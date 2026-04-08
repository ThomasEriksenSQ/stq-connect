

## Plan: Mer luft og horisontal skillelinje under Sone 2

### Vurdering

Ser man på skjermbildet er seksjonen ganske tett — «SISTE OPPFØLGING» og «NESTE OPPFØLGING» ligger visuelt klemt sammen, og det mangler en tydelig avslutning nederst. Sone 2 har allerede en `border-t` (divider) over seg (linje 852), men ingen under. Det gir en asymmetrisk visuell vekting.

**Anbefaling:**
1. **Mer vertikal luft:** Øk `gap-3` mellom «Siste» og «Neste» til `gap-4`, og øk seksjonens padding fra `py-5` til `py-6` for å gi innholdet mer pusterom.
2. **Horisontal strek under:** Legg til en `border-t border-border/50` divider etter Sone 2 (etter linje 1070), identisk med den som allerede finnes over (linje 852). Dette gir symmetri og en tydelig visuell avgrensning mot Sone 4 under.

### Teknisk gjennomføring

**Fil:** `src/components/dashboard/DailyBrief.tsx`

1. **Linje 855:** Endre `py-5` → `py-6` for mer vertikal luft i seksjonen.
2. **Linje 857:** Endre `gap-3` → `gap-4` for mer avstand mellom «Siste» og «Neste».
3. **Etter linje 1070 (etter `</div>` som lukker Sone 2):** Legg til `<div className="border-t border-border/50" />` — identisk med divider-stilen på linje 852.

### Resultat
Seksjonen får balansert luft og tydelige horisontale skillelinjer både over og under, som skaper et ryddigere visuelt hierarki.

