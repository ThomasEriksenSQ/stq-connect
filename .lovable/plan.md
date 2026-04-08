

## Plan: Endre "Erfaring (år)" til årstall-input med dynamisk beregning

### Oversikt
I stedet for å taste inn antall års erfaring, skal brukeren taste inn et årstall (f.eks. 2020). Antall år beregnes dynamisk som `nåværende år - årstall`.

### Endringer

**1. `src/components/AnsattDetailSheet.tsx`**
- **Redigeringsfeltet** (linje 476–484): Endre label til "Startet som konsulent (år)", placeholder til f.eks. "2018", og min/max-validering (1990–nåværende år). Verdien lagres som årstall i `erfaring_aar`-feltet.
- **Visning i sheet** (hvis erfaring vises): Beregn og vis `new Date().getFullYear() - erfaring_aar` + " års erfaring".

**2. `src/pages/AnsattDetail.tsx`**
- **Linje 270**: Endre fra `${ansatt.erfaring_aar} år` til dynamisk beregning: `${new Date().getFullYear() - ansatt.erfaring_aar} års erfaring` (med label endret til "Års erfaring" eller "Konsulent siden").

**3. Alle andre steder som viser `erfaring_aar`** (CvUploadFlow, edge functions som matcher på erfaring): Sikre at verdien tolkes som startår der det er relevant.

### Eksisterende data
Eksisterende verdier i databasen som er lagret som antall år (f.eks. 15) må konverteres til årstall. En liten migrasjon eller manuell oppdatering av de to brukernes data kan trenges. Alternativt kan vi anta at alle eksisterende verdier allerede er årstall basert på memory-notatet.

### Teknisk detalj
- DB-feltet `erfaring_aar` beholdes som integer, men verdien representerer nå et årstall
- Beregning: `const erfaringAar = new Date().getFullYear() - erfaring_aar`

