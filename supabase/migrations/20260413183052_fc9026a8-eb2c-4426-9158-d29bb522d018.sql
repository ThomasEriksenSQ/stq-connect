UPDATE contacts
SET cv_email = false, mailchimp_status = 'unsubscribed'
WHERE lower(trim(email)) IN (
  'an@hideindustry.com',
  'vikesh.schouwenaars@kferrotech.com',
  'dlarsen@shearwatergeo.com',
  'torgeir.braein@kferrotech.com',
  'johan.lovseth@arm.com',
  'mads.dahl@virinco.com'
) AND cv_email = true;