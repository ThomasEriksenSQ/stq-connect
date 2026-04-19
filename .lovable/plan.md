

## Funn

Alle tre sider (`DesignLabForesporsler`, `DesignLabCompanies`, `DesignLabContacts`) bruker samme 3-panel `ResizablePanelGroup` med prosent-baserte bredder. Tabellen (venstre panel) er allerede identisk konfigurert på 38 %, men midt-panelet (detaljvisning) er ulikt:

| Side | Liste | Detalj | Tom |
|---|---|---|---|
| Forespørsler | `defaultSize={38}` `minSize={24}` `maxSize={60}` | `defaultSize={62}` `minSize={34}` | `defaultSize={0}` `maxSize={30}` |
| Selskaper | `defaultSize={38}` `minSize={24}` `maxSize={60}` | `defaultSize={65}` `minSize={30}` | `defaultSize={0}` `maxSize={40}` |
| Kontakter | `defaultSize={38}` `minSize={24}` `maxSize={60}` | `defaultSize={65}` `minSize={30}` | `defaultSize={0}` `maxSize={40}` |

Listebredden (38 %) er **allerede lik**. Det som gjør at tabellene *føles* ulik bredde er at totalsummen 38 + 65 + 0 = 103 (panel-gruppen normaliserer dette internt), mens Forespørsler summerer korrekt til 100. Dette gir Forespørsler en stabil og forutsigbar 38/62-fordeling, mens Selskaper/Kontakter blir litt smalere på listen etter normalisering.

## Plan

Justér midt- og tom-panelet på Selskaper og Kontakter til samme verdier som Forespørsler, slik at listen får samme effektive bredde:

**`src/pages/DesignLabCompanies.tsx`** (linje 627 og 672)
- `defaultSize={65}` `minSize={30}` → `defaultSize={62}` `minSize={34}`
- Tomt panel: `maxSize={40}` → `maxSize={30}`

**`src/pages/DesignLabContacts.tsx`** (linje 2410 og 2463)
- `defaultSize={65}` `minSize={30}` → `defaultSize={62}` `minSize={34}`
- Tomt panel: `maxSize={40}` → `maxSize={30}`

## Hvorfor lav-risk

- Kun seks numeriske verdier endres i to filer.
- Ingen logikk-endring, ingen data-endring, ingen layout-omskriving.
- Resultat: identisk listebredde på alle tre flater.
- Reversibelt med samme grep.

