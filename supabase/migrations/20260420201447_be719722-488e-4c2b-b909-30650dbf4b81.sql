create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Fjern eksisterende job hvis den finnes
do $$
begin
  perform cron.unschedule('news-daily-digest');
exception when others then null;
end $$;

select cron.schedule(
  'news-daily-digest',
  '30 4 * * *',
  $job$
  select net.http_post(
    url := 'https://kbvzpcebfopqqrvmbiap.supabase.co/functions/v1/news-daily-digest',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTgyNTEsImV4cCI6MjA4ODI5NDI1MX0.t_bvITh_RxMfYdutsqHD-IkArlcD8I7au5vxBkt0aVY"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $job$
);