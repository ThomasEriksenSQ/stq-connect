ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

