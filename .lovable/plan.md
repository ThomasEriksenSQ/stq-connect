

## Plan: Legg til epostvarsling-checkbox i redigeringsmodus for oppfølginger

### Hva endres

I `ContactCardContent.tsx`, i TaskRow-komponentens inline redigeringsmodus, legges det til en "Epostvarsling ved forfall"-checkbox — samme som i opprettelsesskjemaene.

### Teknisk detalj

**Fil: `src/components/ContactCardContent.tsx`**

1. Legg til en ny state `editEmailNotify` (initialisert fra `task.email_notify`) i TaskRow-komponenten (ved linje 1511)
2. Sett `editEmailNotify` fra `task.email_notify` i `handleRowClick` (linje 1525-1547)
3. Inkluder `email_notify: editEmailNotify` i `handleSave`-kallet til `onUpdate` (linje 1553)
4. Legg til checkbox-elementet mellom dato-chips-seksjonen og Lagre/Avbryt-knappene (mellom linje 1635 og 1636)

Checkboxen bruker samme stil som i FollowUpModal:
```tsx
<label className="flex items-center gap-2 cursor-pointer select-none">
  <Checkbox
    checked={editEmailNotify}
    onCheckedChange={(v) => setEditEmailNotify(!!v)}
    className="h-4 w-4"
  />
  <span className="text-[0.8125rem] text-foreground">Epostvarsling ved forfall</span>
</label>
```

