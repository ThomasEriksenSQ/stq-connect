

## Risikovurdering

Ja — dette er en **lav-risk plan**. Her er hvorfor:

### Hva som gjør den trygg

1. **Ingen logikkendring** — alle eksisterende `onClick`-callbacks beholdes uendret. Hooken er en ren gatekeeper som bestemmer *når* klikket teller, ikke *hva* som skjer.

2. **`<button>` → `<span role="button" tabIndex={0}>`** er semantisk likeverdig for skjermlesere så lenge vi legger på `onKeyDown` for Enter/Space. Dette er et veletablert ARIA-mønster.

3. **Isolert scope** — kun 4 filer, og 3 av dem er presentasjonskomponenter uten datamutasjoner. Hooken er ny og brukes bare på de stedene vi eksplisitt kobler den inn.

4. **Ingen endring i mailto/tel-lenker, sletteknapper, lagre-knapper, eller skjema-submit** — vi rører kun visningstekst-wrappers.

5. **Reversibel** — endringen er mekanisk og lett å rulle tilbake per komponent hvis noe oppfører seg uventet.

### Hvor risiko finnes (lav, men reell)

- **Aktivitetsrad og e-postrad** har bredere klikk-overflate. Hvis brukeren markerer tekst og slipper musen *utenfor* den opprinnelige raden, må vi sjekke selection-state korrekt slik at vi ikke ved et uhell *aldri* åpner edit/expand. Hooken håndterer dette ved å nullstille på `mousedown`.
- **Tastaturbrukere** mister `<button>`s innebygde Enter/Space-håndtering. Mitigasjon: eksplisitt `onKeyDown` på alle konverterte elementer.
- **Fokusring** på `<span role="button">` arves ikke automatisk fra `<button>`. Mitigasjon: behold eksisterende Tailwind-klasser (de fleste bruker uansett `focus-visible:ring`-pattern via globale stiler) og verifiser visuelt.

### Hva som *ikke* berøres

- Ingen DB-kall, ingen mutations, ingen RLS, ingen edge functions.
- Ingen V1/V2-tokens eller theme-filer.
- Ingen andre kort (Oppdrag, Forespørsel, Ansatt) — kan migreres senere ved behov.

### Konklusjon

Lav risiko, høy verdi. Den eneste måten dette kan brekke noe på er hvis terskelen for "drag vs klikk" (4px) er feil kalibrert — i så fall kan vi justere til 6–8px uten arkitekturendring. Anbefaler å gå videre med planen som den står.

