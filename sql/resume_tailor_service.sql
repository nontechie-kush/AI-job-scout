-- Resume Tailor Service — Schema additions
-- Run this in Supabase SQL editor

-- 1. Add structured_resume column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS structured_resume JSONB;

-- 2. Tailored resumes — stores per-job (or general) tailored versions
CREATE TABLE IF NOT EXISTS tailored_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID REFERENCES job_matches(id) ON DELETE SET NULL,
  base_version JSONB NOT NULL,
  tailored_version JSONB NOT NULL,
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  resume_strength INT,
  status TEXT NOT NULL DEFAULT 'draft',
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for tailored_resumes
ALTER TABLE tailored_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tailored resumes"
  ON tailored_resumes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tailored resumes"
  ON tailored_resumes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tailored resumes"
  ON tailored_resumes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tailored resumes"
  ON tailored_resumes FOR DELETE
  USING (auth.uid() = user_id);

-- Index for quick lookup by user + match
CREATE INDEX IF NOT EXISTS idx_tailored_resumes_user_match
  ON tailored_resumes (user_id, match_id);

-- 3. Resume conversations — chat history for content creator agent
CREATE TABLE IF NOT EXISTS resume_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tailored_resume_id UUID REFERENCES tailored_resumes(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for resume_conversations
ALTER TABLE resume_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own resume conversations"
  ON resume_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resume conversations"
  ON resume_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resume conversations"
  ON resume_conversations FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Storage bucket for generated resume PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: users can read their own resume PDFs
CREATE POLICY "Users can read own resumes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policy: service role can insert resume PDFs
CREATE POLICY "Service can upload resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes');
