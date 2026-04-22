ALTER TABLE public.sent_cv_log
  ADD COLUMN IF NOT EXISTS message_preview text,
  ADD COLUMN IF NOT EXISTS message_body_text text;
