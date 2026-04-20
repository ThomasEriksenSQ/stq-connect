-- News daily table
create table public.news_daily (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  is_current boolean not null default true,
  status text not null default 'ok' check (status in ('ok','empty','error')),
  source_count integer not null default 0,
  company_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb
);

create unique index news_daily_current_per_date
  on public.news_daily(date) where is_current = true;

create index news_daily_date_idx on public.news_daily(date desc);

alter table public.news_daily enable row level security;

create policy "authenticated read news_daily"
  on public.news_daily for select to authenticated using (true);

create policy "service_role manage news_daily"
  on public.news_daily for all to service_role using (true) with check (true);

-- Storage bucket for mirrored news images
insert into storage.buckets (id, name, public)
values ('news-images', 'news-images', true)
on conflict (id) do nothing;

-- Public read of news-images
create policy "Public read news-images"
  on storage.objects for select
  using (bucket_id = 'news-images');

-- Service role manages news-images
create policy "Service role manage news-images"
  on storage.objects for all
  to service_role
  using (bucket_id = 'news-images')
  with check (bucket_id = 'news-images');