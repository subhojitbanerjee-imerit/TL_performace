# Deploy full dashboard (Web App)

You need **two files** in the Apps Script project. `Code.gs` alone only rebuilds scorecards — **`Dashboard.html` is the UI**.

## 1. Create / update the project

1. Open [script.google.com](https://script.google.com) → your TL project  
2. **Code.gs** — replace all with repo [`Code.gs`](./Code.gs)  
3. **Add HTML file** (critical):  
   - Left panel **+** → **HTML**  
   - Name it exactly: **`Dashboard`** (Apps Script will save as `Dashboard.html`)  
   - Delete the default content  
   - Paste **entire** repo [`Dashboard.html`](./Dashboard.html)  
4. Save (Ctrl+S)

## 2. Deploy / re-deploy

1. **Deploy → Manage deployments → Edit (pencil)**  
2. **Version → New version**  
3. **Deploy**  
4. Open the **Web app URL**

## 3. What you should see

Same as local `index.html`:

- Title: **iMerit Employee Feedback Dashboard**  
- Filters: Year · Month · Month-Year · Center · Workflow · TL flag · Search  
- Tabs: Overview · TL-wise Performance · Workflow Analysis · Focus Areas · Location · Themes · Action Plan  
- Charts: Lead score distribution by TL, location radar, themes, workflow health  

Data is **live** from sheet tabs: `TL_Scorecard`, `Location_Scorecard`, `Workflow_Scorecard`, `Period_Scorecard`.

## 4. URLs

| URL | Behavior |
|-----|----------|
| `/exec` | Rebuild scorecards + full dashboard |
| `/exec?skipRebuild=1` | Full dashboard, no rebuild (faster) |
| `/exec?view=json` | JSON payload |

## 5. If you still see only “Scorecards updated automatically”

That is an **old deployment** without `Dashboard.html`.

- Confirm left sidebar shows **Dashboard** under Files  
- Paste latest `Dashboard.html`  
- **New version** deploy again  

## 6. Local preview (no Apps Script)

Open `index.html` in a browser (uses sample June-2026 data unless `__LIVE_DATA__` is set).
