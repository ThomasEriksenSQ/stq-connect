update public.contacts
set cv_email = false
where cv_email = true
  and (email is null or btrim(email) = '');

alter table public.contacts
drop constraint if exists contacts_cv_email_requires_email;

alter table public.contacts
add constraint contacts_cv_email_requires_email
check (
  (not cv_email)
  or (email is not null and btrim(email) <> '')
);
