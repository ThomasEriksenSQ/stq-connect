

## Plan: Gjør e-post-toggle mer synlig

### Endring
Erstatt den nåværende tekst-knappen med en tydelig pill/chip-toggle med bakgrunnsfarge og aktiv/inaktiv tilstand.

### Design
- Stil som en chip: `h-7 px-2.5 text-[0.75rem] rounded-full border` med Mail-ikon
- Aktiv (e-post vises): `bg-primary/10 border-primary/30 text-primary font-medium`
- Inaktiv (e-post skjult): `bg-background border-border text-muted-foreground hover:bg-secondary`
- Beholder samme toggle-logikk

### Teknisk
**Fil: `src/components/ContactCardContent.tsx`** — oppdater begge `<button>`-elementene (linje ~1879 og ~1900):

Erstatt className fra `inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors` til:
```
inline-flex items-center gap-1.5 h-7 px-2.5 text-[0.75rem] rounded-full border transition-colors
+ dynamisk: showEmails ? "bg-primary/10 border-primary/30 text-primary font-medium" : "bg-background border-border text-muted-foreground hover:bg-secondary"
```

