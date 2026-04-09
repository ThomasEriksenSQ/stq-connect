

## Plan: Oppdrag i faner (Tabs) i stedet for under hverandre

### Endring
Refaktorer oppdragsseksjonen i `src/pages/AnsattDetail.tsx` (linje 344–369) til å bruke `Tabs`-komponenten fra `@/components/ui/tabs`.

### Detaljer

1. **Import**: Legg til `Tabs, TabsList, TabsTrigger, TabsContent` fra `@/components/ui/tabs`.

2. **Erstatt oppdragsseksjonen** (linje 344–369) med:
   - En `Card` med `Tabs` inni
   - `TabsList` med to faner: "Aktive oppdrag" og "Tidligere oppdrag"
   - Tidligere oppdrag-fanen viser antall i parentes
   - Default-fane: "aktive"
   - Hver `TabsContent` inneholder listen som i dag

3. **Struktur**:
```text
Card
└── Tabs (defaultValue="aktive")
    ├── TabsList
    │   ├── TabsTrigger "Aktive oppdrag (N)"
    │   └── TabsTrigger "Tidligere oppdrag (N)"
    ├── TabsContent "aktive" → activeOppdrag liste
    └── TabsContent "tidligere" → previousOppdrag liste
```

Kun én fil endres: `src/pages/AnsattDetail.tsx`.

