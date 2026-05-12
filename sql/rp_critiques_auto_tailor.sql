-- Add columns needed for the post-signup auto-tailor flow.
-- Run in Supabase SQL editor (project: xgjwdnidsrrxabivbiaw).
--
-- parsed_resume: stores the structured JSON from parse-resume so the auto-tailor
--                doesn't need the user to re-upload after sign-up.
-- inferred_target: stores the target role + seniority + domain that critique
--                  inferred from the resume (or extracted from user-stated target).
ALTER TABLE rp_critiques ADD COLUMN IF NOT EXISTS parsed_resume jsonb;
ALTER TABLE rp_critiques ADD COLUMN IF NOT EXISTS inferred_target jsonb;
