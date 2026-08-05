# erwin andersen tidsregistrering — opsætningsguide

Internt tidsregistreringsværktøj til rekrutteringsopgaver. Appen er rene
statiske filer (HTML + vanilla JavaScript + CSS) og kan køre i to tilstande:

| Tilstand | Login | Data | Kræver opsætning |
|---|---|---|---|
| **Lokal demo-mode** | Klik på initialer | localStorage i din browser | Nej — virker med det samme |
| **Delt cloud-mode** | Email + adgangskode | Supabase (delt mellem alle) | Ja — se afsnit B |

Tilstanden vælges automatisk: er `SUPABASE_URL` og `SUPABASE_ANON_KEY` tomme
i `app/config.js`, kører appen i lokal demo-mode.

---

## A) Lokal demo-kørsel (ingen opsætning)

1. Åbn en terminal i projektmappen.
2. Start en lokal webserver:

   ```bash
   python -m http.server 8000
   ```

3. Åbn <http://localhost:8000> i din browser.
4. Log ind ved at klikke på en bruger (fx **HRN**, som er admin).

Demo-data seedes automatisk første gang. Al data ligger i browserens
localStorage — den deles ikke med andre, og den overlever genstart af
browseren. Under **Admin → Nulstil demo-data** kan du starte forfra.

> **Tip:** Du kan også bare dobbeltklikke på `index.html`, men en lokal
> webserver anbefales, da den svarer til den måde GitHub Pages serverer
> filerne på.

---

## B) Delt cloud-mode med Supabase

### 1. Opret Supabase-projekt

1. Gå til <https://supabase.com> og opret en konto (gratis plan er rigeligt).
2. Klik **New project**.
3. Vælg organisationen, giv projektet et navn (fx `ea-tidsregistrering`),
   sæt en stærk database-adgangskode og vælg en **EU-region**
   (fx *Central EU (Frankfurt)*) af hensyn til GDPR.
4. Vent 1-2 minutter på at projektet er klar.

### 2. Kør database-scriptet

1. Åbn projektet og gå til **SQL Editor** i venstremenuen.
2. Klik **New query**.
3. Kopiér hele indholdet af `supabase/schema.sql` ind og klik **Run**.
4. Scriptet opretter tabeller, indeks, Row Level Security-policies og de
   5 brugerprofiler — plus lidt demo-data (den nederste blok i scriptet kan
   slettes, hvis I vil starte med en tom database).

> **Bemærk ved gen-kørsel:** Scriptet kan køres igen uden fejl, men
> brugerprofil-blokken nulstiller de 5 profiler til scriptets værdier
> (navne, roller, aktiv). Har I rettet profiler i appen, så udelad den
> blok, når scriptet køres igen.

### 3. Opret login-konti

Brugerprofilerne i databasen er kun stamdata — selve login-kontiene
oprettes under **Authentication → Users**:

1. Gå til **Authentication → Users** og klik **Add user → Create new user**.
2. Opret én konto pr. medarbejder med **præcis samme email** som i profilen:

   | Email | Profil |
   |---|---|
   | mkj@eandersen.dk | MKJ (admin) |
   | hrn@eandersen.dk | HRN (admin) |
   | mail@eandersen.dk | EFA |
   | bdl@eandersen.dk | BDL |
   | lbs@eandersen.dk | LBS |

3. Sæt en adgangskode og slå **Auto Confirm User** til (ellers skal emailen
   bekræftes via et link før login virker).

> Appen matcher login-kontoen med brugerprofilen via emailen. Er der ingen
> profil med den email, afvises login med en fejlbesked.

### 4. Indsæt nøgler i config.js

1. Gå til **Settings → API** (eller **Project Settings → API Keys**) i Supabase.
2. Kopiér **Project URL** og **anon public**-nøglen.
3. Åbn `app/config.js` og udfyld:

   ```js
   SUPABASE_URL: 'https://dit-projekt-id.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...'
   ```

4. Commit og push ændringen (eller genindlæs siden lokalt). Appen skifter
   automatisk til cloud-mode, og loginskærmen beder nu om email + adgangskode.

`anon`-nøglen er designet til at ligge i frontend-kode — datasikkerheden
håndhæves af Row Level Security, som kræver et gyldigt login.

### 5. Aktivér GitHub Pages

1. Push projektet til et GitHub-repository.
2. Gå til **Settings → Pages** i repositoriet.
3. Under **Build and deployment** vælg **Deploy from a branch**.
4. Vælg branchen (typisk `main`) og mappen **/ (root)**. Klik **Save**.
5. Efter ca. et minut er appen live på
   `https://<brugernavn>.github.io/<repo-navn>/`.

> **Cache-busting:** Alle script-tags i `index.html` har `?v=1`. Bump tallet
> (fx til `?v=2`) når I udruller nye versioner, så browsere ikke bruger
> gamle cachede filer.

---

## C) Valgfrit: eget domæne

1. Gå til **Settings → Pages → Custom domain** i GitHub-repositoriet.
2. Indtast domænet (fx `tid.eandersen.dk`) og klik **Save**.
3. Opret en **CNAME-record** hos jeres DNS-udbyder, der peger
   `tid.eandersen.dk` på `<brugernavn>.github.io`.
4. Vent på at DNS slår igennem, og slå **Enforce HTTPS** til.

---

## D) Nulstil data via SQL

Kør i **SQL Editor** i Supabase:

```sql
-- Slet ALT indhold, men behold brugerprofilerne:
delete from recruitments;   -- tidsregistreringer, log og kommentarer følger med (cascade)

-- Slet kun demo-dataene fra schema.sql:
delete from recruitments where id like 'demo-r-%';
```

I lokal demo-mode nulstiller du i stedet under **Admin → Nulstil demo-data**
(eller ved at rydde websitedata for siden i browseren).

---

## E) Skift admin / tilføj bruger

### Gør en bruger til admin (eller omvendt)

- **I appen:** Log ind som admin → **Admin → Brugere → Ret** → sæt
  App-rolle til *Administrator*.
- **Via SQL:**

  ```sql
  update users set app_rolle = 'admin' where initialer = 'EFA';
  ```

### Tilføj en ny medarbejder (cloud-mode — begge trin er nødvendige)

1. **Profil:** Log ind som admin → **Admin → Opret bruger** (initialer,
   navn, email, rolle).
2. **Login-konto:** Opret kontoen i Supabase under **Authentication →
   Users** med samme email (husk *Auto Confirm User*).

I lokal demo-mode er trin 1 nok.

### Nedlæg en medarbejder

- **I appen:** **Admin → Brugere → Nedlæg**. Brugeren kan ikke længere
  logge ind, men al historik (tidsregistreringer m.m.) bevares.
- I cloud-mode bør login-kontoen også deaktiveres/slettes under
  **Authentication → Users**.

### Ret navne

Demo-profilerne er oprettet med initialer som navn. Ret de rigtige navne
under **Admin → Brugere → Ret** (eller via SQL på `users.navn`).

---

## Filstruktur

```
index.html          — appens eneste HTML-side (indlæser alle scripts)
app/config.js       — Supabase-nøgler + appnavn (tomme nøgler = lokal demo-mode)
app/cloud.js        — Supabase-klient: auth, hydrering, write-through, retry-kø
app/db.js           — datalag: tabeller, validering, beregninger (mapper 1:1 til schema.sql)
app/seed.js         — demo-data til lokal mode
app/components.js   — genbrugelige UI-komponenter (sidebar, ikoner, badges, modal, toast)
app/views.js        — de 8 skærmes HTML-rendering
app/app.js          — router, auth, event-bindings, CSV-eksport
app/style.css       — al styling
supabase/schema.sql — komplet SQL: tabeller, RLS, brugerprofiler, demo-data
SETUP.md            — denne guide
```
