
-- Add linkedin and location fields to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS linkedin text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS location text;
