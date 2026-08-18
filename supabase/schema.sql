-- =====================================================================
-- erwin andersen tidsregistrering — komplet database-schema
--
-- Køres i ét hug i Supabase SQL Editor (Database → SQL Editor → New query).
-- Scriptet kan køres flere gange uden fejl (idempotent).
--
-- Indhold:
--   1) Tabeller (users, recruitments, time_entries, activity_log, comments)
--   2) Indeks
--   3) Row Level Security + policies (fuld adgang for indloggede brugere;
--      rollehåndhævelse — fx "kun admin må slette" — sker i selve appen)
--   4) De 5 brugerprofiler
--   5) Valgfri demo-data (tydeligt markeret blok — kan slettes/springes over)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TABELLER
-- ---------------------------------------------------------------------
-- Bemærk: id-kolonner er text (appen genererer UUID-strenge selv), så
-- JSON-eksport fra lokal demo-mode kan importeres direkte i cloud-mode.

create table if not exists users (
  id          text primary key default gen_random_uuid()::text,
  initialer   text not null unique,
  navn        text not null,
  email       text not null unique,
  rolle       text not null check (rolle in ('Rekrutteringspartner', 'Rekrutteringskonsulent', 'Marketing')),
  app_rolle   text not null default 'user' check (app_rolle in ('admin', 'user')),
  aktiv       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists recruitments (
  id                     text primary key default gen_random_uuid()::text,
  rekrutteringsnummer    text not null unique,
  titel                  text not null,
  virksomhedsnavn        text not null,
  opgavetype             text not null check (opgavetype in ('Fuld rekruttering', 'Searchopgave')),
  beskrivelse            text,
  rekrutteringspartner   text references users(id) on delete set null,
  rekrutteringskonsulent text references users(id) on delete set null,
  fase                   text not null default 'Opstartsfase'
                           check (fase in ('Opstartsfase', 'Rekrutteringsfase', 'Afslutningsfase')),
  status                 text not null default 'Aktiv'
                           check (status in ('Aktiv', 'På pause', 'Besat', 'Annulleret', 'Afsluttet')),
  honorar                numeric,
  startdato              date not null,
  ansaettelsesdato       date,
  annulleringsaarsag     text,
  noter                  text,
  favorit                boolean not null default false,
  oprettet_af            text references users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists time_entries (
  id             text primary key default gen_random_uuid()::text,
  recruitment_id text not null references recruitments(id) on delete cascade,
  user_id        text not null references users(id) on delete cascade,
  rolle          text not null check (rolle in ('Rekrutteringspartner', 'Rekrutteringskonsulent', 'Marketing')),
  fase           text not null check (fase in ('Opstartsfase', 'Rekrutteringsfase', 'Afslutningsfase')),
  dato           date not null,
  timer          numeric not null check (timer > 0 and timer <= 24),
  kategori       text,
  beskrivelse    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- MIGRERING: tilføjer 'kategori' til databaser oprettet før kategorier
-- blev indført. Harmløs at køre igen på en ny database.
-- Kategorier gemmes som ren tekst (ingen constraint), så listen i
-- app/db.js kan ændres frit uden at røre databasen.
alter table time_entries add column if not exists kategori text;

create table if not exists activity_log (
  id             text primary key default gen_random_uuid()::text,
  recruitment_id text not null references recruitments(id) on delete cascade,
  user_id        text references users(id) on delete set null,
  type           text not null,
  beskrivelse    text not null,
  created_at     timestamptz not null default now()
);

create table if not exists comments (
  id             text primary key default gen_random_uuid()::text,
  recruitment_id text not null references recruitments(id) on delete cascade,
  user_id        text references users(id) on delete set null,
  tekst          text not null,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) INDEKS
-- ---------------------------------------------------------------------

create index if not exists idx_time_entries_recruitment on time_entries (recruitment_id);
create index if not exists idx_time_entries_user        on time_entries (user_id);
create index if not exists idx_time_entries_dato        on time_entries (dato);
create index if not exists idx_activity_log_recruitment on activity_log (recruitment_id);
create index if not exists idx_comments_recruitment     on comments (recruitment_id);

-- ---------------------------------------------------------------------
-- 3) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
-- Alle indloggede brugere (rollen "authenticated") får fuld læse- og
-- skriveadgang. Anonyme besøgende har ingen adgang. Finkornet
-- rollehåndhævelse (admin vs. bruger) sker i appen.

alter table users        enable row level security;
alter table recruitments enable row level security;
alter table time_entries enable row level security;
alter table activity_log enable row level security;
alter table comments     enable row level security;

drop policy if exists "fuld adgang for indloggede" on users;
create policy "fuld adgang for indloggede" on users
  for all to authenticated using (true) with check (true);

drop policy if exists "fuld adgang for indloggede" on recruitments;
create policy "fuld adgang for indloggede" on recruitments
  for all to authenticated using (true) with check (true);

drop policy if exists "fuld adgang for indloggede" on time_entries;
create policy "fuld adgang for indloggede" on time_entries
  for all to authenticated using (true) with check (true);

drop policy if exists "fuld adgang for indloggede" on activity_log;
create policy "fuld adgang for indloggede" on activity_log
  for all to authenticated using (true) with check (true);

drop policy if exists "fuld adgang for indloggede" on comments;
create policy "fuld adgang for indloggede" on comments
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 4) BRUGERPROFILER
-- ---------------------------------------------------------------------
-- Login-kontiene (email + adgangskode) oprettes separat i Supabase under
-- Authentication → Users — se SETUP.md. Emailen SKAL matche profilens email.
--
-- ADVARSEL: 'on conflict do update' betyder at en GEN-KØRSEL af scriptet
-- nulstiller de 5 profiler til værdierne herunder (navne, roller, aktiv).
-- Har I rettet profiler i appen, så spring denne blok over ved gen-kørsel.

insert into users (id, initialer, navn, email, rolle, app_rolle, aktiv) values
  ('u-mkj', 'MKJ', 'MKJ', 'mkj@eandersen.dk',  'Marketing',              'admin', true),
  ('u-hrn', 'HRN', 'HRN', 'hrn@eandersen.dk',  'Rekrutteringspartner',   'admin', true),
  ('u-efa', 'EFA', 'EFA', 'mail@eandersen.dk', 'Rekrutteringspartner',   'user',  true),
  ('u-bdl', 'BDL', 'BDL', 'bdl@eandersen.dk',  'Rekrutteringskonsulent', 'user',  true),
  ('u-lbs', 'LBS', 'LBS', 'lbs@eandersen.dk',  'Rekrutteringskonsulent', 'user',  true)
on conflict (id) do update set
  initialer = excluded.initialer,
  navn      = excluded.navn,
  email     = excluded.email,
  rolle     = excluded.rolle,
  app_rolle = excluded.app_rolle,
  aktiv     = excluded.aktiv;

-- =====================================================================
-- 5) DEMO-DATA (VALGFRI BLOK — SLET HERFRA OG NED FOR EN TOM DATABASE)
-- =====================================================================
-- Demo-rekrutteringer bruger numre med DEMO-præfiks, så appens rigtige
-- EA-ÅÅÅÅ-NNN-serie starter upåvirket fra 001.

insert into recruitments (id, rekrutteringsnummer, titel, virksomhedsnavn, opgavetype,
    beskrivelse, rekrutteringspartner, rekrutteringskonsulent, fase, status, honorar,
    startdato, ansaettelsesdato, annulleringsaarsag, favorit, oprettet_af)
values
  ('demo-r-01',
   'DEMO-' || extract(year from current_date) || '-001',
   'CFO-rekruttering (demo)', 'Novatek A/S', 'Fuld rekruttering',
   'Demo: CFO til techvirksomhed i vækst.',
   'u-hrn', 'u-bdl', 'Rekrutteringsfase', 'Aktiv', 480000,
   current_date - 45, null, null, true, 'u-hrn'),
  ('demo-r-02',
   'DEMO-' || extract(year from current_date) || '-002',
   'HR Business Partner (demo)', 'Danske Maskinfabrikker A/S', 'Fuld rekruttering',
   'Demo: HRBP til produktionsvirksomhed.',
   'u-efa', 'u-bdl', 'Afslutningsfase', 'Besat', 320000,
   current_date - 80, current_date - 10, null, false, 'u-efa'),
  ('demo-r-03',
   'DEMO-' || extract(year from current_date) || '-003',
   'Salgsdirektør (demo)', 'Fjordlys Pharma ApS', 'Searchopgave',
   'Demo: search efter salgsdirektør med pharma-erfaring.',
   'u-hrn', 'u-lbs', 'Rekrutteringsfase', 'På pause', 250000,
   current_date - 30, null, null, false, 'u-hrn')
on conflict (id) do nothing;

insert into time_entries (id, recruitment_id, user_id, rolle, fase, dato, timer, kategori, beskrivelse)
values
  ('demo-t-01', 'demo-r-01', 'u-hrn', 'Rekrutteringspartner',   'Opstartsfase',      current_date - 43, 4,   'Opstartsmøde med kunde',        'Opstartsmøde og jobprofil'),
  ('demo-t-02', 'demo-r-01', 'u-bdl', 'Rekrutteringskonsulent', 'Rekrutteringsfase', current_date - 30, 8,   'Search & research',             'Executive search, longlist'),
  ('demo-t-03', 'demo-r-01', 'u-mkj', 'Marketing',              'Rekrutteringsfase', current_date - 12, 1.5, 'Annoncetekst & jobopslag',      'Employer branding-materiale'),
  ('demo-t-04', 'demo-r-02', 'u-efa', 'Rekrutteringspartner',   'Opstartsfase',      current_date - 78, 2.5, 'Behovsafdækning & jobprofil',   'Behovsafdækning'),
  ('demo-t-05', 'demo-r-02', 'u-bdl', 'Rekrutteringskonsulent', 'Rekrutteringsfase', current_date - 60, 8,   'Screening af ansøgninger',      null),
  ('demo-t-06', 'demo-r-02', 'u-efa', 'Rekrutteringspartner',   'Afslutningsfase',   current_date - 14, 2,   'Referencetagning',              'Referencetagning og ansættelse'),
  ('demo-t-07', 'demo-r-03', 'u-lbs', 'Rekrutteringskonsulent', 'Opstartsfase',      current_date - 28, 2.5, 'Markedskortlægning',            null)
on conflict (id) do nothing;

insert into activity_log (id, recruitment_id, user_id, type, beskrivelse, created_at)
values
  ('demo-l-01', 'demo-r-01', 'u-hrn', 'oprettet',       'Rekrutteringen blev oprettet', now() - interval '45 days'),
  ('demo-l-02', 'demo-r-01', 'u-hrn', 'fase_aendret',   'Fase ændret fra "Opstartsfase" til "Rekrutteringsfase"', now() - interval '35 days'),
  ('demo-l-03', 'demo-r-02', 'u-efa', 'oprettet',       'Rekrutteringen blev oprettet', now() - interval '80 days'),
  ('demo-l-04', 'demo-r-02', 'u-efa', 'besat',          'Rekrutteringen blev markeret som besat', now() - interval '10 days'),
  ('demo-l-05', 'demo-r-03', 'u-hrn', 'oprettet',       'Rekrutteringen blev oprettet', now() - interval '30 days'),
  ('demo-l-06', 'demo-r-03', 'u-hrn', 'status_aendret', 'Status ændret fra "Aktiv" til "På pause"', now() - interval '21 days')
on conflict (id) do nothing;

insert into comments (id, recruitment_id, user_id, tekst, created_at)
values
  ('demo-c-01', 'demo-r-01', 'u-hrn', 'Kunden ønsker præsentation af 3 kandidater senest i næste uge.', now() - interval '8 days')
on conflict (id) do nothing;

-- =====================================================================
-- SLUT PÅ DEMO-DATA
-- =====================================================================
