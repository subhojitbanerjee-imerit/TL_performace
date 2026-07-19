# TL Performance Dashboard

Interactive employee feedback survey dashboard for **Team Lead (TL) performance**, **location health**, and **focus areas**.

## Live dashboard

Open **[index.html](./index.html)** in a browser (or enable GitHub Pages on this repo and set the source to `/` or `/docs`).

### What’s included

| File | Purpose |
|------|---------|
| `index.html` | Interactive dashboard (KPIs, TL scorecard, location, themes, action plan) |
| `Code.gs` | Google Apps Script to build `TL_Scorecard` / `Location_Scorecard` from sheet data |
| `Google_Sheets_Dashboard_Setup.md` | How to wire the Google Sheet (`responses_consolidated`) |

### Data structure (`responses_consolidated`)

Survey columns (plus period fields):

`Timestamp` · Lead · Workflows · Center · WFO/WFH · 9 lead ratings · Job satisfaction · strengths/improvements · lead feedback · 5 tool ratings · tool suggestions · exec feedback · innovations · L&D score · L&D feedback · final comments · Column 29 · **`Month`** · **`Year`** · **`Month-Year`**

### Filters (header)

| Filter | Purpose |
|--------|---------|
| **Year** | e.g. 2026 |
| **Month** | e.g. June (1–12) |
| **Month-Year** | e.g. `June-2026` (synced with Year/Month) |
| Center | Location |
| Workflow | Project workflow |
| TL flag | TOP / OK / BOTTOM |

### Dashboard tabs

1. **Overview** — KPIs, charts, priority alerts, workflow health  
2. **TL-wise Performance** — sortable scorecard (filter by Year/Month/period/center/workflow)  
3. **Workflow Analysis** — scorecard by project workflow, theme heat, risk cards, deep-dives  
4. **Focus Areas for TLs** — coaching cards for BOTTOM / WATCH leads  
5. **Location Issues** — center-level risk (SLT, Pune, Hyderabad, …)  
6. **Themes & Verbatims** — open-text themes and critical quotes  
7. **Action Plan** — immediate / short / medium priorities  

### Workflow-wise highlights

| Workflow | Signal |
|----------|--------|
| **Sim Behaviour** | Highest volume — tool lag, WFH policy (Pune), Hyderabad stability |
| **LiDAR 3D Cuboid** | Best scores — invest in 3D/cuboid UX |
| **Sim Collision** | Soft tool score — measuring tools, camera/zoom |
| **Nuro Context mapping** | Lag/hang + client update broadcast gaps |
| **GEN-AI (LLM)** | Risk — leadership culture cases, triage tool bugs |

### Data notes

- Scores use a **1–5** Likert scale  
- **Lead score** = average of 9 lead evaluation items  
- **Tool score** = average of 5 labeling-tool items  
- **TOP** = lead ≥ 4.5 and ≥ 5 responses  
- **BOTTOM** = lead &lt; 3.5, or lead &lt; 4.0 with ≥ 3 responses  

Source sheet (private):  
`responses_consolidated` on the iMerit survey Google Spreadsheet.

### Google Sheet live scorecard (standalone)

`Code.gs` is configured for **standalone** deploy (not sheet-bound):

```javascript
SPREADSHEET_ID = '1D_oYej7qjYxgWQ8XtHKceb6fEVJUlNZzLiOX2RQVb0k'
SOURCE_SHEET_GID = 1126318129
```

1. [script.google.com](https://script.google.com) → New project  
2. Paste `Code.gs`  
3. **Deploy as Web App** (needed for URL access):  
   - Deploy → New deployment → Type: **Web app**  
   - Execute as: **Me**  
   - Who has access: your org / Anyone  
   - Entry point is **`doGet`** (included in Code.gs)  
4. Open the Web App URL → it **rebuilds scorecards** and opens the **interactive dashboard** (Overview / TL / Location / Workflow / Period + Year·Month filters)  
5. Faster reload without rebuild: add `?skipRebuild=1` to the Web App URL  
6. Or run **`buildTlDashboard`** from the editor Run menu  

Creates/refreshes **TL_Scorecard**, **Location_Scorecard**, **Workflow_Scorecard**, **Period_Scorecard** (with Year / Month / Month-Year).  

If you still only see a status page (“Scorecards updated automatically”), the deployment is on an old version — paste latest `Code.gs` and **Deploy → Manage deployments → Edit → New version → Deploy**.

---

Generated for iMerit TL performance review (June 2026 survey consolidation).
