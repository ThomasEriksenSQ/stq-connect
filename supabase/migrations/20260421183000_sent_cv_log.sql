CREATE TABLE public.sent_cv_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ansatt_id integer NOT NULL REFERENCES public.stacq_ansatte(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_email text NOT NULL,
  recipient_email text NOT NULL,
  message_id text NOT NULL,
  message_web_link text,
  message_subject text,
  attachment_name text NOT NULL,
  contact_name_snapshot text,
  company_name_snapshot text,
  contact_title_snapshot text,
  sent_at timestamptz NOT NULL,
  employee_match_score integer,
  employee_match_basis text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sent_cv_log_unique_message_recipient_attachment
    UNIQUE (sender_email, message_id, ansatt_id, recipient_email, attachment_name)
);

CREATE INDEX sent_cv_log_ansatt_id_sent_at_idx
  ON public.sent_cv_log (ansatt_id, sent_at DESC);

CREATE INDEX sent_cv_log_contact_id_idx
  ON public.sent_cv_log (contact_id);

CREATE INDEX sent_cv_log_company_id_idx
  ON public.sent_cv_log (company_id);

ALTER TABLE public.sent_cv_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sent_cv_log"
  ON public.sent_cv_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin manage sent_cv_log"
  ON public.sent_cv_log
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.outlook_sent_cv_sync_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_synced_at timestamptz,
  last_scan_started_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outlook_sent_cv_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage outlook_sent_cv_sync_state"
  ON public.outlook_sent_cv_sync_state
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-sent-cvs-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'sync-sent-cvs-daily',
  '15 5 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://kbvzpcebfopqqrvmbiap.supabase.co/functions/v1/sync-sent-cvs',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtidnpwY2ViZm9wcXFydm1iaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTgyNTEsImV4cCI6MjA4ODI5NDI1MX0.t_bvITh_RxMfYdutsqHD-IkArlcD8I7au5vxBkt0aVY"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $job$
);
