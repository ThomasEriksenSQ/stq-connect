
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sf_account_id text UNIQUE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sf_contact_id text UNIQUE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS sf_activity_id text UNIQUE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sf_activity_id text UNIQUE;
