# Live dashboard from Google Sheet (standalone Apps Script)

## Spreadsheet (hardcoded in `Code.gs`)

- **Spreadsheet ID:** `1D_oYej7qjYxgWQ8XtHKceb6fEVJUlNZzLiOX2RQVb0k`
- **Source tab gid:** `1126318129`
- **URL:** https://docs.google.com/spreadsheets/d/1D_oYej7qjYxgWQ8XtHKceb6fEVJUlNZzLiOX2RQVb0k/edit?gid=1126318129#gid=1126318129
- Fallback tab name: `responses_consolidated`
- Period columns supported: `Month`, `Year`, `Month-Year`

## Deploy as standalone Apps Script

1. Go to [script.google.com](https://script.google.com) → **New project**
2. Rename project (e.g. `TL_Performance_Dashboard`)
3. Paste full contents of `Code.gs`
4. Confirm constants at top:

```javascript
var SPREADSHEET_ID = '1D_oYej7qjYxgWQ8XtHKceb6fEVJUlNZzLiOX2RQVb0k';
var SOURCE_SHEET_GID = 1126318129;
```

5. **Run** → `buildTlDashboard` → authorize Google account (must have Editor access on the sheet to write scorecard tabs)
6. Optional: **Triggers** → Add trigger → `buildTlDashboard` → Time-driven → Daily

Scorecard tabs written into the **same** spreadsheet:

| Tab | Purpose |
|-----|---------|
| `TL_Scorecard` | Lead performance by Year/Month/Month-Year |
| `Location_Scorecard` | Center performance by period |
| `Workflow_Scorecard` | Workflow performance by period |
| `Period_Scorecard` | One row per Month-Year |

## HTML dashboard

Open `index.html` in a browser (or GitHub Pages). Filters: Year, Month, Month-Year, Center, Workflow, TL flag.

## Bound script (optional)

You can still paste `Code.gs` into the sheet via Extensions → Apps Script; `onOpen` adds a **TL Dashboard** menu. Standalone uses `openById` so binding is not required.
