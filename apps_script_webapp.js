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
      monthYear: String(pick_(r, ['Month-Year', 'Month Year', 'monthYear']) || '')
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
      monthYear: String(pick_(r, ['Month-Year', 'Month Year']) || '')
    };
  }).filter(function (l) { return l.center && l.center !== 'Unknown'; });

  var workflows = raw.workflows.map(function (r) {
    var n = toNum_(pick_(r, ['# Resp', 'n'])) || 0;
    var lead = toNum_(pick_(r, ['Lead Score', 'lead']));
    var st = String(pick_(r, ['Status', 'status', 'Flag']) || wfStatus_(lead, n));
    var name = String(pick_(r, ['Workflow', 'workflow']) || 'Unknown');
    return {
      workflow: name,
      n: n,
      lead: lead,
      job: toNum_(pick_(r, ['Job Sat', 'job'])),
      tool: toNum_(pick_(r, ['Tool Score', 'tool'])),
      ld: toNum_(pick_(r, ['L&D', 'ld'])),
      year: toNum_(pick_(r, ['Year', 'year'])),
      month: toNum_(pick_(r, ['Month', 'month'])),
      monthYear: String(pick_(r, ['Month-Year', 'Month Year']) || ''),
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
    var my = String(pick_(r, ['Month-Year', 'Month Year']) || '');
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
