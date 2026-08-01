ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_accent_color text,
  ADD COLUMN IF NOT EXISTS brand_tagline text,
  ADD COLUMN IF NOT EXISTS document_footer_text text,
  ADD COLUMN IF NOT EXISTS brand_show_logo boolean NOT NULL DEFAULT true;