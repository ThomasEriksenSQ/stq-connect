

## Mål
Migrere `/innstillinger` til V2-design ved å bruke ekte V2-komponenter (`DesignLabPageShell`, `DesignLabPrimaryAction`, `DesignLabSecondaryAction`, `DesignLabGhostAction`, `DesignLabTextField`, `DesignLabFieldLabel`, `Switch`, `Select`) — og kun når `isV2Active === true`. V1-rendering forblir 100% urørt.

## Hovedgrep

### 1. `src/pages/Innstillinger.tsx` — versjonsbryter
Helt øverst: `const { isV2Active } = useDesignVersion();`. Hvis V2 aktiv → render ny `<InnstillingerV2 />`. Ellers returnerer eksisterende V1-JSX uendret (ingen refaktorering, ingen klasseendring).

### 2. Ny komponent: `InnstillingerV2` (i samme fil)
Bruker `DesignLabPageShell` med:
- `activePath="/innstillinger"` (sidebaren markerer ikke noe — det er ok, samme som ved navigasjon fra DesignLabSidebar)
- `title="Innstillinger"`
- `maxWidth={1180}` (samme som Stilark)

Layout inni:
- 3 seksjoner som "kort" basert på `ExampleCard`-mønsteret fra `DesignLabStyleguide` — hvit panel-bakgrunn, `borderColor: C.borderLight`, `borderRadius: 10`, `padding: 20`, lett skygge.
- Seksjonstittel: 13px / 600 / `C.text` (V2-norm, ingen uppercase).
- Beskrivelse: 12px / `C.textMuted`.
- Knapper: `DesignLabPrimaryAction` (lagre / koble til), `DesignLabSecondaryAction` (test, send nå).
- Statusindikator (Outlook tilkoblet/ikke): farget prikk + 13px tekst (V2-konvensjon i stedet for store ikon-bokser).

### 3. Ny komponent: `VarslingsInnstillingerV2`
Egen fil: `src/components/VarslingsInnstillingerV2.tsx`. Beholder all eksisterende logikk og state-håndtering (kopiert fra `VarslingsInnstillinger.tsx`), men erstatter presentasjon:
- 3 paneler i et 1-kolonne stack (eller `xl:grid-cols-3` for tette skjermer — matche eksisterende oppsett).
- Inputs → `DesignLabTextField`.
- Labels → `DesignLabFieldLabel`.
- Knapper → `DesignLabPrimaryAction` / `DesignLabSecondaryAction`.
- E-postmottaker-rader: 13px tekst, fjern-knapp som `DesignLabGhostAction` med "×".
- Switches: gjenbruk `Switch` fra `@/components/ui/switch` — uendret (fungerer på begge versjoner).
- `Select` (terskel-dager): gjenbruk eksisterende, men style triggeren med samme høyde (32px) via `DesignLabTextField`-tokens.

### 4. V1-fil urørt
`src/components/VarslingsInnstillinger.tsx` endres ikke. V1-grenen i `Innstillinger.tsx` beholder all eksisterende JSX, klasser, tokens.

## Filer som endres / opprettes
- **Endret:** `src/pages/Innstillinger.tsx` — legg til `useDesignVersion`-bryter og ny `InnstillingerV2`-komponent. V1-grenen er bit-for-bit identisk med dagens fil.
- **Ny:** `src/components/VarslingsInnstillingerV2.tsx` — V2-presentasjon, samme datalogikk som V1-versjonen.

## Utenfor scope
- Ingen endring i `VarslingsInnstillinger.tsx` (V1).
- Ingen endring i `App.tsx`-routing (samme `/innstillinger`-rute for begge).
- Ingen endring i `DesignLabSidebar` eller `AppLayout` (samme nav-knapper peker på `/innstillinger`).
- Ingen endring i edge functions, databasekall eller toast-meldinger.
- Ingen ny rute `/design-lab/innstillinger` (`DesignLabSidebar` peker allerede på `/innstillinger` — V2-bryteren håndterer rendering).

## Effekt
- V1-brukere ser nøyaktig samme innstillingsside som i dag.
- V2-brukere (Thomas, Jon med V2 aktivert) får siden gjengitt med Linear-inspirert layout: 40px header med tittel, kompakte kort på `C.appBg`, 13px tekst, 32px knapper i accent-blå (`#5E6AD2` for primær — eller blå `#2563EB` ettersom `DesignLabPrimaryAction` allerede er blå), V2 sidebar til venstre. Alle handlinger (lagre, test, koble til Outlook, Mailchimp-synk) fungerer identisk.

