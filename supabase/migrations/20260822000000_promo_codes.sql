-- Promo codes: grant a free Pro trial (or other plan) for a fixed duration.
--
-- Redemption is handled server-side (src/lib/promo.functions.ts) using the
-- service role, so these tables expose no policies to authenticated users.
-- A user may redeem a given code at most once, and only while they have no
-- active paid plan, which prevents trial stacking.

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'pro',
  duration_days INTEGER NOT NULL DEFAULT 90,
  max_uses INTEGER, -- NULL = unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_plan TEXT NOT NULL,
  granted_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (promo_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON public.promo_redemptions(user_id);

GRANT ALL ON public.promo_codes TO service_role;
GRANT ALL ON public.promo_redemptions TO service_role;

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (server functions) can read/write these.

-- Seed the default 3-month Pro trial code. One redemption per account.
INSERT INTO public.promo_codes (code, plan, duration_days, max_uses)
VALUES ('FREETRIAL', 'pro', 90, NULL)
ON CONFLICT (code) DO NOTHING;
