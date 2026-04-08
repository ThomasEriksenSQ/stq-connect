
## Plan: Vis relativ tid etter datoer i aktivitetstidslinjen

Legger til relativ tid (f.eks. "3 dager siden", "2 uker siden") etter den formaterte datoen i aktivitetsseksjonen på ansattsiden.

### Endring

**Fil:** `src/pages/AnsattDetail.tsx`

- Importere `relativeDate` fra `@/lib/relativeDate`
- I aktivitetstidslinjen, endre dato-visningen fra:
  ```
  8. apr. 2026
  ```
  til:
  ```
  8. apr. 2026 · 3 dager siden
  ```

Én linje endres i renderingen av aktiviteter — legger til ` · {relativeDate(act.created_at)}` etter den eksisterende formaterte datoen.
