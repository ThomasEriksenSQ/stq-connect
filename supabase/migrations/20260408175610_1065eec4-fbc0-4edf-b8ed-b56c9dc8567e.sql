create table public.ansatt_aktiviteter (
  id uuid primary key default gen_random_uuid(),
  ansatt_id integer not null,
  type text not null default 'samtale',
  subject text not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid
);

alter table public.ansatt_aktiviteter enable row level security;

create policy "Admin manage ansatt_aktiviteter" on public.ansatt_aktiviteter
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));