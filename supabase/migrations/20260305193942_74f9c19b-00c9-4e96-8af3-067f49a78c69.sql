-- Insert Thomas profile
INSERT INTO public.profiles (id, full_name)
VALUES ('877c63e8-a70c-4b78-9258-3dc8b1bf3c20', 'Thomas')
ON CONFLICT (id) DO NOTHING;

-- Delete in FK order
DELETE FROM activities;
DELETE FROM tasks;
DELETE FROM contacts;
DELETE FROM companies WHERE id IN (
  '732d5e31-b72d-4124-8f50-c7b99dbd01fb',
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
);

-- New companies
INSERT INTO companies (id, name, industry, city, status, created_by) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Equinor ASA', 'Energi', 'Stavanger', 'active', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('c0000000-0000-0000-0000-000000000002', 'DNB ASA', 'Finans', 'Oslo', 'active', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('c0000000-0000-0000-0000-000000000003', 'Telenor ASA', 'Telekom', 'Oslo', 'active', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20');

-- New contacts with Thomas as owner
INSERT INTO contacts (id, first_name, last_name, email, phone, title, company_id, owner_id, created_by, location) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Anders', 'Lie', 'anders.lie@equinor.com', '+47 912 34 567', 'VP Engineering', 'c0000000-0000-0000-0000-000000000001', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', 'Stavanger'),
  ('d0000000-0000-0000-0000-000000000002', 'Silje', 'Nordmann', 'silje.nordmann@dnb.no', '+47 923 45 678', 'Head of IT', 'c0000000-0000-0000-0000-000000000002', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', 'Oslo'),
  ('d0000000-0000-0000-0000-000000000003', 'Kristian', 'Haugen', 'kristian.haugen@telenor.com', '+47 934 56 789', 'CTO', 'c0000000-0000-0000-0000-000000000003', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', 'Oslo'),
  ('d0000000-0000-0000-0000-000000000004', 'Ingrid', 'Solberg', 'ingrid.solberg@equinor.com', '+47 945 67 890', 'Project Manager', 'c0000000-0000-0000-0000-000000000001', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', 'Bergen'),
  ('d0000000-0000-0000-0000-000000000005', 'Lars', 'Eriksen', 'lars.eriksen@dnb.no', '+47 956 78 901', 'Senior Advisor', 'c0000000-0000-0000-0000-000000000002', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', 'Oslo');

-- Sample activities
INSERT INTO activities (type, subject, description, contact_id, company_id, created_by) VALUES
  ('meeting', 'Introduksjonsmøte', 'Diskuterte behov for konsulenter innen digitalisering', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('call', 'Oppfølgingssamtale', 'Avklarte tidsplan og budsjett', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('email', 'Sendt CV-er', 'Sendte 3 kandidatprofiler', 'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('note', 'Internt notat', 'Viktig kunde – prioriter oppfølging', 'd0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20');

-- Sample tasks
INSERT INTO tasks (title, description, priority, due_date, contact_id, company_id, assigned_to, created_by) VALUES
  ('Ring Anders om prosjektstart', NULL, 'high', '2026-03-10', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('Send tilbud til Silje', 'Forbered og send pristilbud', 'medium', '2026-03-12', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('Følg opp Kristian etter demo', NULL, 'low', '2026-03-15', 'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20');