-- Phase 1 — ML Intelligence Layer
-- Creates event collection, user profiles, feature adoption, value realization,
-- issue detection, unmet needs, nudge rules + logs, and in-app notifications.
-- See PRD_ML_INTELLIGENCE.md §§4–8. RLS mirrors the pattern from 001.

-- =========================================================================
-- user_events (PRD §4.1) — append-only event firehose
-- =========================================================================
CREATE TABLE IF NOT EXISTS user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    event_name TEXT NOT NULL,
    event_category TEXT NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    session_id UUID,
    page_path TEXT,
    locale TEXT CHECK (locale IN ('en', 'ar')),
    device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_events_business ON user_events(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_name ON user_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_category ON user_events(event_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_session ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id, created_at DESC);

-- =========================================================================
-- user_profiles (PRD §5.1) — one row per business, recomputed every 6h
-- =========================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- Scores (0-100)
    engagement_score INTEGER NOT NULL DEFAULT 0,
    health_score INTEGER NOT NULL DEFAULT 0,
    churn_risk_score INTEGER NOT NULL DEFAULT 0,

    -- Activity
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_events INTEGER NOT NULL DEFAULT 0,
    last_active_at TIMESTAMPTZ,
    days_since_signup INTEGER NOT NULL DEFAULT 0,
    days_active_last_30 INTEGER NOT NULL DEFAULT 0,
    avg_session_duration_ms INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,

    -- Feature usage
    features_used TEXT[] DEFAULT '{}',
    features_used_count INTEGER NOT NULL DEFAULT 0,
    primary_feature TEXT,
    primary_locale TEXT DEFAULT 'en',

    -- Onboarding
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    onboarding_steps_done INTEGER NOT NULL DEFAULT 0,
    onboarding_stalled_at TEXT,

    -- AI usage
    total_ai_calls INTEGER NOT NULL DEFAULT 0,
    ai_calls_last_7d INTEGER NOT NULL DEFAULT 0,
    chat_messages_total INTEGER NOT NULL DEFAULT 0,
    avg_chat_satisfaction NUMERIC(3, 2),

    -- Frustration signals
    frustration_events_7d INTEGER NOT NULL DEFAULT 0,
    errors_encountered_7d INTEGER NOT NULL DEFAULT 0,
    rate_limits_hit_7d INTEGER NOT NULL DEFAULT 0,
    unresolved_issues TEXT[] DEFAULT '{}',

    -- Lifecycle
    lifecycle_stage TEXT NOT NULL DEFAULT 'new',
    lifecycle_changed_at TIMESTAMPTZ,

    -- Nudge tracking
    last_nudge_sent_at TIMESTAMPTZ,
    nudges_sent_total INTEGER NOT NULL DEFAULT 0,
    nudges_clicked_total INTEGER NOT NULL DEFAULT 0,

    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_user_profiles_lifecycle CHECK (lifecycle_stage IN
        ('new','onboarding','activated','engaged','at_risk','dormant','churned'))
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_lifecycle ON user_profiles(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_user_profiles_churn ON user_profiles(churn_risk_score DESC);

-- =========================================================================
-- feature_adoption (PRD §7.2) — per-business, per-feature usage
-- =========================================================================
CREATE TABLE IF NOT EXISTS feature_adoption (
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    first_used_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL,
    usage_count_total INTEGER NOT NULL DEFAULT 1,
    usage_count_7d INTEGER NOT NULL DEFAULT 0,
    usage_count_30d INTEGER NOT NULL DEFAULT 0,
    days_since_signup_at_first_use INTEGER,

    PRIMARY KEY (business_id, feature_name)
);

-- =========================================================================
-- value_realization (PRD §7.3) — aha moments + TTV
-- =========================================================================
CREATE TABLE IF NOT EXISTS value_realization (
    business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    first_aha_moment TEXT,
    first_aha_at TIMESTAMPTZ,
    time_to_value_hours NUMERIC(10, 2),
    aha_moments_total INTEGER NOT NULL DEFAULT 0,
    aha_moments JSONB DEFAULT '[]'::jsonb,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- RLS — per-business reads, service_role writes for profile-derived tables
-- =========================================================================
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_adoption ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_realization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_events_select_own" ON user_events
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "user_events_insert_own" ON user_events
    FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "user_profiles_select_own" ON user_profiles
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
-- user_profiles writes happen via service role (compute-profiles edge function).

CREATE POLICY "feature_adoption_select_own" ON feature_adoption
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "value_realization_select_own" ON value_realization
    FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Rollback:
--   DROP TABLE IF EXISTS value_realization, feature_adoption, user_profiles, user_events CASCADE;
