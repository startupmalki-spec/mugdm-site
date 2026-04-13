-- Phase 1 — ML Intelligence Layer (part 2)
-- Issue detection, unmet needs, nudges, in-app notifications, + Phase 1 nudge seed rules.
-- See PRD_ML_INTELLIGENCE.md §§6, 7.4, 8.

-- =========================================================================
-- detected_issues (PRD §6.2)
-- =========================================================================
CREATE TABLE IF NOT EXISTS detected_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

    issue_type TEXT NOT NULL CHECK (issue_type IN (
        'bug','ux_confusion','missing_feature','performance','rate_limit','data_quality'
    )),
    severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','wont_fix')),

    title TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL CHECK (source IN ('chat_nlp','behavioral','explicit','system')),
    evidence JSONB DEFAULT '[]'::jsonb,
    feature_area TEXT,

    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    auto_resolved BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_business ON detected_issues(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_status ON detected_issues(status, severity);
CREATE INDEX IF NOT EXISTS idx_issues_type ON detected_issues(issue_type, created_at DESC);

-- =========================================================================
-- issue_aggregates (PRD §6.3) — service-role only
-- =========================================================================
CREATE TABLE IF NOT EXISTS issue_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    issue_type TEXT NOT NULL,
    feature_area TEXT,
    total_count INTEGER NOT NULL DEFAULT 0,
    unique_users_affected INTEGER NOT NULL DEFAULT 0,
    avg_severity NUMERIC(3, 2),

    count_change_pct NUMERIC(5, 2),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_issue_agg UNIQUE (period_start, period_end, issue_type, feature_area)
);

-- =========================================================================
-- unmet_needs (PRD §7.4)
-- =========================================================================
CREATE TABLE IF NOT EXISTS unmet_needs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    need TEXT NOT NULL,
    need_ar TEXT,
    category TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'nice_to_have',
    source TEXT NOT NULL DEFAULT 'chat_nlp',
    evidence TEXT,
    vote_count INTEGER NOT NULL DEFAULT 1,
    canonical_need_id UUID REFERENCES unmet_needs(id),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','planned','shipped','wont_do')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unmet_needs_category ON unmet_needs(category, vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_unmet_needs_status ON unmet_needs(status);

-- =========================================================================
-- nudge_rules + nudge_log (PRD §8.1) — service-role only
-- =========================================================================
CREATE TABLE IF NOT EXISTS nudge_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,

    trigger_conditions JSONB NOT NULL,

    channel TEXT NOT NULL CHECK (channel IN ('in_app','email','both')),
    template_key TEXT NOT NULL,
    template_vars JSONB DEFAULT '{}'::jsonb,

    max_sends_per_user INTEGER NOT NULL DEFAULT 1,
    cooldown_hours INTEGER NOT NULL DEFAULT 72,
    priority INTEGER NOT NULL DEFAULT 50,

    locale TEXT,
    min_health_score INTEGER,
    max_health_score INTEGER,

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nudge_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nudge_rule_id UUID NOT NULL REFERENCES nudge_rules(id),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clicked_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    converted BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_nudge_log_business ON nudge_log(business_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_nudge_log_rule ON nudge_log(nudge_rule_id, sent_at DESC);

-- =========================================================================
-- in_app_notifications (PRD §8.4) — user-visible
-- =========================================================================
CREATE TABLE IF NOT EXISTS in_app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT,
    action_label TEXT,
    type TEXT NOT NULL DEFAULT 'nudge' CHECK (type IN ('nudge','system','celebration')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    dismissed_at TIMESTAMPTZ,
    nudge_rule_id UUID REFERENCES nudge_rules(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notif_business
    ON in_app_notifications(business_id, is_read, created_at DESC);

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE detected_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_aggregates ENABLE ROW LEVEL SECURITY;  -- no policies → service-role only
ALTER TABLE unmet_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nudge_rules ENABLE ROW LEVEL SECURITY;       -- no policies → service-role only
ALTER TABLE nudge_log ENABLE ROW LEVEL SECURITY;         -- no policies → service-role only
ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "detected_issues_select_own" ON detected_issues
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "unmet_needs_select_own" ON unmet_needs
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "in_app_notifications_select_own" ON in_app_notifications
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "in_app_notifications_update_own" ON in_app_notifications
    FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()))
              WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- =========================================================================
-- Phase 1 Nudge Rules (PRD §8.2) — 7 rules, idempotent on name
-- =========================================================================
INSERT INTO nudge_rules
    (name, description, trigger_conditions, channel, template_key, priority, cooldown_hours, max_sends_per_user, is_active)
VALUES
    ('onboarding_stall',
     'User signed up 3+ days ago but has not completed 2 onboarding steps',
     '{"lifecycle_stage":"new","onboarding_steps_done":{"$lt":2},"days_since_signup":{"$gte":3}}'::jsonb,
     'both','nudgeOnboardingStall', 80, 72, 2, true),

    ('first_upload_nudge',
     'Onboarding user has not uploaded anything to bookkeeper after 5 days',
     '{"lifecycle_stage":"onboarding","features_used_not_contains":"bookkeeper_upload","days_since_signup":{"$gte":5}}'::jsonb,
     'in_app','nudgeFirstUpload', 70, 72, 2, true),

    ('compliance_reminder_boost',
     'User has an overdue compliance obligation and health < 50',
     '{"recent_event":"compliance.obligation_overdue","health_score":{"$lt":50}}'::jsonb,
     'email','nudgeComplianceBoost', 90, 72, 3, true),

    ('re_engagement',
     'Previously engaged user is now at_risk and inactive 7+ days',
     '{"lifecycle_stage":"at_risk","days_since_active":{"$gte":7}}'::jsonb,
     'email','nudgeReengagement', 75, 168, 2, true),

    ('feature_discovery',
     'Engaged user (score >= 30) has only touched one feature after 7+ days',
     '{"features_used_count":1,"engagement_score":{"$gte":30},"days_since_signup":{"$gte":7}}'::jsonb,
     'in_app','nudgeFeatureDiscovery', 50, 72, 3, true),

    ('value_celebration',
     'User just hit a new aha moment',
     '{"event_trigger":"value_realization.new_aha"}'::jsonb,
     'in_app','nudgeValueCelebration', 60, 0, 10, true),

    ('churn_prevention',
     'Churn risk >= 70 and user is at_risk or dormant',
     '{"churn_risk_score":{"$gte":70},"lifecycle_stage":{"$in":["at_risk","dormant"]}}'::jsonb,
     'email','nudgeChurnPrevention', 95, 336, 1, true)
ON CONFLICT (name) DO NOTHING;

-- Rollback:
--   DELETE FROM nudge_rules WHERE name IN ('onboarding_stall','first_upload_nudge','compliance_reminder_boost','re_engagement','feature_discovery','value_celebration','churn_prevention');
--   DROP TABLE IF EXISTS in_app_notifications, nudge_log, nudge_rules, unmet_needs, issue_aggregates, detected_issues CASCADE;
