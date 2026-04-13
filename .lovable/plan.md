

## Oppdater social preview-bilde (og:image)

### Problem
De nåværende `og:image` og `twitter:image` meta-taggene i `index.html` peker til et gammelt skjermbilde fra en tidligere versjon av innloggingssiden. Når linken deles (f.eks. i Slack/iMessage) vises det gamle bildet.

### Plan

1. **Ta et nytt skjermbilde** av den nåværende innloggingssiden via nettleseren.
2. **Generer et polert produktbilde** med product-shot-scriptet (macOS-ramme + gradient-bakgrunn).
3. **Lagre bildet som `/public/og-image.png`** i prosjektet.
4. **Oppdater `index.html`** — endre `og:image` og `twitter:image` til å peke på `/og-image.png` (relativ path, som fungerer med både preview- og custom domain). Fjern også `twitter:site` Lovable-referansen.

### Teknisk detalj
Endringer kun i `index.html`, linje 20 og 24:
```html
<meta property="og:image" content="/og-image.png">
<meta name="twitter:image" content="/og-image.png">
```

