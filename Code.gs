/**
 * TL Performance Dashboard — standalone Apps Script
 *
 * Deploy as a standalone project (script.google.com → New project).
 * Does NOT require binding to the spreadsheet.
 *
 * Spreadsheet:
 *   https://docs.google.com/spreadsheets/d/1D_oYej7qjYxgWQ8XtHKceb6fEVJUlNZzLiOX2RQVb0k/
 *
 * Source tab gid (responses / consolidated data):
 *   1126318129
 *
 * Run: buildTlDashboard
 * Creates/refreshes: TL_Scorecard, Location_Scorecard, Workflow_Scorecard, Period_Scorecard
 *
 * Requirements:
 *   - This script's Google account must have at least Viewer (Editor preferred) on the sheet
 *   - Enable Google Sheets API advanced service only if needed (not required for openById)
 *   - Header matching is fuzzy (case-insensitive contains)
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

  function parseMonth(v) {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'number' && !isNaN(v)) return Math.round(v);
    var s = String(v).trim();
    var n = Number(s);
    if (!isNaN(n) && n >= 1 && n <= 12) return n;
    var map = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
      may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
      oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
    };
    var key = s.toLowerCase();
    return map[key] || null;
  }

  function parseYear(v) {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'number' && !isNaN(v)) return Math.round(v);
    var n = Number(String(v).trim());
    return (!isNaN(n) && n >= 2000 && n <= 2100) ? n : null;
  }

  function rowPeriod(row) {
    var month = colMonth >= 0 ? parseMonth(row[colMonth]) : null;
    var year = colYear >= 0 ? parseYear(row[colYear]) : null;
    var my = colMonthYear >= 0 ? String(row[colMonthYear] || '').trim() : '';
    if (!my && month && year) my = (MONTH_NAMES[month] || month) + '-' + year;
    // Fallback from Timestamp (col 0 often)
    if ((!month || !year) && row[0]) {
      var d = row[0];
      if (Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d)) {
        if (!month) month = d.getMonth() + 1;
        if (!year) year = d.getFullYear();
        if (!my) my = (MONTH_NAMES[month] || month) + '-' + year;
      } else {
        var m = String(d).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (m) {
          // assume M/D/YYYY
          if (!month) month = Number(m[1]);
          if (!year) year = Number(m[3]);
          if (!my) my = (MONTH_NAMES[month] || month) + '-' + year;
        }
      }
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

  // Write TL scorecard (with Month / Year / Month-Year — no WFH %)
  var tlSheet = ss.getSheetByName('TL_Scorecard') || ss.insertSheet('TL_Scorecard');
  tlSheet.clear();
  var tlOut = [['Lead', 'Year', 'Month', 'Month-Year', '# Resp', 'Lead Score', 'Job Sat', 'Tool Score', 'L&D', 'Centers', 'Flag']];
  Object.keys(byLead).sort(function (a, b) {
    return (avg(byLead[b].lead) || 0) - (avg(byLead[a].lead) || 0);
  }).forEach(function (key) {
    var x = byLead[key];
    var ls = avg(x.lead);
    var centers = Object.keys(x.centers).join(', ');
    tlOut.push([
      x.name || key,
      x.year || '',
      x.month || '',
      x.monthYear || '',
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
  tlSheet.autoResizeColumns(1, 11);

  // Write Location scorecard
  var locSheet = ss.getSheetByName('Location_Scorecard') || ss.insertSheet('Location_Scorecard');
  locSheet.clear();
  var locOut = [['Center', 'Year', 'Month', 'Month-Year', '# Resp', 'Lead Score', 'Job Sat', 'Tool Score', 'L&D', 'WFH %', 'WFO %']];
  Object.keys(byLoc).sort().forEach(function (key) {
    var x = byLoc[key];
    var wfhPct = Math.round((x.wfh / x.n) * 1000) / 10;
    locOut.push([
      x.name || key,
      x.year || '',
      x.month || '',
      x.monthYear || '',
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
  locSheet.autoResizeColumns(1, 11);

  // Period summary (for dashboard Year / Month filters)
  var perSheet = ss.getSheetByName('Period_Scorecard') || ss.insertSheet('Period_Scorecard');
  perSheet.clear();
  var perOut = [['Month-Year', 'Year', 'Month', '# Resp', 'Lead Score', 'Job Sat', 'Tool Score', 'L&D']];
  Object.keys(byPeriod).sort().forEach(function (key) {
    var x = byPeriod[key];
    perOut.push([
      x.monthYear || key,
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
      wfOut.push([
        x.name || key,
        x.year || '',
        x.month || '',
        x.monthYear || '',
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
    wfSheet.autoResizeColumns(1, 12);
  }

  notify_(
    'Dashboard refreshed on spreadsheet ' + SPREADSHEET_ID +
    '\nSource: ' + sh.getName() + ' (gid ' + sh.getSheetId() + ')' +
    '\nTabs: TL_Scorecard, Location_Scorecard, Workflow_Scorecard, Period_Scorecard'
  );
}

/**
 * Optional menu when script is later bound, or for testing from container.
 * Standalone: run buildTlDashboard from the editor Run menu.
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
