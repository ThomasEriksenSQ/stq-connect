

# Plan: Opprett ny bruker og oppdater profiler

## Analyse

- Profiles-tabellen mangler `phone`-kolonne
- Thomas har profil men ikke `user_roles`-oppføring
- Jon Richard trenger: auth-bruker, profil, og rolle

## Steg

### 1. Database-migrasjon: Legg til `phone` på profiles
Legger til en `phone` text-kolonne på `profiles`-tabellen.

### 2. Edge Function: `create-user`
Oppretter en midlertidig Edge Function som bruker `supabase.auth.admin.createUser()` med service_role-nøkkelen for å opprette Jon Richard som auth-bruker. Denne setter også opp profilen automatisk via den eksisterende `handle_new_user`-triggeren.

### 3. Oppdater data
- Oppdater Thomas sin profil: `full_name = 'Thomas Eriksen'`, `phone = '97500321'`
- Oppdater Jon Richards profil: `phone = '93287267'`
- Gi begge brukerne `admin`-rolle i `user_roles`

### 4. Kall Edge Function
Bruker curl-verktøyet til å kalle funksjonen og opprette brukeren.

## Tekniske detaljer

- Edge Function bruker `SUPABASE_SERVICE_ROLE_KEY` for admin-tilgang
- `handle_new_user`-triggeren oppretter automatisk en profil-rad når auth-brukeren opprettes
- Etter opprettelse oppdaterer vi profilen med telefonnummer og fullt navn

