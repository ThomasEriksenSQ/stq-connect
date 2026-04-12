

## Tre-stegs toggle for CV-Epost-chipen

### Oppførsel
1. Klikk 1: Vis kun kontakter med CV-Epost aktivert (`cv_email === true`) — som i dag
2. Klikk 2: Vis kun kontakter som IKKE har CV-Epost, men som HAR e-post (`!cv_email && email finnes`)
3. Klikk 3: Filter av

### Endringer

**Fil: `src/pages/Contacts.tsx`**

1. **Filtreringslogikk (linje 713):** Legg til ny verdi `"not_cv_email"`:
   ```
   (typeFilter === "not_cv_email" && !contact.cv_email && contactHasEmail(contact))
   ```

2. **Erstatt Chip med egendefinert button (linje 1577):**
   ```tsx
   <button
     className={`${typeFilter === "cv_email" || typeFilter === "not_cv_email" ? CHIP_ON : CHIP_OFF} inline-flex items-center gap-1.5`}
     onClick={() => {
       if (typeFilter === "cv_email") setTypeFilter("not_cv_email");
       else if (typeFilter === "not_cv_email") setTypeFilter("all");
       else setTypeFilter("cv_email");
     }}
   >
     {typeFilter === "not_cv_email" && <Ban className="w-3.5 h-3.5 text-red-500" />}
     {typeFilter === "not_cv_email" ? "Ikke CV-Epost" : "CV-Epost"}
   </button>
   ```

Ingen andre endringer.

