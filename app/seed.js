/*
 * Demo-data til lokal demo-mode.
 * Datoer beregnes relativt til dags dato, så demoen altid ser aktuel ud.
 * Navne er sat til initialer — ret dem under Admin → Brugere.
 */
window.Seed = (function () {

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function daysAgoISO(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function ts(nDaysAgo) { return daysAgoISO(nDaysAgo) + 'T09:00:00.000Z'; }

  function demoData() {
    var users = [
      { id: 'u-mkj', initialer: 'MKJ', navn: 'MKJ', email: 'mkj@eandersen.dk', rolle: 'Marketing', app_rolle: 'admin', aktiv: true, created_at: ts(365) },
      { id: 'u-hrn', initialer: 'HRN', navn: 'HRN', email: 'hrn@eandersen.dk', rolle: 'Rekrutteringspartner', app_rolle: 'admin', aktiv: true, created_at: ts(365) },
      { id: 'u-efa', initialer: 'EFA', navn: 'EFA', email: 'mail@eandersen.dk', rolle: 'Rekrutteringspartner', app_rolle: 'user', aktiv: true, created_at: ts(365) },
      { id: 'u-bdl', initialer: 'BDL', navn: 'BDL', email: 'bdl@eandersen.dk', rolle: 'Rekrutteringskonsulent', app_rolle: 'user', aktiv: true, created_at: ts(365) },
      { id: 'u-lbs', initialer: 'LBS', navn: 'LBS', email: 'lbs@eandersen.dk', rolle: 'Rekrutteringskonsulent', app_rolle: 'user', aktiv: true, created_at: ts(365) }
    ];

    // [id, titel, virksomhed, opgavetype, fase, status, partner, konsulent,
    //  honorar, startdage, ansatdage|null, aarsag|null, favorit, beskrivelse]
    var rDefs = [
      ['r-01', 'Supply Chain Manager', 'Havnholm Logistik A/S', 'Fuld rekruttering', 'Afslutningsfase', 'Afsluttet', 'u-efa', 'u-lbs', 300000, 120, null, null, false,
        'Genbesættelse efter internt jobskifte. Lukket uden placering — kunden satte processen i bero.'],
      ['r-02', 'Marketingchef', 'Bøgelund Fødevarer A/S', 'Fuld rekruttering', 'Afslutningsfase', 'Besat', 'u-hrn', 'u-bdl', 350000, 100, 25, null, true,
        'Ny marketingchef til voksende fødevarevirksomhed. Fokus på digital profil.'],
      ['r-03', 'HR Business Partner', 'Danske Maskinfabrikker A/S', 'Fuld rekruttering', 'Afslutningsfase', 'Besat', 'u-efa', 'u-bdl', 320000, 80, 10, null, false,
        'HRBP til produktionsvirksomhed med 400 medarbejdere.'],
      ['r-04', 'Økonomichef', 'Grønvang Byg ApS', 'Fuld rekruttering', 'Afslutningsfase', 'Aktiv', 'u-efa', 'u-lbs', 380000, 60, null, null, false,
        'Økonomichef med erfaring fra bygge- og anlægsbranchen. Reference-tjek i gang.'],
      ['r-05', 'IT-projektleder', 'Nordkyst Consulting', 'Searchopgave', 'Rekrutteringsfase', 'Annulleret', 'u-hrn', 'u-lbs', 180000, 50, null, 'Kunden besatte stillingen internt.', false,
        'Search efter senior IT-projektleder til ERP-udrulning.'],
      ['r-06', 'CFO rekruttering', 'Novatek A/S', 'Fuld rekruttering', 'Rekrutteringsfase', 'Aktiv', 'u-hrn', 'u-bdl', 480000, 45, null, null, true,
        'CFO til techvirksomhed i vækst. Kandidatpræsentation planlagt.'],
      ['r-07', 'Salgsdirektør', 'Fjordlys Pharma ApS', 'Searchopgave', 'Rekrutteringsfase', 'På pause', 'u-hrn', 'u-lbs', 250000, 30, null, null, false,
        'Search efter salgsdirektør med pharma-erfaring. Afventer kundens organisationsændring.'],
      ['r-08', 'Financial Controller', 'Vestjysk Energi A/S', 'Searchopgave', 'Opstartsfase', 'Aktiv', 'u-efa', 'u-bdl', null, 7, null, null, false,
        'Kortlægning af kandidatmarkedet er netop startet.']
    ];

    var counters = {}; // fortløbende nummer pr. år
    var recruitments = rDefs.map(function (d) {
      var startdato = daysAgoISO(d[9]);
      var year = startdato.slice(0, 4);
      counters[year] = (counters[year] || 0) + 1;
      var num = String(counters[year]);
      while (num.length < 3) num = '0' + num;
      return {
        id: d[0],
        rekrutteringsnummer: 'EA-' + year + '-' + num,
        titel: d[1],
        virksomhedsnavn: d[2],
        opgavetype: d[3],
        beskrivelse: d[13],
        rekrutteringspartner: d[6],
        rekrutteringskonsulent: d[7],
        fase: d[4],
        status: d[5],
        honorar: d[8],
        startdato: startdato,
        ansaettelsesdato: d[10] === null ? null : daysAgoISO(d[10]),
        annulleringsaarsag: d[11],
        noter: '',
        favorit: d[12],
        oprettet_af: d[6],
        created_at: ts(d[9]),
        updated_at: ts(Math.max(0, d[9] - 5))
      };
    });

    // [id, rekruttering, bruger, rolle, fase, dage siden, timer, beskrivelse]
    var tDefs = [
      ['t-01', 'r-01', 'u-efa', 'Rekrutteringspartner', 'Opstartsfase', 118, 2, 'Opstartsmøde hos kunden'],
      ['t-02', 'r-01', 'u-lbs', 'Rekrutteringskonsulent', 'Rekrutteringsfase', 110, 5.5, 'Search og screening'],
      ['t-03', 'r-01', 'u-lbs', 'Rekrutteringskonsulent', 'Rekrutteringsfase', 95, 4, 'Kandidatinterviews'],
      ['t-04', 'r-01', 'u-efa', 'Rekrutteringspartner', 'Afslutningsfase', 70, 1.5, 'Afsluttende status med kunden'],

      ['t-05', 'r-02', 'u-hrn', 'Rekrutteringspartner', 'Opstartsfase', 98, 3, 'Jobprofil og kontrakt'],
      ['t-06', 'r-02', 'u-mkj', 'Marketing', 'Opstartsfase', 95, 2.5, 'Stillingsopslag og LinkedIn-kampagne'],
      ['t-07', 'r-02', 'u-bdl', 'Rekrutteringskonsulent', 'Rekrutteringsfase', 80, 6, 'Search i eget netværk'],
      ['t-08', 'r-02', 'u-bdl', 'Rekrutteringskonsulent', 'Rekrutteringsfase', 62, 7.5, 'Interviews, 1. runde'],
      ['t-09', 'r-02', 'u-hrn', 'Rekrutteringspartner', 'Afslutningsfase', 30, 2, 'Kandidatpræsentation hos kunden'],
      ['t-10', 'r-02', 'u-hrn', 'Rekrutteringspartner', 'Afslutningsfase', 26, 1.5, 'Kontraktforhandling'],

      ['t-11', 'r-03', 'u-efa', 'Rekrutteringspartner', 'Opstartsfase', 78, 2.5, 'Behovsafdækning'],
      ['t-12', 'r-03', 'u-bdl', 'Rekrutteringskonsulent', 'Rekrutteringsfase', 60, 8, 'Screening af ansøgninger'],
      ['t-13', 'r-03', 'u-bdl', 'Rekrutteringskonsulent', 'Rekrutteringsfase', 45, 6.5, 'Interviews og testtilbagemelding'],
      ['t-14', 'r-03', 'u-efa', 'Rekrutteringspartner', 'Afslutningsfase', 14, 2, 'Referencetagning og ansættelse'],

      ['t-15', 'r-04', 'u-efa', 'Rekrutteringspartner', 'Opstartsfase', 58, 3, 'Opstart og annoncetekst'],
      ['t-16', 'r-04', 'u-mkj', 'Marketing', 'Opstartsfase', 55, 1.5, 'Annonceopsætning'],
      ['t-17', 'r-04', 'u-lbs', 'Rekrutteringskonsulent', 'Rekrutteringsfase', 40, 7, 'Search og kandidatkontakt'],
      ['t-18', 'r-04', 'u-lbs', 'Rekrutteringskonsulent', 'Rekrutteringsfase', 20, 5, 'Interviews, 2. runde'],
      ['t-19', 'r-04', 'u-efa', 'Rekrutteringspartner', 'Afslutningsfase', 5, 2.5, 'Referencetjek'],

      ['t-20', 'r-05', 'u-lbs', 'Rekrutteringskonsulent', 'Opstartsfase', 48, 2, 'Kravspecifikation med kunden'],
      ['t-21', 'r-05', 'u-lbs', 'Rekrutteringskonsulent', 'Rekrutteringsfase', 38, 4.5, 'Longlist-research'],

      ['t-22', 'r-06', 'u-hrn', 'Rekrutteringspartner', 'Opstartsfase', 43, 4, 'Opstartsmøde og jobprofil'],
      ['t-23', 'r-06', 'u-bdl', 'Rekrutteringskonsulent', 'Rekrutteringsfase', 30, 8, 'Executive search, longlist'],
      ['t-24', 'r-06', 'u-bdl', 'Rekrutteringskonsulent', 'Rekrutteringsfase', 15, 6, 'Interviews med shortlist'],
      ['t-25', 'r-06', 'u-hrn', 'Rekrutteringspartner', 'Rekrutteringsfase', 8, 3, 'Kandidatpræsentation forberedt'],
      ['t-26', 'r-06', 'u-mkj', 'Marketing', 'Rekrutteringsfase', 12, 1, 'Employer branding-materiale'],

      ['t-27', 'r-07', 'u-lbs', 'Rekrutteringskonsulent', 'Opstartsfase', 28, 2.5, 'Markedskortlægning'],
      ['t-28', 'r-07', 'u-hrn', 'Rekrutteringspartner', 'Rekrutteringsfase', 22, 1.5, 'Statusmøde med kunden'],

      ['t-29', 'r-08', 'u-efa', 'Rekrutteringspartner', 'Opstartsfase', 6, 2, 'Opstartsmøde'],
      ['t-30', 'r-08', 'u-bdl', 'Rekrutteringskonsulent', 'Opstartsfase', 2, 3.5, 'Indledende search']
    ];

    var time_entries = tDefs.map(function (d) {
      return {
        id: d[0],
        recruitment_id: d[1],
        user_id: d[2],
        rolle: d[3],
        fase: d[4],
        dato: daysAgoISO(d[5]),
        timer: d[6],
        beskrivelse: d[7],
        created_at: ts(d[5]),
        updated_at: ts(d[5])
      };
    });

    var comments = [
      { id: 'c-01', recruitment_id: 'r-06', user_id: 'u-hrn', tekst: 'Kunden ønsker præsentation af 3 kandidater senest i næste uge.', created_at: ts(8) },
      { id: 'c-02', recruitment_id: 'r-06', user_id: 'u-bdl', tekst: 'Shortlist er klar — to stærke profiler og én joker.', created_at: ts(7) },
      { id: 'c-03', recruitment_id: 'r-03', user_id: 'u-efa', tekst: 'Kandidaten har accepteret tilbuddet. Startdato aftalt.', created_at: ts(10) },
      { id: 'c-04', recruitment_id: 'r-07', user_id: 'u-hrn', tekst: 'Kunden vender tilbage efter deres organisationsændring — forventet om 3 uger.', created_at: ts(20) }
    ];

    // [rekruttering, bruger, type, beskrivelse, dage siden]
    var lDefs = [
      ['r-01', 'u-efa', 'oprettet', 'Rekrutteringen blev oprettet', 120],
      ['r-01', 'u-efa', 'status_aendret', 'Status ændret fra "Aktiv" til "Afsluttet"', 68],
      ['r-02', 'u-hrn', 'oprettet', 'Rekrutteringen blev oprettet', 100],
      ['r-02', 'u-hrn', 'fase_aendret', 'Fase ændret fra "Opstartsfase" til "Rekrutteringsfase"', 90],
      ['r-02', 'u-hrn', 'fase_aendret', 'Fase ændret fra "Rekrutteringsfase" til "Afslutningsfase"', 35],
      ['r-02', 'u-hrn', 'besat', 'Rekrutteringen blev markeret som besat (ansættelsesdato ' + daysAgoISO(25) + ')', 25],
      ['r-03', 'u-efa', 'oprettet', 'Rekrutteringen blev oprettet', 80],
      ['r-03', 'u-efa', 'fase_aendret', 'Fase ændret fra "Opstartsfase" til "Rekrutteringsfase"', 70],
      ['r-03', 'u-efa', 'fase_aendret', 'Fase ændret fra "Rekrutteringsfase" til "Afslutningsfase"', 20],
      ['r-03', 'u-efa', 'besat', 'Rekrutteringen blev markeret som besat (ansættelsesdato ' + daysAgoISO(10) + ')', 10],
      ['r-04', 'u-efa', 'oprettet', 'Rekrutteringen blev oprettet', 60],
      ['r-04', 'u-efa', 'fase_aendret', 'Fase ændret fra "Opstartsfase" til "Rekrutteringsfase"', 50],
      ['r-04', 'u-efa', 'fase_aendret', 'Fase ændret fra "Rekrutteringsfase" til "Afslutningsfase"', 8],
      ['r-05', 'u-hrn', 'oprettet', 'Rekrutteringen blev oprettet', 50],
      ['r-05', 'u-hrn', 'annulleret', 'Rekrutteringen blev annulleret: Kunden besatte stillingen internt.', 35],
      ['r-06', 'u-hrn', 'oprettet', 'Rekrutteringen blev oprettet', 45],
      ['r-06', 'u-hrn', 'fase_aendret', 'Fase ændret fra "Opstartsfase" til "Rekrutteringsfase"', 35],
      ['r-06', 'u-hrn', 'kommentar', 'Kommentar tilføjet', 8],
      ['r-07', 'u-hrn', 'oprettet', 'Rekrutteringen blev oprettet', 30],
      ['r-07', 'u-hrn', 'status_aendret', 'Status ændret fra "Aktiv" til "På pause"', 21],
      ['r-08', 'u-efa', 'oprettet', 'Rekrutteringen blev oprettet', 7]
    ];

    var activity_log = lDefs.map(function (d, i) {
      return {
        id: 'l-' + (i < 9 ? '0' : '') + (i + 1),
        recruitment_id: d[0],
        user_id: d[1],
        type: d[2],
        beskrivelse: d[3],
        created_at: ts(d[4])
      };
    });

    return {
      users: users,
      recruitments: recruitments,
      time_entries: time_entries,
      activity_log: activity_log,
      comments: comments
    };
  }

  return { demoData: demoData };
})();
