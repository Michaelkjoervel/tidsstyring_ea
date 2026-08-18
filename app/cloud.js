/*
 * Supabase-lag. Bruges kun i cloud-mode (se config.js).
 *
 * Strategi: localStorage-laget i db.js fungerer som in-memory cache der
 * hydreres fra Supabase ved hver navigation. Alle skrivninger sendes
 * straks videre til Supabase (write-through). Fejlede skrivninger lægges
 * i en kø og forsøges igen automatisk.
 */
window.Cloud = (function () {
  var client = null;
  var queue = [];                  // fejlede skrivninger: {op, table, payload, forsoeg}
  var flushTimer = null;
  var writeChain = Promise.resolve(); // serialiserer skrivninger (bevarer FK-rækkefølge)
  var MAX_FORSOEG = 6;
  var PAGE = 1000;                 // PostgREST returnerer højst 1000 rækker pr. kald

  var TABLES = ['users', 'recruitments', 'time_entries', 'activity_log', 'comments'];

  function enabled() {
    return window.EA_CONFIG.CLOUD && !!client;
  }

  function init() {
    if (!window.EA_CONFIG.CLOUD) return false;
    if (!window.supabase || !window.supabase.createClient) {
      console.error('Supabase-scriptet kunne ikke indlæses fra CDN.');
      return false;
    }
    client = window.supabase.createClient(
      window.EA_CONFIG.SUPABASE_URL,
      window.EA_CONFIG.SUPABASE_ANON_KEY
    );
    flushTimer = setInterval(flush, 15000);
    return true;
  }

  async function signIn(email, password) {
    var res = await client.auth.signInWithPassword({ email: email, password: password });
    if (res.error) throw res.error;
    return res.data;
  }

  async function signOut() {
    await client.auth.signOut();
  }

  async function getSession() {
    var res = await client.auth.getSession();
    return res.data ? res.data.session : null;
  }

  function onAuthChange(cb) {
    client.auth.onAuthStateChange(function (_event, session) { cb(session); });
  }

  /* Henter alle tabeller (pagineret — PostgREST afkorter ellers ved 1000 rækker)
     og returnerer et komplet datasæt til cachen. */
  async function hydrate() {
    var data = {};
    for (var i = 0; i < TABLES.length; i++) {
      var t = TABLES[i];
      var rows = [];
      var from = 0;
      for (;;) {
        var res = await client.from(t).select('*').range(from, from + PAGE - 1);
        if (res.error) throw res.error;
        rows = rows.concat(res.data || []);
        if (!res.data || res.data.length < PAGE) break;
        from += PAGE;
      }
      data[t] = rows;
    }
    return data;
  }

  /* Finder navnet på en kolonne som databasen ikke kender (PGRST204).
     Sker hvis en schema-migrering mangler — fx en ny kolonne der endnu
     ikke er tilføjet i Supabase. */
  function ukendtKolonne(err) {
    var besked = (err && (err.message || err.details)) || '';
    var m = /Could not find the '([^']+)' column/i.exec(besked);
    if (m) return m[1];
    m = /column "([^"]+)" of relation/i.exec(besked);
    return m ? m[1] : null;
  }

  async function executeWrite(item) {
    var res;
    if (item.op === 'upsert') {
      res = await client.from(item.table).upsert(item.payload);
    } else {
      res = await client.from(item.table).delete().eq('id', item.payload);
    }
    if (res.error) {
      // Mangler kolonnen i databasen, gemmes rækken uden den i stedet for
      // at fejle helt — så tidsregistrering virker indtil migreringen køres.
      var kol = item.op === 'upsert' ? ukendtKolonne(res.error) : null;
      if (kol && Object.prototype.hasOwnProperty.call(item.payload, kol)) {
        console.warn('Kolonnen "' + kol + '" mangler i databasen (' + item.table +
          '). Gemmer uden den — kør migreringen i supabase/schema.sql.');
        var uden = Object.assign({}, item.payload);
        delete uden[kol];
        var res2 = await client.from(item.table).upsert(uden);
        if (res2.error) throw res2.error;
        return;
      }
      throw res.error;
    }
  }

  /* Write-through. Alle skrivninger serialiseres gennem én kæde, så
     rækkefølgen bevares (fx rekruttering før dens log-poster).
     Fejlede skrivninger lægges i kø og forsøges igen automatisk. */
  function enqueueWrite(item) {
    writeChain = writeChain.then(function () {
      return executeWrite(item).catch(function (e) {
        console.error('Cloud-skrivning fejlede (' + item.table + '):', e);
        item.forsoeg = (item.forsoeg || 0) + 1;
        queue.push(item);
        notifyQueued();
      });
    });
    return writeChain;
  }

  function upsert(table, row) {
    return enqueueWrite({ op: 'upsert', table: table, payload: row, forsoeg: 0 });
  }

  function remove(table, id) {
    return enqueueWrite({ op: 'remove', table: table, payload: id, forsoeg: 0 });
  }

  function notifyQueued() {
    if (window.Toast) {
      Toast.show('Kunne ikke gemme til skyen — prøver igen automatisk.', 'error');
    }
  }

  /* Forsøg at aflevere kø-lagte skrivninger igen. Efter for mange forgæves
     forsøg opgives skrivningen med tydelig besked, i stedet for at fejle
     stille for evigt (fx ved dublet-rekrutteringsnummer). */
  async function flush() {
    if (!enabled() || queue.length === 0) return;
    var pending = queue.slice();
    queue = [];
    for (var i = 0; i < pending.length; i++) {
      var item = pending[i];
      try {
        await executeWrite(item);
      } catch (e) {
        item.forsoeg = (item.forsoeg || 0) + 1;
        if (item.forsoeg >= MAX_FORSOEG) {
          console.error('Cloud-skrivning opgivet efter ' + item.forsoeg + ' forsøg (' + item.table + '):', e, item.payload);
          if (window.Toast) {
            Toast.show('En ændring kunne ikke gemmes i skyen og er opgivet (' + item.table +
              '). Genindlæs siden og prøv igen.', 'error');
          }
        } else {
          queue.push(item); // stadig fejl — behold i køen
        }
      }
    }
    if (pending.length > 0 && queue.length === 0 && window.Toast) {
      Toast.show('Alle ændringer er nu gemt i skyen.', 'success');
    }
  }

  function pendingWrites() { return queue.length; }

  // Advar hvis brugeren lukker siden med usendte skrivninger.
  window.addEventListener('beforeunload', function (e) {
    if (queue.length > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  return {
    init: init,
    enabled: enabled,
    signIn: signIn,
    signOut: signOut,
    getSession: getSession,
    onAuthChange: onAuthChange,
    hydrate: hydrate,
    upsert: upsert,
    remove: remove,
    flush: flush,
    pendingWrites: pendingWrites
  };
})();
