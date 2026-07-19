/**
 * iMerit Employee Feedback Dashboard — standalone Apps Script
 *
 * REQUIRED FILES IN THE APPS SCRIPT PROJECT:
 *   1) Code.gs      ← this file
 *   2) Dashboard    ← HTML file (paste repo Dashboard.html). Name must be exactly "Dashboard"
 *
 * Deploy as Web App:
 *   Deploy → New deployment → Type: Web app
 *   Execute as: Me · Who has access: your org / Anyone
 *   Opening the URL rebuilds scorecards THEN shows the FULL dashboard UI
 *   (same layout as index.html: Overview, TL, Workflow, Focus, Location, Themes, Action Plan)
 *
 * Optional: ?skipRebuild=1  faster open from existing scorecard tabs
 * Optional time trigger on buildTlDashboard for hands-off refresh
 *
 * Spreadsheet ID: 1D_oYej7qjYxgWQ8XtHKceb6fEVJUlNZzLiOX2RQVb0k
 * Source gid: 1126318129 (responses_consolidated)
 */

/** Target spreadsheet (standalone — do not rely on getActive). */
var SPREADSHEET_ID = '1D_oYej7qjYxgWQ8XtHKceb6fEVJUlNZzLiOX2RQVb0k';

/**
 * Source data sheet gid from URL:
 * .../edit?gid=1126318129#gid=1126318129
 */
var SOURCE_SHEET_GID = 1126318129;

/** Fallback tab name if gid is not found */
var SOURCE_SHEET_NAME = 'responses_consolidated';

/**
 * Open the configured spreadsheet by ID (standalone-safe).
 */
function getTargetSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Resolve source sheet by gid first, then by name.
 */
function getSourceSheet_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === SOURCE_SHEET_GID) {
      return sheets[i];
    }
  }
  var byName = ss.getSheetByName(SOURCE_SHEET_NAME);
  if (byName) return byName;
  throw new Error(
    'Source sheet not found. gid=' + SOURCE_SHEET_GID +
    ' name=' + SOURCE_SHEET_NAME +
    ' spreadsheet=' + SPREADSHEET_ID
  );
}

/**
 * Safe UI toast / alert (standalone has no bound UI sometimes).
 */
function notify_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    Logger.log(message);
  }
}

/**
 * Web App entry point.
 * Serves the FULL interactive Dashboard.html (same UI as index.html)
 * after rebuilding scorecard tabs from responses_consolidated.
 *
 * Params:
 *   ?skipRebuild=1  — open dashboard without rebuilding (faster)
 *   ?action=home    — small status page
 *   ?view=json      — raw dashboard JSON
 *
 * DEPLOY: Apps Script project must contain BOTH:
 *   1) Code.gs  (this project)
 *   2) Dashboard.html  (File → New → HTML file named exactly "Dashboard")
 */
function doGet(e) {
  e = e || { parameter: {} };
  var p = e.parameter || {};
  var action = p.action || 'dashboard';
  var view = p.view || 'html';
  var skipRebuild = String(p.skipRebuild || '') === '1';

  if (action === 'home') {
    return htmlPage_('TL Performance Dashboard', homeHtml_(), true);
  }

  try {
    var result = null;
    if (!skipRebuild) {
      result = buildTlDashboard();
    }

    var live = mapScorecardsToDashboard_(result);

    if (view === 'json') {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, rebuild: result, data: live }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var tpl = HtmlService.createTemplateFromFile('Dashboard');
    // Injected as: window.__LIVE_DATA__ = <?!= liveJson ?>;
    tpl.liveJson = JSON.stringify(live)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');

    return tpl.evaluate()
      .setTitle('iMerit Employee Feedback Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    var msg = String(err && err.message ? err.message : err);
    if (msg.indexOf('Dashboard') !== -1 || msg.indexOf('not found') !== -1 || msg.indexOf('HTML') !== -1) {
      msg += ' | Add HTML file named exactly "Dashboard" and paste repo Dashboard.html contents.';
    }
    if (view === 'json') {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: msg }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return htmlPage_(
      'Dashboard error',
      '<h1>Could not open dashboard</h1>' +
        '<div class="card"><p class="err">' + escapeHtml_(msg) + '</p>' +
        '<p>In Apps Script: <b>File → New → HTML</b> → name it <code>Dashboard</code> → paste <code>Dashboard.html</code> from GitHub.</p>' +
        '<p class="actions"><a class="btn" href="?action=dashboard">Retry</a> ' +
        '<a class="btn secondary" href="?skipRebuild=1">Skip rebuild</a></p></div>',
      false
    );
  }
}

function doPost(e) {
  try {
    var result = buildTlDashboard();
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, result: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err.message || err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function homeHtml_() {
  var sheetUrl = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit';
  return '' +
    '<h1>iMerit Employee Feedback Dashboard</h1>' +
    '<p class="muted">Web App serves the full interactive dashboard (Overview, TL, Workflow, Location…).</p>' +
    '<div class="card">' +
    '<p><a href="' + sheetUrl + '" target="_blank" rel="noopener">Open Google Sheet</a></p>' +
    '<p class="actions">' +
    '<a class="btn" href="?action=dashboard">Open full dashboard</a> ' +
    '<a class="btn secondary" href="?skipRebuild=1">Fast open</a>' +
    '</p></div>';
}

function htmlPage_(title, bodyHtml, ok) {
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml_(title) + '</title>' +
    '<style>body{font-family:system-ui,sans-serif;background:#0b1220;color:#e8eefc;margin:0;padding:24px}' +
    '.card{background:#121a2b;border:1px solid #243049;border-radius:12px;padding:18px;max-width:720px}' +
    '.err{color:#fca5a5}.muted{color:#93a0b8}' +
    '.btn{display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff!important;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600;margin:4px 4px 0 0}' +
    '.btn.secondary{background:#1e293b;border:1px solid #334155}code{background:#1e293b;padding:2px 6px;border-radius:4px}</style></head><body>' +
    bodyHtml + '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadDashboardData_() {
  var ss = getTargetSpreadsheet_();
  return {
    tls: sheetToObjects_(ss.getSheetByName('TL_Scorecard')),
    locations: sheetToObjects_(ss.getSheetByName('Location_Scorecard')),
    workflows: sheetToObjects_(ss.getSheetByName('Workflow_Scorecard')),
    periods: sheetToObjects_(ss.getSheetByName('Period_Scorecard')),
    meta: {
      spreadsheetId: SPREADSHEET_ID,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit',
      loadedAt: new Date().toISOString()
    }
  };
}

function sheetToObjects_(sheet) {
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h || '').trim(); });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c] || ('col' + c);
      var v = values[r][c];
      if (v !== '' && v !== null && v !== undefined) empty = false;
      obj[key] = v;
    }
    if (!empty) rows.push(obj);
  }
  return rows;
}

function pick_(row, keys) {
  for (var i = 0; i < keys.length; i++) {
    if (row[keys[i]] !== undefined && row[keys[i]] !== null && row[keys[i]] !== '') return row[keys[i]];
  }
  return null;
}

function toNum_(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

function flagFromScore_(lead, n) {
  if (lead === null) return 'OK';
  if (lead >= 4.5 && n >= 5) return 'TOP';
  if (lead < 3.5 || (lead < 4.0 && n >= 3)) return 'BOTTOM';
  return 'OK';
}

function wfStatus_(lead, n) {
  if (n < 5) return 'LOW N';
  if (lead !== null && lead >= 4.5) return 'TOP';
  if (lead !== null && lead < 3.5) return 'RISK';
  if (lead !== null && lead < 4.0) return 'WATCH';
  if (n >= 50) return 'CORE';
  return 'OK';
}

/**
 * Map scorecard tabs to the payload expected by Dashboard.html / index.html
 */
function mapScorecardsToDashboard_(rebuildSummary) {
  var raw = loadDashboardData_();
  var MONTH_NAMES = {
    1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
    7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
  };

  var tls = raw.tls.map(function (r) {
    var n = toNum_(pick_(r, ['# Resp', 'Resp', 'n'])) || 0;
    var lead = toNum_(pick_(r, ['Lead Score', 'lead']));
    var flag = String(pick_(r, ['Flag', 'flag']) || flagFromScore_(lead, n)).toUpperCase();
    return {
      rank: 0,
      name: String(pick_(r, ['Lead', 'lead', 'name']) || 'Unknown'),
      n: n,
      lead: lead,
      job: toNum_(pick_(r, ['Job Sat', 'job'])),
      tool: toNum_(pick_(r, ['Tool Score', 'tool'])),
      ld: toNum_(pick_(r, ['L&D', 'ld'])),
      centers: String(pick_(r, ['Centers', 'Center', 'centers']) || ''),
      wfh: toNum_(pick_(r, ['WFH %', 'wfh'])) || 0,
      flag: flag,
      notes: '',
      year: toNum_(pick_(r, ['Year', 'year'])),
      month: toNum_(pick_(r, ['Month', 'month'])),
      monthYear: cleanMonthYearDisplay_(
        pick_(r, ['Month-Year', 'Month Year', 'monthYear']),
        toNum_(pick_(r, ['Month', 'month'])),
        toNum_(pick_(r, ['Year', 'year']))
      )
    };
  }).filter(function (t) { return t.name && t.name !== 'Unknown'; });

  tls.sort(function (a, b) { return (b.lead || 0) - (a.lead || 0); });
  tls.forEach(function (t, i) { t.rank = i + 1; });

  var locations = raw.locations.map(function (r) {
    return {
      center: String(pick_(r, ['Center', 'center']) || 'Unknown'),
      n: toNum_(pick_(r, ['# Resp', 'n'])) || 0,
      lead: toNum_(pick_(r, ['Lead Score', 'lead'])),
      job: toNum_(pick_(r, ['Job Sat', 'job'])),
      tool: toNum_(pick_(r, ['Tool Score', 'tool'])),
      ld: toNum_(pick_(r, ['L&D', 'ld'])),
      wfh: toNum_(pick_(r, ['WFH %', 'wfh'])) || 0,
      wfo: toNum_(pick_(r, ['WFO %', 'wfo'])) || 0,
      concern: '',
      year: toNum_(pick_(r, ['Year', 'year'])),
      month: toNum_(pick_(r, ['Month', 'month'])),
      monthYear: cleanMonthYearDisplay_(
        pick_(r, ['Month-Year', 'Month Year']),
        toNum_(pick_(r, ['Month', 'month'])),
        toNum_(pick_(r, ['Year', 'year']))
      )
    };
  }).filter(function (l) { return l.center && l.center !== 'Unknown'; });

  var workflows = raw.workflows.map(function (r) {
    var n = toNum_(pick_(r, ['# Resp', 'n'])) || 0;
    var lead = toNum_(pick_(r, ['Lead Score', 'lead']));
    var st = String(pick_(r, ['Status', 'status', 'Flag']) || wfStatus_(lead, n));
    var name = String(pick_(r, ['Workflow', 'workflow']) || 'Unknown');
    var yW = toNum_(pick_(r, ['Year', 'year']));
    var mW = toNum_(pick_(r, ['Month', 'month']));
    return {
      workflow: name,
      n: n,
      lead: lead,
      job: toNum_(pick_(r, ['Job Sat', 'job'])),
      tool: toNum_(pick_(r, ['Tool Score', 'tool'])),
      ld: toNum_(pick_(r, ['L&D', 'ld'])),
      year: yW,
      month: mW,
      monthYear: cleanMonthYearDisplay_(pick_(r, ['Month-Year', 'Month Year']), mW, yW),
      wfh: toNum_(pick_(r, ['WFH %', 'wfh'])) || 0,
      wfo: 0,
      centers: String(pick_(r, ['Top Centers', 'Centers', 'centers']) || ''),
      topLeads: '',
      status: st,
      focus: 'Live workflow metrics from scorecard',
      themes: {},
      deep: {
        title: name,
        points: ['Scores from Workflow_Scorecard for selected Month-Year filters.']
      }
    };
  }).filter(function (w) { return w.workflow && w.workflow !== 'Unknown'; });

  var periodMap = {};
  raw.periods.forEach(function (r) {
    var y = toNum_(pick_(r, ['Year', 'year']));
    var m = toNum_(pick_(r, ['Month', 'month']));
    var my = cleanMonthYearDisplay_(pick_(r, ['Month-Year', 'Month Year']), m, y);
    if (!my && y && m) my = (MONTH_NAMES[m] || m) + '-' + y;
    if (!my) return;
    periodMap[my] = {
      year: y,
      month: m,
      monthYear: my,
      label: my
    };
  });
  tls.forEach(function (t) {
    if (t.monthYear && !periodMap[t.monthYear]) {
      periodMap[t.monthYear] = {
        year: t.year, month: t.month, monthYear: t.monthYear, label: t.monthYear
      };
    }
  });
  var periods = Object.keys(periodMap).map(function (k) { return periodMap[k]; });
  periods.sort(function (a, b) {
    var ay = Number(a.year) || 0, by = Number(b.year) || 0;
    if (ay !== by) return ay - by;
    return (Number(a.month) || 0) - (Number(b.month) || 0);
  });

  function wavg(arr, key) {
    var s = 0, w = 0;
    arr.forEach(function (r) {
      if (r[key] !== null && r[key] !== undefined && r.n) {
        s += r[key] * r.n;
        w += r.n;
      }
    });
    return w ? Math.round((s / w) * 100) / 100 : null;
  }

  var totalResp = tls.reduce(function (s, t) { return s + (t.n || 0); }, 0);
  var last = periods.length ? periods[periods.length - 1] : { year: null, month: null, monthYear: '' };

  var focusCards = tls.filter(function (t) {
    return t.flag === 'BOTTOM' || (t.lead !== null && t.lead < 3.8);
  }).slice(0, 12).map(function (t) {
    var pri = (t.lead !== null && t.lead < 2.5) ? 'CRITICAL' : (t.lead !== null && t.lead < 3.5) ? 'HIGH' : 'MEDIUM';
    return {
      name: t.name,
      flag: t.flag || 'BOTTOM',
      priority: pri,
      centers: t.centers || '',
      focus: [
        'Lead score ' + (t.lead != null ? t.lead.toFixed(2) : 'n/a') + ' across ' + t.n + ' responses',
        'Review accessibility, equal treatment, feedback cadence',
        'Period: ' + (t.monthYear || 'n/a')
      ]
    };
  });

  return {
    periods: periods,
    kpi: {
      responses: totalResp || (rebuildSummary && rebuildSummary.rows) || 0,
      jobSat: wavg(tls, 'job'),
      lead: wavg(tls, 'lead'),
      tool: wavg(tls, 'tool'),
      ld: wavg(tls, 'ld'),
      wfhPct: null,
      year: last.year,
      month: last.month,
      monthYear: last.monthYear
    },
    tls: tls,
    locations: locations,
    workflows: workflows,
    tlWorkflows: {},
    focusCards: focusCards,
    meta: {
      spreadsheetId: SPREADSHEET_ID,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit',
      rebuilt: !!rebuildSummary,
      rebuildSummary: rebuildSummary || null,
      loadedAt: new Date().toISOString(),
      source: 'scorecard tabs'
    }
  };
}

/**
 * Build scorecard tabs. Returns a summary object (used by doGet / doPost).
 */
function buildTlDashboard() {
  var ss = getTargetSpreadsheet_();
  var sh = getSourceSheet_(ss);

  var values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('No data on source sheet: ' + sh.getName());

  var headers = values[0].map(function (h) { return String(h || '').trim(); });
  var hLower = headers.map(function (h) { return h.toLowerCase(); });

  function findCol(preds) {
    for (var i = 0; i < hLower.length; i++) {
      for (var p = 0; p < preds.length; p++) {
        if (hLower[i].indexOf(preds[p]) !== -1) return i;
      }
    }
    return -1;
  }

  var colLead = findCol(['lead name', 'chose your lead', 'your lead']);
  var colCenter = findCol(['chose your center', 'center', 'location']);
  var colMode = findCol(['wfo/wfh', 'working mode', 'wfh']);
  var colJob = findCol(['overall job satisfaction', 'job satisfaction']);
  var colLd = findCol(['l&d', 'trainer supported', 'day to day doubts']);
  // New period columns: Month, Year, Month-Year (exact header match preferred)
  var colMonth = -1, colYear = -1, colMonthYear = -1;
  for (var hi = 0; hi < hLower.length; hi++) {
    if (hLower[hi] === 'month') colMonth = hi;
    if (hLower[hi] === 'year') colYear = hi;
    if (hLower[hi] === 'month-year' || hLower[hi] === 'month year' || hLower[hi] === 'month_year') colMonthYear = hi;
  }
  if (colMonth < 0) colMonth = findCol(['month']);
  if (colYear < 0) colYear = findCol(['year']);
  if (colMonthYear < 0) colMonthYear = findCol(['month-year', 'month year']);

  var MONTH_NAMES = {
    1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
    7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
  };

  function isDate_(v) {
    return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
  }

  /** Always write Month-Year as e.g. "June-2026" — never a Date.toString(). */
  function formatMonthYear_(month, year) {
    if (!month || !year) return '';
    var m = Number(month);
    var y = Number(year);
    if (isNaN(m) || isNaN(y)) return '';
    return (MONTH_NAMES[m] || m) + '-' + y;
  }

  function parseMonth(v) {
    if (v === '' || v === null || v === undefined) return null;
    if (isDate_(v)) return v.getMonth() + 1;
    if (typeof v === 'number' && !isNaN(v)) {
      // Sheet sometimes stores month as Excel serial or 1–12
      if (v >= 1 && v <= 12) return Math.round(v);
      // Excel serial date (approx)
      if (v > 30) {
        var d0 = new Date(Math.round((v - 25569) * 86400 * 1000));
        if (!isNaN(d0.getTime())) return d0.getUTCMonth() + 1;
      }
      return Math.round(v);
    }
    var s = String(v).trim();
    // "Mon Jun 01 2026 00:00:00 GMT+0530..." or ISO
    var dateTry = new Date(s);
    if (!isNaN(dateTry.getTime()) && /[a-z]{3}|\/|-/i.test(s) && s.length > 8) {
      return dateTry.getMonth() + 1;
    }
    var n = Number(s);
    if (!isNaN(n) && n >= 1 && n <= 12) return n;
    var map = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
      may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
      oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
    };
    // "June-2026" or "Jun 2026"
    var parts = s.toLowerCase().split(/[\s\-\/]+/);
    if (parts.length && map[parts[0]]) return map[parts[0]];
    return map[s.toLowerCase()] || null;
  }

  function parseYear(v) {
    if (v === '' || v === null || v === undefined) return null;
    if (isDate_(v)) return v.getFullYear();
    if (typeof v === 'number' && !isNaN(v)) {
      if (v >= 2000 && v <= 2100) return Math.round(v);
      if (v > 30000) {
        var d1 = new Date(Math.round((v - 25569) * 86400 * 1000));
        if (!isNaN(d1.getTime())) return d1.getUTCFullYear();
      }
      return Math.round(v);
    }
    var s = String(v).trim();
    var yMatch = s.match(/(20\d{2})/);
    if (yMatch) return Number(yMatch[1]);
    var n = Number(s);
    return (!isNaN(n) && n >= 2000 && n <= 2100) ? n : null;
  }

  /**
   * Parse Month-Year cell: Date objects → June-2026; strings like "June-2026" kept clean.
   */
  function parseMonthYearCell_(v) {
    if (v === '' || v === null || v === undefined) return { month: null, year: null, monthYear: '' };
    if (isDate_(v)) {
      var m = v.getMonth() + 1;
      var y = v.getFullYear();
      return { month: m, year: y, monthYear: formatMonthYear_(m, y) };
    }
    if (typeof v === 'number' && v > 30000) {
      var d2 = new Date(Math.round((v - 25569) * 86400 * 1000));
      if (!isNaN(d2.getTime())) {
        var m2 = d2.getUTCMonth() + 1;
        var y2 = d2.getUTCFullYear();
        return { month: m2, year: y2, monthYear: formatMonthYear_(m2, y2) };
      }
    }
    var s = String(v).trim();
    // Already clean "June-2026" / "Jun-2026"
    var clean = s.match(/^([A-Za-z]+)\s*[-/]\s*(20\d{2})$/);
    if (clean) {
      var mm = parseMonth(clean[1]);
      var yy = Number(clean[2]);
      return { month: mm, year: yy, monthYear: formatMonthYear_(mm, yy) };
    }
    // Full date string from Date.toString()
    var d3 = new Date(s);
    if (!isNaN(d3.getTime()) && s.length > 10) {
      var m3 = d3.getMonth() + 1;
      var y3 = d3.getFullYear();
      return { month: m3, year: y3, monthYear: formatMonthYear_(m3, y3) };
    }
    return { month: null, year: null, monthYear: '' };
  }

  function rowPeriod(row) {
    var month = colMonth >= 0 ? parseMonth(row[colMonth]) : null;
    var year = colYear >= 0 ? parseYear(row[colYear]) : null;
    var my = '';

    // Prefer dedicated Month-Year column, but always normalize to "MonthName-Year"
    if (colMonthYear >= 0 && row[colMonthYear] !== '' && row[colMonthYear] != null) {
      var parsedMy = parseMonthYearCell_(row[colMonthYear]);
      if (!month && parsedMy.month) month = parsedMy.month;
      if (!year && parsedMy.year) year = parsedMy.year;
      if (parsedMy.monthYear) my = parsedMy.monthYear;
    }

    // Fallback from Timestamp (col 0 often)
    if ((!month || !year) && row[0]) {
      var d = row[0];
      if (isDate_(d)) {
        if (!month) month = d.getMonth() + 1;
        if (!year) year = d.getFullYear();
      } else {
        var m = String(d).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (m) {
          // assume M/D/YYYY
          if (!month) month = Number(m[1]);
          if (!year) year = Number(m[3]);
        } else {
          var d4 = new Date(String(d));
          if (!isNaN(d4.getTime())) {
            if (!month) month = d4.getMonth() + 1;
            if (!year) year = d4.getFullYear();
          }
        }
      }
    }

    // Final clean label — never leave a raw Date string in monthYear
    my = formatMonthYear_(month, year) || my;
    if (my.indexOf('GMT') !== -1 || my.indexOf('Standard Time') !== -1 || my.indexOf(' 00:00:00') !== -1) {
      var fix = parseMonthYearCell_(my);
      my = fix.monthYear || formatMonthYear_(month, year);
      if (!month && fix.month) month = fix.month;
      if (!year && fix.year) year = fix.year;
    }

    return { month: month, year: year, monthYear: my };
  }

  // Lead rating columns: short Likert items about "my lead"
  var leadCols = [];
  for (var i = 0; i < hLower.length; i++) {
    var h = hLower[i];
    if (h.indexOf('my lead') === 0 || h.indexOf('my lead') !== -1) {
      if (h.indexOf('strength') === -1 && h.indexOf('feedback') === -1 && h.indexOf('identify') === -1) {
        leadCols.push(i);
      }
    }
  }
  // Tool columns
  var toolCols = [];
  for (var j = 0; j < hLower.length; j++) {
    var t = hLower[j];
    if (t.indexOf('label') !== -1 || t.indexOf('labelling') !== -1 || t.indexOf('labeling') !== -1) {
      if (t.indexOf('suggest') === -1 && t.indexOf('any specific') === -1) toolCols.push(j);
    }
  }

  function num(v) {
    if (v === '' || v === null || v === undefined) return null;
    var s = String(v).trim().toUpperCase();
    if (s === 'NA' || s === 'N/A' || s === 'N.A' || s === '.' || s === '-') return null;
    var n = Number(v);
    if (isNaN(n) || n < 1 || n > 5) return null;
    return n;
  }

  function avg(arr) {
    var s = 0, c = 0;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] !== null && arr[i] !== undefined) { s += arr[i]; c++; }
    }
    return c ? s / c : null;
  }

  var byLead = {};
  var byLoc = {};
  var byPeriod = {};

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var lead = colLead >= 0 ? String(row[colLead] || '').trim() : '';
    var center = colCenter >= 0 ? String(row[colCenter] || '').trim() : '';
    var mode = colMode >= 0 ? String(row[colMode] || '').trim().toUpperCase() : '';
    var period = rowPeriod(row);
    if (!lead) continue;

    var leadScores = leadCols.map(function (c) { return num(row[c]); });
    var toolScores = toolCols.map(function (c) { return num(row[c]); });
    var job = colJob >= 0 ? num(row[colJob]) : null;
    var ld = colLd >= 0 ? num(row[colLd]) : null;
    var leadAvg = avg(leadScores);
    var toolAvg = avg(toolScores);

    // Composite keys include Month-Year so filters can be built from sheet
    var periodKey = period.monthYear || ((period.year || '') + '-' + (period.month || '')) || 'Unknown';
    var leadKey = lead + ' || ' + periodKey;
    if (!byLead[leadKey]) byLead[leadKey] = {
      name: lead, n: 0, lead: [], job: [], tool: [], ld: [], centers: {}, wfh: 0,
      year: period.year, month: period.month, monthYear: periodKey
    };
    var L = byLead[leadKey];
    L.n++;
    if (leadAvg !== null) L.lead.push(leadAvg);
    if (job !== null) L.job.push(job);
    if (toolAvg !== null) L.tool.push(toolAvg);
    if (ld !== null) L.ld.push(ld);
    if (center) L.centers[center] = (L.centers[center] || 0) + 1;
    if (mode.indexOf('WFH') !== -1) L.wfh++;

    var locKey = (center || 'Unknown') + ' || ' + periodKey;
    if (!byLoc[locKey]) byLoc[locKey] = {
      name: center || 'Unknown', n: 0, lead: [], job: [], tool: [], ld: [], wfh: 0,
      year: period.year, month: period.month, monthYear: periodKey
    };
    var C = byLoc[locKey];
    C.n++;
    if (leadAvg !== null) C.lead.push(leadAvg);
    if (job !== null) C.job.push(job);
    if (toolAvg !== null) C.tool.push(toolAvg);
    if (ld !== null) C.ld.push(ld);
    if (mode.indexOf('WFH') !== -1) C.wfh++;

    if (!byPeriod[periodKey]) byPeriod[periodKey] = {
      n: 0, lead: [], job: [], tool: [], ld: [], year: period.year, month: period.month, monthYear: periodKey
    };
    var P = byPeriod[periodKey];
    P.n++;
    if (leadAvg !== null) P.lead.push(leadAvg);
    if (job !== null) P.job.push(job);
    if (toolAvg !== null) P.tool.push(toolAvg);
    if (ld !== null) P.ld.push(ld);
  }

  function flag(leadScore, n) {
    if (leadScore === null) return 'NA';
    if (leadScore >= 4.5 && n >= 5) return 'TOP';
    if (leadScore < 3.5 || (leadScore < 4.0 && n >= 3)) return 'BOTTOM';
    return 'OK';
  }

  // Write TL scorecard (Year number, Month 1–12, Month-Year like "June-2026")
  var tlSheet = ss.getSheetByName('TL_Scorecard') || ss.insertSheet('TL_Scorecard');
  tlSheet.clear();
  var tlOut = [['Lead', 'Year', 'Month', 'Month-Year', '# Resp', 'Lead Score', 'Job Sat', 'Tool Score', 'L&D', 'Centers', 'Flag']];
  Object.keys(byLead).sort(function (a, b) {
    return (avg(byLead[b].lead) || 0) - (avg(byLead[a].lead) || 0);
  }).forEach(function (key) {
    var x = byLead[key];
    var ls = avg(x.lead);
    var centers = Object.keys(x.centers).join(', ');
    var myClean = formatMonthYear_(x.month, x.year) || String(x.monthYear || '').replace(/Mon .*|GMT.*|Standard Time|\(.*\)/g, '').trim();
    if (myClean.indexOf('GMT') !== -1 || myClean.length > 20) myClean = formatMonthYear_(x.month, x.year);
    tlOut.push([
      x.name || key,
      x.year || '',
      x.month || '',
      myClean || '',
      x.n,
      ls !== null ? Math.round(ls * 100) / 100 : '',
      avg(x.job) !== null ? Math.round(avg(x.job) * 100) / 100 : '',
      avg(x.tool) !== null ? Math.round(avg(x.tool) * 100) / 100 : '',
      avg(x.ld) !== null ? Math.round(avg(x.ld) * 100) / 100 : '',
      centers,
      flag(ls, x.n)
    ]);
  });
  tlSheet.getRange(1, 1, tlOut.length, tlOut[0].length).setValues(tlOut);
  tlSheet.setFrozenRows(1);
  // Force Month-Year column as plain text so Sheets does not re-parse as Date
  if (tlOut.length > 1) {
    tlSheet.getRange(2, 4, tlOut.length - 1, 1).setNumberFormat('@');
  }
  tlSheet.autoResizeColumns(1, 11);

  // Write Location scorecard
  var locSheet = ss.getSheetByName('Location_Scorecard') || ss.insertSheet('Location_Scorecard');
  locSheet.clear();
  var locOut = [['Center', 'Year', 'Month', 'Month-Year', '# Resp', 'Lead Score', 'Job Sat', 'Tool Score', 'L&D', 'WFH %', 'WFO %']];
  Object.keys(byLoc).sort().forEach(function (key) {
    var x = byLoc[key];
    var wfhPct = Math.round((x.wfh / x.n) * 1000) / 10;
    var myLoc = formatMonthYear_(x.month, x.year) || '';
    locOut.push([
      x.name || key,
      x.year || '',
      x.month || '',
      myLoc,
      x.n,
      avg(x.lead) !== null ? Math.round(avg(x.lead) * 100) / 100 : '',
      avg(x.job) !== null ? Math.round(avg(x.job) * 100) / 100 : '',
      avg(x.tool) !== null ? Math.round(avg(x.tool) * 100) / 100 : '',
      avg(x.ld) !== null ? Math.round(avg(x.ld) * 100) / 100 : '',
      wfhPct,
      Math.round((1000 - wfhPct * 10)) / 10
    ]);
  });
  locSheet.getRange(1, 1, locOut.length, locOut[0].length).setValues(locOut);
  locSheet.setFrozenRows(1);
  if (locOut.length > 1) {
    locSheet.getRange(2, 4, locOut.length - 1, 1).setNumberFormat('@');
  }
  locSheet.autoResizeColumns(1, 11);

  // Period summary (for dashboard Year / Month filters)
  var perSheet = ss.getSheetByName('Period_Scorecard') || ss.insertSheet('Period_Scorecard');
  perSheet.clear();
  var perOut = [['Month-Year', 'Year', 'Month', '# Resp', 'Lead Score', 'Job Sat', 'Tool Score', 'L&D']];
  Object.keys(byPeriod).sort().forEach(function (key) {
    var x = byPeriod[key];
    var myPer = formatMonthYear_(x.month, x.year) || key;
    if (String(myPer).indexOf('GMT') !== -1) myPer = formatMonthYear_(x.month, x.year);
    perOut.push([
      myPer,
      x.year || '',
      x.month || '',
      x.n,
      avg(x.lead) !== null ? Math.round(avg(x.lead) * 100) / 100 : '',
      avg(x.job) !== null ? Math.round(avg(x.job) * 100) / 100 : '',
      avg(x.tool) !== null ? Math.round(avg(x.tool) * 100) / 100 : '',
      avg(x.ld) !== null ? Math.round(avg(x.ld) * 100) / 100 : ''
    ]);
  });
  perSheet.getRange(1, 1, perOut.length, perOut[0].length).setValues(perOut);
  perSheet.setFrozenRows(1);
  if (perOut.length > 1) {
    perSheet.getRange(2, 1, perOut.length - 1, 1).setNumberFormat('@');
  }
  perSheet.autoResizeColumns(1, 8);

  // Workflow scorecard
  var colWf = findCol(['workflows you work', 'select the workflows', 'workflow']);
  var byWf = {};
  if (colWf >= 0) {
    for (var r2 = 1; r2 < values.length; r2++) {
      var row2 = values[r2];
      var wfRaw = String(row2[colWf] || '').trim();
      if (!wfRaw) continue;
      var parts = wfRaw.split(/[,;|/]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!parts.length) parts = [wfRaw];

      var leadScores2 = leadCols.map(function (c) { return num(row2[c]); });
      var toolScores2 = toolCols.map(function (c) { return num(row2[c]); });
      var job2 = colJob >= 0 ? num(row2[colJob]) : null;
      var ld2 = colLd >= 0 ? num(row2[colLd]) : null;
      var leadAvg2 = avg(leadScores2);
      var toolAvg2 = avg(toolScores2);
      var mode2 = colMode >= 0 ? String(row2[colMode] || '').trim().toUpperCase() : '';
      var center2 = colCenter >= 0 ? String(row2[colCenter] || '').trim() : '';

      var period2 = rowPeriod(row2);
      var periodKey2 = period2.monthYear || ((period2.year || '') + '-' + (period2.month || '')) || 'Unknown';
      parts.forEach(function (wfName) {
        var wfKey = wfName + ' || ' + periodKey2;
        if (!byWf[wfKey]) byWf[wfKey] = {
          name: wfName, n: 0, lead: [], job: [], tool: [], ld: [], wfh: 0, centers: {},
          year: period2.year, month: period2.month, monthYear: periodKey2
        };
        var W = byWf[wfKey];
        W.n++;
        if (leadAvg2 !== null) W.lead.push(leadAvg2);
        if (job2 !== null) W.job.push(job2);
        if (toolAvg2 !== null) W.tool.push(toolAvg2);
        if (ld2 !== null) W.ld.push(ld2);
        if (mode2.indexOf('WFH') !== -1) W.wfh++;
        if (center2) W.centers[center2] = (W.centers[center2] || 0) + 1;
      });
    }

    var wfSheet = ss.getSheetByName('Workflow_Scorecard') || ss.insertSheet('Workflow_Scorecard');
    wfSheet.clear();
    var wfOut = [['Workflow', 'Year', 'Month', 'Month-Year', '# Resp', 'Lead Score', 'Job Sat', 'Tool Score', 'L&D', 'WFH %', 'Top Centers', 'Status']];
    Object.keys(byWf).sort(function (a, b) {
      return byWf[b].n - byWf[a].n;
    }).forEach(function (key) {
      var x = byWf[key];
      var ls = avg(x.lead);
      var centers = Object.keys(x.centers).sort(function (a, b) {
        return x.centers[b] - x.centers[a];
      }).slice(0, 3).join(', ');
      var st = 'OK';
      if (ls !== null && ls >= 4.5 && x.n >= 5) st = 'TOP';
      if (ls !== null && (ls < 3.8 || (ls < 4.0 && x.n >= 5))) st = 'WATCH';
      if (ls !== null && ls < 3.5) st = 'RISK';
      if (x.n < 5) st = 'LOW N';
      var myWf = formatMonthYear_(x.month, x.year) || '';
      wfOut.push([
        x.name || key,
        x.year || '',
        x.month || '',
        myWf,
        x.n,
        ls !== null ? Math.round(ls * 100) / 100 : '',
        avg(x.job) !== null ? Math.round(avg(x.job) * 100) / 100 : '',
        avg(x.tool) !== null ? Math.round(avg(x.tool) * 100) / 100 : '',
        avg(x.ld) !== null ? Math.round(avg(x.ld) * 100) / 100 : '',
        Math.round((x.wfh / x.n) * 1000) / 10,
        centers,
        st
      ]);
    });
    wfSheet.getRange(1, 1, wfOut.length, wfOut[0].length).setValues(wfOut);
    wfSheet.setFrozenRows(1);
    if (wfOut.length > 1) {
      wfSheet.getRange(2, 4, wfOut.length - 1, 1).setNumberFormat('@');
    }
    wfSheet.autoResizeColumns(1, 12);
  }

  var summary = {
    ok: true,
    spreadsheetId: SPREADSHEET_ID,
    sourceName: sh.getName(),
    sourceGid: sh.getSheetId(),
    rows: values.length - 1,
    leads: Object.keys(byLead).length,
    locations: Object.keys(byLoc).length,
    workflows: Object.keys(byWf || {}).length,
    periods: Object.keys(byPeriod).length
  };

  notify_(
    'Dashboard refreshed on spreadsheet ' + SPREADSHEET_ID +
    '\nSource: ' + sh.getName() + ' (gid ' + sh.getSheetId() + ')' +
    '\nTabs: TL_Scorecard, Location_Scorecard, Workflow_Scorecard, Period_Scorecard'
  );

  return summary;
}

/**
 * Optional menu when script is later bound, or for testing from container.
 * Standalone: run buildTlDashboard from the editor Run menu, or open the Web App URL (doGet).
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('TL Dashboard')
      .addItem('Rebuild scorecards', 'buildTlDashboard')
      .addToUi();
  } catch (e) {
    // Standalone project — no spreadsheet UI; ignore.
  }
}
