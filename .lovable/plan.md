

## Plan: Oppdater OG-bilde med nytt screenshot av innloggingssiden

### Hva gjøres

1. **Generer product shot** fra screenshottet av login-siden med product-shot-scriptet (fog eller midnight preset for å matche det mørke temaet)
2. **Lagre bildet** i `public/og-image.png` 
3. **Oppdater `index.html`** — pek `og:image` og `twitter:image` til den lokale filen `/og-image.png` i stedet for den gamle R2-URLen

### Teknisk detalj

**index.html** — erstatt de to gamle bilde-URLene med:
```html
<meta property="og:image" content="https://stq-connect.lovable.app/og-image.png">
<meta name="twitter:image" content="https://stq-connect.lovable.app/og-image.png">
```

Bildet genereres med product-shot-scriptet og kopieres til `public/og-image.png` slik at det serves statisk.

