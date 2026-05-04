-- Company-scoped activities/tasks should only point to contacts that are active
-- contacts on the same company. Otherwise the UI can show deleted or unrelated
-- people as if they still exist on the company card.

UPDATE public.activities AS activity
SET contact_id = NULL
FROM public.contacts AS contact
WHERE activity.contact_id = contact.id
  AND activity.company_id IS NOT NULL
  AND (
    contact.status = 'deleted'
    OR contact.company_id IS DISTINCT FROM activity.company_id
  );

UPDATE public.tasks AS task
SET
  contact_id = NULL,
  updated_at = now()
FROM public.contacts AS contact
WHERE task.contact_id = contact.id
  AND task.company_id IS NOT NULL
  AND (
    contact.status = 'deleted'
    OR contact.company_id IS DISTINCT FROM task.company_id
  );
