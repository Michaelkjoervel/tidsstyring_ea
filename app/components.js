/*
 * Genbrugelige UI-komponenter: escaping, ikoner, badges, modal, toast,
 * sidebar, KPI-kort og bjælkediagram.
 */

/* HTML-escaping — brug ved AL interpolation af brugerdata. */
window.esc = function (s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/* Escaping til attribut-værdier (samme regler, eget navn for læsbarhed). */
window.escAttr = window.esc;

/* ---------- Ikoner (inline SVG, stroke = currentColor) ---------- */
window.icon = (function () {
  var svgs = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    briefcase: '<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8.5 7V5.5A2 2 0 0 1 10.5 3.5h3a2 2 0 0 1 2 2V7"/><path d="M2.5 12.5h19"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    chart: '<path d="M3.5 20.5h17"/><path d="M6.5 16.5v-6"/><path d="M11 16.5V7"/><path d="M15.5 16.5v-4"/><path d="M20 16.5V4.5"/>',
    settings: '<path d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h13M21 17h-1"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="19" cy="17" r="2"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    edit: '<path d="M16.5 4.5l3 3L8 19l-4 1 1-4z"/><path d="M14.5 6.5l3 3"/>',
    trash: '<path d="M4.5 6.5h15"/><path d="M8.5 6.5v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6.5 6.5l1 13a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9l1-13"/><path d="M10 10.5v6M14 10.5v6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 11l4.5 4.5L16.5 11"/><path d="M4.5 19.5h15"/>',
    upload: '<path d="M12 15V4"/><path d="M7.5 8L12 3.5 16.5 8"/><path d="M4.5 19.5h15"/>',
    logout: '<path d="M9.5 4.5h-4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h4"/><path d="M15 8l4 4-4 4"/><path d="M19 12H9"/>',
    menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    comment: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5H9l-5 4z"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.5 4-5 7.5-5s6.3 1.5 7.5 5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17"/><path d="M8 2.5V6M16 2.5V6"/>',
    building: '<rect x="4.5" y="3.5" width="15" height="17" rx="1"/><path d="M4.5 20.5h15"/><path d="M8.5 7.5h2M13.5 7.5h2M8.5 11.5h2M13.5 11.5h2M10.5 20.5v-4h3v4"/>',
    arrowleft: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
    pause: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'
  };
  return function (name, cls) {
    var body = svgs[name] || svgs.info;
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + body + '</svg>';
  };
})();

/* ---------- Badges ---------- */

window.statusBadge = function (status) {
  var cls = {
    'Aktiv': 'badge-aktiv',
    'På pause': 'badge-pause',
    'Besat': 'badge-besat',
    'Annulleret': 'badge-annulleret',
    'Afsluttet': 'badge-afsluttet'
  }[status] || 'badge-neutral';
  return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
};

window.faseBadge = function (fase) {
  var cls = {
    'Opstartsfase': 'badge-fase-1',
    'Rekrutteringsfase': 'badge-fase-2',
    'Afslutningsfase': 'badge-fase-3'
  }[fase] || 'badge-neutral';
  return '<span class="badge ' + cls + '">' + esc(fase) + '</span>';
};

window.typeBadge = function (type) {
  var cls = type === 'Fuld rekruttering' ? 'badge-type-fuld' : 'badge-type-search';
  return '<span class="badge badge-outline ' + cls + '">' + esc(type) + '</span>';
};

window.rolleBadge = function (rolle) {
  return '<span class="badge badge-rolle">' + esc(rolle) + '</span>';
};

/* ---------- Toast ---------- */

window.Toast = (function () {
  function show(message, type) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.setAttribute('role', 'status');
    var ic = type === 'success' ? 'check' : (type === 'error' ? 'info' : 'info');
    el.innerHTML = icon(ic) + '<span>' + esc(message) + '</span>';
    root.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('toast-vis'); });
    setTimeout(function () {
      el.classList.remove('toast-vis');
      setTimeout(function () { el.remove(); }, 300);
    }, 4200);
  }
  function errors(list) { show(list.join(' '), 'error'); }
  return { show: show, errors: errors };
})();

/* ---------- Modal ---------- */

window.Modal = (function () {
  var onSubmitCb = null;

  function open(opts) {
    var root = document.getElementById('modal-root');
    onSubmitCb = opts.onSubmit || null;
    root.innerHTML =
      '<div class="modal-backdrop" data-modal-backdrop>' +
        '<div class="modal" role="dialog" aria-modal="true" aria-label="' + escAttr(opts.title || '') + '">' +
          '<div class="modal-head">' +
            '<h3>' + esc(opts.title || '') + '</h3>' +
            '<button type="button" class="btn-icon" data-modal-close aria-label="Luk">' + icon('x') + '</button>' +
          '</div>' +
          '<form id="modal-form" novalidate>' +
            '<div class="modal-body">' + (opts.body || '') + '</div>' +
            '<div class="modal-foot">' +
              '<button type="button" class="btn btn-ghost" data-modal-close>Annullér</button>' +
              (opts.okLabel === null ? '' :
                '<button type="submit" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '">' +
                esc(opts.okLabel || 'Gem') + '</button>') +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';
    var form = document.getElementById('modal-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (onSubmitCb) onSubmitCb(form);
    });
    root.querySelectorAll('[data-modal-close]').forEach(function (b) {
      b.addEventListener('click', close);
    });
    root.querySelector('[data-modal-backdrop]').addEventListener('mousedown', function (e) {
      if (e.target === e.currentTarget) close();
    });
    // Flyt fokus ind i modalen — ellers rammer Enter knappen bag backdroppen.
    var first = form.querySelector('input, select, textarea') ||
      form.querySelector('button[type=submit]') ||
      root.querySelector('[data-modal-close]');
    if (first) first.focus();
  }

  function close() {
    document.getElementById('modal-root').innerHTML = '';
    onSubmitCb = null;
  }

  function confirm(opts) {
    open({
      title: opts.title,
      body: '<p class="modal-text">' + esc(opts.text) + '</p>',
      okLabel: opts.okLabel || 'Bekræft',
      danger: opts.danger,
      onSubmit: function () {
        close();
        opts.onOk();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  return { open: open, close: close, confirm: confirm };
})();

/* ---------- Sidebar / layout ---------- */

window.sidebarHtml = function (route, user) {
  function item(href, ic, label, active) {
    return '<a href="' + href + '" class="nav-item' + (active ? ' nav-active' : '') + '">' +
      icon(ic) + '<span>' + label + '</span></a>';
  }
  var r = route.split('/')[1] || 'dashboard';
  var html =
    '<aside class="sidebar" id="sidebar">' +
      '<div class="sidebar-brand">' +
        '<span class="brand-mark">ea</span>' +
        '<span class="brand-name">erwin andersen<br><strong>tidsregistrering</strong></span>' +
      '</div>' +
      '<nav class="sidebar-nav">' +
        item('#/dashboard', 'dashboard', 'Dashboard', r === 'dashboard') +
        item('#/rekrutteringer', 'briefcase', 'Rekrutteringer', r === 'rekrutteringer' && route !== '#/rekrutteringer/ny') +
        item('#/rekrutteringer/ny', 'plus', 'Opret rekruttering', route === '#/rekrutteringer/ny') +
        item('#/tid', 'clock', 'Tidsregistrering', r === 'tid') +
        item('#/rapporter', 'chart', 'Rapporter', r === 'rapporter') +
        (user.app_rolle === 'admin' ? item('#/admin', 'settings', 'Admin', r === 'admin') : '') +
      '</nav>' +
      '<div class="sidebar-foot">' +
        '<div class="sidebar-user">' +
          '<span class="avatar">' + esc(user.initialer) + '</span>' +
          '<span class="sidebar-user-info">' +
            '<strong>' + esc(DB.userLabel(user.id)) + '</strong>' +
            '<small>' + esc(user.rolle) + (user.app_rolle === 'admin' ? ' · admin' : '') + '</small>' +
          '</span>' +
        '</div>' +
        '<button type="button" class="btn-logout" data-action="logout" title="Log ud og skift bruger">' +
          icon('logout') + '<span>Log ud</span></button>' +
      '</div>' +
    '</aside>';
  return html;
};

/* ---------- Hurtig tidsregistrering (bjælke øverst) ---------- */

window.quickBar = function () {
  var recs = DB.all('recruitments')
    .filter(function (r) { return DB.LUKKEDE_STATUSSER.indexOf(r.status) === -1; })
    .sort(function (a, b) {
      if (!!a.favorit !== !!b.favorit) return a.favorit ? -1 : 1;
      return (b.rekrutteringsnummer || '').localeCompare(a.rekrutteringsnummer || '');
    });
  var label = '<span class="quickbar-label">' + icon('clock') + 'Hurtig tidsregistrering</span>';
  if (recs.length === 0) {
    return '<div class="quickbar">' + label +
      '<span class="quickbar-tom">Ingen åbne rekrutteringer — <a href="#/rekrutteringer/ny">opret en</a> for at registrere tid.</span>' +
      '</div>';
  }
  var valgt = App.state.quick.rek;
  if (!recs.some(function (r) { return r.id === valgt; })) valgt = '';
  var opts = recs.map(function (r) {
    return { value: r.id, label: (r.favorit ? '★ ' : '') + r.rekrutteringsnummer + ' · ' + r.titel };
  });
  var hint = 'Registreres med dags dato, din rolle (' + escAttr(App.user.rolle) +
    ') og rekrutteringens aktuelle fase';
  return '<div class="quickbar">' +
    '<form id="quick-tid-form" class="quickbar-form" novalidate>' +
      label +
      '<select name="recruitment_id" id="quick-rek" class="quickbar-rek" aria-label="Rekruttering">' +
        selectOptions(opts, valgt, 'Vælg rekruttering…') + '</select>' +
      '<input type="text" name="timer" class="quickbar-timer" placeholder="Timer, fx 2,5" ' +
        'inputmode="decimal" autocomplete="off" aria-label="Timer">' +
      '<input type="text" name="beskrivelse" class="quickbar-desc" placeholder="Beskrivelse (valgfri)" ' +
        'aria-label="Beskrivelse">' +
      '<button type="submit" class="btn btn-primary btn-sm" title="' + hint + '">Registrér</button>' +
      '<a href="#/tid" class="quickbar-mere" title="Alle felter: dato, rolle og fase">Flere felter</a>' +
    '</form>' +
    '</div>';
};

/* ---------- KPI-kort ---------- */

window.kpiCard = function (label, value, sub) {
  return '<div class="kpi-card">' +
    '<span class="kpi-value">' + value + '</span>' +
    '<span class="kpi-label">' + esc(label) + '</span>' +
    (sub ? '<span class="kpi-sub">' + esc(sub) + '</span>' : '') +
    '</div>';
};

/* ---------- Bjælkediagram (vandret, én farvetone, direkte labels) ---------- */

window.barChart = function (title, rows, valueFmt) {
  var fmt = valueFmt || DB.fmtTimer;
  var max = 0;
  rows.forEach(function (r) { if (r.value > max) max = r.value; });
  var body;
  if (max === 0) {
    body = '<p class="chart-empty">Ingen data i perioden</p>';
  } else {
    body = rows.map(function (r) {
      var pct = Math.max(1.5, Math.round(r.value / max * 1000) / 10);
      return '<div class="chart-row" title="' + escAttr(r.label + ': ' + fmt(r.value)) + '">' +
        '<span class="chart-label">' + esc(r.label) + '</span>' +
        '<span class="chart-track"><span class="chart-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="chart-value">' + esc(fmt(r.value)) + '</span>' +
        '</div>';
    }).join('');
  }
  return '<div class="card chart-card">' +
    '<h3 class="card-title">' + esc(title) + '</h3>' +
    '<div class="chart">' + body + '</div>' +
    '</div>';
};

/* ---------- Tom tilstand ---------- */

window.emptyState = function (text) {
  return '<div class="empty-state">' + icon('info') + '<p>' + esc(text) + '</p></div>';
};

/* ---------- Formular-hjælpere ---------- */

window.selectOptions = function (values, selected, emptyLabel) {
  var html = '';
  if (emptyLabel !== undefined) {
    html += '<option value="">' + esc(emptyLabel) + '</option>';
  }
  values.forEach(function (v) {
    var val, label;
    if (typeof v === 'object') { val = v.value; label = v.label; }
    else { val = v; label = v; }
    html += '<option value="' + escAttr(val) + '"' + (val === selected ? ' selected' : '') + '>' +
      esc(label) + '</option>';
  });
  return html;
};

window.userOptions = function (selected, emptyLabel) {
  var users = DB.activeUsers();
  // Behold en nedlagt bruger der allerede er valgt — ellers nulstilles
  // feltet lydløst når formularen gemmes igen.
  var valgt = selected ? DB.userById(selected) : null;
  if (valgt && users.indexOf(valgt) === -1) users = users.concat([valgt]);
  var opts = users.map(function (u) {
    return {
      value: u.id,
      label: DB.userLabel(u.id) + (u.aktiv === false ? ' (nedlagt)' : '')
    };
  });
  return selectOptions(opts, selected, emptyLabel);
};
