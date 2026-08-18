/*
 * Datalag. Feltnavne mapper 1:1 til supabase/schema.sql.
 *
 * Lokal demo-mode: hele datasættet gemmes i localStorage.
 * Cloud-mode:      datasættet er en in-memory cache der hydreres fra
 *                  Supabase ved hver navigation; alle skrivninger sendes
 *                  straks videre via Cloud (write-through).
 */
window.DB = (function () {
  var LS_KEY = 'ea_tid_data_v1';
  var TABLES = ['users', 'recruitments', 'time_entries', 'activity_log', 'comments'];

  /* ---------- Faste lister ---------- */

  var ROLLER = ['Rekrutteringspartner', 'Rekrutteringskonsulent', 'Marketing'];
  var FASER = ['Opstartsfase', 'Rekrutteringsfase', 'Afslutningsfase'];

  /* Kategorier til tidsregistrering — grupperet så listen er hurtig at skanne.
     Ret frit i listen; kategorier bruges kun som tekst (ingen db-constraint),
     så eksisterende registreringer påvirkes ikke af ændringer her. */
  var KATEGORI_GRUPPER = [
    { gruppe: 'Opstart', punkter: [
      'Opstartsmøde med kunde',
      'Behovsafdækning & jobprofil',
      'Annoncetekst & jobopslag',
      'Markedskortlægning'
    ] },
    { gruppe: 'Rekruttering', punkter: [
      'Search & research',
      'Kandidatkontakt & dialog',
      'Screening af ansøgninger',
      'Interview med kandidat',
      'Test & assessment',
      'Kandidatpræsentation for kunde'
    ] },
    { gruppe: 'Afslutning', punkter: [
      'Referencetagning',
      'Kontrakt & forhandling',
      'Opfølgning & onboarding'
    ] },
    { gruppe: 'Generelt', punkter: [
      'Statusmøde med kunde',
      'Administration & dokumentation',
      'Rejsetid',
      'Andet'
    ] }
  ];

  var KATEGORIER = KATEGORI_GRUPPER.reduce(function (alle, g) {
    return alle.concat(g.punkter);
  }, []);

  var STATUSSER = ['Aktiv', 'På pause', 'Besat', 'Annulleret', 'Afsluttet'];
  var OPGAVETYPER = ['Fuld rekruttering', 'Searchopgave'];
  var LUKKEDE_STATUSSER = ['Besat', 'Annulleret', 'Afsluttet'];

  var store = emptyStore();

  function emptyStore() {
    return { users: [], recruitments: [], time_entries: [], activity_log: [], comments: [] };
  }

  /* ---------- Init / persistens ---------- */

  function init() {
    if (window.EA_CONFIG.CLOUD) {
      store = emptyStore(); // fyldes via hydrate()
      return;
    }
    var raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) { /* private mode */ }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        store = emptyStore();
        TABLES.forEach(function (t) {
          if (Array.isArray(parsed[t])) store[t] = parsed[t];
        });
        return;
      } catch (e) {
        console.error('Kunne ikke læse gemt data — nulstiller.', e);
      }
    }
    store = window.Seed.demoData();
    persist();
  }

  function persist() {
    if (window.EA_CONFIG.CLOUD) return; // cloud: kun in-memory cache
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(store));
    } catch (e) {
      console.error('Kunne ikke gemme til localStorage:', e);
    }
  }

  /* Cloud-mode: erstat hele cachen med frisk data fra Supabase. */
  function setAll(data) {
    store = emptyStore();
    TABLES.forEach(function (t) {
      if (Array.isArray(data[t])) store[t] = data[t];
    });
  }

  /* Admin: JSON-import. I cloud-mode skubbes hele det nye datasæt til
     Supabase, og rækker der ikke findes i importen slettes — så importen
     reelt ERSTATTER data (ellers ville slettede rækker genopstå ved næste
     hydrering). Skrivningerne serialiseres i cloud.js, så rækkefølgen
     (forældre før børn ved upsert, børn før forældre ved sletning) holder. */
  function replaceAll(data) {
    var gammel = store;
    setAll(data);
    persist();
    if (window.Cloud.enabled()) {
      TABLES.forEach(function (t) {
        store[t].forEach(function (row) { Cloud.upsert(t, row); });
      });
      ['comments', 'activity_log', 'time_entries', 'recruitments', 'users'].forEach(function (t) {
        var behold = {};
        store[t].forEach(function (r) { behold[r.id] = true; });
        (gammel[t] || []).forEach(function (r) {
          if (!behold[r.id]) Cloud.remove(t, r.id);
        });
      });
    }
  }

  function exportAll() {
    var out = { eksporteret: nowISO(), app: window.EA_CONFIG.APP_NAME };
    TABLES.forEach(function (t) { out[t] = store[t]; });
    return out;
  }

  function resetDemo() {
    store = window.Seed.demoData();
    persist();
  }

  /* ---------- CRUD ---------- */

  function all(table) { return store[table] || []; }

  function get(table, id) {
    var rows = store[table] || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === id) return rows[i];
    }
    return null;
  }

  function insert(table, data) {
    var row = Object.assign({ id: uuid(), created_at: nowISO() }, data);
    if (table === 'recruitments' || table === 'time_entries') row.updated_at = row.created_at;
    store[table].push(row);
    persist();
    if (window.Cloud.enabled()) Cloud.upsert(table, row);
    return row;
  }

  function update(table, id, patch) {
    var row = get(table, id);
    if (!row) return null;
    Object.assign(row, patch);
    if (table === 'recruitments' || table === 'time_entries') row.updated_at = nowISO();
    persist();
    if (window.Cloud.enabled()) Cloud.upsert(table, row);
    return row;
  }

  function remove(table, id) {
    store[table] = (store[table] || []).filter(function (r) { return r.id !== id; });
    if (table === 'recruitments') {
      // Spejler databasens "on delete cascade" i cachen.
      ['time_entries', 'activity_log', 'comments'].forEach(function (t) {
        store[t] = store[t].filter(function (r) { return r.recruitment_id !== id; });
      });
    }
    persist();
    if (window.Cloud.enabled()) Cloud.remove(table, id);
  }

  /* ---------- Aktivitetslog ---------- */

  function log(recruitmentId, userId, type, beskrivelse) {
    return insert('activity_log', {
      recruitment_id: recruitmentId,
      user_id: userId,
      type: type,
      beskrivelse: beskrivelse
    });
  }

  /* ---------- Hjælpere ---------- */

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function nowISO() { return new Date().toISOString(); }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function userById(id) { return get('users', id); }

  function userLabel(id) {
    var u = userById(id);
    if (!u) return '—';
    if (!u.navn || u.navn === u.initialer) return u.initialer;
    return u.navn + ' (' + u.initialer + ')';
  }

  function userInitialer(id) {
    var u = userById(id);
    return u ? u.initialer : '—';
  }

  function activeUsers() {
    return all('users')
      .filter(function (u) { return u.aktiv !== false; })
      .sort(function (a, b) { return a.navn.localeCompare(b.navn, 'da'); });
  }

  /* Autogenereret rekrutteringsnummer: EA-ÅÅÅÅ-001, fortløbende pr. år. */
  function nextRekrutteringsnummer() {
    var year = new Date().getFullYear();
    var max = 0;
    all('recruitments').forEach(function (r) {
      var m = /^EA-(\d{4})-(\d+)$/.exec(r.rekrutteringsnummer || '');
      if (m && parseInt(m[1], 10) === year) {
        var n = parseInt(m[2], 10);
        if (n > max) max = n;
      }
    });
    var next = String(max + 1);
    while (next.length < 3) next = '0' + next;
    return 'EA-' + year + '-' + next;
  }

  /* ---------- Formatering (dansk) ---------- */

  /* 2.5 -> "2,5" */
  function fmtTal(n, decimals) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    var d = decimals === undefined ? 1 : decimals;
    var s = Number(n).toFixed(d);
    // fjern unødvendige decimal-nuller: "2.00" -> "2", "2.50" -> "2,5"
    if (s.indexOf('.') !== -1) {
      s = s.replace(/0+$/, '').replace(/\.$/, '');
    }
    return s.replace('.', ',');
  }

  /* 2.5 -> "2,5 t" */
  function fmtTimer(n) { return fmtTal(n, 2) + ' t'; }

  /* "2026-03-14" -> "14.03.2026" */
  function fmtDato(iso) {
    if (!iso) return '—';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (!m) return String(iso);
    return m[3] + '.' + m[2] + '.' + m[1];
  }

  /* ISO-tidsstempel -> "14.03.2026 kl. 09.30" */
  function fmtDatoTid(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear() +
      ' kl. ' + pad2(d.getHours()) + '.' + pad2(d.getMinutes());
  }

  /* 480000 -> "480.000 kr." */
  function fmtBeloeb(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    var s = String(Math.round(Number(n)));
    var neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    var out = '';
    while (s.length > 3) {
      out = '.' + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    return (neg ? '-' : '') + s + out + ' kr.';
  }

  /* ---------- Parsing ---------- */

  /* "2,5" eller "2.5" -> 2.5. Returnerer NaN ved ugyldigt input. */
  function parseTimer(input) {
    if (input === null || input === undefined) return NaN;
    var s = String(input).trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 100) / 100;
  }

  /* "480.000", "480000", "480 000 kr." -> 480000. Tom streng -> null.
     Alt der ikke er et rent beløb (fx "1,2 mio") -> NaN, så valideringen
     kan afvise det i stedet for at gemme et misvisende tal. */
  function parseBeloeb(input) {
    if (input === null || input === undefined) return null;
    var s = String(input).trim();
    if (s === '') return null;
    s = s.replace(/kr\.?$/i, '').trim();
    s = s.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Math.round(parseFloat(s));
  }

  /* ---------- Validering (danske fejlbeskeder) ---------- */

  function validateRecruitment(data) {
    var errors = [];
    if (!data.titel || !String(data.titel).trim()) {
      errors.push('Titel er påkrævet.');
    }
    if (!data.virksomhedsnavn || !String(data.virksomhedsnavn).trim()) {
      errors.push('Virksomhedsnavn er påkrævet.');
    }
    if (OPGAVETYPER.indexOf(data.opgavetype) === -1) {
      errors.push('Vælg en opgavetype.');
    }
    if (data.fase && FASER.indexOf(data.fase) === -1) {
      errors.push('Ugyldig fase.');
    }
    if (data.status && STATUSSER.indexOf(data.status) === -1) {
      errors.push('Ugyldig status.');
    }
    if (!data.startdato) {
      errors.push('Startdato er påkrævet.');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startdato)) {
      errors.push('Ugyldig startdato.');
    } else if (data.startdato > todayISO()) {
      errors.push('Startdato må ikke ligge i fremtiden.');
    }
    if (data.honorar !== null && data.honorar !== undefined) {
      if (isNaN(data.honorar)) {
        errors.push('Honorar skal være et beløb, fx 480.000.');
      } else if (data.honorar < 0) {
        errors.push('Honorar kan ikke være negativt.');
      }
    }
    return errors;
  }

  function validateTimeEntry(data) {
    var errors = [];
    if (!data.recruitment_id || !get('recruitments', data.recruitment_id)) {
      errors.push('Vælg en rekruttering.');
    }
    if (!data.user_id || !get('users', data.user_id)) {
      errors.push('Der mangler en bruger på registreringen.');
    }
    if (ROLLER.indexOf(data.rolle) === -1) {
      errors.push('Vælg en rolle.');
    }
    if (FASER.indexOf(data.fase) === -1) {
      errors.push('Vælg en fase.');
    }
    if (!data.dato || !/^\d{4}-\d{2}-\d{2}$/.test(data.dato)) {
      errors.push('Dato er påkrævet.');
    } else if (data.dato > todayISO()) {
      errors.push('Dato må ikke ligge i fremtiden.');
    }
    if (data.kategori && KATEGORIER.indexOf(data.kategori) === -1) {
      errors.push('Ukendt kategori.');
    }
    if (isNaN(data.timer)) {
      errors.push('Ugyldigt timetal — brug fx 2,5.');
    } else if (data.timer <= 0) {
      errors.push('Timer skal være større end 0.');
    } else if (data.timer > 24) {
      errors.push('Timer kan højst være 24 pr. registrering.');
    }
    return errors;
  }

  /* ---------- Beregninger ---------- */

  function sumTimer(entries) {
    var sum = 0;
    entries.forEach(function (e) { sum += Number(e.timer) || 0; });
    return Math.round(sum * 100) / 100;
  }

  /* Grupperet timesum: key(entry) -> label. Returnerer [{label, value}] sorteret faldende. */
  function timerFordeling(entries, keyFn, fixedOrder) {
    var map = {};
    entries.forEach(function (e) {
      var key = keyFn(e);
      if (key === null || key === undefined) return;
      map[key] = (map[key] || 0) + (Number(e.timer) || 0);
    });
    var rows = [];
    if (fixedOrder) {
      fixedOrder.forEach(function (k) {
        rows.push({ label: k, value: Math.round((map[k] || 0) * 100) / 100 });
      });
    } else {
      Object.keys(map).forEach(function (k) {
        rows.push({ label: k, value: Math.round(map[k] * 100) / 100 });
      });
      rows.sort(function (a, b) { return b.value - a.value; });
    }
    return rows;
  }

  function timerPrRolle(entries) {
    return timerFordeling(entries, function (e) { return e.rolle; }, ROLLER);
  }

  function timerPrFase(entries) {
    return timerFordeling(entries, function (e) { return e.fase; }, FASER);
  }

  function timerPrBruger(entries) {
    return timerFordeling(entries, function (e) { return userInitialer(e.user_id); });
  }

  function timerPrOpgavetype(entries) {
    return timerFordeling(entries, function (e) {
      var r = get('recruitments', e.recruitment_id);
      return r ? r.opgavetype : null;
    }, OPGAVETYPER);
  }

  function timerPrKategori(entries) {
    return timerFordeling(entries, function (e) {
      return e.kategori || 'Uden kategori';
    });
  }

  function timerPrRekruttering(entries) {
    var rows = timerFordeling(entries, function (e) { return e.recruitment_id; });
    return rows.map(function (row) {
      return { recruitment: get('recruitments', row.label), value: row.value };
    }).filter(function (row) { return !!row.recruitment; });
  }

  /* Antal dage mellem to ISO-datoer. */
  function dageMellem(fraISO, tilISO) {
    var fra = new Date(fraISO + 'T00:00:00');
    var til = new Date(tilISO + 'T00:00:00');
    if (isNaN(fra.getTime()) || isNaN(til.getTime())) return null;
    return Math.round((til - fra) / 86400000);
  }

  /* Gns. dage fra startdato til ansættelsesdato for besatte rekrutteringer. */
  function gnsDageTilBesaettelse(recruitments) {
    var sum = 0, count = 0;
    recruitments.forEach(function (r) {
      if (r.status === 'Besat' && r.startdato && r.ansaettelsesdato) {
        var d = dageMellem(r.startdato, r.ansaettelsesdato);
        if (d !== null && d >= 0) { sum += d; count++; }
      }
    });
    return count === 0 ? null : Math.round(sum / count);
  }

  /* Tidsregistreringer i datointerval (begge grænser valgfri, ISO-datoer). */
  function entriesIPeriode(fra, til) {
    return all('time_entries').filter(function (e) {
      if (fra && e.dato < fra) return false;
      if (til && e.dato > til) return false;
      return true;
    });
  }

  return {
    // konstanter
    ROLLER: ROLLER,
    FASER: FASER,
    KATEGORIER: KATEGORIER,
    KATEGORI_GRUPPER: KATEGORI_GRUPPER,
    STATUSSER: STATUSSER,
    OPGAVETYPER: OPGAVETYPER,
    LUKKEDE_STATUSSER: LUKKEDE_STATUSSER,
    // init/persistens
    init: init,
    setAll: setAll,
    replaceAll: replaceAll,
    exportAll: exportAll,
    resetDemo: resetDemo,
    // crud
    all: all,
    get: get,
    insert: insert,
    update: update,
    remove: remove,
    log: log,
    // hjælpere
    uuid: uuid,
    nowISO: nowISO,
    todayISO: todayISO,
    userById: userById,
    userLabel: userLabel,
    userInitialer: userInitialer,
    activeUsers: activeUsers,
    nextRekrutteringsnummer: nextRekrutteringsnummer,
    // formatering
    fmtTal: fmtTal,
    fmtTimer: fmtTimer,
    fmtDato: fmtDato,
    fmtDatoTid: fmtDatoTid,
    fmtBeloeb: fmtBeloeb,
    // parsing
    parseTimer: parseTimer,
    parseBeloeb: parseBeloeb,
    // validering
    validateRecruitment: validateRecruitment,
    validateTimeEntry: validateTimeEntry,
    // beregninger
    sumTimer: sumTimer,
    timerPrRolle: timerPrRolle,
    timerPrFase: timerPrFase,
    timerPrBruger: timerPrBruger,
    timerPrOpgavetype: timerPrOpgavetype,
    timerPrKategori: timerPrKategori,
    timerPrRekruttering: timerPrRekruttering,
    dageMellem: dageMellem,
    gnsDageTilBesaettelse: gnsDageTilBesaettelse,
    entriesIPeriode: entriesIPeriode
  };
})();
