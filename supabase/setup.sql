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

-- Optional: create the receipts bucket via SQL (works only with sufficient privileges).
-- If this fails, create a private bucket named "receipts" in the Supabase dashboard.
-- insert into storage.buckets (id, name, public)
-- values ('receipts', 'receipts', false)
-- on conflict (id) do nothing;
