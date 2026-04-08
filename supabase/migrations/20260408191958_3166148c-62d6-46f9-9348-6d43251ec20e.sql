-- Exact name matches (10 ansatte)
UPDATE stacq_ansatte SET bilde_url = c.image_url
FROM consultants c
WHERE LOWER(TRIM(stacq_ansatte.navn)) = LOWER(TRIM(c.name))
  AND c.image_url IS NOT NULL;

-- Manual matches for remaining 6
-- id=6 Filip Dovland — no consultant image exists, skip
-- id=7 Trine Ødegård Olsen → "Trine Ø. Olsen"
UPDATE stacq_ansatte SET bilde_url = 'https://kbvzpcebfopqqrvmbiap.supabase.co/storage/v1/object/public/consultant-images/1773398918751-Trine-Olsen_WEB.jpg' WHERE id = 7;
-- id=9 Mattis Spieler Asp → "Mattis Asp"
UPDATE stacq_ansatte SET bilde_url = 'https://kbvzpcebfopqqrvmbiap.supabase.co/storage/v1/object/public/consultant-images/1773398835790-Mattis-Asp_WEB.jpg' WHERE id = 9;
-- id=13 Harald Ivarson Moldsvor → "0x01 (starter 1.sept)"
UPDATE stacq_ansatte SET bilde_url = 'https://kbvzpcebfopqqrvmbiap.supabase.co/storage/v1/object/public/consultant-images/1773753178738-Harald-Moldsvor--27086-WEB.jpg' WHERE id = 13;
-- id=14 Rikke Solbjørg → "(TG) Rikke Solbjørg"
UPDATE stacq_ansatte SET bilde_url = 'https://kbvzpcebfopqqrvmbiap.supabase.co/storage/v1/object/public/consultant-images/1773398906164-Solbjoerg-(1)_red_web.jpg' WHERE id = 14;
-- id=16 Trond Hübertz Emaus → "0x02 (starter 1.sept)"
UPDATE stacq_ansatte SET bilde_url = 'https://kbvzpcebfopqqrvmbiap.supabase.co/storage/v1/object/public/consultant-images/1773753205478-Trond-Emaus--27109-WEB.jpg' WHERE id = 16;