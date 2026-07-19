/**
 * Paste into: Google Sheet → Extensions → Apps Script
 * Run: buildTlDashboard
 *
 * Assumes tab "responses_consolidated" with a header row.
 * Creates/refreshes tabs: TL_Scorecard, Location_Scorecard
 *
 * Header matching is fuzzy (case-insensitive contains).
 */

function buildTlDashboard() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('responses_consolidated');
  if (!sh) throw new Error('Tab responses_consolidated not found');

  var values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('No data');

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

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var lead = colLead >= 0 ? String(row[colLead] || '').trim() : '';
    var center = colCenter >= 0 ? String(row[colCenter] || '').trim() : '';
    var mode = colMode >= 0 ? String(row[colMode] || '').trim().toUpperCase() : '';
    if (!lead) continue;

    var leadScores = leadCols.map(function (c) { return num(row[c]); });
    var toolScores = toolCols.map(function (c) { return num(row[c]); });
    var job = colJob >= 0 ? num(row[colJob]) : null;
    var ld = colLd >= 0 ? num(row[colLd]) : null;
    var leadAvg = avg(leadScores);
    var toolAvg = avg(toolScores);

    if (!byLead[lead]) byLead[lead] = { n: 0, lead: [], job: [], tool: [], ld: [], centers: {}, wfh: 0 };
    var L = byLead[lead];
    L.n++;
    if (leadAvg !== null) L.lead.push(leadAvg);
    if (job !== null) L.job.push(job);
    if (toolAvg !== null) L.tool.push(toolAvg);
    if (ld !== null) L.ld.push(ld);
    if (center) L.centers[center] = (L.centers[center] || 0) + 1;
    if (mode.indexOf('WFH') !== -1) L.wfh++;

    var locKey = center || 'Unknown';
    if (!byLoc[locKey]) byLoc[locKey] = { n: 0, lead: [], job: [], tool: [], ld: [], wfh: 0 };
    var C = byLoc[locKey];
    C.n++;
    if (leadAvg !== null) C.lead.push(leadAvg);
    if (job !== null) C.job.push(job);
    if (toolAvg !== null) C.tool.push(toolAvg);
    if (ld !== null) C.ld.push(ld);
    if (mode.indexOf('WFH') !== -1) C.wfh++;
  }

  function flag(leadScore, n) {
    if (leadScore === null) return 'NA';
    if (leadScore >= 4.5 && n >= 5) return 'TOP';
    if (leadScore < 3.5 || (leadScore < 4.0 && n >= 3)) return 'BOTTOM';
    return 'OK';
  }

  // Write TL scorecard
  var tlSheet = ss.getSheetByName('TL_Scorecard') || ss.insertSheet('TL_Scorecard');
  tlSheet.clear();
  var tlOut = [['Lead', '# Resp', 'Lead Score', 'Job Sat', 'Tool Score', 'L&D', 'Centers', 'WFH %', 'Flag']];
  Object.keys(byLead).sort(function (a, b) {
    return (avg(byLead[b].lead) || 0) - (avg(byLead[a].lead) || 0);
  }).forEach(function (name) {
    var x = byLead[name];
    var ls = avg(x.lead);
    var centers = Object.keys(x.centers).join(', ');
    tlOut.push([
      name,
      x.n,
      ls !== null ? Math.round(ls * 100) / 100 : '',
      avg(x.job) !== null ? Math.round(avg(x.job) * 100) / 100 : '',
      avg(x.tool) !== null ? Math.round(avg(x.tool) * 100) / 100 : '',
      avg(x.ld) !== null ? Math.round(avg(x.ld) * 100) / 100 : '',
      centers,
      Math.round((x.wfh / x.n) * 1000) / 10,
      flag(ls, x.n)
    ]);
  });
  tlSheet.getRange(1, 1, tlOut.length, tlOut[0].length).setValues(tlOut);
  tlSheet.setFrozenRows(1);
  tlSheet.autoResizeColumns(1, 9);

  // Write Location scorecard
  var locSheet = ss.getSheetByName('Location_Scorecard') || ss.insertSheet('Location_Scorecard');
  locSheet.clear();
  var locOut = [['Center', '# Resp', 'Lead Score', 'Job Sat', 'Tool Score', 'L&D', 'WFH %', 'WFO %']];
  Object.keys(byLoc).sort().forEach(function (name) {
    var x = byLoc[name];
    var wfhPct = Math.round((x.wfh / x.n) * 1000) / 10;
    locOut.push([
      name,
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
  locSheet.autoResizeColumns(1, 8);

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

      parts.forEach(function (wfName) {
        if (!byWf[wfName]) byWf[wfName] = { n: 0, lead: [], job: [], tool: [], ld: [], wfh: 0, centers: {} };
        var W = byWf[wfName];
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
    var wfOut = [['Workflow', '# Resp', 'Lead Score', 'Job Sat', 'Tool Score', 'L&D', 'WFH %', 'Top Centers', 'Status']];
    Object.keys(byWf).sort(function (a, b) {
      return byWf[b].n - byWf[a].n;
    }).forEach(function (name) {
      var x = byWf[name];
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
        name,
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
    wfSheet.autoResizeColumns(1, 9);
  }

  SpreadsheetApp.getUi().alert('Dashboard tabs refreshed: TL_Scorecard, Location_Scorecard, Workflow_Scorecard');
}
