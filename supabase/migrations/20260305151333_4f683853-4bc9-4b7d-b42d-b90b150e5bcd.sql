
-- 1. Fix SELECT policies: scope to owner (created_by)
-- Companies
DROP POLICY IF EXISTS "Authenticated users can read companies" ON public.companies;
CREATE POLICY "Users read own companies" ON public.companies
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Contacts
DROP POLICY IF EXISTS "Authenticated users can read contacts" ON public.contacts;
CREATE POLICY "Users read own contacts" ON public.contacts
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Activities
DROP POLICY IF EXISTS "Authenticated users can read activities" ON public.activities;
CREATE POLICY "Users read own activities" ON public.activities
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Tasks
DROP POLICY IF EXISTS "Authenticated users can read tasks" ON public.tasks;
CREATE POLICY "Users read own tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR assigned_to = auth.uid());

-- 2. Fix UPDATE policies: scope to owner
DROP POLICY IF EXISTS "Authenticated users can update companies" ON public.companies;
CREATE POLICY "Owners update companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can update contacts" ON public.contacts;
CREATE POLICY "Owners update contacts" ON public.contacts
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
CREATE POLICY "Owners update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR assigned_to = auth.uid())
  WITH CHECK (created_by = auth.uid() OR assigned_to = auth.uid());

-- 3. Fix INSERT policies: enforce created_by = auth.uid()
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.companies;
CREATE POLICY "Users insert own companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contacts;
CREATE POLICY "Users insert own contacts" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can insert activities" ON public.activities;
CREATE POLICY "Users insert own activities" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;
CREATE POLICY "Users insert own tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
