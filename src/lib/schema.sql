-- Neo Neon DB schema
-- Run via GET /api/migrate (requires ALLOW_MIGRATE=true in Vercel env)

CREATE TABLE IF NOT EXISTS neo_user_notes (
  bundle_id  BIGINT PRIMARY KEY,
  note       TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS neo_pmf_feedback (
  id                SERIAL PRIMARY KEY,
  account_id        BIGINT,
  customer_id       BIGINT,
  product           TEXT,
  score             TEXT,
  feedback_text     TEXT,
  submitted_at      TIMESTAMPTZ,
  tally_form_id     TEXT,
  tally_response_id TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS neo_pmf_feedback_account_id  ON neo_pmf_feedback(account_id);
CREATE INDEX IF NOT EXISTS neo_pmf_feedback_customer_id ON neo_pmf_feedback(customer_id);
CREATE INDEX IF NOT EXISTS neo_pmf_feedback_product     ON neo_pmf_feedback(product)
