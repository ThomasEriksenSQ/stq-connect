create table if not exists public.website_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  full_name text not null,
  email text not null,
  phone text,
  cv_url text
);

alter table public.website_applications enable row level security;

create policy "Authenticated users can read applications"
  on public.website_applications for select
  to authenticated using (true);

create policy "Anyone can insert applications"
  on public.website_applications for insert
  to anon, authenticated with check (true);