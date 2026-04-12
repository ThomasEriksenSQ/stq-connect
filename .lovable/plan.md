

## Fix: Horisontal forskyvning av navigasjonsmenyen

### Årsak
`<main>` har `overflow-auto`, som betyr at scrollbar kun vises når innholdet er høyere enn viewporten. Når scrollbar dukker opp/forsvinner ved sidebytte, forskyves hele layouten horisontalt fordi `max-w-6xl mx-auto` sentreres i en smalere/bredere flate.

### Løsning
Legg til `scrollbar-gutter: stable` på `<main>`-elementet (linje 256 i `AppLayout.tsx`). Dette reserverer plass til scrollbar permanent, slik at layouten aldri forskyves.

### Endring

**Fil: `src/components/AppLayout.tsx`**, linje 256:

Endre:
```tsx
<main className="flex-1 overflow-auto">
```
til:
```tsx
<main className="flex-1 overflow-auto" style={{ scrollbarGutter: "stable" }}>
```

Alternativt kan dette legges som en Tailwind-klasse i `index.css` om ønskelig, men inline style er enklest og berører kun denne ene linjen.

### Ingen andre endringer
Ingen logikk, ingen andre filer.

