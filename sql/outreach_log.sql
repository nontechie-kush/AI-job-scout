-- Outreach log: records every transactional/manual email sent to RolePitch users.
-- Run in Supabase SQL editor (project: xgjwdnidsrrxabivbiaw).

CREATE TABLE IF NOT EXISTS outreach_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email        TEXT NOT NULL,
  from_email      TEXT NOT NULL,
  template        TEXT,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  resend_id       TEXT,
  status          TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed')),
  error           TEXT,
  sent_by         TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_log_user ON outreach_log (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_log_to ON outreach_log (to_email, sent_at DESC);
