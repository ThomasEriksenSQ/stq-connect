ALTER TABLE public.contacts DROP CONSTRAINT contacts_owner_id_fkey;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);