---
name: Design Lab søkefelt-plassering
description: Søkefeltet i Design Lab-headeren skal kun vises på flater hvor Cmd+K ikke gir tilgang til søk
type: design
---
Søkefeltet (DesignLabSearchInput) i headeren på Design Lab-flater skal kun vises der Cmd+K-snarveien ikke allerede gir søkefunksjonalitet:

- **Med Cmd+K (skjul søkefelt):** Kontakter, Selskaper, Forespørsler — Cmd+K åpner enten CommandPalette (Kontakter/Selskaper) eller fokuserer søket direkte (Forespørsler).
- **Uten Cmd+K (behold søkefelt):** Oppfølginger, Konsulenter (Ansatte/Oppdrag), Styleguide.

Når Cmd+K legges til en ny flate, skal søkefeltet i headeren fjernes samtidig.
