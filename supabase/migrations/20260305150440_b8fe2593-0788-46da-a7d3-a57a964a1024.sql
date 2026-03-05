
-- Companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  org_number TEXT,
  industry TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  zip_code TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'note',
  subject TEXT NOT NULL,
  description TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium',
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can read all CRM data
CREATE POLICY "Authenticated users can read companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update companies" ON public.companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete companies" ON public.companies FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read activities" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can delete activities" ON public.activities FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
