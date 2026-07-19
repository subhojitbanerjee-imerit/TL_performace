# Live dashboard from Google Sheet (`responses_consolidated`)

Sheet: https://docs.google.com/spreadsheets/d/1D_oYej7qjYxgWQ8XtHKceb6fEVJUlNZzLiOX2RQVb0k/edit#gid=860063649

The interactive HTML dashboard at `index.html` uses the **already-analyzed consolidated metrics** (274 responses). To keep Google Sheets itself live:

## Option A — Quick charts inside the Sheet (no code)

1. Open the spreadsheet → Extensions is not required.
2. Create a new tab: `Dashboard_TL`.
3. In `responses_consolidated`, ensure these columns exist (adjust letters if your headers differ):

| Concept | Typical header |
|--------|----------------|
| Lead | Chose your Lead Name from the Dropdown |
| Center | Chose Your Center |
| Mode | Chose your working mode WFO/WFH |
| Lead items | 9 columns of lead ratings (1–5) |
| Job sat | how would you rate your overall job satisfaction? |
| Tool items | 5 labeling tool rating columns |
| L&D | On a scale of 1 to 5, has L&D team/Trainer… |

4. On `Dashboard_TL`, use **Pivot tables**:
   - Rows: Lead name  
   - Values: AVERAGE of each score column, COUNTA of Timestamp  
5. Insert → Chart → Bar (Lead score by TL), Column (by Center).

## Option B — Apps Script auto scorecard

1. Sheet → **Extensions → Apps Script**
2. Paste the contents of `Code.gs` from this folder
3. Run `buildTlDashboard` once (authorize)
4. Optional: Triggers → time-driven → daily refresh

## Option C — Looker Studio (best for exec sharing)

1. File → Share → Anyone with link **Viewer** (or connect with your Google account in Looker)
2. [Looker Studio](https://lookerstudio.google.com/) → Create → Data source → Google Sheets → this file → `responses_consolidated`
3. Build pages: TL scorecard, Location, Themes (if you add a theme helper column)

## Share sheet with automation (optional)

To allow a service account / script to read the sheet:

Share the spreadsheet with one of your GCP service accounts as **Viewer**, e.g.:

- `qms-dashboard-reader@gen-lang-client-0732074273.iam.gserviceaccount.com`

Then the HTML/Python pipeline can re-export CSV automatically.

## Local dashboard

Open:

```
C:\Users\Subho\survey-dashboard\index.html
```

Or from PowerShell:

```powershell
start C:\Users\Subho\survey-dashboard\index.html
```

Excel analytical workbook (tables for printouts):

```
C:\Users\Subho\Downloads\iMerit_Survey_Analysis_Report_TL_Location.xlsx
```
