-- Expand profiles.source check to allow 'image' (RolePitch screenshots flow).
-- Existing values: pdf, website, text, linkedin_pdf
-- Adding: image

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_source_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_source_check
  CHECK (source IN ('pdf','website','text','linkedin_pdf','image'));
