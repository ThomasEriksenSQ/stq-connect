
-- Tighten INSERT policies to require admin role
DROP POLICY "Authenticated insert companies" ON public.companies;
CREATE POLICY "Admin insert companies" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Authenticated insert contacts" ON public.contacts;
CREATE POLICY "Admin insert contacts" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Authenticated insert tasks" ON public.tasks;
CREATE POLICY "Admin insert tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Authenticated insert activities" ON public.activities;
CREATE POLICY "Admin insert activities" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
