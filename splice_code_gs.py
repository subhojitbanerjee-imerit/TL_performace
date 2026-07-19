from pathlib import Path

root = Path(__file__).resolve().parent
code = (root / "Code.gs").read_text(encoding="utf-8")
web = (root / "apps_script_webapp.js").read_text(encoding="utf-8")

start = code.index("function doGet(e)")
# Prefer cutting at buildTlDashboard comment if present
markers = [
    "/**\n * Build scorecard tabs. Returns a summary object (used by doGet / doPost).\n */\nfunction buildTlDashboard()",
    "/**\n * Build scorecard tabs. Returns a summary object (used by doGet / doPost).\n */\r\nfunction buildTlDashboard()",
    "function buildTlDashboard()",
]
end = None
for m in markers:
    i = code.find(m)
    if i != -1:
        # If we matched bare function, walk back to include its JSDoc if present
        if m.startswith("function"):
            j = code.rfind("/**", 0, i)
            if j != -1 and i - j < 400:
                end = j
            else:
                end = i
        else:
            end = i
        break
if end is None:
    raise SystemExit("buildTlDashboard not found")

# Keep header through getSourceSheet/notify, remove old doGet..dashboardClientJs
# Find start of doGet - but keep everything before first "function doGet"
# Actually start is doGet - we need keep everything BEFORE doGet including notify_
prefix = code[:start]
# Drop orphaned middle if previous splice left PLACEHOLDER
if "PLACEHOLDER_DOGET" in prefix:
    prefix = prefix.split("PLACEHOLDER_DOGET")[0]

suffix = code[end:]
# Ensure suffix starts with buildTlDashboard doc/function
out = prefix.rstrip() + "\n\n" + web.strip() + "\n\n" + suffix.lstrip()
(root / "Code.gs").write_text(out, encoding="utf-8")
print("Code.gs bytes", len(out))
print("has doGet", "function doGet" in out)
print("has mapScorecards", "mapScorecardsToDashboard_" in out)
print("has buildTlDashboard", "function buildTlDashboard" in out)
print("no buildDashboardHtml", "buildDashboardHtml_" not in out)
