

## Plan: Forbedre formatering av e-poster i aktivitetstidslinjen

### Problem
`stripHtml` i edge-funksjonen erstatter ALL whitespace (inkl. linjeskift) med ett mellomrom (`\s+` → `" "`). E-posttråder med From/To/Date/Subject-headere blir én uleselig tekstblokk.

### Løsning — to endringer

**1. Backend: `supabase/functions/outlook-mail/index.ts` — forbedre `stripHtml`**
- Sett inn linjeskift før `<br>`, `<p>`, `<div>`, `<tr>`, `<li>` og `<hr>` tags
- Erstatt `\s+` bare for vanlige mellomrom, behold `\n`
- Legg til linjeskift foran typiske e-post-headere (From:, To:, Date:, Subject:, Sendt:, Fra:, Til:, Dato:, Emne:)

**2. Frontend: `src/components/ContactCardContent.tsx` — splitt e-posttråd i separate meldinger**
- Parse `body_text` for å identifisere individuelle meldinger i tråden basert på "From:" / "Fra:" headere
- Vis kun den nyeste meldingen som standard, med en "Vis hele tråden"-knapp
- Vis hver melding i tråden med visuell separator og innrykk/bakgrunn for siterte deler
- Alternativt: vis hele body med `whitespace-pre-wrap` som allerede er der, men nå faktisk med linjeskift bevart fra backend

### Tekniske detaljer

**stripHtml oppdatering:**
```typescript
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<(hr)\s*\/?>/gi, "\n---\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")          // bare horisontale mellomrom
    .replace(/\n /g, "\n")            // trim start av linjer
    .replace(/\n{3,}/g, "\n\n")       // maks 2 tomme linjer
    .trim();
}
```

**EmailRow — vis kun nyeste melding + "Vis tråd":**
- Parse body_text og splitt på mønster som `\nFrom:` eller `\nFra:`
- Vis første del (nyeste melding) direkte
- Vis resten bak en "Vis hele tråden ▾" toggle med `bg-muted/30 rounded-lg p-3 mt-2` styling

Krever re-deploy av edge-funksjonen etter endring.

