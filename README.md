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

### Dashboard tabs

1. **Overview** — KPIs, charts, priority alerts  
2. **TL-wise Performance** — sortable scorecard, volume vs score  
3. **Focus Areas for TLs** — coaching cards for BOTTOM / WATCH leads  
4. **Location Issues** — center-level risk (SLT, Pune, Hyderabad, …)  
5. **Themes & Verbatims** — open-text themes and critical quotes  
6. **Action Plan** — immediate / short / medium priorities  

### Data notes

- Scores use a **1–5** Likert scale  
- **Lead score** = average of 9 lead evaluation items  
- **Tool score** = average of 5 labeling-tool items  
- **TOP** = lead ≥ 4.5 and ≥ 5 responses  
- **BOTTOM** = lead &lt; 3.5, or lead &lt; 4.0 with ≥ 3 responses  

Source sheet (private):  
`responses_consolidated` on the iMerit survey Google Spreadsheet.

### Google Sheet live scorecard

1. Open the survey spreadsheet  
2. **Extensions → Apps Script**  
3. Paste `Code.gs`  
4. Run `buildTlDashboard`  

This creates/refreshes **TL_Scorecard** and **Location_Scorecard** tabs.

---

Generated for iMerit TL performance review (June 2026 survey consolidation).
