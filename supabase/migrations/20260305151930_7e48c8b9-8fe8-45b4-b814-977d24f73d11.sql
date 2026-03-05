
-- Insert mock companies
INSERT INTO public.companies (id, name, org_number, industry, phone, email, city, website, created_by) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Amina Charging AS', '923456789', 'Energi / Lading', '22 33 44 55', 'post@aminacharging.com', 'Stavanger', 'https://aminacharging.com', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('a1000000-0000-0000-0000-000000000002', 'Nordic Consulting Group', '912345678', 'Rådgivning', '99 88 77 66', 'info@ncg.no', 'Oslo', 'https://ncg.no', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('a1000000-0000-0000-0000-000000000003', 'Havblikk Tech AS', '934567890', 'Teknologi', '45 67 89 01', 'hello@havblikk.no', 'Bergen', NULL, '877c63e8-a70c-4b78-9258-3dc8b1bf3c20');

-- Insert mock contacts
INSERT INTO public.contacts (id, first_name, last_name, email, phone, title, company_id, linkedin, location, created_by) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Fredrik Erland', 'Lima', 'fredrik@aminacharging.com', '45441014', 'Co-Founder', 'a1000000-0000-0000-0000-000000000001', 'https://www.linkedin.com/in/fredlima/', 'Stavanger', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('b1000000-0000-0000-0000-000000000002', 'Johan', 'Olofsson', NULL, '480 19 741', 'Teknisk lead', 'a1000000-0000-0000-0000-000000000001', NULL, 'Oslo', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('b1000000-0000-0000-0000-000000000003', 'Øystein', 'Tveterås', 'oystein@aminacharging.com', '959 05 218', 'Product Manager', 'a1000000-0000-0000-0000-000000000001', NULL, 'Stavanger', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('b1000000-0000-0000-0000-000000000004', 'Marte', 'Hansen', 'marte@ncg.no', '91 23 45 67', 'Daglig leder', 'a1000000-0000-0000-0000-000000000002', 'https://linkedin.com/in/martehansen', 'Oslo', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20'),
  ('b1000000-0000-0000-0000-000000000005', 'Erik', 'Berg', 'erik@havblikk.no', '97 65 43 21', 'CTO', 'a1000000-0000-0000-0000-000000000003', NULL, 'Bergen', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20');

-- Insert mock activities
INSERT INTO public.activities (subject, type, description, company_id, contact_id, created_by, created_at) VALUES
  ('Konsulentavtale diskusjon', 'email', 'Sendt over utkast til konsulentavtale for gjennomgang', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '2026-02-19 16:58:00+01'),
  ('Fornyelse av kontrakt', 'email', 'Diskuterte fornyelse av eksisterende kontrakt', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '2025-09-08 09:45:00+02'),
  ('Telefon med Øystein - langsiktig samarbeid', 'call', 'Snakket om langsiktig samarbeid og muligheter', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '2025-02-24 14:00:00+01'),
  ('Møte med Marte om prosjekt', 'meeting', 'Kick-off møte for nytt rådgivningsprosjekt', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '2026-01-15 10:00:00+01'),
  ('Intro-samtale med Erik', 'call', 'Første kontakt med Havblikk Tech', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '2026-03-01 11:30:00+01'),
  ('Statusmøte Q1', 'meeting', 'Gjennomgang av leveranser i Q1', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', '877c63e8-a70c-4b78-9258-3dc8b1bf3c20', '2026-03-04 09:00:00+01');
