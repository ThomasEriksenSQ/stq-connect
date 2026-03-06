
-- Add owner_id to companies
ALTER TABLE public.companies ADD COLUMN owner_id uuid REFERENCES public.profiles(id);

-- Update RLS: companies
DROP POLICY "Users read own companies" ON public.companies;
CREATE POLICY "Admin and owner read companies" ON public.companies FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Owners update companies" ON public.companies;
CREATE POLICY "Admin and owner update companies" ON public.companies FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Users insert own companies" ON public.companies;
CREATE POLICY "Authenticated insert companies" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (true);

-- Update RLS: contacts
DROP POLICY "Users read own contacts" ON public.contacts;
CREATE POLICY "Admin and owner read contacts" ON public.contacts FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Owners update contacts" ON public.contacts;
CREATE POLICY "Admin and owner update contacts" ON public.contacts FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Users insert own contacts" ON public.contacts;
CREATE POLICY "Authenticated insert contacts" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (true);

-- Update RLS: tasks
DROP POLICY "Users read own tasks" ON public.tasks;
CREATE POLICY "Admin and owner read tasks" ON public.tasks FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR assigned_to = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Owners update tasks" ON public.tasks;
CREATE POLICY "Admin and owner update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR assigned_to = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR assigned_to = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Users insert own tasks" ON public.tasks;
CREATE POLICY "Authenticated insert tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (true);

-- Update RLS: activities
DROP POLICY "Users read own activities" ON public.activities;
CREATE POLICY "Admin and owner read activities" ON public.activities FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Users insert own activities" ON public.activities;
CREATE POLICY "Authenticated insert activities" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (true);
