-- Enable multi-business support per user
-- The app UI (BusinessProvider, business switcher) supports multiple businesses
-- but the DB had a UNIQUE constraint limiting one business per user.

-- Forward: drop the unique constraint on user_id so one user can own multiple businesses
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS uq_businesses_user_id;

-- The existing index on businesses(user_id) remains for query performance.
-- RLS policies already use `WHERE user_id = auth.uid()` which correctly returns
-- all businesses owned by the user — no RLS changes needed.

-- Rollback: ALTER TABLE businesses ADD CONSTRAINT uq_businesses_user_id UNIQUE (user_id);
