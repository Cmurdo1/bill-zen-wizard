-- Server-side enforcement of the Free plan's "5 invoices per month" limit.
--
-- The UI already meters this, but the meter can be bypassed by calling the
-- data API directly. This trigger fails closed at the database level for
-- anything that is not an active paid subscription, so the limit holds no
-- matter how the insert arrives (app, MCP/API, or direct REST call).
--
-- Note: on the legacy schema, estimates share the invoices table, so they
-- count toward the monthly limit — matching the usage meter in the app.

create or replace function public.enforce_free_invoice_monthly_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_status text;
  plan_end timestamptz;
  month_start timestamptz;
  doc_count integer;
begin
  select subscription_status, subscription_end
    into plan_status, plan_end
    from public.profiles
   where id = new.user_id;

  -- Paid plans with a valid subscription end are unlimited.
  if plan_status in
       ('pro', 'business', 'active', 'active_pro', 'active_business', 'trialing')
     and (plan_end is null or plan_end > now()) then
    return new;
  end if;

  month_start := date_trunc('month', now());

  select count(*)
    into doc_count
    from public.invoices
   where user_id = new.user_id
     and created_at >= month_start;

  if doc_count >= 5 then
    raise exception
      'Free plan limit reached: 5 invoices per month. Upgrade to Pro for unlimited invoices.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_free_invoice_monthly_limit_trigger on public.invoices;
create trigger enforce_free_invoice_monthly_limit_trigger
  before insert on public.invoices
  for each row execute function public.enforce_free_invoice_monthly_limit();
