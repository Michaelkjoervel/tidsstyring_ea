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
  var queue = [];        // fejlede skrivninger: {op, table, payload}
  var flushTimer = null;

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

  /* Henter alle tabeller og returnerer et komplet datasæt til cachen. */
  async function hydrate() {
    var data = {};
    for (var i = 0; i < TABLES.length; i++) {
      var t = TABLES[i];
      var res = await client.from(t).select('*');
      if (res.error) throw res.error;
      data[t] = res.data || [];
    }
    return data;
  }

  /* Write-through: læg i kø ved fejl, så intet går tabt. */
  async function upsert(table, row) {
    try {
      var res = await client.from(table).upsert(row);
      if (res.error) throw res.error;
    } catch (e) {
      console.error('Cloud-upsert fejlede (' + table + '):', e);
      queue.push({ op: 'upsert', table: table, payload: row });
      notifyQueued();
    }
  }

  async function remove(table, id) {
    try {
      var res = await client.from(table).delete().eq('id', id);
      if (res.error) throw res.error;
    } catch (e) {
      console.error('Cloud-sletning fejlede (' + table + '):', e);
      queue.push({ op: 'remove', table: table, payload: id });
      notifyQueued();
    }
  }

  function notifyQueued() {
    if (window.Toast) {
      Toast.show('Kunne ikke gemme til skyen — prøver igen automatisk.', 'error');
    }
  }

  /* Forsøg at aflevere kø-lagte skrivninger igen. */
  async function flush() {
    if (!enabled() || queue.length === 0) return;
    var pending = queue.slice();
    queue = [];
    for (var i = 0; i < pending.length; i++) {
      var item = pending[i];
      try {
        var res;
        if (item.op === 'upsert') {
          res = await client.from(item.table).upsert(item.payload);
        } else {
          res = await client.from(item.table).delete().eq('id', item.payload);
        }
        if (res.error) throw res.error;
      } catch (e) {
        queue.push(item); // stadig fejl — behold i køen
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
