/*
 * De 8 skærmes HTML-rendering. Al brugerdata escapes med esc()/escAttr().
 * Event-bindinger sker i app.js (delegation via data-action / data-filter).
 */
window.Views = (function () {

  /* ---------- 1. Login ---------- */

  function login() {
    var inner;
    if (window.EA_CONFIG.CLOUD) {
      inner =
        '<form id="login-form" class="login-form" novalidate>' +
          '<label class="field"><span>Email</span>' +
            '<input type="email" name="email" autocomplete="email" required placeholder="dit navn@eandersen.dk"></label>' +
          '<label class="field"><span>Adgangskode</span>' +
            '<input type="password" name="password" autocomplete="current-password" required placeholder="••••••••"></label>' +
          '<button type="submit" class="btn btn-primary btn-block">Log ind</button>' +
        '</form>' +
        '<p class="login-mode">Delt cloud-mode · data gemmes i Supabase</p>';
    } else {
      var buttons = DB.activeUsers().map(function (u) {
        return '<button type="button" class="login-user" data-action="login-local" data-id="' + escAttr(u.id) + '">' +
          '<span class="avatar">' + esc(u.initialer) + '</span>' +
          '<span class="login-user-info"><strong>' + esc(DB.userLabel(u.id)) + '</strong>' +
          '<small>' + esc(u.rolle) + '</small></span>' +
          '</button>';
      }).join('');
      inner =
        '<p class="login-hint">Vælg bruger for at logge ind</p>' +
        '<div class="login-users">' + buttons + '</div>' +
        '<p class="login-mode">Lokal demo-mode · data gemmes kun i denne browser</p>';
    }
    return '<div class="login-wrap">' +
      '<div class="card login-card">' +
        '<div class="login-logo">ea</div>' +
        '<h1 class="login-title">erwin andersen<br><strong>tidsregistrering</strong></h1>' +
        inner +
      '</div></div>';
  }

  /* ---------- 2. Dashboard ---------- */

  function dashboard() {
    var f = App.state.dash;
    var entries = DB.entriesIPeriode(f.fra || null, f.til || null);
    var recs = DB.all('recruitments').filter(function (r) {
      if (f.fra && r.startdato < f.fra) return false;
      if (f.til && r.startdato > f.til) return false;
      return true;
    });
    var antal = recs.length;
    var aktive = recs.filter(function (r) { return r.status === 'Aktiv'; }).length;
    var besatte = recs.filter(function (r) { return r.status === 'Besat'; }).length;
    var annullerede = recs.filter(function (r) { return r.status === 'Annulleret'; }).length;
    var totalTimer = DB.sumTimer(entries);
    var recsMedTid = {};
    entries.forEach(function (e) { recsMedTid[e.recruitment_id] = true; });
    var antalMedTid = Object.keys(recsMedTid).length;
    var gnsTimer = antalMedTid === 0 ? null : totalTimer / antalMedTid;
    var gnsDage = DB.gnsDageTilBesaettelse(recs);

    return '<div class="page-head">' +
        '<h1>Dashboard</h1>' +
        '<div class="page-actions">' +
          periodeFilter('dash', f) +
          '<button type="button" class="btn btn-secondary" data-action="dash-export">' + icon('download') + 'CSV</button>' +
        '</div>' +
      '</div>' +
      '<p class="page-note">Rekrutteringer afgrænses efter startdato, timer efter registreringsdato.</p>' +
      '<div class="kpi-grid">' +
        kpiCard('Rekrutteringer', String(antal)) +
        kpiCard('Aktive', String(aktive)) +
        kpiCard('Besatte', String(besatte)) +
        kpiCard('Annullerede', String(annullerede)) +
        kpiCard('Samlede timer', DB.fmtTimer(totalTimer)) +
        kpiCard('Gns. timer pr. rekruttering', gnsTimer === null ? '—' : DB.fmtTimer(gnsTimer), 'med registreret tid') +
        kpiCard('Gns. dage til besættelse', gnsDage === null ? '—' : gnsDage + ' dage') +
      '</div>' +
      '<div class="chart-grid">' +
        barChart('Timer pr. rolle', DB.timerPrRolle(entries)) +
        barChart('Timer pr. fase', DB.timerPrFase(entries)) +
        barChart('Timer pr. medarbejder', DB.timerPrBruger(entries)) +
        barChart('Timer pr. opgavetype', DB.timerPrOpgavetype(entries)) +
      '</div>';
  }

  function periodeFilter(viewKey, f) {
    return '<div class="periode-filter">' +
      '<label>Fra <input type="date" data-filter="' + viewKey + ':fra" value="' + escAttr(f.fra || '') + '"></label>' +
      '<label>Til <input type="date" data-filter="' + viewKey + ':til" value="' + escAttr(f.til || '') + '"></label>' +
      '</div>';
  }

  /* ---------- 3. Rekrutteringsliste ---------- */

  function recruitments() {
    var f = App.state.rec;
    var q = (f.q || '').toLowerCase();
    var alleEntries = DB.all('time_entries');
    var rows = DB.all('recruitments').filter(function (r) {
      if (f.status && r.status !== f.status) return false;
      if (f.fase && r.fase !== f.fase) return false;
      if (f.type && r.opgavetype !== f.type) return false;
      if (f.partner && r.rekrutteringspartner !== f.partner) return false;
      if (q) {
        var hay = (r.rekrutteringsnummer + ' ' + r.titel + ' ' + r.virksomhedsnavn).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) {
      if (!!a.favorit !== !!b.favorit) return a.favorit ? -1 : 1;
      return (b.rekrutteringsnummer || '').localeCompare(a.rekrutteringsnummer || '');
    });

    var timerPrRec = {};
    alleEntries.forEach(function (e) {
      timerPrRec[e.recruitment_id] = (timerPrRec[e.recruitment_id] || 0) + (Number(e.timer) || 0);
    });

    var tbody = rows.map(function (r) {
      return '<tr data-action="row-open" data-href="#/rekrutteringer/' + escAttr(r.id) + '">' +
        '<td class="td-fav"><button type="button" class="btn-star' + (r.favorit ? ' star-on' : '') + '" ' +
          'data-action="fav-toggle" data-id="' + escAttr(r.id) + '" aria-label="Favorit">' + icon('star') + '</button></td>' +
        '<td class="td-nr">' + esc(r.rekrutteringsnummer) + '</td>' +
        '<td class="td-strong">' + esc(r.titel) + '</td>' +
        '<td>' + esc(r.virksomhedsnavn) + '</td>' +
        '<td>' + typeBadge(r.opgavetype) + '</td>' +
        '<td>' + faseBadge(r.fase) + '</td>' +
        '<td>' + statusBadge(r.status) + '</td>' +
        '<td>' + esc(DB.userInitialer(r.rekrutteringspartner)) + '</td>' +
        '<td>' + esc(DB.userInitialer(r.rekrutteringskonsulent)) + '</td>' +
        '<td class="td-num">' + esc(DB.fmtTimer(timerPrRec[r.id] || 0)) + '</td>' +
        '<td>' + esc(DB.fmtDato(r.startdato)) + '</td>' +
        '</tr>';
    }).join('');

    return '<div class="page-head">' +
        '<h1>Rekrutteringer</h1>' +
        '<div class="page-actions">' +
          '<a class="btn btn-primary" href="#/rekrutteringer/ny">' + icon('plus') + 'Opret rekruttering</a>' +
        '</div>' +
      '</div>' +
      '<div class="card toolbar">' +
        '<label class="search-field">' + icon('search') +
          '<input type="search" placeholder="Søg i nummer, titel eller virksomhed…" data-filter="rec:q" value="' + escAttr(f.q || '') + '"></label>' +
        '<select data-filter="rec:status">' + selectOptions(DB.STATUSSER, f.status, 'Status: alle') + '</select>' +
        '<select data-filter="rec:fase">' + selectOptions(DB.FASER, f.fase, 'Fase: alle') + '</select>' +
        '<select data-filter="rec:type">' + selectOptions(DB.OPGAVETYPER, f.type, 'Type: alle') + '</select>' +
        '<select data-filter="rec:partner">' + userOptions(f.partner, 'Partner: alle') + '</select>' +
      '</div>' +
      (rows.length === 0
        ? emptyState('Ingen rekrutteringer matcher din søgning.')
        : '<div class="card table-card"><div class="table-scroll"><table class="table">' +
          '<thead><tr><th></th><th>Nr.</th><th>Titel</th><th>Virksomhed</th><th>Type</th><th>Fase</th>' +
          '<th>Status</th><th>Partner</th><th>Konsulent</th><th class="td-num">Timer</th><th>Startdato</th></tr></thead>' +
          '<tbody>' + tbody + '</tbody></table></div></div>');
  }

  /* ---------- 4. Opret/rediger rekruttering ---------- */

  function recruitmentForm(rec) {
    var isNew = !rec;
    var r = rec || {
      titel: '', virksomhedsnavn: '', opgavetype: '', beskrivelse: '',
      rekrutteringspartner: '', rekrutteringskonsulent: '',
      fase: 'Opstartsfase', honorar: null, startdato: DB.todayISO(), noter: ''
    };
    return '<div class="page-head">' +
        '<h1>' + (isNew ? 'Opret rekruttering' : 'Redigér ' + esc(r.rekrutteringsnummer)) + '</h1>' +
      '</div>' +
      '<form id="rec-form" class="card form-card" novalidate>' +
        (isNew
          ? '<p class="form-note">' + icon('info') + 'Rekrutteringsnummeret tildeles automatisk — næste er <strong>' +
            esc(DB.nextRekrutteringsnummer()) + '</strong>.</p>'
          : '<input type="hidden" name="id" value="' + escAttr(r.id) + '">') +
        '<div class="form-grid">' +
          '<label class="field span-2"><span>Titel <em>*</em></span>' +
            '<input type="text" name="titel" value="' + escAttr(r.titel) + '" placeholder="fx CFO rekruttering"></label>' +
          '<label class="field"><span>Virksomhedsnavn <em>*</em></span>' +
            '<input type="text" name="virksomhedsnavn" value="' + escAttr(r.virksomhedsnavn) + '" placeholder="Kundevirksomheden"></label>' +
          '<label class="field"><span>Opgavetype <em>*</em></span>' +
            '<select name="opgavetype">' + selectOptions(DB.OPGAVETYPER, r.opgavetype, 'Vælg opgavetype…') + '</select></label>' +
          '<label class="field"><span>Rekrutteringspartner</span>' +
            '<select name="rekrutteringspartner">' + userOptions(r.rekrutteringspartner, 'Vælg partner…') + '</select></label>' +
          '<label class="field"><span>Rekrutteringskonsulent</span>' +
            '<select name="rekrutteringskonsulent">' + userOptions(r.rekrutteringskonsulent, 'Vælg konsulent…') + '</select></label>' +
          '<label class="field"><span>Fase</span>' +
            '<select name="fase">' + selectOptions(DB.FASER, r.fase) + '</select></label>' +
          '<label class="field"><span>Startdato <em>*</em></span>' +
            '<input type="date" name="startdato" value="' + escAttr(r.startdato) + '" max="' + escAttr(DB.todayISO()) + '"></label>' +
          '<label class="field"><span>Estimeret honorar (kr.)</span>' +
            '<input type="text" name="honorar" inputmode="numeric" value="' + escAttr(r.honorar === null || r.honorar === undefined ? '' : r.honorar) + '" placeholder="fx 480.000"></label>' +
          '<label class="field span-2"><span>Beskrivelse</span>' +
            '<textarea name="beskrivelse" rows="3" placeholder="Kort beskrivelse af opgaven…">' + esc(r.beskrivelse || '') + '</textarea></label>' +
          '<label class="field span-2"><span>Noter</span>' +
            '<textarea name="noter" rows="2" placeholder="Interne noter…">' + esc(r.noter || '') + '</textarea></label>' +
        '</div>' +
        '<div class="form-foot">' +
          '<a class="btn btn-ghost" href="' + (isNew ? '#/rekrutteringer' : '#/rekrutteringer/' + escAttr(r.id)) + '">Annullér</a>' +
          '<button type="submit" class="btn btn-primary">' + (isNew ? 'Opret rekruttering' : 'Gem ændringer') + '</button>' +
        '</div>' +
      '</form>';
  }

  /* ---------- 5. Rekrutteringsdetalje ---------- */

  function recruitmentDetail(id) {
    var r = DB.get('recruitments', id);
    if (!r) {
      return '<div class="page-head"><h1>Ikke fundet</h1></div>' +
        emptyState('Rekrutteringen findes ikke (måske er den slettet).') +
        '<p><a class="btn btn-secondary" href="#/rekrutteringer">' + icon('arrowleft') + 'Til oversigten</a></p>';
    }
    var tab = App.state.detailTab || 'tid';
    var entries = DB.all('time_entries').filter(function (e) { return e.recruitment_id === id; })
      .sort(function (a, b) { return (b.dato + b.created_at).localeCompare(a.dato + a.created_at); });
    var total = DB.sumTimer(entries);
    var erLukket = DB.LUKKEDE_STATUSSER.indexOf(r.status) !== -1;

    var faseKnapper = DB.FASER.map(function (fs) {
      var active = fs === r.fase;
      return '<button type="button" class="seg-btn' + (active ? ' seg-active' : '') + '"' +
        (active || erLukket ? ' disabled' : '') +
        ' data-action="fase-set" data-id="' + escAttr(r.id) + '" data-fase="' + escAttr(fs) + '">' + esc(fs) + '</button>';
    }).join('');

    var statusLabels = {
      'Aktiv': 'Genoptag (Aktiv)', 'På pause': 'Sæt på pause',
      'Besat': 'Markér som besat', 'Annulleret': 'Annullér', 'Afsluttet': 'Afslut'
    };
    var statusKnapper = DB.STATUSSER.filter(function (s) { return s !== r.status; })
      .map(function (s) {
        var cls = s === 'Annulleret' ? 'btn-danger-ghost' : (s === 'Besat' ? 'btn-primary' : 'btn-secondary');
        return '<button type="button" class="btn btn-sm ' + cls + '" data-action="status-set" ' +
          'data-id="' + escAttr(r.id) + '" data-status="' + escAttr(s) + '">' + esc(statusLabels[s]) + '</button>';
      }).join('');

    var info =
      infoRow('Virksomhed', esc(r.virksomhedsnavn)) +
      infoRow('Opgavetype', typeBadge(r.opgavetype)) +
      infoRow('Rekrutteringspartner', esc(DB.userLabel(r.rekrutteringspartner))) +
      infoRow('Rekrutteringskonsulent', esc(DB.userLabel(r.rekrutteringskonsulent))) +
      infoRow('Estimeret honorar', esc(DB.fmtBeloeb(r.honorar))) +
      infoRow('Startdato', esc(DB.fmtDato(r.startdato))) +
      (r.status === 'Besat' ? infoRow('Ansættelsesdato', esc(DB.fmtDato(r.ansaettelsesdato))) : '') +
      (r.status === 'Besat' && r.startdato && r.ansaettelsesdato
        ? infoRow('Dage til besættelse', esc(String(DB.dageMellem(r.startdato, r.ansaettelsesdato))) + ' dage') : '') +
      (r.status === 'Annulleret' ? infoRow('Annulleringsårsag', esc(r.annulleringsaarsag || '—')) : '') +
      infoRow('Oprettet af', esc(DB.userLabel(r.oprettet_af))) +
      infoRow('Oprettet', esc(DB.fmtDatoTid(r.created_at)));

    var tabsHtml =
      '<div class="tabs">' +
        tabBtn('tid', 'Tidsregistreringer (' + entries.length + ')', tab) +
        tabBtn('kommentarer', 'Kommentarer', tab) +
        tabBtn('log', 'Aktivitetslog', tab) +
      '</div>' +
      '<div class="tab-body">' +
        (tab === 'tid' ? detailTabTid(r, entries)
          : tab === 'kommentarer' ? detailTabKommentarer(r)
          : detailTabLog(r)) +
      '</div>';

    return '<div class="page-head detail-head">' +
        '<div>' +
          '<a class="back-link" href="#/rekrutteringer">' + icon('arrowleft') + 'Rekrutteringer</a>' +
          '<h1><button type="button" class="btn-star btn-star-lg' + (r.favorit ? ' star-on' : '') + '" data-action="fav-toggle" ' +
            'data-id="' + escAttr(r.id) + '" aria-label="Favorit">' + icon('star') + '</button> ' +
            '<span class="detail-nr">' + esc(r.rekrutteringsnummer) + '</span> ' + esc(r.titel) + '</h1>' +
          '<div class="detail-badges">' + typeBadge(r.opgavetype) + ' ' + faseBadge(r.fase) + ' ' + statusBadge(r.status) + '</div>' +
        '</div>' +
        '<div class="page-actions">' +
          '<a class="btn btn-secondary" href="#/rekrutteringer/' + escAttr(r.id) + '/rediger">' + icon('edit') + 'Redigér</a>' +
          (App.user.app_rolle === 'admin'
            ? '<button type="button" class="btn btn-danger" data-action="rec-delete" data-id="' + escAttr(r.id) + '">' + icon('trash') + 'Slet</button>'
            : '') +
        '</div>' +
      '</div>' +
      '<div class="detail-grid">' +
        '<div class="card detail-info">' +
          '<h3 class="card-title">Stamdata</h3>' +
          '<dl class="info-list">' + info + '</dl>' +
          (r.beskrivelse ? '<h4 class="info-sub">Beskrivelse</h4><p class="info-text">' + esc(r.beskrivelse) + '</p>' : '') +
          (r.noter ? '<h4 class="info-sub">Noter</h4><p class="info-text">' + esc(r.noter) + '</p>' : '') +
        '</div>' +
        '<div class="detail-side">' +
          '<div class="card">' +
            '<h3 class="card-title">Handlinger</h3>' +
            '<p class="mini-label">Fase</p>' +
            '<div class="seg">' + faseKnapper + '</div>' +
            (erLukket ? '<p class="mini-note">Rekrutteringen er lukket (' + esc(r.status) + ') — genoptag for at ændre fase.</p>' : '') +
            '<p class="mini-label">Status</p>' +
            '<div class="status-knapper">' + statusKnapper + '</div>' +
          '</div>' +
          '<div class="card">' +
            '<h3 class="card-title">Timer i alt: ' + esc(DB.fmtTimer(total)) + '</h3>' +
            miniChart('Pr. rolle', DB.timerPrRolle(entries)) +
            miniChart('Pr. fase', DB.timerPrFase(entries)) +
          '</div>' +
        '</div>' +
      '</div>' +
      tabsHtml;
  }

  function infoRow(label, valueHtml) {
    return '<div class="info-row"><dt>' + esc(label) + '</dt><dd>' + valueHtml + '</dd></div>';
  }

  function tabBtn(key, label, active) {
    return '<button type="button" class="tab-btn' + (key === active ? ' tab-active' : '') + '" ' +
      'data-action="tab" data-tab="' + escAttr(key) + '">' + esc(label) + '</button>';
  }

  function miniChart(title, rows) {
    var max = 0;
    rows.forEach(function (r) { if (r.value > max) max = r.value; });
    if (max === 0) return '';
    var body = rows.filter(function (r) { return r.value > 0; }).map(function (r) {
      var pct = Math.max(2, Math.round(r.value / max * 1000) / 10);
      return '<div class="chart-row chart-row-sm" title="' + escAttr(r.label + ': ' + DB.fmtTimer(r.value)) + '">' +
        '<span class="chart-label">' + esc(r.label) + '</span>' +
        '<span class="chart-track"><span class="chart-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="chart-value">' + esc(DB.fmtTimer(r.value)) + '</span></div>';
    }).join('');
    return '<p class="mini-label">' + esc(title) + '</p><div class="chart chart-sm">' + body + '</div>';
  }

  function detailTabTid(r, entries) {
    var rows = entries.map(function (e) { return entryRow(e, false); }).join('');
    return '<div class="tab-toolbar">' +
        '<button type="button" class="btn btn-primary btn-sm" data-action="tid-paa-rek" data-id="' + escAttr(r.id) + '">' +
          icon('clock') + 'Registrér tid på denne rekruttering</button>' +
      '</div>' +
      (entries.length === 0
        ? emptyState('Der er endnu ikke registreret tid på denne rekruttering.')
        : '<div class="table-scroll"><table class="table">' +
          '<thead><tr><th>Dato</th><th>Medarbejder</th><th>Rolle</th><th>Fase</th>' +
          '<th class="td-num">Timer</th><th>Beskrivelse</th><th></th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>');
  }

  function entryRow(e, visRekruttering) {
    var kanRette = App.user.app_rolle === 'admin' || e.user_id === App.user.id;
    var rec = visRekruttering ? DB.get('recruitments', e.recruitment_id) : null;
    return '<tr>' +
      '<td>' + esc(DB.fmtDato(e.dato)) + '</td>' +
      (visRekruttering
        ? '<td class="td-strong">' + (rec
            ? '<a href="#/rekrutteringer/' + escAttr(rec.id) + '">' + esc(rec.rekrutteringsnummer + ' · ' + rec.titel) + '</a>'
            : '—') + '</td>'
        : '') +
      '<td>' + esc(DB.userInitialer(e.user_id)) + '</td>' +
      '<td>' + rolleBadge(e.rolle) + '</td>' +
      '<td>' + faseBadge(e.fase) + '</td>' +
      '<td class="td-num td-strong">' + esc(DB.fmtTimer(e.timer)) + '</td>' +
      '<td class="td-desc">' + esc(e.beskrivelse || '') + '</td>' +
      '<td class="td-actions">' + (kanRette
        ? '<button type="button" class="btn-icon" data-action="entry-edit" data-id="' + escAttr(e.id) + '" title="Ret" aria-label="Ret">' + icon('edit') + '</button>' +
          '<button type="button" class="btn-icon btn-icon-danger" data-action="entry-delete" data-id="' + escAttr(e.id) + '" title="Slet" aria-label="Slet">' + icon('trash') + '</button>'
        : '') + '</td>' +
      '</tr>';
  }

  function detailTabKommentarer(r) {
    var comments = DB.all('comments').filter(function (c) { return c.recruitment_id === r.id; })
      .sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
    var list = comments.length === 0
      ? emptyState('Ingen kommentarer endnu.')
      : comments.map(function (c) {
          return '<div class="comment">' +
            '<span class="avatar avatar-sm">' + esc(DB.userInitialer(c.user_id)) + '</span>' +
            '<div class="comment-body">' +
              '<div class="comment-meta"><strong>' + esc(DB.userLabel(c.user_id)) + '</strong>' +
              '<span>' + esc(DB.fmtDatoTid(c.created_at)) + '</span></div>' +
              '<p>' + esc(c.tekst) + '</p>' +
            '</div></div>';
        }).join('');
    return '<form id="comment-form" class="comment-form" data-id="' + escAttr(r.id) + '">' +
        '<textarea name="tekst" rows="2" placeholder="Skriv en kommentar…"></textarea>' +
        '<button type="submit" class="btn btn-primary">' + icon('comment') + 'Tilføj kommentar</button>' +
      '</form>' +
      '<div class="comment-list">' + list + '</div>';
  }

  function detailTabLog(r) {
    var logs = DB.all('activity_log').filter(function (l) { return l.recruitment_id === r.id; })
      .sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
    var ikoner = {
      oprettet: 'plus', fase_aendret: 'activity', status_aendret: 'activity',
      tid_registreret: 'clock', tid_redigeret: 'clock', tid_slettet: 'trash',
      besat: 'check', annulleret: 'x', kommentar: 'comment', redigeret: 'edit'
    };
    if (logs.length === 0) return emptyState('Ingen aktivitet registreret endnu.');
    return '<ul class="log-list">' + logs.map(function (l) {
      return '<li class="log-item">' +
        '<span class="log-icon log-' + escAttr(l.type) + '">' + icon(ikoner[l.type] || 'activity') + '</span>' +
        '<div class="log-body">' +
          '<p>' + esc(l.beskrivelse) + '</p>' +
          '<small>' + esc(DB.userLabel(l.user_id)) + ' · ' + esc(DB.fmtDatoTid(l.created_at)) + '</small>' +
        '</div></li>';
    }).join('') + '</ul>';
  }

  /* ---------- 6. Tidsregistrering ---------- */

  function tid() {
    var f = App.state.tid;
    var recs = DB.all('recruitments').slice().sort(function (a, b) {
      var aOpen = DB.LUKKEDE_STATUSSER.indexOf(a.status) === -1;
      var bOpen = DB.LUKKEDE_STATUSSER.indexOf(b.status) === -1;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return (b.rekrutteringsnummer || '').localeCompare(a.rekrutteringsnummer || '');
    });
    var recOpts = recs.map(function (r) {
      return { value: r.id, label: r.rekrutteringsnummer + ' · ' + r.titel + ' (' + r.status + ')' };
    });

    var valgtRek = f.rek && DB.get('recruitments', f.rek) ? f.rek : '';
    var defaultFase = valgtRek ? DB.get('recruitments', valgtRek).fase : 'Opstartsfase';

    var entries = DB.all('time_entries').filter(function (e) {
      if (f.bruger === 'mine' && e.user_id !== App.user.id) return false;
      if (f.bruger && f.bruger !== 'mine' && e.user_id !== f.bruger) return false;
      if (f.filterRek && e.recruitment_id !== f.filterRek) return false;
      if (f.fra && e.dato < f.fra) return false;
      if (f.til && e.dato > f.til) return false;
      return true;
    }).sort(function (a, b) { return (b.dato + b.created_at).localeCompare(a.dato + a.created_at); });

    var brugerOpts = [{ value: 'mine', label: 'Kun mine' }].concat(
      DB.activeUsers().map(function (u) { return { value: u.id, label: DB.userLabel(u.id) }; }));

    var filterRecOpts = DB.all('recruitments').map(function (r) {
      return { value: r.id, label: r.rekrutteringsnummer + ' · ' + r.titel };
    });

    return '<div class="page-head"><h1>Tidsregistrering</h1></div>' +
      '<form id="tid-form" class="card form-card tid-form" novalidate>' +
        '<h3 class="card-title">Registrér tid</h3>' +
        '<div class="tid-grid">' +
          '<label class="field span-2"><span>Rekruttering <em>*</em></span>' +
            '<select name="recruitment_id" id="tid-rek">' + selectOptions(recOpts, valgtRek, 'Vælg rekruttering…') + '</select></label>' +
          '<label class="field"><span>Dato</span>' +
            '<input type="date" name="dato" value="' + escAttr(DB.todayISO()) + '" max="' + escAttr(DB.todayISO()) + '"></label>' +
          '<label class="field"><span>Timer <em>*</em></span>' +
            '<input type="text" name="timer" inputmode="decimal" placeholder="fx 2,5" autocomplete="off"></label>' +
          '<label class="field"><span>Rolle</span>' +
            '<select name="rolle">' + selectOptions(DB.ROLLER, App.user.rolle) + '</select></label>' +
          '<label class="field"><span>Fase</span>' +
            '<select name="fase" id="tid-fase">' + selectOptions(DB.FASER, defaultFase) + '</select></label>' +
          '<label class="field span-2"><span>Beskrivelse</span>' +
            '<input type="text" name="beskrivelse" placeholder="Hvad blev tiden brugt på? (valgfrit)"></label>' +
        '</div>' +
        '<div class="form-foot"><button type="submit" class="btn btn-primary">' + icon('clock') + 'Registrér tid</button></div>' +
      '</form>' +
      '<div class="card toolbar">' +
        '<select data-filter="tid:bruger">' + selectOptions(brugerOpts, f.bruger, 'Medarbejder: alle') + '</select>' +
        '<select data-filter="tid:filterRek">' + selectOptions(filterRecOpts, f.filterRek, 'Rekruttering: alle') + '</select>' +
        '<label class="inline-date">Fra <input type="date" data-filter="tid:fra" value="' + escAttr(f.fra || '') + '"></label>' +
        '<label class="inline-date">Til <input type="date" data-filter="tid:til" value="' + escAttr(f.til || '') + '"></label>' +
        '<span class="toolbar-sum">I alt: <strong>' + esc(DB.fmtTimer(DB.sumTimer(entries))) + '</strong></span>' +
      '</div>' +
      (entries.length === 0
        ? emptyState('Ingen tidsregistreringer matcher filtrene.')
        : '<div class="card table-card"><div class="table-scroll"><table class="table">' +
          '<thead><tr><th>Dato</th><th>Rekruttering</th><th>Medarbejder</th><th>Rolle</th><th>Fase</th>' +
          '<th class="td-num">Timer</th><th>Beskrivelse</th><th></th></tr></thead>' +
          '<tbody>' + entries.map(function (e) { return entryRow(e, true); }).join('') + '</tbody></table></div></div>');
  }

  /* ---------- 7. Rapporter ---------- */

  function reports() {
    var f = App.state.rap;
    var entries = DB.entriesIPeriode(f.fra || null, f.til || null);
    var top = DB.timerPrRekruttering(entries).slice(0, 10);
    var gnsDage = DB.gnsDageTilBesaettelse(DB.all('recruitments'));

    var topRows = top.map(function (row, i) {
      var r = row.recruitment;
      return '<tr data-action="row-open" data-href="#/rekrutteringer/' + escAttr(r.id) + '">' +
        '<td class="td-num">' + (i + 1) + '</td>' +
        '<td class="td-nr">' + esc(r.rekrutteringsnummer) + '</td>' +
        '<td class="td-strong">' + esc(r.titel) + '</td>' +
        '<td>' + esc(r.virksomhedsnavn) + '</td>' +
        '<td>' + typeBadge(r.opgavetype) + '</td>' +
        '<td>' + statusBadge(r.status) + '</td>' +
        '<td class="td-num td-strong">' + esc(DB.fmtTimer(row.value)) + '</td>' +
        '</tr>';
    }).join('');

    return '<div class="page-head">' +
        '<h1>Rapporter</h1>' +
        '<div class="page-actions">' + periodeFilter('rap', f) + '</div>' +
      '</div>' +
      '<div class="kpi-grid kpi-grid-3">' +
        kpiCard('Timer i perioden', DB.fmtTimer(DB.sumTimer(entries))) +
        kpiCard('Registreringer', String(entries.length)) +
        kpiCard('Gns. dage til besættelse', gnsDage === null ? '—' : gnsDage + ' dage', 'alle besatte rekrutteringer') +
      '</div>' +
      '<div class="card table-card">' +
        '<div class="card-head-row"><h3 class="card-title">Top-rekrutteringer efter timer</h3></div>' +
        (top.length === 0 ? emptyState('Ingen tidsregistreringer i perioden.')
          : '<div class="table-scroll"><table class="table">' +
            '<thead><tr><th class="td-num">#</th><th>Nr.</th><th>Titel</th><th>Virksomhed</th><th>Type</th><th>Status</th><th class="td-num">Timer</th></tr></thead>' +
            '<tbody>' + topRows + '</tbody></table></div>') +
      '</div>' +
      '<div class="chart-grid">' +
        barChart('Timer pr. medarbejder', DB.timerPrBruger(entries)) +
        barChart('Timer pr. rolle', DB.timerPrRolle(entries)) +
        barChart('Timer pr. fase', DB.timerPrFase(entries)) +
        barChart('Timer pr. opgavetype', DB.timerPrOpgavetype(entries)) +
      '</div>' +
      '<div class="card export-card">' +
        '<h3 class="card-title">Eksport (CSV, Excel-kompatibel)</h3>' +
        '<p class="page-note">Eksporten respekterer den valgte periode.</p>' +
        '<div class="export-btns">' +
          '<button type="button" class="btn btn-secondary" data-action="rap-export-rec">' + icon('download') + 'Rekrutteringer (CSV)</button>' +
          '<button type="button" class="btn btn-secondary" data-action="rap-export-tid">' + icon('download') + 'Tidsregistreringer (CSV)</button>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 8. Admin ---------- */

  function admin() {
    var users = DB.all('users').slice().sort(function (a, b) {
      return a.initialer.localeCompare(b.initialer, 'da');
    });
    var rows = users.map(function (u) {
      return '<tr class="' + (u.aktiv === false ? 'row-inaktiv' : '') + '">' +
        '<td><span class="avatar avatar-sm">' + esc(u.initialer) + '</span></td>' +
        '<td class="td-strong">' + esc(u.navn) + '</td>' +
        '<td>' + esc(u.email) + '</td>' +
        '<td>' + rolleBadge(u.rolle) + '</td>' +
        '<td>' + (u.app_rolle === 'admin' ? '<span class="badge badge-admin">admin</span>' : 'bruger') + '</td>' +
        '<td>' + (u.aktiv === false ? '<span class="badge badge-neutral">nedlagt</span>' : '<span class="badge badge-aktiv">aktiv</span>') + '</td>' +
        '<td class="td-actions">' +
          '<button type="button" class="btn-icon" data-action="user-edit" data-id="' + escAttr(u.id) + '" title="Ret" aria-label="Ret bruger">' + icon('edit') + '</button>' +
          (u.aktiv === false
            ? '<button type="button" class="btn-icon" data-action="user-activate" data-id="' + escAttr(u.id) + '" title="Genaktivér" aria-label="Genaktivér">' + icon('check') + '</button>'
            : '<button type="button" class="btn-icon btn-icon-danger" data-action="user-deactivate" data-id="' + escAttr(u.id) + '" title="Nedlæg" aria-label="Nedlæg">' + icon('x') + '</button>') +
        '</td></tr>';
    }).join('');

    return '<div class="page-head">' +
        '<h1>Admin</h1>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-primary" data-action="user-new">' + icon('plus') + 'Opret bruger</button>' +
        '</div>' +
      '</div>' +
      '<div class="card table-card">' +
        '<div class="card-head-row"><h3 class="card-title">Brugere</h3></div>' +
        '<div class="table-scroll"><table class="table">' +
        '<thead><tr><th></th><th>Navn</th><th>Email</th><th>Rolle</th><th>App-rolle</th><th>Status</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        '<p class="page-note">Brugere med tidsregistreringer nedlægges (deaktiveres) i stedet for at blive slettet, så historikken bevares.</p>' +
      '</div>' +
      '<div class="card">' +
        '<h3 class="card-title">Data</h3>' +
        '<p class="page-note">Kørselstilstand: <strong>' +
          (window.EA_CONFIG.CLOUD ? 'Delt cloud-mode (Supabase)' : 'Lokal demo-mode (localStorage)') + '</strong></p>' +
        '<div class="export-btns">' +
          '<button type="button" class="btn btn-secondary" data-action="admin-export-json">' + icon('download') + 'Eksportér al data (JSON)</button>' +
          '<label class="btn btn-secondary btn-file">' + icon('upload') + 'Importér data (JSON)' +
            '<input type="file" id="admin-import-file" accept=".json,application/json" hidden></label>' +
          (window.EA_CONFIG.CLOUD ? '' :
            '<button type="button" class="btn btn-danger-ghost" data-action="admin-reset-demo">' + icon('trash') + 'Nulstil demo-data</button>') +
        '</div>' +
      '</div>';
  }

  return {
    login: login,
    dashboard: dashboard,
    recruitments: recruitments,
    recruitmentForm: recruitmentForm,
    recruitmentDetail: recruitmentDetail,
    tid: tid,
    reports: reports,
    admin: admin
  };
})();
