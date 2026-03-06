

# Update: Norwegian UI Language

The database schema, table names, column names, and all backend code remain in English as planned. The user-facing interface will be fully in Norwegian.

## What changes

All UI text — labels, buttons, headings, placeholders, menu items, status labels, and empty states — will be written in Norwegian (Bokmål).

Examples:
- "Companies" → "Selskaper"
- "Contacts" → "Kontakter"
- "Activities" → "Aktiviteter"
- "Tasks" → "Oppgaver"
- "Add Note" → "Legg til notat"
- "Log Activity" → "Logg aktivitet"
- "Create Task" → "Opprett oppgave"
- "Search..." → "Søk..."
- "Open" / "Done" → "Åpen" / "Fullført"
- "Name" → "Navn"
- "Industry" → "Bransje"
- "Due date" → "Forfallsdato"
- "Sign in" → "Logg inn"
- Activity types: Note → Notat, Call → Samtale, Meeting → Møte, Email → E-post

## Implementation approach

- All hardcoded UI strings will be in Norwegian directly in the components (no i18n library needed since this is a single-language internal tool)
- Database columns stay English (e.g. `company_name`, `due_date`, `status`)
- Supabase table/column names stay English
- TypeScript types and variable names stay English

This will be applied throughout all pages and components during implementation. No separate translation step needed — Norwegian is simply the default language for all UI copy.

