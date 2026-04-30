## Problem

Sletting av en pipeline-mulighet bruker `window.confirm`, som gir nettleserens stygge dialog ("På en innebygd side på ... står det"). Den globale regelen krever en pen bekreftelsesdialog med "Er du sikker?", "Ja, slett" og "Avbryt".

## Endring i `src/pages/Pipeline.tsx`

1. **Importer AlertDialog**:
   ```ts
   import {
     AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
     AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
   } from "@/components/ui/alert-dialog";
   ```

2. **Ny state** ved siden av andre `useState`-kall:
   ```ts
   const [pendingDelete, setPendingDelete] = useState<PipelineItem | null>(null);
   const [deletingOpportunity, setDeletingOpportunity] = useState(false);
   ```

3. **Erstatt `deleteOpportunity` (linje 683–694)** — fjern `window.confirm`, bare åpne dialogen:
   ```ts
   const deleteOpportunity = (item: PipelineItem) => {
     if (item.source !== "mulighet") return;
     setPendingDelete(item);
   };

   const confirmDeleteOpportunity = async () => {
     if (!pendingDelete) return;
     setDeletingOpportunity(true);
     const { error } = await supabase
       .from("pipeline_muligheter")
       .delete()
       .eq("id", pendingDelete.sourceId as string);
     setDeletingOpportunity(false);
     if (error) {
       toast.error("Kunne ikke slette mulighet");
       return;
     }
     setPendingDelete(null);
     await invalidatePipelineQueries();
     toast.success("Mulighet slettet");
   };
   ```

4. **Render `<AlertDialog>` rett før det avsluttende `</div>`** i `Pipeline`-komponenten (rundt linje 853, etter `<CommandPalette … />`):
   ```tsx
   <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
     <AlertDialogContent>
       <AlertDialogHeader>
         <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
         <AlertDialogDescription>
           Slette muligheten "{pendingDelete?.title}"? Dette kan ikke angres.
         </AlertDialogDescription>
       </AlertDialogHeader>
       <AlertDialogFooter>
         <AlertDialogCancel disabled={deletingOpportunity}>Avbryt</AlertDialogCancel>
         <AlertDialogAction
           onClick={(e) => { e.preventDefault(); void confirmDeleteOpportunity(); }}
           disabled={deletingOpportunity}
           className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
         >
           Ja, slett
         </AlertDialogAction>
       </AlertDialogFooter>
     </AlertDialogContent>
   </AlertDialog>
   ```

### Effekt
- Klikk på "Slett" på en mulighet åpner en pen modal i stedet for nettleserdialog.
- "Avbryt" lukker uten endring; "Ja, slett" sletter og viser toast.
- Følger global slette-regel ("Er du sikker?" / "Ja, slett" / "Avbryt").
