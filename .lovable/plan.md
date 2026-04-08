

## Plan: Slett og rediger aktiviteter på ansattsiden

Legger til mulighet for å redigere og slette aktiviteter i aktivitetstidslinjen på `src/pages/AnsattDetail.tsx`.

### Funksjonalitet

1. **Redigering**: Klikk på en aktivitet åpner inline redigering (i tråd med prosjektets mønster for inline editing). Felter: type, emne, beskrivelse, og dato (`created_at`).

2. **Sletting**: Slett-knapp med bekreftelsesdialog ("Er du sikker?" → "Ja, slett" / "Avbryt").

### Tekniske endringer

**Fil:** `src/pages/AnsattDetail.tsx`

- Legge til state for `editingActId` og `editForm` (type, subject, description, created_at)
- Legge til `updateActivityMutation` som kaller `.update()` på `ansatt_aktiviteter`
- Legge til `deleteActivityMutation` som kaller `.delete()` på `ansatt_aktiviteter` med bekreftelse via `AlertDialog`
- I aktivitets-renderingen: Når `editingActId === act.id`, vis inline redigeringsfelt i stedet for read-only visning
- Legg til redigerings- og sletteikoner (Pencil, Trash2) som vises på hover per aktivitetsrad
- Dato-felt som `<Input type="datetime-local">` for å kunne endre tidspunkt

### UI-flyt
- Hover over aktivitet → viser Pencil + Trash2 ikoner øverst til høyre
- Klikk Pencil → inline redigering med lagre/avbryt-knapper
- Klikk Trash2 → AlertDialog bekreftelse → sletter ved "Ja, slett"

