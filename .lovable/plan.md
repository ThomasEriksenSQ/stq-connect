

## Mål
I `/design-lab/kontakter`-tabellen, bytt ut `Wifi`-ikonet i "FINN"-kolonnen med det opplastede Finn.no-logoikonet — i gråtone.

## Funn
- Ikonet rendres i `src/pages/DesignLabContacts.tsx` linje 2313–2315:
  ```tsx
  {c.hasMarkedsradar && (
    <Wifi style={{ width: 14, height: 14, color: C.info }} />
  )}
  ```
- Vises kun når `hasMarkedsradar === true` (selskapet har Finn-annonse siste 90 dager).
- Hover-tittel og logikk forblir uendret.
- Opplastet bilde (`finnnoikon.webp`) er Finn.no-logoen i blått — skal rendres i gråtone.

## Plan

1. **Kopier asset**: `user-uploads://finnnoikon.webp` → `src/assets/finn-icon.webp`.
2. **Importer asset** i `src/pages/DesignLabContacts.tsx`:
   ```tsx
   import finnIcon from "@/assets/finn-icon.webp";
   ```
3. **Erstatt `<Wifi … />`** (linje 2313–2315) med et `<img>`:
   ```tsx
   {c.hasMarkedsradar && (
     <img
       src={finnIcon}
       alt="Finn"
       style={{
         width: 14,
         height: 14,
         filter: "grayscale(1) opacity(0.65)",
         objectFit: "contain",
       }}
     />
   )}
   ```
   - `grayscale(1)` gir gråskala.
   - `opacity(0.65)` gir en dempet, V2-kompatibel tone (matcher `C.textMuted`-vekt).
4. **Rydd `Wifi`-import** fra lucide-react hvis ingen andre bruker den i filen (sjekkes ved implementering).

## Filer som endres
- `src/assets/finn-icon.webp` (ny)
- `src/pages/DesignLabContacts.tsx` (ikon-bytte + evt. import-opprydding)

## Utenfor scope
- Endring av kolonne-bredde, header-label eller hover-tittel.
- Endring av FINN-logikk (`hasMarkedsradar`) eller sortering.
- Andre Design Lab-sider.

