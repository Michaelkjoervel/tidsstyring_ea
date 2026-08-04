/*
 * Konfiguration for "erwin andersen tidsregistrering".
 *
 * LOKAL DEMO-MODE (standard):
 *   Lad SUPABASE_URL og SUPABASE_ANON_KEY stå tomme. Al data gemmes i
 *   browserens localStorage, og der logges ind med initialer.
 *
 * DELT CLOUD-MODE (Supabase):
 *   Udfyld begge nøgler fra dit Supabase-projekt (Settings → API), så
 *   aktiveres email/adgangskode-login og delt data automatisk.
 *   Se SETUP.md for en trin-for-trin guide.
 */
window.EA_CONFIG = {
  APP_NAME: 'erwin andersen tidsregistrering',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: ''
};

// Cloud-mode er aktiv når begge nøgler er udfyldt.
window.EA_CONFIG.CLOUD =
  !!(window.EA_CONFIG.SUPABASE_URL && window.EA_CONFIG.SUPABASE_ANON_KEY);
