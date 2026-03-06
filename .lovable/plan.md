

## Plan: Clean Re-import with Salesforce ID-based Matching

### Problem
The current import uses **name-based matching** (company name, contact first+last name) which is fragile and caused broken relationships (e.g., Amina Charging AS had zero linked activities). The new approach uses **Salesforce IDs** as canonical keys for reliable relationship resolution.

### File Analysis
The three new Excel files have these headers (after metadata rows):

- **Accounts**: Account ID, Account Name, Type, Organization number, Website, Industry, Created Date, Account Owner, Description
- **Contacts**: Contact ID, Account ID, First Name, Last Name, Email, Phone, Title, Linkedin, Contact Owner, Legg til ringeliste, Motta CV på tilgjengelige konsulenter, Description
- **Activities/Tasks**: Account ID, Activity ID, Subject, Full Comments, Task Subtype, Event Subtype, Status, Date, Assigned, Name (contact name), Company / Account

### Changes

#### 1. Database Migration — Add Salesforce ID columns
Add `sf_account_id`, `sf_contact_id`, `sf_activity_id` columns (text, nullable, unique) to existing tables. This preserves the existing schema and UI while enabling ID-based matching.

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sf_account_id text UNIQUE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sf_contact_id text UNIQUE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS sf_activity_id text UNIQUE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sf_activity_id text UNIQUE;
```

#### 2. Update Edge Function (`supabase/functions/salesforce-import/index.ts`)
- Companies: receive `sf_account_id` from client, insert with it
- Contacts: receive `sf_contact_id` and `sf_account_id`, resolve `company_id` by matching `sf_account_id` on `companies` table
- Activities: receive `sf_activity_id`, `sf_contact_id`, `sf_account_id`, resolve `contact_id` and `company_id` via SF IDs
- Tasks: same SF ID resolution as activities
- Use `upsert` with SF ID conflict to prevent duplicates

#### 3. Update Import Page (`src/pages/Import.tsx`)
- Parse **Account ID** from accounts file → `sf_account_id`
- Parse **Contact ID** and **Account ID** from contacts file → `sf_contact_id`, `sf_account_id`
- Parse **Activity ID**, **Account ID** from activities file → `sf_activity_id`, `sf_account_id`
- Extract contact name from activities "Name" column to match `sf_contact_id` via a lookup (or pass name for fallback)
- Actually, the activities file has **Account ID** but not Contact ID directly. We'll need to match contacts by the "Name" column against our contact records, OR look up the contact via company. Since activities have Account ID, we can at least link company_id reliably.

Wait — re-checking the activities file: it has `Account ID` (col 0) and `Activity ID` (col 2), but no `Contact ID` column. The contact is identified by "Name" (col 6) which is a display name like "Joakim Almvik". So for activities→contact linking, we still need name-based matching for contacts, but company linking will be reliable via `sf_account_id`.

#### Revised approach for activities:
- Link `company_id` via `sf_account_id` (reliable)
- Link `contact_id` by splitting "Name" into first/last and matching against contacts table (best-effort, same as before but with company scoping for better accuracy)

#### 4. No UI changes needed
CompanyDetail, ContactDetail, and list pages already query by `company_id`/`contact_id` foreign keys. Once relationships are correctly established during import, everything displays correctly.

### Import Flow Summary

```text
Step 1: DELETE all rows from activities, tasks, contacts, companies
Step 2: Parse accounts.xlsx → INSERT companies with sf_account_id
Step 3: Parse contacts.xlsx → INSERT contacts with sf_contact_id
        Resolve company_id: JOIN on sf_account_id = companies.sf_account_id  
Step 4: Parse activities.xlsx → Split into activities + tasks
        Resolve company_id: JOIN on sf_account_id = companies.sf_account_id
        Resolve contact_id: Match "Name" against contacts (scoped by company)
```

### Files to modify
- **Migration**: Add `sf_account_id`/`sf_contact_id`/`sf_activity_id` columns
- **`supabase/functions/salesforce-import/index.ts`**: Use SF IDs for relationship resolution
- **`src/pages/Import.tsx`**: Extract SF IDs from Excel columns and send to edge function

