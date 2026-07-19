"""Parse survey prompt dump for workflow-wise metrics."""
import re
import json
from collections import defaultdict, Counter
from pathlib import Path

path = Path(
    r"C:\Users\Subho\.grok\sessions\C%3A%5CUsers%5CSubho\019f78c5-ad7e-7e13-aa54-76bfca52a534\prompts\prompt_0.txt"
)
text = path.read_text(encoding="utf-8", errors="replace")
if "<user_query>" in text:
    text = text.split("<user_query>", 1)[1]
if "</user_query>" in text:
    text = text.split("</user_query>", 1)[0]

parts = re.split(r"(?=\d{1,2}/\d{1,2}/2026)", text)
rows = [p.strip() for p in parts if re.match(r"\d{1,2}/\d{1,2}/2026", p.strip())]
print("rows", len(rows))

WF_ORDER = [
    ("Sim Behaviour, GEN-AI (LLM)", r"Sim Behaviour,\s*GEN-AI\s*\(?LLM\)?"),
    ("Sim Behaviour, Sim Collision", r"Sim Behaviour,\s*Sim Collision"),
    ("Sim Behaviour, Visual Similarity Search", r"Sim Behaviour,\s*Visual Similarity Search"),
    ("Sim Behaviour, Audio Siren", r"Sim Behaviour,\s*Audio Siren"),
    ("GEN-AI (LLM)", r"GEN-AI\s*\(?LLM\)?"),
    ("Nuro Context mapping", r"Nuro Context mapping"),
    ("LiDAR 3D Cuboid", r"LiDAR 3D Cuboid"),
    ("Visual Similarity Search", r"Visual Similarity Search"),
    ("Track Attribute", r"Track Attribute"),
    ("Sim Collision", r"Sim Collision"),
    ("Sim Behaviour", r"Sim Behaviour"),
]


def extract_workflows(head: str):
    for name, pat in WF_ORDER:
        if re.search(pat, head, re.I):
            if "," in name:
                return [x.strip() for x in name.split(",")]
            return [name]
    return ["Unknown"]


def mean(xs):
    return round(sum(xs) / len(xs), 2) if xs else None


wf_stats = defaultdict(
    lambda: {
        "n": 0,
        "lead": [],
        "job": [],
        "tool": [],
        "ld": [],
        "centers": Counter(),
        "leads": Counter(),
        "modes": Counter(),
        "themes": Counter(),
    }
)

theme_pats = {
    "tool_lag_crash": r"lag|loading|load time|slow|hang|crash|freeze|unresponsive",
    "camera_ui": r"camera|2[Dd]|zoom|blinker|occupancy|shortcut|cuboid|lidar|3[Dd]",
    "wfh_policy": r"work from home|WFH policy|partiality|eligible for WFH",
    "salary": r"salary|increment|inflation|compensation",
    "shift_wlb": r"9.?hour|9hrs|12 hrs|shift|work.?life",
    "equal_treatment": r"equal|respect|valued|fairness|partiality",
    "ld_training": r"L&D|trainer|training|PKT|refresher",
    "client_qc": r"client|quality score|rejection|revert",
}

centers_list = ["Hyderabad", "Pune", "SLT", "BRP", "MBZ", "BBS", "CBTR"]

for r in rows:
    head = r[:320]
    wfs = extract_workflows(head)

    center = "Unknown"
    for c in centers_list:
        if re.search(rf"\b{c}\b", head):
            center = c
            break

    mode = "Unknown"
    if re.search(r"\bWFH\b", head):
        mode = "WFH"
    elif re.search(r"\bWFO\b", head):
        mode = "WFO"

    m = re.match(
        r"\d{1,2}/\d{1,2}/2026\s+([A-Za-z][A-Za-z.\s]+?)(?:Sim|GEN|Nuro|LiDAR|Visual|Track|Audio)",
        r[:160],
    )
    lead_name = m.group(1).strip() if m else "Unknown"

    lead_avg = job = tool_avg = ld = None

    # Tab-style digits
    nums = [int(x) for x in re.findall(r"(?<=[\t ])([1-5])(?=[\t \n])", r[:450])]
    if len(nums) >= 9:
        lead_avg = sum(nums[:9]) / 9
        if len(nums) >= 10:
            job = nums[9]
        if len(nums) >= 15:
            tool_avg = sum(nums[10:15]) / 5
        if len(nums) >= 16:
            ld = nums[15] if nums[15] else None
        # sometimes L&D is later single digit - take last 1-5 before long text end
    # Compact after WFO/WFH: 55555...
    compact = re.search(r"(?:WFO|WFH)\s*([1-5]{5,15})", head.replace(" ", ""))
    if compact and lead_avg is None:
        digits = [int(d) for d in compact.group(1)]
        if len(digits) >= 9:
            lead_avg = sum(digits[:9]) / 9
            if len(digits) >= 10:
                job = digits[9]
        elif len(digits) >= 5:
            lead_avg = sum(digits[:5]) / 5

    # Heuristic tool: look for sequences of 5 ratings in mid body after known patterns
    # Many rows: ... 5 5 5 5 5 NA for tool block
    tool_m = re.findall(
        r"(?<![.\d])([1-5])[\t ]+([1-5])[\t ]+([1-5])[\t ]+([1-5])[\t ]+([1-5])(?![.\d])",
        r,
    )
    if tool_avg is None and len(tool_m) >= 2:
        # second 5-tuple often tool after lead block
        t = [int(x) for x in tool_m[1]]
        tool_avg = sum(t) / 5
    elif tool_avg is None and len(tool_m) == 1 and lead_avg is not None:
        # only one block - might be tool-only short rows skip
        pass

    # L&D: "    5    NA    NA" near end or isolated
    ld_m = re.findall(
        r"[\t ]([1-5])[\t ]+(?:NA|N/A|Na|na|no|No|NO|N\.A)[\t ]+(?:NA|N/A|Na|na|no|No|NO|N\.A)",
        r[-400:] if len(r) > 400 else r,
    )
    if ld is None and ld_m:
        ld = int(ld_m[-1])

    for wf in wfs:
        s = wf_stats[wf]
        s["n"] += 1
        if lead_avg is not None:
            s["lead"].append(lead_avg)
        if job is not None:
            s["job"].append(job)
        if tool_avg is not None:
            s["tool"].append(tool_avg)
        if ld is not None:
            s["ld"].append(ld)
        s["centers"][center] += 1
        s["leads"][lead_name] += 1
        s["modes"][mode] += 1
        for tname, pat in theme_pats.items():
            if re.search(pat, r, re.I):
                s["themes"][tname] += 1

# Manual enrichment from known full analysis (274 responses) when parse sample is partial
# The HTML already has org totals; workflow breakdown from parse + domain knowledge

out = []
for wf, s in sorted(wf_stats.items(), key=lambda x: -x[1]["n"]):
    rec = {
        "workflow": wf,
        "n": s["n"],
        "lead": mean(s["lead"]),
        "job": mean(s["job"]),
        "tool": mean(s["tool"]),
        "ld": mean(s["ld"]),
        "wfh_pct": round(100 * s["modes"].get("WFH", 0) / s["n"], 1) if s["n"] else 0,
        "wfo_pct": round(100 * s["modes"].get("WFO", 0) / s["n"], 1) if s["n"] else 0,
        "top_centers": s["centers"].most_common(4),
        "top_leads": s["leads"].most_common(5),
        "themes": dict(s["themes"]),
    }
    out.append(rec)
    print(json.dumps(rec, ensure_ascii=False))

Path(r"C:\Users\Subho\TL_performace\workflow_stats.json").write_text(
    json.dumps(out, indent=2), encoding="utf-8"
)
print("wrote workflow_stats.json", len(out))
