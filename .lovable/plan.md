

# Salesforce-import: Full dataimport

## Dataoversikt fra filene

| Type | Antall ca. | Fil |
|---|---|---|
| Selskaper (Accounts) | ~400 | accounts_export |
| Kontakter (Contacts) | ~500 | Contacts_and_accounts_export |
| Oppfølginger (Activities/Tasks) | ~300 | activities_with_contacts_export |

## Steg 1: Database-migrasjon

Legge til `owner_id` på `companies`-tabellen og oppdatere RLS-policier slik at admin-brukere kan se all data (ikke bare sine egne). Dagens RLS krever `created_by = auth.uid()` -- dette betyr at Thomas ikke kan se JRs selskaper og omvendt.

```sql
-- Legg til owner_id
ALTER TABLE companies ADD COLUMN owner_id uuid REFERENCES profiles(id);

-- Oppdater RLS: admins kan se/redigere alt
DROP POLICY "Users read own companies" ON companies;
CREATE POLICY "Admins and owners read companies" ON companies FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Tilsvarende for contacts, tasks, activities
```

## Steg 2: Edge Function `salesforce-import`

En Edge Function som mottar all data som JSON og bruker `service_role` for å bypasse RLS og bulk-inserte:

1. **Selskaper først**: Mapper Salesforce Account ID til ny UUID. Mapper `Type`-feltet:
   - "Privat direktekunde" / "Offentlig direktekunde" → `kunde`
   - "Offentlig DPS" → `potensiell_kunde`
   - "Privat partner" → `partner`
   - "Konsulentmegler" → `konsulentmegler`

2. **Kontakter**: Kobler til selskaper via SF Account ID → ny company UUID. Mapper `cv_email`, `call_list`, og `owner` (Contact Owner).

3. **Oppfølginger**: Kobler til kontakt via SF Contact ID og selskap via SF Account ID. Mapper status:
   - "Ferdig utført" → `completed`
   - "Ikke påbegynt" → `open`

Eiermapping:
- "Thomas Eriksen" → `877c63e8-a70c-4b78-9258-3dc8b1bf3c20`
- "Jon Richard Nygaard" → `451cb75f-685d-433d-83f0-bb24941ff2a4`

## Steg 3: Bygg JSON fra parsede filer og kall funksjonen

Funksjonen kalles via curl med hele datasettet. Pga. datamengden kan det bli nødvendig å dele opp i flere kall (companies, contacts, tasks separat).

## Steg 4: Rydd opp

Slett den midlertidige edge function etter import og oppdater `config.toml`.

## Viktige detaljer

- Duplikater i Salesforce (f.eks. "Sysint AS" med to Account IDs, "EasyX"/"Easyx AS") håndteres ved å importere begge og evt. slå sammen manuelt etterpå
- Kontakter uten selskapskobling (Account ID mangler i contacts-filen) importeres uten `company_id`
- Salesforce "Description" på accounts → `notes` i companies
- Alle datoer konverteres fra DD.MM.YYYY til ISO-format

