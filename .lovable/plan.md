

## Plan: Flytt Varslingsinnstillinger til ny Innstillinger-side

### Konsept
Flytt `VarslingsInnstillinger`-komponenten fra Aktive oppdrag-siden til en ny `/innstillinger`-side. Legg til et tannhjul-ikon i headeren som navigerer dit. Innstillinger-siden får to seksjoner: Outlook-tilkobling og Varslingsinnstillinger.

### Endringer

**1. `src/components/VarslingsInnstillinger.tsx` (ny fil)**
- Flytt hele `VarslingsInnstillinger`-funksjonen (linje 42–513) fra `KonsulenterOppdrag.tsx` til en egen komponent-fil
- Eksporter som named export

**2. `src/pages/Innstillinger.tsx` (ny fil)**
- Sidetittel: "Innstillinger"
- Seksjon 1: **Outlook-tilkobling** — viser status via `outlook-auth?action=status`, knapp for å koble til/koble til på nytt
- Seksjon 2: **Varslingsinnstillinger** — importerer og renderer `VarslingsInnstillinger`-komponenten

**3. `src/pages/KonsulenterOppdrag.tsx`**
- Fjern `VarslingsInnstillinger`-funksjonen (linje 42–513)
- Fjern tab-switcheren (linje 694–715) og `activeTab`-state
- Fjern `{activeTab === "innstillinger" && ...}` (linje 1030)
- Siden viser kun oppdragslisten direkte uten tabs

**4. `src/components/AppLayout.tsx`**
- Importer `Settings` fra lucide-react og `useNavigate`
- Legg til Settings-ikon mellom theme-toggle og profil-initialer: `<Button variant="ghost" size="icon" onClick={() => navigate("/innstillinger")}>`
- Legg til "Innstillinger"-lenke i mobilmenyen

**5. `src/App.tsx`**
- Lazy-importer `Innstillinger`
- Legg til route: `<Route path="innstillinger" element={<Suspense><Innstillinger /></Suspense>} />`

### Filer
| Fil | Endring |
|-----|---------|
| `src/components/VarslingsInnstillinger.tsx` | Ny fil — uttrukket komponent |
| `src/pages/Innstillinger.tsx` | Ny side med Outlook + varsling |
| `src/pages/KonsulenterOppdrag.tsx` | Fjern VarslingsInnstillinger + tabs |
| `src/components/AppLayout.tsx` | Settings-ikon i header |
| `src/App.tsx` | Ny route |

