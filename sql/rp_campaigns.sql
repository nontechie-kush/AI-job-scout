-- RolePitch referral / UTM campaigns.
-- Run in Supabase SQL editor (project: xgjwdnidsrrxabivbiaw).

-- ─── 1. Campaigns table ────────────────────────────────────────────────
-- One row per mintable referral link. Code is short + URL-safe.
CREATE TABLE IF NOT EXISTS rp_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,        -- e.g. 'WHATSAPP-APR27' or 'WA8K2F'
  name            TEXT NOT NULL,                -- internal label: "WhatsApp PM group, 27 Apr"
  bonus_pitches   INTEGER NOT NULL DEFAULT 10,  -- credits granted on signup
  expires_at      TIMESTAMPTZ NOT NULL,         -- hard cutoff
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_content     TEXT,
  click_count     INTEGER NOT NULL DEFAULT 0,
  signup_count    INTEGER NOT NULL DEFAULT 0,   -- distinct users who redeemed
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      TEXT,                          -- email of admin who minted
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rp_campaigns_code ON rp_campaigns(code);
CREATE INDEX IF NOT EXISTS idx_rp_campaigns_active ON rp_campaigns(active, expires_at);

-- ─── 2. Redemptions table ─────────────────────────────────────────────
-- One row per (campaign, user). Prevents double-grant.
CREATE TABLE IF NOT EXISTS rp_campaign_redemptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES rp_campaigns(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted       INTEGER NOT NULL,
  redeemed_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rp_redemptions_campaign ON rp_campaign_redemptions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_rp_redemptions_user ON rp_campaign_redemptions(user_id);

-- ─── 3. Atomic redeem RPC ─────────────────────────────────────────────
-- Single transaction: validate campaign + insert redemption + grant credits.
-- Returns: { granted: int, total_credits: int, error: text | null }
CREATE OR REPLACE FUNCTION redeem_campaign(
  p_user_id UUID,
  p_code    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign rp_campaigns%ROWTYPE;
  v_new_credits INTEGER;
BEGIN
  SELECT * INTO v_campaign FROM rp_campaigns
    WHERE code = p_code AND active = TRUE
    LIMIT 1;

  IF v_campaign.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or inactive campaign code');
  END IF;

  IF v_campaign.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'Campaign has expired');
  END IF;

  -- Already redeemed?
  IF EXISTS (SELECT 1 FROM rp_campaign_redemptions WHERE campaign_id = v_campaign.id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('error', 'Already redeemed');
  END IF;

  -- Insert redemption + grant credits + bump signup_count atomically
  INSERT INTO rp_campaign_redemptions (campaign_id, user_id, granted)
    VALUES (v_campaign.id, p_user_id, v_campaign.bonus_pitches);

  UPDATE users
    SET pitch_credits = pitch_credits + v_campaign.bonus_pitches
    WHERE id = p_user_id
    RETURNING pitch_credits INTO v_new_credits;

  UPDATE rp_campaigns
    SET signup_count = signup_count + 1
    WHERE id = v_campaign.id;

  RETURN jsonb_build_object(
    'granted', v_campaign.bonus_pitches,
    'total_credits', v_new_credits,
    'campaign_name', v_campaign.name
  );
END;
$$;

-- ─── 4. Click increment RPC (lightweight, called on landing) ──────────
CREATE OR REPLACE FUNCTION bump_campaign_click(p_code TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE rp_campaigns SET click_count = click_count + 1
    WHERE code = p_code AND active = TRUE AND expires_at > NOW();
$$;

-- ─── 5. Reduce default free pitches: 10 → 5 ──────────────────────────
-- Existing users keep what they have. Only new signups get 5.
ALTER TABLE users ALTER COLUMN pitch_credits SET DEFAULT 5;

-- ─── 6. Keep signup_count consistent when a user is deleted ──────────
-- ON DELETE CASCADE removes the redemption row but not the cached count
-- on rp_campaigns. This trigger reconciles it on every redemption delete.
CREATE OR REPLACE FUNCTION decrement_campaign_signup_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE rp_campaigns
    SET signup_count = GREATEST(signup_count - 1, 0)
    WHERE id = OLD.campaign_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_campaign_signup_count ON rp_campaign_redemptions;
CREATE TRIGGER trg_decrement_campaign_signup_count
  AFTER DELETE ON rp_campaign_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION decrement_campaign_signup_count();
