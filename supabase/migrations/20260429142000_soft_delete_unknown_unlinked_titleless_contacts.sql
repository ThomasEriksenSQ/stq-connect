ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE OR REPLACE FUNCTION pg_temp.crm_normalize_geo_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        replace(replace(replace(lower(coalesce(value, '')), 'æ', 'ae'), 'ø', 'o'), 'å', 'a'),
        '[^a-z0-9[:space:]-]',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.crm_known_geo_place_pattern()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    'kristiansandsregionen|kristiansand-omradet|vestfold og telemark|trondheimsregionen|gamle fredrikstad|kongsbergregionen|stavanger-omradet|stavangerregionen|troms og finnmark|trondheim-omradet|drammensregionen|sogn og fjordane|stavangeromradet|bergensregionen|more og romsdal|sandnes-omradet|ulleval stadion|valer i ostfold|bergen-omradet|bergensomradet|charlottenlund|bjornafjorden|blomsterdalen|bo i telemark|fyllingsdalen|indre ostfold|oslo-regionen|skedsmokorset|sor-ostlandet|kristiansand|kristiansund|midthordland|nordfjordeid|nordhordland|nordre follo|oslo-omradet|sandnessjoen|sor-rogaland|aker brygge|billingstad|bronnoysund|flekkefjord|fredrikstad|holmestrand|kongsvinger|lierstranda|lillehammer|nedre eiker|norheimsund|oslo region|osloomradet|soreidgrend|tvedestrand|aust-agder|brumunddal|fjellhamar|gardermoen|gloshaugen|hallingdal|hammerfest|hjelmeland|lillestrom|loddefjord|majorstuen|midt-norge|nedre vats|nord-norge|ovre eiker|sandefjord|tjuvholmen|ullensaker|ulsteinvik|vest-agder|' ||
    'vestfossen|vestlandet|bekkestua|birkeland|bremanger|flekkeroy|haugesund|hommelvik|hordaland|innlandet|jorpeland|kleppesto|kongsberg|kongshavn|lampeland|lillesand|lindesnes|lorenskog|lovenstad|mjondalen|mo i rana|ostlandet|porsgrunn|raelingen|randaberg|ringerike|sarpsborg|sellebakk|slependen|songdalen|sorlandet|sorumsand|stavanger|steinkjer|stor-oslo|trollasen|trondelag|trondheim|vikersund|vinterbro|akershus|akrehamn|bjorvika|buskerud|egersund|eidsvoll|finnmark|finnsnes|frekhaug|gressvik|greverud|grimstad|hadeland|heggedal|hemsedal|hokksund|honefoss|hvalstad|jessheim|kirkenes|kopervik|krakeroy|laksevag|levanger|mongstad|nesodden|nittedal|nordland|nordmore|notodden|notteroy|oppegard|orkanger|oygarden|rennesoy|rogaland|romerike|sandvika|setesdal|skjetten|sofiemyr|solsiden|sortland|stjordal|strommen|sunnmore|svolvaer|tananger|telemark|tonsberg|vanvikan|vennesla|vestfold|vestland|alesund|alnabru|andenes|arendal|aurskog|drammen|dusavik|eidsvag|elverum|enebakk|farsund|fetsund|fornebu|frogner|' ||
    'gjesdal|harstad|heimdal|hundvag|iveland|kjeller|knarvik|kokstad|kolbotn|kragero|kvadrat|langhus|leirvik|lyngdal|lysaker|mariero|mosjoen|myrvoll|nesbyen|nesttun|numedal|nydalen|orkland|ostfold|paradis|ranheim|raufoss|revetal|ringebu|rolvsoy|romsdal|rotvoll|sandnes|sandsli|seljord|skedsmo|sluppen|snaroya|sogndal|stabekk|straume|tysvaer|ulleval|varhaug|algard|andoya|baerum|bergen|byasen|drobak|fauske|finnoy|gjovik|godvik|halden|horten|jaeren|karmoy|kjevik|kleppe|klofta|larvik|leknes|malvik|mandal|melhus|moholt|naerbo|namsos|narvik|nesbru|nyborg|oppdal|rindal|skoyen|stokke|strand|tiller|tranby|tromso|trysil|tynset|verdal|vestby|vollen|agder|alver|andoy|asane|asker|askim|askoy|bones|borsa|bryne|ensjo|floro|follo|forde|forus|frogn|geilo|hamar|hanes|hasle|hinna|hovik|klepp|loren|maloy|minde|modum|moelv|molde|mysen|okern|orsta|risor|roros|rygge|sauda|selbu|skaun|skien|sogne|sotra|stord|stryn|troms|vadso|vardo|viken|volda|alna|alta|arna|bodo|evje|hell|kvam|lade|lier|moss|nome|odda|olen|oslo|' ||
    'otta|rana|sola|time|vats|voss|fla|gol|rud|ski|tau|al|as|bo|os';
$$;

CREATE OR REPLACE FUNCTION pg_temp.crm_find_postal_code(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (regexp_match(coalesce(value, ''), '\m([0-9]{4})\M'))[1];
$$;

CREATE OR REPLACE FUNCTION pg_temp.crm_postal_code_has_known_geo(postal_code text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  value integer;
BEGIN
  IF postal_code IS NULL OR postal_code !~ '^[0-9]{4}$' THEN
    RETURN false;
  END IF;

  value := postal_code::integer;

  RETURN
    value < 1500
    OR (value >= 1500 AND value < 3000)
    OR (value >= 3000 AND value < 3700)
    OR (value >= 3700 AND value < 4000)
    OR (value >= 4000 AND value < 4400)
    OR (value >= 4400 AND value < 4500)
    OR (value >= 4500 AND value < 4800)
    OR (value >= 4800 AND value < 5000)
    OR (value >= 5000 AND value < 5400)
    OR (value >= 5400 AND value < 7000)
    OR (value >= 7000 AND value < 7600)
    OR (value >= 7600 AND value < 8000)
    OR (value >= 8000 AND value < 10000);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.crm_contact_location_parts(contact_location text, contact_locations text[])
RETURNS TABLE(part text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(btrim(value), '') AS part
  FROM (
    SELECT regexp_split_to_table(coalesce(contact_location, ''), E'[,;\\n/]+|[[:space:]]+og[[:space:]]+', 'i') AS value
    UNION ALL
    SELECT regexp_split_to_table(coalesce(location_value, ''), E'[,;\\n/]+|[[:space:]]+og[[:space:]]+', 'i') AS value
    FROM unnest(coalesce(contact_locations, ARRAY[]::text[])) AS location_values(location_value)
  ) location_parts
  WHERE nullif(btrim(value), '') IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION pg_temp.crm_contact_part_has_known_geo(part text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_part text;
BEGIN
  normalized_part := pg_temp.crm_normalize_geo_text(part);
  IF normalized_part = '' THEN
    RETURN false;
  END IF;

  IF pg_temp.crm_postal_code_has_known_geo(pg_temp.crm_find_postal_code(part)) THEN
    RETURN true;
  END IF;

  RETURN normalized_part ~ ('(^| )(' || pg_temp.crm_known_geo_place_pattern() || ')( |$)');
END;
$$;

WITH contacts_to_soft_delete AS (
  SELECT c.id
  FROM public.contacts c
  WHERE c.status IS DISTINCT FROM 'deleted'
    AND c.company_id IS NULL
    AND nullif(btrim(coalesce(c.title, '')), '') IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_temp.crm_contact_location_parts(c.location, c.locations) AS location_parts(part)
      WHERE pg_temp.crm_contact_part_has_known_geo(location_parts.part)
    )
)
UPDATE public.contacts c
SET
  status = 'deleted',
  updated_at = now()
FROM contacts_to_soft_delete target
WHERE c.id = target.id;
