/*
 * App-kerne: router, auth, event-bindinger og eksport.
 */
window.App = {
  user: null,
  state: {
    dash: { fra: '', til: '' },
    rec: { q: '', status: '', fase: '', type: '', partner: '' },
    tid: { bruger: '', filterRek: '', fra: '', til: '', rek: '' },
    rap: { fra: '', til: '' },
    quick: { rek: '' },
    detailTab: 'tid'
  }
};

(function () {
  var lastDetailId = null;
  var debounceTimer = null;
  var pendingFocus = null;
  var tidFormDraft = null; // bevarer indtastning når #/tid re-renderes

  /* ---------- Boot ---------- */

  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    DB.init();
    if (window.EA_CONFIG.CLOUD) {
      var ok = Cloud.init();
      if (!ok) {
        document.getElementById('app').innerHTML =
          '<div class="login-wrap"><div class="card login-card"><div class="login-logo">ea</div>' +
          '<p class="login-hint">Supabase kunne ikke indlæses. Tjek din internetforbindelse og nøglerne i app/config.js.</p></div></div>';
        return;
      }
      try {
        var session = await Cloud.getSession();
        if (session && session.user) {
          DB.setAll(await Cloud.hydrate());
          var profil = profileByEmail(session.user.email);
          if (profil && profil.aktiv !== false) {
            App.user = profil;
          } else {
            // Nedlagt/ukendt profil må ikke genoptage en gammel session.
            await Cloud.signOut();
          }
        }
      } catch (e) {
        console.error('Kunne ikke genoprette session:', e);
      }
      Cloud.onAuthChange(function (session) {
        if (!session && App.user) {
          App.user = null;
          render();
        }
      });
    } else {
      var uid = null;
      try { uid = localStorage.getItem('ea_tid_session'); } catch (e) { }
      if (uid) {
        var u = DB.get('users', uid);
        if (u && u.aktiv !== false) App.user = u;
      }
    }
    window.addEventListener('hashchange', onNav);
    bindGlobal();
    render();
  }

  function profileByEmail(email) {
    var mail = String(email || '').toLowerCase();
    var users = DB.all('users');
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email || '').toLowerCase() === mail) return users[i];
    }
    return null;
  }

  /* ---------- Router / render ---------- */

  async function onNav() {
    if (window.EA_CONFIG.CLOUD && App.user) {
      try {
        DB.setAll(await Cloud.hydrate());
        var frisk = DB.get('users', App.user.id);
        if (frisk && frisk.aktiv !== false) {
          App.user = frisk;
        } else {
          // Brugeren er nedlagt (eller slettet) siden sidst — log ud.
          App.user = null;
          resetState();
          try { await Cloud.signOut(); } catch (e2) { }
          Toast.show('Din bruger er nedlagt. Kontakt en administrator.', 'error');
        }
      } catch (e) {
        console.error('Hydrering fejlede:', e);
        Toast.show('Kunne ikke hente data fra skyen — viser senest kendte data.', 'error');
      }
    }
    render();
  }

  function resetState() {
    App.state = {
      dash: { fra: '', til: '' },
      rec: { q: '', status: '', fase: '', type: '', partner: '' },
      tid: { bruger: '', filterRek: '', fra: '', til: '', rek: '' },
      rap: { fra: '', til: '' },
      quick: { rek: '' },
      detailTab: 'tid'
    };
    lastDetailId = null;
  }

  function render() {
    Modal.close(); // en åben modal må ikke overleve navigation/re-render
    var app = document.getElementById('app');
    if (!App.user) {
      app.innerHTML = Views.login();
      bindLoginForm();
      return;
    }

    var hash = location.hash || '#/dashboard';
    var parts = hash.replace(/^#\//, '').split('/');
    var inner = '';

    if (parts[0] === '' || parts[0] === 'dashboard') {
      inner = Views.dashboard();
    } else if (parts[0] === 'rekrutteringer' && parts.length === 1) {
      inner = Views.recruitments();
    } else if (parts[0] === 'rekrutteringer' && parts[1] === 'ny') {
      inner = Views.recruitmentForm(null);
    } else if (parts[0] === 'rekrutteringer' && parts[2] === 'rediger') {
      var recRed = DB.get('recruitments', parts[1]);
      inner = recRed ? Views.recruitmentForm(recRed) : Views.recruitmentDetail(parts[1]);
    } else if (parts[0] === 'rekrutteringer') {
      if (parts[1] !== lastDetailId) {
        App.state.detailTab = 'tid';
        lastDetailId = parts[1];
      }
      inner = Views.recruitmentDetail(parts[1]);
    } else if (parts[0] === 'tid') {
      inner = Views.tid();
    } else if (parts[0] === 'rapporter') {
      inner = Views.reports();
    } else if (parts[0] === 'admin') {
      if (App.user.app_rolle !== 'admin') {
        Toast.show('Kun administratorer har adgang til Admin.', 'error');
        location.hash = '#/dashboard';
        return;
      }
      inner = Views.admin();
    } else {
      inner = Views.dashboard();
    }

    app.innerHTML =
      '<div class="layout">' +
        sidebarHtml(hash, App.user) +
        '<div class="main">' +
          '<header class="topbar">' +
            '<button type="button" class="btn-icon" data-action="nav-toggle" aria-label="Menu">' + icon('menu') + '</button>' +
            '<span class="topbar-title">erwin andersen <strong>tidsregistrering</strong></span>' +
            '<span class="topbar-user">' + esc(App.user.initialer) + '</span>' +
            '<button type="button" class="btn-icon topbar-logout" data-action="logout" ' +
              'title="Log ud" aria-label="Log ud">' + icon('logout') + '</button>' +
          '</header>' +
          (parts[0] === 'tid' ? '' : quickBar()) +
          '<main class="content">' + inner + '</main>' +
        '</div>' +
      '</div>';

    bindForms();
    restoreFilterFocus();
  }

  /* ---------- Login ---------- */

  function bindLoginForm() {
    var form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var email = String(fd.get('email') || '').trim();
      var password = String(fd.get('password') || '');
      if (!email || !password) {
        Toast.show('Udfyld både email og adgangskode.', 'error');
        return;
      }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Logger ind…';
      try {
        await Cloud.signIn(email, password);
        DB.setAll(await Cloud.hydrate());
        var profile = profileByEmail(email);
        if (!profile) {
          await Cloud.signOut();
          Toast.show('Ingen brugerprofil matcher denne email. Kontakt en administrator.', 'error');
          return;
        }
        if (profile.aktiv === false) {
          await Cloud.signOut();
          Toast.show('Denne bruger er nedlagt. Kontakt en administrator.', 'error');
          return;
        }
        App.user = profile;
        resetState();
        location.hash = '#/dashboard';
        Toast.show('Velkommen, ' + DB.userLabel(profile.id) + '!', 'success');
        render();
      } catch (err) {
        console.error(err);
        Toast.show('Login fejlede — tjek email og adgangskode.', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Log ind';
      }
    });
  }

  /* ---------- Globale events (delegation) ---------- */

  function bindGlobal() {
    document.addEventListener('click', function (e) {
      var layout = document.querySelector('.layout.sidebar-open');
      if (layout && !e.target.closest('.sidebar') && !e.target.closest('[data-action="nav-toggle"]')) {
        layout.classList.remove('sidebar-open');
      }
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var action = el.getAttribute('data-action');

      if (action === 'row-open') {
        var hit = e.target.closest('a, button, [data-action]:not([data-action="row-open"])');
        if (hit && hit !== el) return;
        location.hash = el.getAttribute('data-href');
        return;
      }
      var handler = actions[action];
      if (handler) {
        e.preventDefault();
        handler(el);
      }
    });

    // Tekstsøgning: debounce. Datoer/valg: reagér straks på change.
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (!el.matches || !el.matches('[data-filter]')) return;
      if (el.type !== 'search' && el.type !== 'text') return;
      clearTimeout(debounceTimer);
      var key = el.getAttribute('data-filter');
      var value = el.value;
      var pos = el.selectionStart;
      debounceTimer = setTimeout(function () {
        pendingFocus = { key: key, pos: pos };
        setFilter(key, value);
      }, 250);
    });

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.matches && el.matches('[data-filter]')) {
        if (el.type === 'search' || el.type === 'text') return;
        // Gendan fokus efter re-render, så filtre kan betjenes med tastatur.
        pendingFocus = { key: el.getAttribute('data-filter'), pos: null };
        setFilter(el.getAttribute('data-filter'), el.value);
        return;
      }
      if (el.id === 'quick-rek') {
        App.state.quick.rek = el.value;
        return;
      }
      if (el.id === 'tid-rek') {
        // Valget styrer både formularen og oversigten nedenfor, så man kun
        // ser tid på den rekruttering man er ved at registrere på.
        var form = el.closest('form');
        if (form) {
          var fd = new FormData(form);
          tidFormDraft = {
            dato: String(fd.get('dato') || ''),
            timer: String(fd.get('timer') || ''),
            kategori: String(fd.get('kategori') || ''),
            beskrivelse: String(fd.get('beskrivelse') || '')
          };
        }
        App.state.tid.rek = el.value;
        App.state.tid.filterRek = el.value; // tom værdi = vis alle igen
        render();
        return;
      }
      if (el.id === 'admin-import-file') {
        importJsonFile(el);
      }
    });
  }

  function setFilter(key, value) {
    var kv = key.split(':');
    if (App.state[kv[0]]) App.state[kv[0]][kv[1]] = value;
    render();
  }

  function restoreFilterFocus() {
    if (!pendingFocus) return;
    var el = document.querySelector('[data-filter="' + pendingFocus.key + '"]');
    if (el) {
      el.focus();
      if (pendingFocus.pos !== null && el.setSelectionRange) {
        try { el.setSelectionRange(pendingFocus.pos, pendingFocus.pos); } catch (e) { }
      }
    }
    pendingFocus = null;
  }

  /* ---------- Action-handlers ---------- */

  var actions = {

    'nav-toggle': function () {
      var layout = document.querySelector('.layout');
      if (layout) layout.classList.toggle('sidebar-open');
    },

    'logout': async function () {
      if (window.EA_CONFIG.CLOUD) {
        try { await Cloud.signOut(); } catch (e) { }
      } else {
        try { localStorage.removeItem('ea_tid_session'); } catch (e) { }
      }
      App.user = null;
      resetState(); // filtre og valg må ikke lække til næste bruger
      location.hash = '';
      render();
    },

    'login-local': function (el) {
      var u = DB.get('users', el.getAttribute('data-id'));
      if (!u || u.aktiv === false) {
        Toast.show('Brugeren findes ikke eller er nedlagt.', 'error');
        return;
      }
      App.user = u;
      resetState();
      try { localStorage.setItem('ea_tid_session', u.id); } catch (e) { }
      location.hash = '#/dashboard';
      Toast.show('Velkommen, ' + DB.userLabel(u.id) + '!', 'success');
      render();
    },

    'fav-toggle': function (el) {
      var r = DB.get('recruitments', el.getAttribute('data-id'));
      if (!r) return;
      DB.update('recruitments', r.id, { favorit: !r.favorit });
      render();
    },

    'tab': function (el) {
      App.state.detailTab = el.getAttribute('data-tab');
      render();
    },

    'fase-set': function (el) {
      var r = DB.get('recruitments', el.getAttribute('data-id'));
      var nyFase = el.getAttribute('data-fase');
      if (!r || r.fase === nyFase) return;
      var gammel = r.fase;
      DB.update('recruitments', r.id, { fase: nyFase });
      DB.log(r.id, App.user.id, 'fase_aendret', 'Fase ændret fra "' + gammel + '" til "' + nyFase + '"');
      Toast.show('Fasen er ændret til ' + nyFase + '.', 'success');
      render();
    },

    'status-set': function (el) {
      var r = DB.get('recruitments', el.getAttribute('data-id'));
      var nyStatus = el.getAttribute('data-status');
      if (!r || r.status === nyStatus) return;
      if (nyStatus === 'Besat') return besatModal(r);
      if (nyStatus === 'Annulleret') return annullerModal(r);
      skiftStatus(r, nyStatus, {});
    },

    'rec-delete': function (el) {
      if (App.user.app_rolle !== 'admin') {
        Toast.show('Kun administratorer kan slette rekrutteringer.', 'error');
        return;
      }
      var r = DB.get('recruitments', el.getAttribute('data-id'));
      if (!r) return;
      Modal.confirm({
        title: 'Slet rekruttering',
        text: 'Vil du slette ' + r.rekrutteringsnummer + ' "' + r.titel + '"? Alle tilhørende tidsregistreringer, kommentarer og aktivitetslog slettes også. Handlingen kan ikke fortrydes.',
        okLabel: 'Slet permanent',
        danger: true,
        onOk: function () {
          DB.remove('recruitments', r.id);
          Toast.show('Rekrutteringen ' + r.rekrutteringsnummer + ' er slettet.', 'success');
          location.hash = '#/rekrutteringer';
        }
      });
    },

    'tid-vis-alle': function () {
      App.state.tid.filterRek = '';
      render();
    },

    'tid-paa-rek': function (el) {
      App.state.tid.rek = el.getAttribute('data-id');
      App.state.tid.filterRek = el.getAttribute('data-id');
      location.hash = '#/tid';
    },

    'entry-edit': function (el) {
      var entry = DB.get('time_entries', el.getAttribute('data-id'));
      if (!entry) return;
      if (App.user.app_rolle !== 'admin' && entry.user_id !== App.user.id) {
        Toast.show('Du kan kun rette dine egne tidsregistreringer.', 'error');
        return;
      }
      entryModal(entry);
    },

    'entry-delete': function (el) {
      var entry = DB.get('time_entries', el.getAttribute('data-id'));
      if (!entry) return;
      if (App.user.app_rolle !== 'admin' && entry.user_id !== App.user.id) {
        Toast.show('Du kan kun slette dine egne tidsregistreringer.', 'error');
        return;
      }
      Modal.confirm({
        title: 'Slet tidsregistrering',
        text: 'Vil du slette registreringen på ' + DB.fmtTimer(entry.timer) + ' fra ' + DB.fmtDato(entry.dato) + '?',
        okLabel: 'Slet',
        danger: true,
        onOk: function () {
          DB.remove('time_entries', entry.id);
          DB.log(entry.recruitment_id, App.user.id, 'tid_slettet',
            'Tidsregistrering slettet (' + DB.fmtTimer(entry.timer) + ' den ' + DB.fmtDato(entry.dato) + ')');
          Toast.show('Tidsregistreringen er slettet.', 'success');
          render();
        }
      });
    },

    'dash-export': function () { exportDashboardCSV(); },
    'rap-export-rec': function () { exportRecruitmentsCSV(); },
    'rap-export-tid': function () { exportTimeEntriesCSV(); },

    'user-new': function () { userModal(null); },

    'user-edit': function (el) {
      var u = DB.get('users', el.getAttribute('data-id'));
      if (u) userModal(u);
    },

    'user-deactivate': function (el) {
      var u = DB.get('users', el.getAttribute('data-id'));
      if (!u) return;
      if (u.id === App.user.id) {
        Toast.show('Du kan ikke nedlægge din egen bruger.', 'error');
        return;
      }
      Modal.confirm({
        title: 'Nedlæg bruger',
        text: 'Vil du nedlægge ' + DB.userLabel(u.id) + '? Brugeren kan ikke længere logge ind, men al historik bevares.',
        okLabel: 'Nedlæg',
        danger: true,
        onOk: function () {
          DB.update('users', u.id, { aktiv: false });
          Toast.show('Brugeren er nedlagt.', 'success');
          render();
        }
      });
    },

    'user-activate': function (el) {
      var u = DB.get('users', el.getAttribute('data-id'));
      if (!u) return;
      DB.update('users', u.id, { aktiv: true });
      Toast.show('Brugeren er genaktiveret.', 'success');
      render();
    },

    'admin-export-json': function () {
      var data = JSON.stringify(DB.exportAll(), null, 2);
      downloadFile('ea-data-' + DB.todayISO() + '.json', data, 'application/json');
      Toast.show('Data er eksporteret som JSON.', 'success');
    },

    'admin-reset-demo': function () {
      Modal.confirm({
        title: 'Nulstil demo-data',
        text: 'Al data i denne browser erstattes med frisk demo-data. Handlingen kan ikke fortrydes.',
        okLabel: 'Nulstil',
        danger: true,
        onOk: function () {
          DB.resetDemo();
          var u = DB.get('users', App.user.id);
          App.user = u && u.aktiv !== false ? u : null;
          if (!App.user) location.hash = '';
          Toast.show('Demo-data er nulstillet.', 'success');
          render();
        }
      });
    }
  };

  /* ---------- Statusskift ---------- */

  function skiftStatus(r, nyStatus, ekstra) {
    var gammel = r.status;
    var patch = Object.assign({ status: nyStatus }, ekstra);
    if (nyStatus !== 'Besat') patch.ansaettelsesdato = null;
    if (nyStatus !== 'Annulleret') patch.annulleringsaarsag = null;
    DB.update('recruitments', r.id, patch);
    if (nyStatus === 'Besat') {
      DB.log(r.id, App.user.id, 'besat',
        'Rekrutteringen blev markeret som besat (ansættelsesdato ' + DB.fmtDato(patch.ansaettelsesdato) + ')');
    } else if (nyStatus === 'Annulleret') {
      DB.log(r.id, App.user.id, 'annulleret', 'Rekrutteringen blev annulleret: ' + patch.annulleringsaarsag);
    } else {
      DB.log(r.id, App.user.id, 'status_aendret', 'Status ændret fra "' + gammel + '" til "' + nyStatus + '"');
    }
    Toast.show('Status er ændret til ' + nyStatus + '.', 'success');
    render();
  }

  function besatModal(r) {
    Modal.open({
      title: 'Markér som besat',
      body:
        '<p class="modal-text">' + esc(r.rekrutteringsnummer + ' · ' + r.titel) + '</p>' +
        '<label class="field"><span>Ansættelsesdato <em>*</em></span>' +
        '<input type="date" name="ansaettelsesdato" value="' + escAttr(DB.todayISO()) + '"' +
        (r.startdato ? ' min="' + escAttr(r.startdato) + '"' : '') + '></label>',
      okLabel: 'Markér som besat',
      onSubmit: function (form) {
        var dato = new FormData(form).get('ansaettelsesdato');
        if (!dato) {
          Toast.show('Ansættelsesdato er påkrævet.', 'error');
          return;
        }
        if (r.startdato && dato < r.startdato) {
          Toast.show('Ansættelsesdatoen kan ikke ligge før startdatoen (' + DB.fmtDato(r.startdato) + ').', 'error');
          return;
        }
        Modal.close();
        skiftStatus(r, 'Besat', { ansaettelsesdato: dato });
      }
    });
  }

  function annullerModal(r) {
    Modal.open({
      title: 'Annullér rekruttering',
      body:
        '<p class="modal-text">' + esc(r.rekrutteringsnummer + ' · ' + r.titel) + '</p>' +
        '<label class="field"><span>Årsag til annullering <em>*</em></span>' +
        '<textarea name="aarsag" rows="3" placeholder="fx Kunden besatte stillingen internt"></textarea></label>',
      okLabel: 'Annullér rekruttering',
      danger: true,
      onSubmit: function (form) {
        var aarsag = String(new FormData(form).get('aarsag') || '').trim();
        if (!aarsag) {
          Toast.show('Angiv en årsag til annulleringen.', 'error');
          return;
        }
        Modal.close();
        skiftStatus(r, 'Annulleret', { annulleringsaarsag: aarsag });
      }
    });
  }

  /* ---------- Tidsregistrerings-modal (ret) ---------- */

  function entryModal(entry) {
    var rec = DB.get('recruitments', entry.recruitment_id);
    Modal.open({
      title: 'Ret tidsregistrering',
      body:
        '<p class="modal-text">' + esc(rec ? rec.rekrutteringsnummer + ' · ' + rec.titel : '') + '</p>' +
        '<p class="mini-note">Registreret af ' + esc(DB.userLabel(entry.user_id)) + ' som ' +
          rolleBadge(entry.rolle) + ' — rollen fastholdes.</p>' +
        '<div class="form-grid">' +
          '<label class="field"><span>Dato</span>' +
            '<input type="date" name="dato" value="' + escAttr(entry.dato) + '" max="' + escAttr(DB.todayISO()) + '"></label>' +
          '<label class="field"><span>Timer <em>*</em></span>' +
            '<input type="text" name="timer" inputmode="decimal" value="' + escAttr(DB.fmtTal(entry.timer, 2)) + '"></label>' +
          '<label class="field"><span>Fase</span>' +
            '<select name="fase">' + selectOptions(DB.FASER, entry.fase) + '</select></label>' +
          '<label class="field span-2"><span>Kategori</span>' +
            '<select name="kategori">' + kategoriOptions(entry.kategori || '', 'Ingen kategori') + '</select></label>' +
          '<label class="field span-2"><span>Beskrivelse</span>' +
            '<input type="text" name="beskrivelse" value="' + escAttr(entry.beskrivelse || '') + '"></label>' +
        '</div>',
      okLabel: 'Gem ændringer',
      onSubmit: function (form) {
        var fd = new FormData(form);
        var patch = {
          dato: String(fd.get('dato') || ''),
          timer: DB.parseTimer(fd.get('timer')),
          fase: String(fd.get('fase') || ''),
          kategori: String(fd.get('kategori') || ''),
          beskrivelse: String(fd.get('beskrivelse') || '').trim()
        };
        var check = Object.assign({}, entry, patch);
        var errors = DB.validateTimeEntry(check);
        if (errors.length) {
          Toast.errors(errors);
          return;
        }
        Modal.close();
        DB.update('time_entries', entry.id, patch);
        DB.log(entry.recruitment_id, App.user.id, 'tid_redigeret',
          'Tidsregistrering rettet (' + DB.fmtTimer(patch.timer) + ' den ' + DB.fmtDato(patch.dato) + ')');
        Toast.show('Tidsregistreringen er opdateret.', 'success');
        render();
      }
    });
  }

  /* ---------- Bruger-modal (admin) ---------- */

  function userModal(u) {
    var isNew = !u;
    var user = u || { initialer: '', navn: '', email: '', rolle: 'Rekrutteringskonsulent', app_rolle: 'user', aktiv: true };
    Modal.open({
      title: isNew ? 'Opret bruger' : 'Ret bruger',
      body:
        '<div class="form-grid">' +
          '<label class="field"><span>Initialer <em>*</em></span>' +
            '<input type="text" name="initialer" value="' + escAttr(user.initialer) + '" maxlength="6" placeholder="fx MKJ"></label>' +
          '<label class="field"><span>Navn</span>' +
            '<input type="text" name="navn" value="' + escAttr(user.navn) + '" placeholder="Fulde navn"></label>' +
          '<label class="field span-2"><span>Email <em>*</em></span>' +
            '<input type="email" name="email" value="' + escAttr(user.email) + '" placeholder="navn@eandersen.dk"></label>' +
          '<label class="field"><span>Rolle (default ved tidsregistrering)</span>' +
            '<select name="rolle">' + selectOptions(DB.ROLLER, user.rolle) + '</select></label>' +
          '<label class="field"><span>App-rolle</span>' +
            '<select name="app_rolle">' +
              selectOptions([{ value: 'user', label: 'Bruger' }, { value: 'admin', label: 'Administrator' }], user.app_rolle) +
            '</select></label>' +
        '</div>' +
        (window.EA_CONFIG.CLOUD && isNew
          ? '<p class="mini-note">Husk også at oprette login-kontoen i Supabase under Authentication → Users (samme email).</p>'
          : ''),
      okLabel: isNew ? 'Opret bruger' : 'Gem ændringer',
      onSubmit: function (form) {
        var fd = new FormData(form);
        var data = {
          initialer: String(fd.get('initialer') || '').trim().toUpperCase(),
          navn: String(fd.get('navn') || '').trim(),
          email: String(fd.get('email') || '').trim().toLowerCase(),
          rolle: String(fd.get('rolle') || ''),
          app_rolle: String(fd.get('app_rolle') || 'user')
        };
        if (!data.navn) data.navn = data.initialer;
        var errors = [];
        if (!data.initialer) errors.push('Initialer er påkrævet.');
        if (!data.email) errors.push('Email er påkrævet.');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Ugyldig email.');
        if (DB.ROLLER.indexOf(data.rolle) === -1) errors.push('Vælg en rolle.');
        DB.all('users').forEach(function (other) {
          if (u && other.id === u.id) return;
          if (other.initialer.toUpperCase() === data.initialer) errors.push('Initialerne er allerede i brug.');
          if (String(other.email).toLowerCase() === data.email) errors.push('Emailen er allerede i brug.');
        });
        if (!isNew && u.id === App.user.id && data.app_rolle !== 'admin') {
          errors.push('Du kan ikke fjerne din egen admin-rolle.');
        }
        if (errors.length) {
          Toast.errors(errors);
          return;
        }
        Modal.close();
        if (isNew) {
          DB.insert('users', Object.assign({ aktiv: true }, data));
          Toast.show('Brugeren ' + data.initialer + ' er oprettet.', 'success');
        } else {
          DB.update('users', u.id, data);
          if (u.id === App.user.id) App.user = DB.get('users', u.id);
          Toast.show('Brugeren er opdateret.', 'success');
        }
        render();
      }
    });
  }

  /* ---------- Formularer (pr. visning) ---------- */

  function bindForms() {
    var recForm = document.getElementById('rec-form');
    if (recForm) recForm.addEventListener('submit', submitRecForm);

    var tidForm = document.getElementById('tid-form');
    if (tidForm) tidForm.addEventListener('submit', submitTidForm);

    var commentForm = document.getElementById('comment-form');
    if (commentForm) commentForm.addEventListener('submit', submitCommentForm);

    var quickForm = document.getElementById('quick-tid-form');
    if (quickForm) quickForm.addEventListener('submit', submitQuickTidForm);

    if (tidForm && tidFormDraft) {
      Object.keys(tidFormDraft).forEach(function (navn) {
        var felt = tidForm.elements[navn];
        if (felt && tidFormDraft[navn]) felt.value = tidFormDraft[navn];
      });
      tidFormDraft = null;
      var timerFelt = tidForm.elements.timer;
      if (timerFelt) timerFelt.focus();
    }
  }

  async function submitRecForm(e) {
    e.preventDefault();
    var form = e.currentTarget;
    var fd = new FormData(form);
    var id = fd.get('id');
    var data = {
      titel: String(fd.get('titel') || '').trim(),
      virksomhedsnavn: String(fd.get('virksomhedsnavn') || '').trim(),
      opgavetype: String(fd.get('opgavetype') || ''),
      beskrivelse: String(fd.get('beskrivelse') || '').trim(),
      rekrutteringspartner: String(fd.get('rekrutteringspartner') || '') || null,
      rekrutteringskonsulent: String(fd.get('rekrutteringskonsulent') || '') || null,
      fase: String(fd.get('fase') || ''),
      startdato: String(fd.get('startdato') || ''),
      honorar: DB.parseBeloeb(fd.get('honorar')),
      noter: String(fd.get('noter') || '').trim()
    };
    var errors = DB.validateRecruitment(data);
    if (errors.length) {
      Toast.errors(errors);
      return;
    }
    if (id) {
      var eksisterende = DB.get('recruitments', id);
      if (!eksisterende) return;
      var gammelFase = eksisterende.fase;
      // Fase kan ikke ændres på en lukket rekruttering (samme regel som på
      // detaljesiden, hvor fase-knapperne er deaktiveret).
      if (DB.LUKKEDE_STATUSSER.indexOf(eksisterende.status) !== -1) {
        data.fase = eksisterende.fase;
      }
      DB.update('recruitments', id, data);
      DB.log(id, App.user.id, 'redigeret', 'Rekrutteringen blev redigeret');
      if (gammelFase !== data.fase) {
        DB.log(id, App.user.id, 'fase_aendret', 'Fase ændret fra "' + gammelFase + '" til "' + data.fase + '"');
      }
      Toast.show('Ændringerne er gemt.', 'success');
      location.hash = '#/rekrutteringer/' + id;
    } else {
      // I cloud-mode: hent friskeste data lige inden nummeret tildeles, så
      // to samtidige brugere ikke får samme fortløbende nummer.
      if (window.EA_CONFIG.CLOUD && Cloud.enabled()) {
        try { DB.setAll(await Cloud.hydrate()); } catch (err) { console.error(err); }
      }
      var row = DB.insert('recruitments', Object.assign({
        rekrutteringsnummer: DB.nextRekrutteringsnummer(),
        status: 'Aktiv',
        ansaettelsesdato: null,
        annulleringsaarsag: null,
        favorit: false,
        oprettet_af: App.user.id
      }, data));
      DB.log(row.id, App.user.id, 'oprettet', 'Rekrutteringen blev oprettet');
      Toast.show('Rekrutteringen ' + row.rekrutteringsnummer + ' er oprettet.', 'success');
      location.hash = '#/rekrutteringer/' + row.id;
    }
  }

  function submitTidForm(e) {
    e.preventDefault();
    var fd = new FormData(e.currentTarget);
    var data = {
      recruitment_id: String(fd.get('recruitment_id') || ''),
      user_id: App.user.id,
      rolle: App.user.rolle, // tildeles automatisk ud fra den indloggede bruger
      fase: String(fd.get('fase') || ''),
      dato: String(fd.get('dato') || ''),
      timer: DB.parseTimer(fd.get('timer')),
      kategori: String(fd.get('kategori') || ''),
      beskrivelse: String(fd.get('beskrivelse') || '').trim()
    };
    var errors = DB.validateTimeEntry(data);
    if (errors.length) {
      Toast.errors(errors);
      return;
    }
    DB.insert('time_entries', data);
    DB.log(data.recruitment_id, App.user.id, 'tid_registreret',
      'Tid registreret: ' + DB.fmtTimer(data.timer) + ' den ' + DB.fmtDato(data.dato) + ' (' + data.fase + ')');
    App.state.tid.rek = data.recruitment_id; // gør det nemt at registrere flere
    Toast.show(DB.fmtTimer(data.timer) + ' er registreret.', 'success');
    render();
  }

  /* Hurtig-bjælken: dato = i dag, rolle = brugerens, fase = rekrutteringens. */
  function submitQuickTidForm(e) {
    e.preventDefault();
    var fd = new FormData(e.currentTarget);
    var recId = String(fd.get('recruitment_id') || '');
    var rec = DB.get('recruitments', recId);
    var data = {
      recruitment_id: recId,
      user_id: App.user.id,
      rolle: App.user.rolle,
      fase: rec ? rec.fase : '',
      dato: DB.todayISO(),
      timer: DB.parseTimer(fd.get('timer')),
      kategori: String(fd.get('kategori') || ''),
      beskrivelse: String(fd.get('beskrivelse') || '').trim()
    };
    var errors = DB.validateTimeEntry(data);
    if (errors.length) {
      Toast.errors(errors);
      return;
    }
    DB.insert('time_entries', data);
    DB.log(recId, App.user.id, 'tid_registreret',
      'Tid registreret: ' + DB.fmtTimer(data.timer) + ' den ' + DB.fmtDato(data.dato) + ' (' + data.fase + ')');
    App.state.quick.rek = recId; // gør det nemt at registrere flere i træk
    Toast.show(DB.fmtTimer(data.timer) + ' er registreret på ' + rec.rekrutteringsnummer + '.', 'success');
    render();
    var timerFelt = document.querySelector('#quick-tid-form [name=timer]');
    if (timerFelt) timerFelt.focus();
  }

  function submitCommentForm(e) {
    e.preventDefault();
    var form = e.currentTarget;
    var recId = form.getAttribute('data-id');
    var tekst = String(new FormData(form).get('tekst') || '').trim();
    if (!tekst) {
      Toast.show('Skriv en kommentar først.', 'error');
      return;
    }
    DB.insert('comments', { recruitment_id: recId, user_id: App.user.id, tekst: tekst });
    DB.log(recId, App.user.id, 'kommentar', 'Kommentar tilføjet');
    Toast.show('Kommentaren er tilføjet.', 'success');
    render();
  }

  /* ---------- JSON-import ---------- */

  function importJsonFile(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        Toast.show('Filen kunne ikke læses som JSON.', 'error');
        return;
      }
      var tabeller = ['users', 'recruitments', 'time_entries', 'activity_log', 'comments'];
      var gyldig = tabeller.every(function (t) { return Array.isArray(data[t]); });
      if (!gyldig) {
        Toast.show('Filen har ikke det forventede format (mangler tabeller).', 'error');
        return;
      }
      Modal.confirm({
        title: 'Importér data',
        text: 'Import erstatter al eksisterende data med indholdet af filen (' +
          data.recruitments.length + ' rekrutteringer, ' + data.time_entries.length +
          ' tidsregistreringer, ' + data.users.length + ' brugere). Fortsæt?',
        okLabel: 'Importér',
        danger: true,
        onOk: function () {
          DB.replaceAll(data);
          var u = DB.get('users', App.user.id);
          App.user = u && u.aktiv !== false ? u : null;
          if (!App.user) location.hash = '';
          Toast.show('Data er importeret.', 'success');
          render();
        }
      });
    };
    reader.readAsText(file);
    input.value = '';
  }

  /* ---------- CSV-eksport ---------- */

  function csvValue(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    // Neutralisér formel-tegn (Excel evaluerer =, +, @ og tab som formler,
    // også i citerede celler). Negative tal og "2,5" røres ikke.
    if (/^[=+@\t]/.test(s) || (/^-/.test(s) && !/^-?\d+(,\d+)?$/.test(s))) {
      s = "'" + s;
    }
    if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadCSV(filename, rows) {
    var content = '\uFEFF' + rows.map(function (r) {
      return r.map(csvValue).join(';');
    }).join('\r\n');
    downloadFile(filename, content, 'text/csv;charset=utf-8');
  }

  function downloadFile(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function csvTal(n) {
    return DB.fmtTal(n === null || n === undefined ? 0 : n, 2);
  }

  function exportDashboardCSV() {
    var f = App.state.dash;
    var entries = DB.entriesIPeriode(f.fra || null, f.til || null);
    var recs = DB.all('recruitments').filter(function (r) {
      if (f.fra && r.startdato < f.fra) return false;
      if (f.til && r.startdato > f.til) return false;
      return true;
    });
    var gnsDage = DB.gnsDageTilBesaettelse(recs);
    var recsMedTid = {};
    entries.forEach(function (e) { recsMedTid[e.recruitment_id] = true; });
    var antalMedTid = Object.keys(recsMedTid).length;
    var totalTimer = DB.sumTimer(entries);
    var rows = [
      ['erwin andersen tidsregistrering — dashboard'],
      ['Periode', (f.fra ? DB.fmtDato(f.fra) : 'Alt') + ' – ' + (f.til ? DB.fmtDato(f.til) : 'i dag')],
      [],
      ['Nøgletal', 'Værdi'],
      ['Rekrutteringer', recs.length],
      ['Aktive', recs.filter(function (r) { return r.status === 'Aktiv'; }).length],
      ['Besatte', recs.filter(function (r) { return r.status === 'Besat'; }).length],
      ['Annullerede', recs.filter(function (r) { return r.status === 'Annulleret'; }).length],
      ['Samlede timer', csvTal(totalTimer)],
      ['Gns. timer pr. rekruttering (med registreret tid)', antalMedTid === 0 ? '' : csvTal(totalTimer / antalMedTid)],
      ['Gns. dage til besættelse', gnsDage === null ? '' : gnsDage]
    ];
    // Dashboardets hovedtal: tiden pr. rekruttering.
    rows.push([]);
    rows.push(['Timer pr. rekruttering', 'Nummer', 'Virksomhed', 'Status', 'Timer', 'Andel %']);
    DB.timerPrRekruttering(entries).forEach(function (row) {
      rows.push([
        row.recruitment.titel,
        row.recruitment.rekrutteringsnummer,
        row.recruitment.virksomhedsnavn,
        row.recruitment.status,
        csvTal(row.value),
        totalTimer ? Math.round(row.value / totalTimer * 100) : 0
      ]);
    });

    [['Timer pr. fase', DB.timerPrFase(entries)],
     ['Timer pr. kategori', DB.timerPrKategori(entries)],
     ['Timer pr. medarbejder', DB.timerPrBruger(entries)],
     ['Timer pr. rolle', DB.timerPrRolle(entries)],
     ['Timer pr. opgavetype', DB.timerPrOpgavetype(entries)]
    ].forEach(function (sektion) {
      rows.push([]);
      rows.push([sektion[0], 'Timer']);
      sektion[1].forEach(function (r) { rows.push([r.label, csvTal(r.value)]); });
    });
    downloadCSV('ea-dashboard-' + DB.todayISO() + '.csv', rows);
    Toast.show('Dashboardet er eksporteret som CSV.', 'success');
  }

  function exportRecruitmentsCSV() {
    var f = App.state.rap;
    var entries = DB.entriesIPeriode(f.fra || null, f.til || null);
    var timerIPeriode = {};
    entries.forEach(function (e) {
      timerIPeriode[e.recruitment_id] = (timerIPeriode[e.recruitment_id] || 0) + (Number(e.timer) || 0);
    });
    var alleTimer = {};
    DB.all('time_entries').forEach(function (e) {
      alleTimer[e.recruitment_id] = (alleTimer[e.recruitment_id] || 0) + (Number(e.timer) || 0);
    });
    var rows = [[
      'Nummer', 'Titel', 'Virksomhed', 'Opgavetype', 'Fase', 'Status',
      'Partner', 'Konsulent', 'Honorar (kr.)', 'Startdato', 'Ansættelsesdato',
      'Dage til besættelse', 'Annulleringsårsag', 'Timer i perioden', 'Timer i alt', 'Favorit'
    ]];
    DB.all('recruitments').slice().sort(function (a, b) {
      return (a.rekrutteringsnummer || '').localeCompare(b.rekrutteringsnummer || '');
    }).forEach(function (r) {
      var dage = (r.status === 'Besat' && r.startdato && r.ansaettelsesdato)
        ? DB.dageMellem(r.startdato, r.ansaettelsesdato) : '';
      rows.push([
        r.rekrutteringsnummer, r.titel, r.virksomhedsnavn, r.opgavetype, r.fase, r.status,
        DB.userInitialer(r.rekrutteringspartner), DB.userInitialer(r.rekrutteringskonsulent),
        r.honorar === null || r.honorar === undefined ? '' : r.honorar,
        DB.fmtDato(r.startdato),
        r.ansaettelsesdato ? DB.fmtDato(r.ansaettelsesdato) : '',
        dage,
        r.annulleringsaarsag || '',
        csvTal(timerIPeriode[r.id] || 0),
        csvTal(alleTimer[r.id] || 0),
        r.favorit ? 'Ja' : 'Nej'
      ]);
    });
    downloadCSV('ea-rekrutteringer-' + DB.todayISO() + '.csv', rows);
    Toast.show('Rekrutteringer er eksporteret som CSV.', 'success');
  }

  function exportTimeEntriesCSV() {
    var f = App.state.rap;
    var entries = DB.entriesIPeriode(f.fra || null, f.til || null)
      .slice().sort(function (a, b) { return a.dato.localeCompare(b.dato); });
    var rows = [['Dato', 'Rekrutteringsnr.', 'Rekruttering', 'Virksomhed', 'Medarbejder', 'Rolle', 'Fase', 'Timer', 'Kategori', 'Beskrivelse']];
    entries.forEach(function (e) {
      var r = DB.get('recruitments', e.recruitment_id);
      rows.push([
        DB.fmtDato(e.dato),
        r ? r.rekrutteringsnummer : '',
        r ? r.titel : '',
        r ? r.virksomhedsnavn : '',
        DB.userInitialer(e.user_id),
        e.rolle, e.fase,
        csvTal(e.timer),
        e.kategori || '',
        e.beskrivelse || ''
      ]);
    });
    downloadCSV('ea-tidsregistreringer-' + DB.todayISO() + '.csv', rows);
    Toast.show('Tidsregistreringer er eksporteret som CSV.', 'success');
  }
})();
