

## Fjern to gule bannere

### Endringer

1. **`src/components/AppLayout.tsx`** (linje 2 og 255): Fjern import av `FornyelsesVarsel` og fjern `<FornyelsesVarsel />` under header. Dette fjerner det gule kontraktsfornyelse-banneret som vises under navigasjonsmenyen.

2. **`src/components/dashboard/DailyBrief.tsx`** (linje 687-705): Fjern hele den gule påminnelses-blokken ("Påminnelse! Viktig at vi bruker salgsagenten..."). Variablene `showReminder` og `setReminderDismissed` kan også ryddes bort om de ikke brukes andre steder.

### Ingen andre endringer
Ingen logikk, funksjonalitet eller design endres utover fjerning av disse to elementene.

