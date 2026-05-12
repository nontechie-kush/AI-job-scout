-- rp_drafts — server-owned state for the RolePitch tailor flow.
-- Mirrors the rp_critiques pattern: anonymous user starts a draft, signup
-- claims it via claim-draft, atomic promotion into profiles + tailored_resumes.
--
-- Replaces the localStorage-as-state-of-truth design that lost Vshrant's
-- pitch on 2026-05-02 (step=6 OAuth-return path didn't fire, tailored result
-- never reached the DB).

CREATE TABLE IF NOT EXISTS public.rp_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- nullable until claimed; set by claim-draft
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- extracted from parsed_resume.contact.email by parse-resume so we can
  -- claim by email as a fallback (same pattern as rp_critiques.email).
  email           TEXT,

  -- resume side
  parsed_resume   JSONB,
  parsed_source   TEXT CHECK (parsed_source IS NULL OR parsed_source IN ('pdf','website','text','linkedin_pdf','image')),

  -- JD side. We keep BOTH a denormalized snapshot (so anonymous users can
  -- generate a tailor without writing to job_descriptions yet) AND a foreign
  -- key once the JD has been promoted to job_descriptions.
  jd_id           UUID REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
  jd_snapshot     JSONB,

  -- tailor result + chat context
  tailored        JSONB,
  before_score    INT,
  after_score     INT,
  gap_questions   JSONB,
  gap_answers     JSONB,

  -- lifecycle
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','claimed','expired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days'
);

-- Plain index on email + user_id null-ness for the claim-by-email fallback.
-- Can't include `expires_at > now()` in the predicate because index predicates
-- must be immutable and now() isn't. The expires_at filter is applied at
-- query time in claim-draft, which still uses this index.
CREATE INDEX IF NOT EXISTS rp_drafts_email_unclaimed_idx
  ON public.rp_drafts (email)
  WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS rp_drafts_user_id_idx ON public.rp_drafts (user_id);

ALTER TABLE public.rp_drafts ENABLE ROW LEVEL SECURITY;

-- Anonymous: can READ + UPDATE drafts that are not yet claimed and not expired.
-- The id is unguessable (UUID) — same security model as rp_critiques.
DROP POLICY IF EXISTS rp_drafts_anon_read ON public.rp_drafts;
CREATE POLICY rp_drafts_anon_read ON public.rp_drafts FOR SELECT
  USING (user_id IS NULL AND expires_at > now());

DROP POLICY IF EXISTS rp_drafts_anon_update ON public.rp_drafts;
CREATE POLICY rp_drafts_anon_update ON public.rp_drafts FOR UPDATE
  USING (user_id IS NULL AND expires_at > now())
  WITH CHECK (user_id IS NULL AND expires_at > now());

-- Anyone can INSERT a fresh draft (anonymous flow).
DROP POLICY IF EXISTS rp_drafts_anon_insert ON public.rp_drafts;
CREATE POLICY rp_drafts_anon_insert ON public.rp_drafts FOR INSERT
  WITH CHECK (user_id IS NULL);

-- Owners: read their own drafts post-claim.
DROP POLICY IF EXISTS rp_drafts_owner_read ON public.rp_drafts;
CREATE POLICY rp_drafts_owner_read ON public.rp_drafts FOR SELECT
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.rp_drafts_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rp_drafts_updated_at ON public.rp_drafts;
CREATE TRIGGER rp_drafts_updated_at
  BEFORE UPDATE ON public.rp_drafts
  FOR EACH ROW EXECUTE FUNCTION public.rp_drafts_set_updated_at();
