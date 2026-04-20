

## Problem
E-posten fra Thomas Eriksen (i dag kl. 13:33) til Kjell Ole Ingebo, med Håkon Gjøne i **Kopi (CC)**, dukker ikke opp på Håkons kontaktkort. Microsoft Graph sin `$search="to:..."` matcher kun `toRecipients`, ikke `ccRecipients` eller `bccRecipients`. Dermed mister vi alle e-poster der kontakten kun er CC-ed.

## Fiks i `supabase/functions/outlook-mail/index.ts`

### Endring
Erstatt de to nåværende `$search`-kallene (`from:` og `to:`) med tre parallelle kall som dekker alle posisjoner kontakten kan ha:

1. `$search="from:hakon.gjone@..."` — avsender
2. `$search="to:hakon.gjone@..."` — direkte mottaker
3. `$search="cc:hakon.gjone@..."` — i kopi

Microsoft Graph KQL støtter `cc:` (og `bcc:`) som søkeoperatorer på samme måte som `to:`. Resultatet samles i samme `messages`-array, dedupliseres på `msg.id` (allerede implementert via `seenIds`), og slippes gjennom samme sortering/dedupe-pipeline.

### Konkret diff (linje 159–181)
```ts
const fromUrl = `${GRAPH_BASE}/me/messages?$search="${encodeURIComponent(`from:${emailAddr}`)}"&$top=${top}&$select=...`;
const toUrl   = `${GRAPH_BASE}/me/messages?$search="${encodeURIComponent(`to:${emailAddr}`)}"&$top=${top}&$select=...`;
const ccUrl   = `${GRAPH_BASE}/me/messages?$search="${encodeURIComponent(`cc:${emailAddr}`)}"&$top=${top}&$select=...`;

const [fromRes, toRes, ccRes] = await Promise.all([
  fetch(fromUrl, { headers: { Authorization: `Bearer ${accessToken}` } }),
  fetch(toUrl,   { headers: { Authorization: `Bearer ${accessToken}` } }),
  fetch(ccUrl,   { headers: { Authorization: `Bearer ${accessToken}` } }),
]);

// Push results from all three responses (med samme error-logging som før)
```

I tillegg utvides mappingen i `messages`-loopen slik at `to`-feltet inkluderer både `toRecipients` og `ccRecipients` (prefiksert) i visningen, slik at brukeren forstår at vedkommende var CC-et:
```ts
to: [
  ...(msg.toRecipients || []).map(r => r.emailAddress?.address),
  ...(msg.ccRecipients || []).map(r => `cc: ${r.emailAddress?.address}`),
].filter(Boolean).join(", "),
```
Og legger til `ccRecipients` i `$select`-listen i alle tre URL-ene.

### Etter deploy
- Den manglende e-posten fra 13:33 vises i Håkons aktivitetstidslinje innen 5 min (queryen har `staleTime: 5 * 60 * 1000`) — eller umiddelbart ved hard refresh.
- Også historiske CC-e-poster dukker opp.
- Ingen UI-endringer i `ContactCardContent.tsx` — den eksisterende `normalizeOutlookMailItems`-pipen håndterer den utvidede `to`-strengen uendret.

### Ikke endret
- Auth, token-refresh, admin-sjekk, dedupe-logikk — uendret.
- BCC inkluderes ikke (ingen brukstilfelle, og `bcc:` returnerer kun for innloggede konto sine sendte e-poster uansett).
- V1-kontaktsiden bruker samme `outlook-mail`-funksjon, så fiksen gjelder begge versjoner.

