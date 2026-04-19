
## Mål
Bytte favicon på STACQ CRM til de opplastede filene (sort STACQ "stablet diamant"-logo).

## Funn
`index.html` referer i dag til:
- `/favicon.ico`
- `/favicon-32x32.png`
- `/favicon-16x16.png`
- `/apple-touch-icon.png`

Brukeren har lastet opp et komplett favicon-sett:
- `favicon-2.ico` → ny `.ico`
- `favicon-96x96.png` → moderne PNG-favicon
- `favicon.svg` → vektor-favicon (skarp på alle skjermer)
- `apple-touch-icon-2.png` → iOS hjemskjerm
- `web-app-manifest-192x192.png` + `web-app-manifest-512x512.png` → PWA/Android

## Plan

**1. Kopier opplastede filer til `public/`**
- `user-uploads://favicon-2.ico` → `public/favicon.ico` (overskriver gammel — viktig fordi nettlesere ber om `/favicon.ico` automatisk)
- `user-uploads://favicon.svg` → `public/favicon.svg`
- `user-uploads://favicon-96x96.png` → `public/favicon-96x96.png`
- `user-uploads://apple-touch-icon-2.png` → `public/apple-touch-icon.png` (overskriver)
- `user-uploads://web-app-manifest-192x192.png` → `public/web-app-manifest-192x192.png`
- `user-uploads://web-app-manifest-512x512.png` → `public/web-app-manifest-512x512.png`

**2. Slett utdaterte favicon-filer i `public/`**
- `public/favicon-32x32.png` og `public/favicon-16x16.png` (erstattes av SVG + 96x96 PNG, og `index.html` refererer ikke lenger til dem)

**3. Oppdater `index.html` (`<head>`)**
Bytt nåværende ikon-lenker til:
```html
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
```

**4. Opprett `public/site.webmanifest`** for PWA-ikoner:
```json
{
  "name": "STACQ CRM",
  "short_name": "STACQ",
  "icons": [
    { "src": "/web-app-manifest-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/web-app-manifest-512x512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "display": "standalone"
}
```

## Effekt
Faneikon, iOS hjemskjerm og Android/PWA installasjon bruker den nye sorte STACQ-logoen. Nettleser-cache kan kreve hard reload (Cmd+Shift+R) for å se endringen umiddelbart.

## Utenfor scope
- Ingen endring i `og-image.png` eller andre delingsbilder.
- Ingen endring i appens UI eller theme-farger.
