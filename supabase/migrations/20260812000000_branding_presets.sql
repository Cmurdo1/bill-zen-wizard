-- Branding presets: multiple saved brand identities per account.
-- Pro/Business users can save several "brands" (e.g. two companies they
-- invoice under) and pick one per document.
create table if not exists public.branding_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  business_name text not null default '',
  logo_url text,
  brand_color text,
  estimate_color text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  country text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists branding_presets_user_id_idx
  on public.branding_presets (user_id);

-- Keep only one default preset per user.
create unique index if not exists branding_presets_one_default_per_user
  on public.branding_presets (user_id)
  where is_default;

alter table public.branding_presets enable row level security;

drop policy if exists "Users can view own branding presets" on public.branding_presets;
create policy "Users can view own branding presets"
  on public.branding_presets for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own branding presets" on public.branding_presets;
create policy "Users can create own branding presets"
  on public.branding_presets for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own branding presets" on public.branding_presets;
create policy "Users can update own branding presets"
  on public.branding_presets for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own branding presets" on public.branding_presets;
create policy "Users can delete own branding presets"
  on public.branding_presets for delete
  using (auth.uid() = user_id);

-- Track which preset a document was created under so PDFs and emails use the
-- right brand identity even if the account default changes later.
alter table public.invoices
  add column if not exists branding_preset_id uuid
  references public.branding_presets (id) on delete set null;

-- New-schema deployments keep estimates in a dedicated table. Legacy
-- deployments store estimates inside invoices, so only add the column
-- when the estimates table exists.
do $$
begin
  if to_regclass('public.estimates') is not null then
    alter table public.estimates
      add column if not exists branding_preset_id uuid
      references public.branding_presets (id) on delete set null;
  end if;
end
$$;
