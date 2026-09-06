-- Persist the visual template selected for each document.
-- The application falls back to `clean` when this migration has not yet been
-- applied, so older deployments remain readable.
alter table if exists public.invoices
  add column if not exists invoice_template text not null default 'clean';

alter table if exists public.estimates
  add column if not exists invoice_template text not null default 'clean';

-- Legacy estimates share the invoices table, so the invoices column covers
-- both legacy invoices and estimates.
