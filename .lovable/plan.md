
## Plan: Flytt "Aktive prosesser" inn som fane

### Endring
Flytt "Aktive prosesser"-seksjonen (linje 307–343) inn i fane-komponenten (linje 348–375) som en tredje fane etter "Tidligere oppdrag". Fjern det separate kortet.

### Detaljer i `src/pages/AnsattDetail.tsx`

1. **Fjern** det frittstående "Aktive prosesser"-kortet (linje 307–343).

2. **Legg til ny TabsTrigger** etter "Tidligere oppdrag":
   ```
   <TabsTrigger value="prosesser">Aktive prosesser ({aktiveProsesser.length})</TabsTrigger>
   ```

3. **Legg til ny TabsContent** med det eksisterende innholdet fra prosesser-seksjonen (uten Card-wrapping og overskrift, bare listen med Send-ikon, selskapsnavn, referanse og status-badge). Vis "Ingen aktive prosesser" om listen er tom.

Kun én fil endres.
