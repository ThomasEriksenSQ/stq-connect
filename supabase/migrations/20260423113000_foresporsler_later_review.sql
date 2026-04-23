CREATE TABLE public.foresporsler_konsulenter_senere (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foresporsler_id bigint NOT NULL REFERENCES public.foresporsler(id) ON DELETE CASCADE,
  ansatt_id integer REFERENCES public.stacq_ansatte(id) ON DELETE CASCADE,
  ekstern_id uuid REFERENCES public.external_consultants(id) ON DELETE CASCADE,
  konsulent_type text NOT NULL DEFAULT 'intern' CHECK (konsulent_type IN ('intern', 'ekstern')),
  notify_user_id uuid NOT NULL,
  notify_on_pipeline_exit boolean NOT NULL DEFAULT false,
  notify_email_date date,
  date_notification_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  pipeline_notification_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  pipeline_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT foresporsler_konsulenter_senere_one_ref CHECK (
    (ansatt_id IS NOT NULL AND ekstern_id IS NULL) OR
    (ansatt_id IS NULL AND ekstern_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX foresporsler_konsulenter_senere_ansatt_unique
  ON public.foresporsler_konsulenter_senere (foresporsler_id, ansatt_id)
  WHERE ansatt_id IS NOT NULL;

CREATE UNIQUE INDEX foresporsler_konsulenter_senere_ekstern_unique
  ON public.foresporsler_konsulenter_senere (foresporsler_id, ekstern_id)
  WHERE ekstern_id IS NOT NULL;

ALTER TABLE public.foresporsler_konsulenter_senere ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read foresporsler_konsulenter_senere"
  ON public.foresporsler_konsulenter_senere FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin insert foresporsler_konsulenter_senere"
  ON public.foresporsler_konsulenter_senere FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update foresporsler_konsulenter_senere"
  ON public.foresporsler_konsulenter_senere FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete foresporsler_konsulenter_senere"
  ON public.foresporsler_konsulenter_senere FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
