## Endring

Legg til subtittel i "Ny forespørsel"-modalen på `/foresporsler` slik at den matcher mønsteret fra "Ny mulighet" på `/pipeline` (tittel + dempet subtittel).

### Fil
`src/pages/Foresporsler.tsx` — linje 530–532 (modal-header):

Fra:
```tsx
<div className="mb-5">
  <h2 className="text-[1.125rem] font-bold text-foreground">Ny forespørsel</h2>
</div>
```

Til:
```tsx
<div className="mb-5">
  <h2 className="text-[1.125rem] font-bold text-foreground">Ny forespørsel</h2>
  <p className="mt-1 text-[0.875rem] text-muted-foreground">Når mottatt forespørsel fra et selskap</p>
</div>
```

Ingen andre endringer. Lukke-knappen (X) kommer allerede fra `DesignLabEntitySheet`-wrapperen.
