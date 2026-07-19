/**
 * TL Performance Dashboard — standalone Apps Script
 *
 * Deploy as Web App (Execute as: Me · Who has access: Anyone in org / Anyone):
 *   Deploy → New deployment → Type: Web app
 *   Entry point: doGet  (required for Web App URL)
 *   Opening the Web App URL auto-runs buildTlDashboard then shows the
 *   interactive DASHBOARD (charts + filters) — not only a status page.
 *
 * Or run buildTlDashboard from the editor.
 * Optional: ?skipRebuild=1 for faster dashboard open from existing tabs.
 * Optional time trigger: Triggers → buildTlDashboard → Time-driven → Hourly/Daily.
 *
 * Spreadsheet:
 *   https://docs.google.com/spreadsheets/d/1D_oYej7qjYxgWQ8XtHKceb6fEVJUlNZzLiOX2RQVb0k/
 * Source tab gid: 1126318129
 *
 * Creates/refreshes: TL_Scorecard, Location_Scorecard, Workflow_Scorecard, Period_Scorecard
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
 * Web App entry point — required when deploying as Web App.
 *
 * Default: rebuild scorecards, then show INTERACTIVE DASHBOARD.
 *
 * Params:
 *   ?action=dashboard  — show dashboard (rebuild first unless skipRebuild=1)
 *   ?action=rebuild    — same as dashboard (rebuild + dashboard)
 *   ?action=home       — status page only
 *   ?skipRebuild=1     — open dashboard from existing scorecard tabs (faster)
 *   ?view=json         — JSON data dump
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
    if (!skipRebuild && action !== 'view') {
      result = buildTlDashboard();
    }
    var data = loadDashboardData_();
    data.meta = data.meta || {};
    data.meta.rebuilt = !skipRebuild;
    data.meta.rebuildAt = new Date().toISOString();
    data.meta.rebuildSummary = result;

    if (view === 'json') {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, result: result, data: data }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Interactive dashboard (charts + filters)
    return HtmlService.createHtmlOutput(buildDashboardHtml_(data))
      .setTitle('TL Performance Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    if (view === 'json') {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: String(err.message || err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return htmlPage_(
      'Dashboard error',
      '<h1>Could not load dashboard</h1>' +
        '<div class="card"><p class="err">' + escapeHtml_(String(err.message || err)) + '</p>' +
        '<p class="actions"><a class="btn" href="?action=dashboard">Retry</a> ' +
        '<a class="btn secondary" href="?action=dashboard&skipRebuild=1">Open without rebuild</a></p></div>',
      false
    );
  }
}

/**
 * Optional JSON API rebuild
 */
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
    '<h1>TL Performance Dashboard</h1>' +
    '<p class="muted">The Web App URL opens the full dashboard after rebuilding scorecards.</p>' +
    '<div class="card">' +
    '<p><strong>Spreadsheet</strong><br><a href="' + sheetUrl + '" target="_blank" rel="noopener">Open Google Sheet</a></p>' +
    '<p><strong>Source tab gid</strong> ' + SOURCE_SHEET_GID + '</p>' +
    '<p class="actions">' +
    '<a class="btn" href="?action=dashboard">Open dashboard (rebuild)</a> ' +
    '<a class="btn secondary" href="?action=dashboard&skipRebuild=1">Open dashboard (fast)</a>' +
    '</p>' +
    '</div>';
}

function htmlPage_(title, bodyHtml, ok) {
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml_(title) + '</title>' +
    '<style>' +
    'body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#0b1220;color:#e8eefc;margin:0;padding:24px;line-height:1.5}' +
    'h1{font-size:1.4rem;margin:0 0 8px}' +
    '.muted{color:#93a0b8;font-size:.9rem}' +
    '.card{background:#121a2b;border:1px solid #243049;border-radius:12px;padding:18px;max-width:640px;margin:16px 0}' +
    '.err{color:#fca5a5}' +
    'a{color:#93c5fd}' +
    '.btn{display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff!important;text-decoration:none;' +
    'padding:10px 16px;border-radius:10px;font-weight:600;margin:4px 4px 4px 0}' +
    '.btn.secondary{background:#1e293b;border:1px solid #334155}' +
    '</style></head><body>' + bodyHtml + '</body></html>';
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

/**
 * Read scorecard tabs into dashboard payload.
 */
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

/**
 * Full interactive dashboard HTML (Chart.js + filters).
 * Data is embedded as JSON from scorecard tabs.
 */
function buildDashboardHtml_(data) {
  var payload = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return '<!DOCTYPE html>\n' +
'<html lang="en"><head><meta charset="utf-8"/>' +
'<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
'<title>TL Performance Dashboard</title>' +
'<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>' +
'<style>' +
':root{--bg:#0b1220;--panel:#121a2b;--panel2:#182338;--border:#243049;--text:#e8eefc;--muted:#93a0b8;--good:#22c55e;--warn:#f59e0b;--bad:#ef4444}' +
'*{box-sizing:border-box}body{margin:0;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:radial-gradient(1000px 500px at 10% -10%,#1a2744,transparent),var(--bg);color:var(--text)}' +
'header{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(11,18,32,.92);border-bottom:1px solid var(--border);backdrop-filter:blur(10px)}' +
'header h1{margin:0;font-size:1.05rem}header .sub{color:var(--muted);font-size:.78rem}' +
'.controls{display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
'select,input,button{background:var(--panel2);color:var(--text);border:1px solid var(--border);border-radius:9px;padding:7px 10px;font-size:.82rem}' +
'button{cursor:pointer;font-weight:600}button.primary{background:linear-gradient(135deg,#2563eb,#4f46e5);border:none}' +
'main{padding:14px 16px 36px;max-width:1400px;margin:0 auto}' +
'.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}' +
'.tab{padding:8px 12px;border-radius:999px;border:1px solid var(--border);background:var(--panel);color:var(--muted);cursor:pointer;font-weight:600;font-size:.82rem}' +
'.tab.active{color:#fff;background:linear-gradient(135deg,#2563eb,#4f46e5);border-color:transparent}' +
'.section{display:none}.section.active{display:block}' +
'.kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:12px}' +
'@media(max-width:1000px){.kpis{grid-template-columns:repeat(3,1fr)}}' +
'@media(max-width:600px){.kpis{grid-template-columns:repeat(2,1fr)}}' +
'.kpi{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--border);border-radius:12px;padding:12px}' +
'.kpi .l{color:var(--muted);font-size:.7rem;text-transform:uppercase;letter-spacing:.04em}.kpi .v{font-size:1.35rem;font-weight:800;margin-top:4px}.kpi .s{color:var(--muted);font-size:.75rem}' +
'.good{color:var(--good)}.warn{color:var(--warn)}.bad{color:var(--bad)}' +
'.grid2{display:grid;grid-template-columns:1.2fr 1fr;gap:12px}@media(max-width:900px){.grid2{grid-template-columns:1fr}}' +
'.card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px}' +
'.card h2{margin:0 0 4px;font-size:.95rem}.hint{color:var(--muted);font-size:.78rem;margin:0 0 10px}' +
'.chart{position:relative;height:340px}.chart.tall{height:480px}' +
'table{width:100%;border-collapse:collapse;font-size:.82rem}th,td{padding:8px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}' +
'th{color:var(--muted);font-size:.7rem;text-transform:uppercase;position:sticky;top:0;background:var(--panel);cursor:pointer}' +
'.scroll{max-height:520px;overflow:auto;border:1px solid var(--border);border-radius:10px}' +
'.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.7rem;font-weight:700}' +
'.badge.top{background:rgba(34,197,94,.15);color:var(--good)}.badge.ok{background:rgba(91,140,255,.15);color:#93c5fd}.badge.bottom{background:rgba(239,68,68,.15);color:#fca5a5}' +
'.badge.watch{background:rgba(245,158,11,.15);color:#fcd34d}.badge.risk{background:rgba(239,68,68,.2);color:#fecaca}' +
'a{color:#93c5fd}' +
'</style></head><body>' +
'<header><div><h1>TL Performance Dashboard</h1><div class="sub" id="sub">Loading…</div></div>' +
'<div class="controls">' +
'<select id="fYear"><option value="all">All years</option></select>' +
'<select id="fMonth"><option value="all">All months</option></select>' +
'<select id="fMY"><option value="all">All periods</option></select>' +
'<select id="fFlag"><option value="all">All flags</option><option value="TOP">TOP</option><option value="OK">OK</option><option value="BOTTOM">BOTTOM</option><option value="WATCH">WATCH</option><option value="RISK">RISK</option><option value="LOW N">LOW N</option></select>' +
'<input id="fSearch" type="search" placeholder="Search TL / workflow…"/>' +
'<button class="primary" type="button" onclick="location.href=\'?action=dashboard\'">Refresh data</button>' +
'<button type="button" onclick="location.href=\'?action=dashboard&skipRebuild=1\'">Fast reload</button>' +
'<a id="sheetLink" href="#" target="_blank" rel="noopener"><button type="button">Open sheet</button></a>' +
'</div></header>' +
'<main>' +
'<div class="tabs" id="tabs">' +
'<div class="tab active" data-t="overview">Overview</div>' +
'<div class="tab" data-t="tl">TL Scorecard</div>' +
'<div class="tab" data-t="loc">Location</div>' +
'<div class="tab" data-t="wf">Workflow</div>' +
'<div class="tab" data-t="period">Period</div>' +
'</div>' +
'<section class="section active" id="s-overview"><div class="kpis" id="kpis"></div>' +
'<div class="grid2"><div class="card"><h2>Lead score distribution by TL</h2><p class="hint">Sorted high → low · Green TOP · Blue OK · Red BOTTOM</p><div class="chart tall" id="tlChartWrap"><canvas id="cTl"></canvas></div></div>' +
'<div class="card"><h2>Scores by location</h2><p class="hint">Lead · Job · Tool · L&D</p><div class="chart"><canvas id="cLoc"></canvas></div></div></div>' +
'<div class="card"><h2>Workflow volume & lead score</h2><div class="chart"><canvas id="cWf"></canvas></div></div></section>' +
'<section class="section" id="s-tl"><div class="card"><h2>Team Lead performance scorecard</h2><p class="hint">No WFH% · filter by Year / Month / Month-Year</p><div class="scroll"><table id="tTl"><thead><tr>' +
'<th data-k="Lead">Lead</th><th data-k="Year">Year</th><th data-k="Month">Month</th><th data-k="Month-Year">Month-Year</th>' +
'<th data-k="n"># Resp</th><th data-k="lead">Lead Score</th><th data-k="job">Job Sat</th><th data-k="tool">Tool</th><th data-k="ld">L&D</th>' +
'<th data-k="Centers">Centers</th><th data-k="Flag">Flag</th></tr></thead><tbody></tbody></table></div></div></section>' +
'<section class="section" id="s-loc"><div class="card"><h2>Location scorecard</h2><div class="scroll"><table id="tLoc"><thead><tr>' +
'<th>Center</th><th>Year</th><th>Month</th><th>Month-Year</th><th># Resp</th><th>Lead</th><th>Job</th><th>Tool</th><th>L&D</th></tr></thead><tbody></tbody></table></div></div></section>' +
'<section class="section" id="s-wf"><div class="card"><h2>Workflow scorecard</h2><div class="scroll"><table id="tWf"><thead><tr>' +
'<th>Workflow</th><th>Year</th><th>Month</th><th>Month-Year</th><th># Resp</th><th>Lead</th><th>Job</th><th>Tool</th><th>L&D</th><th>Status</th></tr></thead><tbody></tbody></table></div></div></section>' +
'<section class="section" id="s-period"><div class="card"><h2>Period scorecard</h2><div class="scroll"><table id="tPer"><thead><tr>' +
'<th>Month-Year</th><th>Year</th><th>Month</th><th># Resp</th><th>Lead</th><th>Job</th><th>Tool</th><th>L&D</th></tr></thead><tbody></tbody></table></div></div></section>' +
'</main>' +
'<script>window.__DASH__ = ' + payload + ';</script>\n' +
'<script>\n' +
dashboardClientJs_() +
'\n</script></body></html>';
}

/** Client-side JS for dashboard (as string for HtmlService). */
function dashboardClientJs_() {
  return [
    'const D = window.__DASH__ || {tls:[],locations:[],workflows:[],periods:[],meta:{}};',
    'const MONTHS={1:"January",2:"February",3:"March",4:"April",5:"May",6:"June",7:"July",8:"August",9:"September",10:"October",11:"November",12:"December"};',
    'function num(v){if(v===null||v===undefined||v==="")return null;const n=Number(v);return isNaN(n)?null:n;}',
    'function g(row,keys){for(const k of keys){if(row[k]!==undefined&&row[k]!==null&&row[k]!=="")return row[k];}return "";}',
    'function normTl(r){return{name:String(g(r,["Lead","lead","name"])),year:num(g(r,["Year","year"])),month:num(g(r,["Month","month"])),monthYear:String(g(r,["Month-Year","Month Year","monthYear"])||""),n:num(g(r,["# Resp","Resp","n","#Resp"]))||0,lead:num(g(r,["Lead Score","LeadScore","lead"])),job:num(g(r,["Job Sat","JobSat","job"])),tool:num(g(r,["Tool Score","Tool","tool"])),ld:num(g(r,["L&D","LD","ld"])),centers:String(g(r,["Centers","Center","centers"])||""),flag:String(g(r,["Flag","flag","Status","status"])||"OK").toUpperCase()};}',
    'function normLoc(r){return{center:String(g(r,["Center","center"])),year:num(g(r,["Year","year"])),month:num(g(r,["Month","month"])),monthYear:String(g(r,["Month-Year","Month Year"])||""),n:num(g(r,["# Resp","Resp","n"]))||0,lead:num(g(r,["Lead Score","lead"])),job:num(g(r,["Job Sat","job"])),tool:num(g(r,["Tool Score","tool"])),ld:num(g(r,["L&D","ld"]))};}',
    'function normWf(r){return{workflow:String(g(r,["Workflow","workflow"])),year:num(g(r,["Year","year"])),month:num(g(r,["Month","month"])),monthYear:String(g(r,["Month-Year","Month Year"])||""),n:num(g(r,["# Resp","Resp","n"]))||0,lead:num(g(r,["Lead Score","lead"])),job:num(g(r,["Job Sat","job"])),tool:num(g(r,["Tool Score","tool"])),ld:num(g(r,["L&D","ld"])),status:String(g(r,["Status","status","Flag"])||"OK").toUpperCase()};}',
    'function normPer(r){return{monthYear:String(g(r,["Month-Year","Month Year"])||""),year:num(g(r,["Year","year"])),month:num(g(r,["Month","month"])),n:num(g(r,["# Resp","Resp","n"]))||0,lead:num(g(r,["Lead Score","lead"])),job:num(g(r,["Job Sat","job"])),tool:num(g(r,["Tool Score","tool"])),ld:num(g(r,["L&D","ld"]))};}',
    'const TLS=(D.tls||[]).map(normTl).filter(t=>t.name);',
    'const LOCS=(D.locations||[]).map(normLoc).filter(t=>t.center);',
    'const WFS=(D.workflows||[]).map(normWf).filter(t=>t.workflow);',
    'const PERS=(D.periods||[]).map(normPer);',
    'let charts={};',
    'function sc(v){if(v==null)return"";if(v>=4.5)return"good";if(v>=3.8)return"warn";return"bad";}',
    'function badge(f){const x=(f||"OK").toUpperCase();const c=x==="TOP"?"top":(x==="BOTTOM"||x==="RISK")?"bottom":x==="WATCH"||x==="LOW N"?"watch":"ok";return `<span class="badge ${c}">${x}</span>`;}',
    'function periodMatch(row){const y=document.getElementById("fYear").value;const m=document.getElementById("fMonth").value;const my=document.getElementById("fMY").value;if(y!=="all"&&String(row.year)!==y)return false;if(m!=="all"&&String(row.month)!==m)return false;if(my!=="all"&&String(row.monthYear)!==my)return false;return true;}',
    'function fTls(){const flag=document.getElementById("fFlag").value;const q=document.getElementById("fSearch").value.trim().toLowerCase();return TLS.filter(t=>{if(!periodMatch(t))return false;if(flag!=="all"&&t.flag!==flag)return false;if(q&&!t.name.toLowerCase().includes(q))return false;return true;}).sort((a,b)=>(b.lead||0)-(a.lead||0));}',
    'function fLocs(){return LOCS.filter(periodMatch).sort((a,b)=>b.n-a.n);}',
    'function fWfs(){const q=document.getElementById("fSearch").value.trim().toLowerCase();return WFS.filter(w=>{if(!periodMatch(w))return false;if(q&&!w.workflow.toLowerCase().includes(q))return false;return true;}).sort((a,b)=>b.n-a.n);}',
    'function fPers(){return PERS.filter(periodMatch).sort((a,b)=>String(b.monthYear).localeCompare(String(a.monthYear)));}',
    'function wavg(rows,key){let s=0,w=0;rows.forEach(r=>{if(r[key]!=null){s+=r[key]*r.n;w+=r.n;}});return w?s/w:null;}',
    'function destroy(id){if(charts[id]){charts[id].destroy();delete charts[id];}}',
    'function renderKpis(){const tls=fTls();const n=tls.reduce((s,t)=>s+t.n,0);const lead=wavg(tls,"lead");const job=wavg(tls,"job");const tool=wavg(tls,"tool");const ld=wavg(tls,"ld");const items=[{l:"Responses",v:n,s:"Filtered TL rows"},{l:"Leads",v:tls.length,s:"In view"},{l:"Lead score",v:lead!=null?lead.toFixed(2):"—",c:sc(lead)},{l:"Job sat",v:job!=null?job.toFixed(2):"—",c:sc(job)},{l:"Tool",v:tool!=null?tool.toFixed(2):"—",c:sc(tool)},{l:"L&D",v:ld!=null?ld.toFixed(2):"—",c:sc(ld)}];document.getElementById("kpis").innerHTML=items.map(i=>`<div class="kpi"><div class="l">${i.l}</div><div class="v ${i.c||""}">${i.v}</div><div class="s">${i.s||""}</div></div>`).join("");}',
    'function renderTables(){const tls=fTls();document.querySelector("#tTl tbody").innerHTML=tls.map(t=>`<tr><td><strong>${t.name}</strong></td><td>${t.year||""}</td><td>${t.month||""}</td><td>${t.monthYear||""}</td><td>${t.n}</td><td class="${sc(t.lead)}">${t.lead!=null?t.lead.toFixed(2):""}</td><td class="${sc(t.job)}">${t.job!=null?t.job.toFixed(2):""}</td><td class="${sc(t.tool)}">${t.tool!=null?t.tool.toFixed(2):""}</td><td class="${sc(t.ld)}">${t.ld!=null?t.ld.toFixed(2):""}</td><td>${t.centers}</td><td>${badge(t.flag)}</td></tr>`).join("")||"<tr><td colspan=11>No rows</td></tr>";',
    'const locs=fLocs();document.querySelector("#tLoc tbody").innerHTML=locs.map(l=>`<tr><td><strong>${l.center}</strong></td><td>${l.year||""}</td><td>${l.month||""}</td><td>${l.monthYear||""}</td><td>${l.n}</td><td class="${sc(l.lead)}">${l.lead!=null?l.lead.toFixed(2):""}</td><td class="${sc(l.job)}">${l.job!=null?l.job.toFixed(2):""}</td><td class="${sc(l.tool)}">${l.tool!=null?l.tool.toFixed(2):""}</td><td class="${sc(l.ld)}">${l.ld!=null?l.ld.toFixed(2):""}</td></tr>`).join("")||"<tr><td colspan=9>No rows</td></tr>";',
    'const wfs=fWfs();document.querySelector("#tWf tbody").innerHTML=wfs.map(w=>`<tr><td><strong>${w.workflow}</strong></td><td>${w.year||""}</td><td>${w.month||""}</td><td>${w.monthYear||""}</td><td>${w.n}</td><td class="${sc(w.lead)}">${w.lead!=null?w.lead.toFixed(2):""}</td><td class="${sc(w.job)}">${w.job!=null?w.job.toFixed(2):""}</td><td class="${sc(w.tool)}">${w.tool!=null?w.tool.toFixed(2):""}</td><td class="${sc(w.ld)}">${w.ld!=null?w.ld.toFixed(2):""}</td><td>${badge(w.status)}</td></tr>`).join("")||"<tr><td colspan=10>No rows</td></tr>";',
    'const pers=fPers();document.querySelector("#tPer tbody").innerHTML=pers.map(p=>`<tr><td><strong>${p.monthYear}</strong></td><td>${p.year||""}</td><td>${p.month||""}</td><td>${p.n}</td><td class="${sc(p.lead)}">${p.lead!=null?p.lead.toFixed(2):""}</td><td class="${sc(p.job)}">${p.job!=null?p.job.toFixed(2):""}</td><td class="${sc(p.tool)}">${p.tool!=null?p.tool.toFixed(2):""}</td><td class="${sc(p.ld)}">${p.ld!=null?p.ld.toFixed(2):""}</td></tr>`).join("")||"<tr><td colspan=8>No rows</td></tr>";}',
    'function renderCharts(){const tls=fTls();const wrap=document.getElementById("tlChartWrap");if(wrap)wrap.style.height=Math.max(320,Math.min(900,26*tls.length+40))+"px";destroy("tl");',
    'charts.tl=new Chart(document.getElementById("cTl"),{type:"bar",data:{labels:tls.map(t=>{const p=t.name.split(/\\s+/);return p.length<=2?t.name:p[0]+" "+p[p.length-1];}),datasets:[{data:tls.map(t=>t.lead),backgroundColor:tls.map(t=>t.flag==="BOTTOM"||t.flag==="RISK"?"rgba(239,68,68,.75)":t.flag==="TOP"?"rgba(34,197,94,.75)":"rgba(91,140,255,.75)"),borderRadius:4}]},options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:i=>tls[i[0].dataIndex].name,label:c=>{const t=tls[c.dataIndex];return "Lead "+(t.lead!=null?t.lead.toFixed(2):"—")+" · n="+t.n+" · "+t.flag;}}}},scales:{x:{min:0,max:5,ticks:{color:"#93a0b8"},grid:{color:"#243049"}},y:{ticks:{color:"#e8eefc",font:{size:10}},grid:{display:false}}}}});',
    'const locs=fLocs().slice(0,12);destroy("loc");charts.loc=new Chart(document.getElementById("cLoc"),{type:"bar",data:{labels:locs.map(l=>l.center),datasets:[{label:"Lead",data:locs.map(l=>l.lead),backgroundColor:"#5b8cffaa"},{label:"Job",data:locs.map(l=>l.job),backgroundColor:"#22d3eeaa"},{label:"Tool",data:locs.map(l=>l.tool),backgroundColor:"#f59e0baa"},{label:"L&D",data:locs.map(l=>l.ld),backgroundColor:"#a78bfaaa"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#e8eefc",boxWidth:10}}},scales:{y:{min:0,max:5,ticks:{color:"#93a0b8"},grid:{color:"#243049"}},x:{ticks:{color:"#e8eefc",maxRotation:40,font:{size:10}},grid:{display:false}}}}});',
    'const wfs=fWfs().filter(w=>w.n>=3).slice(0,15);destroy("wf");charts.wf=new Chart(document.getElementById("cWf"),{type:"bar",data:{labels:wfs.map(w=>w.workflow.length>28?w.workflow.slice(0,26)+"…":w.workflow),datasets:[{label:"Lead score",data:wfs.map(w=>w.lead),backgroundColor:"#5b8cffaa",yAxisID:"y"},{label:"Responses",data:wfs.map(w=>w.n),type:"line",borderColor:"#22d3ee",backgroundColor:"#22d3ee33",yAxisID:"y1",tension:.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#e8eefc",boxWidth:10}}},scales:{y:{min:0,max:5,position:"left",ticks:{color:"#93a0b8"},grid:{color:"#243049"}},y1:{position:"right",ticks:{color:"#93a0b8"},grid:{display:false}},x:{ticks:{color:"#e8eefc",maxRotation:45,font:{size:9}},grid:{display:false}}}}});}',
    'function refresh(){const tls=fTls();const n=tls.reduce((s,t)=>s+t.n,0);const m=D.meta||{};document.getElementById("sub").textContent=(m.rebuilt?"Rebuilt · ":"Loaded · ")+(m.rebuildAt?new Date(m.rebuildAt).toLocaleString():"")+" · filtered resp≈"+n+" · leads "+tls.length+" · use Year/Month filters";renderKpis();renderTables();renderCharts();}',
    'function initFilters(){const years=[...new Set(TLS.map(t=>t.year).filter(Boolean))].sort();const months=[...new Set(TLS.map(t=>t.month).filter(Boolean))].sort((a,b)=>a-b);const mys=[...new Set(TLS.map(t=>t.monthYear).filter(Boolean))].sort();const ySel=document.getElementById("fYear");years.forEach(y=>{const o=document.createElement("option");o.value=String(y);o.textContent=y;ySel.appendChild(o);});const mSel=document.getElementById("fMonth");months.forEach(m=>{const o=document.createElement("option");o.value=String(m);o.textContent=MONTHS[m]||m;mSel.appendChild(o);});const mySel=document.getElementById("fMY");mys.forEach(my=>{const o=document.createElement("option");o.value=my;o.textContent=my;mySel.appendChild(o);});if(mys.length){mySel.value=mys[mys.length-1];const last=TLS.find(t=>t.monthYear===mys[mys.length-1]);if(last){if(last.year)ySel.value=String(last.year);if(last.month)mSel.value=String(last.month);}}if(D.meta&&D.meta.sheetUrl)document.getElementById("sheetLink").href=D.meta.sheetUrl;}',
    'document.getElementById("tabs").onclick=e=>{const t=e.target.closest(".tab");if(!t)return;document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));t.classList.add("active");document.getElementById("s-"+t.dataset.t).classList.add("active");setTimeout(renderCharts,40);};',
    '["fYear","fMonth","fMY","fFlag"].forEach(id=>document.getElementById(id).onchange=refresh);',
    'document.getElementById("fSearch").oninput=refresh;',
    'document.getElementById("fYear").onchange=()=>{refresh();};',
    'initFilters();refresh();'
  ].join('\n');
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
