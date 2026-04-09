

## Plan: Legg til "Tidligere prosesser"-fane

### Endring i `src/pages/AnsattDetail.tsx`

1. **Ny query** for tidligere prosesser — samme som `aktiveProsesser` men med `.in("status", ["vunnet", "avslag", "bortfalt"])`.

2. **Ny TabsTrigger** etter "Aktive prosesser":
   ```
   <TabsTrigger value="tidl-prosesser">Tidligere prosesser ({tidligereProsesser.length})</TabsTrigger>
   ```

3. **Ny TabsContent** med samme renderingslogikk som aktive prosesser, men med status-mappinger:
   - `vunnet` → grønn badge "Vunnet"
   - `avslag` → rød badge "Avslag"
   - `bortfalt` → grå badge med gjennomstreket tekst "Bortfalt"

Kun én fil endres.

