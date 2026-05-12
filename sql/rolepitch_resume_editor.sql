-- RolePitch resume editor — user-authored edits after first tailored PDF.
--
-- `tailored_version` remains the original AI output.
-- `edited_version` stores the user's self-edited version and wins at download.

ALTER TABLE tailored_resumes
  ADD COLUMN IF NOT EXISTS edited_version JSONB,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tailored_resumes_user_edited
  ON tailored_resumes (user_id, edited_at DESC)
  WHERE edited_at IS NOT NULL;
