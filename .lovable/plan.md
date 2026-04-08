

## Plan: Ansatt-profilside

Oppretter en dedikert profilside for ansatte med all relevant informasjon, samt et link-ikon i ansatt-tabellen.

### Nye filer

**1. `src/pages/AnsattDetail.tsx`** — Profilsiden

Henter data fra `stacq_ansatte` (via id-param), `stacq_oppdrag` (via `ansatt_id` og `kandidat`), og `cv_documents` (portrettbilde). Layout følger samme mønster som CompanyDetail/ContactDetail (`max-w-5xl`, tilbake-knapp).

Innhold:
- **Header**: Portrettbilde/initialer, navn, status-badge (Aktiv/Sluttet/Kommende)
- **Infogrid** (to kolonner): E-post, telefon, startdato, sluttdato, fødselsdato (med alder), ansettelsesvarighet (beregnet), tilgjengelig fra, års erfaring, geografi, kompetanse-tags
- **Oppdrag-seksjon**: Aktivt oppdrag med utpris, til konsulent, margin (calcStacqPris). Tidligere oppdrag i en tabell med samme kolonner
- **Notat-felt**: Textarea som lagrer til `stacq_ansatte.kommentar`, inline redigering med lagre-knapp
- **Aktivitetslogg**: Ny tabell `ansatt_aktiviteter` (se under) med type (samtale/møte), tittel, beskrivelse, dato. Logg-knapp for å legge til nye. Vises som timeline likt kontaktsiden

### Database-migrasjon

Ny tabell `ansatt_aktiviteter`:
```sql
create table public.ansatt_aktiviteter (
  id uuid primary key default gen_random_uuid(),
  ansatt_id integer not null,
  type text not null default 'samtale',
  subject text not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid
);
alter table public.ansatt_aktiviteter enable row level security;
create policy "Admin manage ansatt_aktiviteter" on public.ansatt_aktiviteter
  for all to authenticated using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));
```

### Endringer i eksisterende filer

**2. `src/pages/KonsulenterAnsatte.tsx`**
- Legg til en ny kolonne i GRID_COLS (en smal kolonne ~32px til høyre for HANDLINGER, eller erstatt pencil-ikonet)
- Legg til et `User`-ikon (fra lucide) som linker til `/konsulenter/ansatte/:id` via `navigate`

**3. `src/App.tsx`**
- Legg til rute: `konsulenter/ansatte/:id` → lazy-loadet `AnsattDetail`

### Designprinsipper

- Følger prosjektets typografi-hierarki (text-[1.5rem] font-bold for navn, text-[0.6875rem] uppercase for seksjonstitler)
- Kort-stil: `bg-card border border-border rounded-lg shadow-card p-4`
- Datoer med årstall, format `d. MMM yyyy`
- Aktivitets-timeline med samme ikon-stil som kontaktsiden (MessageCircle for samtale, FileText for møte)
- Kompetanse som badges: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold`
- Notat redigeres inline, ikke i modal

