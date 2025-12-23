create table if not exists public.app_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_secrets_updated_at on public.app_secrets;
create trigger trg_app_secrets_updated_at
before update on public.app_secrets
for each row
execute function public.set_updated_at();

alter table public.app_secrets enable row level security;

drop policy if exists "app_secrets_service_role_only" on public.app_secrets;
create policy "app_secrets_service_role_only"
  on public.app_secrets
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.push_subscriptions (
  device_id text primary key,
  endpoint text not null,
  keys jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trg_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_service_role_only" on public.push_subscriptions;
create policy "push_subscriptions_service_role_only"
  on public.push_subscriptions
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.push_budget_alerts_sent (
  year int not null,
  month text not null,
  category text not null,
  threshold numeric not null,
  total numeric,
  budget numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (year, month, category, threshold)
);

drop trigger if exists trg_push_budget_alerts_sent_updated_at on public.push_budget_alerts_sent;
create trigger trg_push_budget_alerts_sent_updated_at
before update on public.push_budget_alerts_sent
for each row
execute function public.set_updated_at();

alter table public.push_budget_alerts_sent enable row level security;

drop policy if exists "push_budget_alerts_sent_service_role_only" on public.push_budget_alerts_sent;
create policy "push_budget_alerts_sent_service_role_only"
  on public.push_budget_alerts_sent
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.push_weekly_digests_sent (
  week_start_date date primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_push_weekly_digests_sent_updated_at on public.push_weekly_digests_sent;
create trigger trg_push_weekly_digests_sent_updated_at
before update on public.push_weekly_digests_sent
for each row
execute function public.set_updated_at();

alter table public.push_weekly_digests_sent enable row level security;

drop policy if exists "push_weekly_digests_sent_service_role_only" on public.push_weekly_digests_sent;
create policy "push_weekly_digests_sent_service_role_only"
  on public.push_weekly_digests_sent
  for all
  to service_role
  using (true)
  with check (true);

-- Optional: create the receipts bucket via SQL (works only with sufficient privileges).
-- If this fails, create a private bucket named "receipts" in the Supabase dashboard.
-- insert into storage.buckets (id, name, public)
-- values ('receipts', 'receipts', false)
-- on conflict (id) do nothing;
