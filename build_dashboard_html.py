"""Patch index.html for live data + emit Dashboard.html for Apps Script."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
index_path = ROOT / "index.html"
text = index_path.read_text(encoding="utf-8")

# Mutable datasets for live hydration
for name in [
    "PERIODS",
    "KPI",
    "TLS",
    "LOCATIONS",
    "WORKFLOWS",
    "TL_WORKFLOWS",
    "THEMES",
    "VERBATIMS",
    "FOCUS_CARDS",
    "UNIVERSAL",
    "ACTIONS",
]:
    text = text.replace(f"const {name} =", f"let {name} =", 1)

if "window.__LIVE_DATA__ = window.__LIVE_DATA__" not in text:
    text = text.replace(
        "  <script>\n    // ========== DATA ==========",
        "  <script>\n"
        "    // Local open: null. Apps Script Dashboard.html sets this from scorecards.\n"
        "    window.__LIVE_DATA__ = window.__LIVE_DATA__ || null;\n"
        "  </script>\n"
        "  <script>\n    // ========== DATA ==========",
        1,
    )

APPLY = r"""
    // ---- Live data from Google Apps Script scorecards ----
    function applyLiveData_() {
      const L = window.__LIVE_DATA__;
      if (!L || typeof L !== 'object') return false;
      if (Array.isArray(L.periods) && L.periods.length) PERIODS = L.periods;
      if (L.kpi && typeof L.kpi === 'object') {
        Object.keys(L.kpi).forEach(function (k) {
          if (L.kpi[k] !== null && L.kpi[k] !== undefined && L.kpi[k] !== '') KPI[k] = L.kpi[k];
        });
      }
      if (Array.isArray(L.tls) && L.tls.length) TLS = L.tls;
      if (Array.isArray(L.locations) && L.locations.length) LOCATIONS = L.locations;
      if (Array.isArray(L.workflows) && L.workflows.length) WORKFLOWS = L.workflows;
      if (L.tlWorkflows && typeof L.tlWorkflows === 'object') TL_WORKFLOWS = L.tlWorkflows;
      if (Array.isArray(L.themes) && L.themes.length) THEMES = L.themes;
      if (Array.isArray(L.verbatims) && L.verbatims.length) VERBATIMS = L.verbatims;
      if (Array.isArray(L.focusCards) && L.focusCards.length) FOCUS_CARDS = L.focusCards;
      if (Array.isArray(L.universal) && L.universal.length) UNIVERSAL = L.universal;
      if (L.actions && typeof L.actions === 'object') ACTIONS = L.actions;
      if (L.meta && L.meta.sheetUrl) window.__SHEET_URL__ = L.meta.sheetUrl;
      // Prefer latest period when live multi-month data is present
      if (PERIODS.length) {
        PERIODS = PERIODS.slice().sort(function (a, b) {
          const ay = Number(a.year) || 0, by = Number(b.year) || 0;
          if (ay !== by) return ay - by;
          return (Number(a.month) || 0) - (Number(b.month) || 0);
        });
      }
      return true;
    }
    const __IS_LIVE__ = applyLiveData_();
    if (__IS_LIVE__) {
      console.log('Live dashboard data loaded from Apps Script scorecards', {
        tls: TLS.length, locations: LOCATIONS.length, workflows: WORKFLOWS.length, periods: PERIODS.length
      });
    }

"""

marker = "    // Init period + center + workflow filters"
if "applyLiveData_" not in text:
    text = text.replace(marker, APPLY + marker)

# Init: default to latest period when multiple
old_init = """    // Default to latest year/month if only one period exists
    if (PERIODS.length === 1) {
      yearSel.value = String(PERIODS[0].year);
    }
    syncMonthOptionsFromYear();
    if (PERIODS.length === 1) {
      document.getElementById('filterMonth').value = String(PERIODS[0].month);
      document.getElementById('filterMonthYear').value = PERIODS[0].monthYear;
    }"""

new_init = """    // Default to latest period (works for 1 or many months of live data)
    if (PERIODS.length >= 1) {
      const last = PERIODS[PERIODS.length - 1];
      yearSel.value = String(last.year);
      syncMonthOptionsFromYear();
      document.getElementById('filterMonth').value = String(last.month);
      document.getElementById('filterMonthYear').value = last.monthYear;
    } else {
      syncMonthOptionsFromYear();
    }"""

if old_init in text:
    text = text.replace(old_init, new_init)

text = text.replace(
    "Dashboard generated from consolidated June 2026 survey analysis",
    "iMerit Employee Feedback Dashboard · live scorecards when deployed via Apps Script",
)

# Soften workflow filter when TL has no mapping (live scorecards)
old_wf = """        if (wf !== 'all') {
          const wfs = TL_WORKFLOWS[t.name] || [];
          if (!wfs.includes(wf)) return false;
        }"""
new_wf = """        if (wf !== 'all') {
          const wfs = TL_WORKFLOWS[t.name] || t.workflows || [];
          // Live TL scorecard has no workflow column — only filter when mapping exists
          if (wfs.length && !wfs.includes(wf)) return false;
        }"""
if old_wf in text:
    text = text.replace(old_wf, new_wf)

index_path.write_text(text, encoding="utf-8")
print("Wrote", index_path, "bytes", index_path.stat().st_size)

# Dashboard.html for Apps Script createTemplateFromFile('Dashboard')
live_block = """  <script>
    // Apps Script template injection (doGet sets liveJson from scorecard tabs)
    window.__LIVE_DATA__ = <?!= liveJson ?>;
  </script>
"""
dash = text
if "<?!= liveJson ?>" not in dash:
    dash = dash.replace("<body>", "<body>\n" + live_block, 1)

# Title brand alignment
dash = dash.replace(
    "<title>iMerit Survey Dashboard — TL · Workflow · Location</title>",
    "<title>iMerit Employee Feedback Dashboard</title>",
)

dash_path = ROOT / "Dashboard.html"
dash_path.write_text(dash, encoding="utf-8")
print("Wrote", dash_path, "bytes", dash_path.stat().st_size)
print("liveJson template:", "<?!= liveJson ?>" in dash)
print("applyLiveData_:", "applyLiveData_" in dash)
