

## Plan: Fjern AI-kunnskap-fanen og fiks build-feil

### 1. Fjern KnowledgeTab fra `src/pages/NettsideAI.tsx`

- **Fjern `KnowledgeTab`-funksjonen** (linje 858–1247) — hele komponenten.
- **Fjern TabsTrigger** for "AI-kunnskap" (linje 1446).
- **Fjern TabsContent** for "knowledge" (linje 1458–1460).
- **Fjern ubrukte konstantene** øverst: `CHIP_BASE`, `CHIP_OFF`, `CHIP_ON`, `VisFilter`, `CatFilter`, `VIS_CHIPS`, `CAT_CHIPS`, `CATEGORIES_LIST` (linje 54–79) — dersom ingen andre komponenter bruker dem.
- **Fjern ubrukte imports** som kun ble brukt av KnowledgeTab (f.eks. `pdfjs-dist`, `mammoth`, `FileText`, `Upload` etc.) — ryddes etter fjerning.
- **Oppdater beskrivelsen** på linje 1437 fra "Administrer konsulentprofiler og AI-kunnskapsbase for stacq.no." til "Administrer konsulentprofiler for stacq.no."

### 2. Fiks build-feil i `supabase/functions/salgsagent-paaminning/index.ts`

Endre import fra `npm:resend@4.1.2` til `npm:resend@^4.0.0` (eller tilsvarende kompatibel versjon som finnes i cache).

### Teknisk detalj

Totalt fjernes ca. 400+ linjer kode. Kun én side-fil og én edge function berøres.

