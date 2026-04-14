-- User Experience Memory — durable nuggets extracted from resume conversations
-- Builds a user-scoped knowledge graph of achievements, skills, and context
-- that accumulates across tailoring sessions. After N sessions, the Content
-- Creator agent can infer bullet points from stored nuggets instead of
-- re-asking the same STAR questions.

CREATE TABLE IF NOT EXISTS user_experience_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Type of nugget
  -- 'achievement' — a concrete outcome with metrics ("drove 40% retention lift")
  -- 'skill_usage' — demonstrated use of a skill ("used SQL for cohort analysis at Acme")
  -- 'context'     — situational background ("team of 4, reported to CPO")
  -- 'metric'      — standalone quantitative fact ("managed $2M P&L")
  nugget_type TEXT NOT NULL CHECK (nugget_type IN ('achievement', 'skill_usage', 'context', 'metric')),

  -- Where/when this fact applies
  company TEXT,
  role TEXT,

  -- The fact itself — written in a way that can be dropped into a prompt verbatim
  fact TEXT NOT NULL,

  -- Structured metric for filtering/ranking
  -- e.g., {value: 40, unit: "percent", type: "retention_lift"}
  metric JSONB,

  -- Tags for retrieval — e.g., ['retention', 'lifecycle-email', 'growth']
  tags TEXT[] NOT NULL DEFAULT '{}',

  -- 0.00-1.00 — how confident we are this is accurate based on source
  confidence NUMERIC(3,2) DEFAULT 0.80 CHECK (confidence >= 0 AND confidence <= 1),

  -- Provenance
  source_match_id UUID REFERENCES job_matches(id) ON DELETE SET NULL,
  source_conversation_id UUID REFERENCES resume_conversations(id) ON DELETE SET NULL,

  extracted_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  use_count INT DEFAULT 0
);

-- Retrieval indexes
CREATE INDEX IF NOT EXISTS idx_uem_user_tags ON user_experience_memory USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_uem_user_id ON user_experience_memory (user_id);
CREATE INDEX IF NOT EXISTS idx_uem_user_company ON user_experience_memory (user_id, company);
CREATE INDEX IF NOT EXISTS idx_uem_user_type ON user_experience_memory (user_id, nugget_type);

-- RLS
ALTER TABLE user_experience_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memory"
  ON user_experience_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memory"
  ON user_experience_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memory"
  ON user_experience_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memory"
  ON user_experience_memory FOR DELETE
  USING (auth.uid() = user_id);
