-- Resume Tailor v2 — schema for knowledge-base-driven composition
-- Design: careerpilot-ai/docs/resume-tailor-v2.md
-- Run in Supabase SQL editor.

-- ─── 1. Extend user_experience_memory to hold atoms from original resume ───

ALTER TABLE user_experience_memory
  ADD COLUMN IF NOT EXISTS source_type TEXT
    CHECK (source_type IN ('original_resume', 'chat_extraction', 'manual'))
    NOT NULL DEFAULT 'chat_extraction',
  ADD COLUMN IF NOT EXISTS source_bullet_id TEXT,
  ADD COLUMN IF NOT EXISTS source_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS pinned_for_clusters TEXT[] NOT NULL DEFAULT '{}';

-- Index for atom retrieval per user (already have user_id index)
CREATE INDEX IF NOT EXISTS idx_uem_source_profile ON user_experience_memory (source_profile_id);
CREATE INDEX IF NOT EXISTS idx_uem_user_source_type ON user_experience_memory (user_id, source_type);

-- ─── 2. Cluster classification cache on jobs ───

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS cluster_id TEXT,
  ADD COLUMN IF NOT EXISTS seniority_band TEXT,
  ADD COLUMN IF NOT EXISTS cluster_confidence NUMERIC(3,2);

CREATE INDEX IF NOT EXISTS idx_jobs_cluster ON jobs (cluster_id, seniority_band);

-- ─── 3. Resume story briefs — cached per (user, cluster, seniority) ───

CREATE TABLE IF NOT EXISTS resume_story_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  cluster_id TEXT NOT NULL,
  seniority_band TEXT NOT NULL,

  positioning TEXT NOT NULL,
  key_themes TEXT[] NOT NULL DEFAULT '{}',
  caliber_signals TEXT[] NOT NULL DEFAULT '{}',

  -- Bumps when atoms added/changed for this user
  knowledge_base_version INT NOT NULL DEFAULT 1,
  -- Jobs that justified this brief (for audit)
  source_match_ids UUID[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, cluster_id, seniority_band)
);

ALTER TABLE resume_story_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own briefs"
  ON resume_story_briefs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own briefs"
  ON resume_story_briefs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own briefs"
  ON resume_story_briefs FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_briefs_user_cluster
  ON resume_story_briefs (user_id, cluster_id, seniority_band);

-- ─── 4. Knowledge-base version counter on profiles ───
-- Bumps every time atoms are added/edited so cached briefs know to invalidate.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS knowledge_base_version INT NOT NULL DEFAULT 1;

-- ─── 5. Extend tailored_resumes for v2 flow ───

ALTER TABLE tailored_resumes
  ADD COLUMN IF NOT EXISTS story_brief_id UUID REFERENCES resume_story_briefs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_atom_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reused_from UUID REFERENCES tailored_resumes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_version TEXT NOT NULL DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_tr_user_pipeline ON tailored_resumes (user_id, pipeline_version, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tr_reused_from ON tailored_resumes (reused_from);
