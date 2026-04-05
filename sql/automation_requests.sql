-- automation_requests: tracks each batch automation request as a first-class entity
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS automation_requests (
  id              UUID PRIMARY KEY,              -- = batch_id from outreach_queue
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email      TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT 'unknown', -- 'mobile' | 'extension'
  script_version  TEXT NOT NULL DEFAULT '',
  profile_ids     JSONB NOT NULL DEFAULT '[]',     -- array of recruiter_match_ids
  profile_results JSONB NOT NULL DEFAULT '{}',     -- { match_id: { status, detail, completed_at } }
  total_profiles  INT NOT NULL DEFAULT 0,
  sent_count      INT NOT NULL DEFAULT 0,
  failed_count    INT NOT NULL DEFAULT 0,
  failure_buckets JSONB NOT NULL DEFAULT '{}',     -- { "restricted": 1, "limit_hit": 2 }
  status          TEXT NOT NULL DEFAULT 'in_progress', -- in_progress | completed | partially_completed | cancelled
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Index for founder queries
CREATE INDEX idx_automation_requests_created ON automation_requests (created_at DESC);
CREATE INDEX idx_automation_requests_user    ON automation_requests (user_id, created_at DESC);

-- RLS: users can read/write their own rows; service role can do anything
ALTER TABLE automation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automation requests"
  ON automation_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own automation requests"
  ON automation_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation requests"
  ON automation_requests FOR UPDATE
  USING (auth.uid() = user_id);
