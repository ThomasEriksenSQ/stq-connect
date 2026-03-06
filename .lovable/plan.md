

## Plan: Full Salesforce CSV Reimport

### Overview
Replace the current XLSX-based import with a new CSV-based import that reads 4 Salesforce Data Export files (Account, Contact, Task, Event). All existing data is cleared and re-inserted with correct relational mapping.

### Data Flow
```text
CSV Files (client-side parsing)
  → Account.csv → companies table (sf_account_id = SF Id)
  → Contact.csv → contacts table (sf_contact_id = SF Id, linked via AccountId)
  → Task.csv   → tasks table (Type=Task/Call) + activities table (Type=other)
  → Event.csv  → activities table (type=meeting)
```

### Changes

**1. `src/pages/Import.tsx`** — Rewrite to accept 4 CSV files
- Parse CSV with proper UTF-8 handling and quoted fields
- Map Account columns: Id→sf_account_id, Name, Type→status, Industry, Phone, Website, Organization_number__c, OwnerId→owner_id
- Map Contact columns: Id→sf_contact_id, AccountId→sf_account_id (for resolution), FirstName, LastName, Email, Phone/MobilePhone, Title, Linkedin__c, Description, OwnerId
- Map Task columns: Id→sf_activity_id, WhoId (contact), WhatId/AccountId (company), Subject, ActivityDate, Status, Priority, Description, Type, OwnerId
- Map Event columns: Id→sf_activity_id, WhoId, WhatId/AccountId, Subject, ActivityDate, Description, OwnerId
- Treat `"000000000000000AAA"` and empty strings as null everywhere
- Send batches to edge function as before

**2. `supabase/functions/salesforce-import/index.ts`** — Update company resolution logic
- For contacts: resolve company_id from sf_account_id as before (no change needed)
- For tasks/activities: implement the 3-step company resolution:
  1. WhatId → find company by sf_account_id
  2. AccountId → find company by sf_account_id  
  3. WhoId → find contact by sf_contact_id → get contact's company_id
- For contact resolution on tasks/activities: WhoId → find contact by sf_contact_id
- Task.csv "Call" type → activities table (type=call), "Task" → tasks table, others → activities (type=note)
- Event.csv → all go to activities table (type=meeting)

**3. OwnerId Mapping**
- Keep existing THOMAS_ID / JR_ID mapping in Import.tsx
- Map Salesforce OwnerId strings to the two known user UUIDs

### Null value handling
Every field read from CSV is checked: if value is `""` or `"000000000000000AAA"`, treat as null. This is critical for WhatId, AccountId, WhoId, and all relation fields.

### No schema changes needed
The existing database tables (companies, contacts, activities, tasks) already have the right columns including sf_account_id, sf_contact_id, sf_activity_id. No migrations required.

