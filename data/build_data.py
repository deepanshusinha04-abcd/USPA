import csv, json
from collections import Counter, defaultdict
import statistics

# Load raw CSV (do NOT modify it)
raw = []
with open(r'd:\SEMESTER 3\Data Analytics\student performance analytics\academic_performance_dataset_V2.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        raw.append(row)

# Identify duplicate IDs across programs — treat as separate students
# (65 of 70 duplicate ID pairs span different programs; they are different students with colliding IDs)
# We keep ALL records as-is. No records are dropped.

numeric_cols = ['CGPA', 'CGPA100', 'CGPA200', 'CGPA300', 'CGPA400', 'SGPA']

# Cast to proper types
students = []
for row in raw:
    s = {
        'id':      row['ID No'],
        'prog':    row['Prog Code'],
        'gender':  row['Gender'],
        'yog':     int(row['YoG']),
        'cgpa':    float(row['CGPA']),
        'cgpa100': float(row['CGPA100']),
        'cgpa200': float(row['CGPA200']),
        'cgpa300': float(row['CGPA300']),
        'cgpa400': float(row['CGPA400']),
        'sgpa':    float(row['SGPA']),
    }
    students.append(s)

# ── Helper ────────────────────────────────────────────────────────────────────
def stats(vals):
    if not vals: return {}
    vals_sorted = sorted(vals)
    n = len(vals)
    mean = sum(vals) / n
    med  = statistics.median(vals)
    std  = statistics.stdev(vals) if n > 1 else 0
    return {
        'n':    n,
        'mean': round(mean, 3),
        'min':  round(min(vals), 3),
        'max':  round(max(vals), 3),
        'median': round(med, 3),
        'std':  round(std, 3),
        'q1':   round(vals_sorted[n//4], 3),
        'q3':   round(vals_sorted[3*n//4], 3),
    }

def hist(vals, bins=20):
    mn, mx = min(vals), max(vals)
    bw = (mx - mn) / bins
    buckets = [0] * bins
    labels  = []
    for i in range(bins):
        lo = mn + i * bw
        hi = lo + bw
        labels.append(round((lo + hi) / 2, 2))
    for v in vals:
        idx = min(int((v - mn) / bw), bins - 1)
        buckets[idx] += 1
    return {'labels': labels, 'counts': buckets}

# ── 1. Overall statistics ─────────────────────────────────────────────────────
overall = {}
for col in numeric_cols:
    key = col.lower().replace('cgpa', 'cgpa')
    vals = [s[col.lower()] for s in students]
    overall[col] = stats(vals)

# ── 2. Per-program statistics ─────────────────────────────────────────────────
prog_stats = {}
for col in numeric_cols:
    prog_stats[col] = {}
    groups = defaultdict(list)
    for s in students:
        groups[s['prog']].append(s[col.lower()])
    for prog, vals in groups.items():
        prog_stats[col][prog] = stats(vals)

# Program-level summary (for bar charts)
prog_summary = {}
for prog in set(s['prog'] for s in students):
    ss = [s for s in students if s['prog'] == prog]
    prog_summary[prog] = {
        'n':       len(ss),
        'cgpa':    stats([s['cgpa']    for s in ss]),
        'cgpa100': stats([s['cgpa100'] for s in ss]),
        'cgpa200': stats([s['cgpa200'] for s in ss]),
        'cgpa300': stats([s['cgpa300'] for s in ss]),
        'cgpa400': stats([s['cgpa400'] for s in ss]),
        'sgpa':    stats([s['sgpa']    for s in ss]),
        'female':  sum(1 for s in ss if s['gender']=='Female'),
        'male':    sum(1 for s in ss if s['gender']=='Male'),
    }

# ── 3. Per-year statistics ────────────────────────────────────────────────────
year_summary = {}
for yr in sorted(set(s['yog'] for s in students)):
    ss = [s for s in students if s['yog'] == yr]
    year_summary[str(yr)] = {
        'n':       len(ss),
        'cgpa':    stats([s['cgpa']    for s in ss]),
        'sgpa':    stats([s['sgpa']    for s in ss]),
        'cgpa100': stats([s['cgpa100'] for s in ss]),
        'cgpa200': stats([s['cgpa200'] for s in ss]),
        'cgpa300': stats([s['cgpa300'] for s in ss]),
        'cgpa400': stats([s['cgpa400'] for s in ss]),
    }

# ── 4. Gender statistics ─────────────────────────────────────────────────────
gender_summary = {}
for g in ['Female', 'Male']:
    ss = [s for s in students if s['gender'] == g]
    gender_summary[g] = {
        'n':       len(ss),
        'cgpa':    stats([s['cgpa'] for s in ss]),
        'sgpa':    stats([s['sgpa'] for s in ss]),
        'cgpa100': stats([s['cgpa100'] for s in ss]),
        'cgpa200': stats([s['cgpa200'] for s in ss]),
        'cgpa300': stats([s['cgpa300'] for s in ss]),
        'cgpa400': stats([s['cgpa400'] for s in ss]),
    }

# ── 5. CGPA histogram (overall) ───────────────────────────────────────────────
cgpa_hist = hist([s['cgpa'] for s in students], bins=25)
sgpa_hist = hist([s['sgpa'] for s in students], bins=25)

# ── 6. Level-wise performance (CGPA100 → 400) ────────────────────────────────
level_means = {
    'CGPA100': round(sum(s['cgpa100'] for s in students) / len(students), 3),
    'CGPA200': round(sum(s['cgpa200'] for s in students) / len(students), 3),
    'CGPA300': round(sum(s['cgpa300'] for s in students) / len(students), 3),
    'CGPA400': round(sum(s['cgpa400'] for s in students) / len(students), 3),
}

# ── 7. Performance tiers (for CGPA-based classification) ─────────────────────
def tier(cgpa):
    if cgpa >= 4.50: return 'Distinction'
    if cgpa >= 4.00: return 'Upper Credit'
    if cgpa >= 3.50: return 'Lower Credit'
    if cgpa >= 3.00: return 'Merit'
    if cgpa >= 2.50: return 'Pass'
    return 'Below Pass'

tier_counts = Counter(tier(s['cgpa']) for s in students)

# ── 8. Year × Program counts ─────────────────────────────────────────────────
year_prog = defaultdict(lambda: defaultdict(int))
for s in students:
    year_prog[str(s['yog'])][s['prog']] += 1

# ── 9. Scatter data (for scatter plot): CGPA vs SGPA ────────────────────────
scatter = [{
    'id':     s['id'],
    'prog':   s['prog'],
    'gender': s['gender'],
    'yog':    s['yog'],
    'cgpa':   s['cgpa'],
    'sgpa':   s['sgpa'],
} for s in students]

# ── 10b. Sorted CGPA arrays per group (for percentile computation in browser) ─
all_cgpas_sorted  = sorted(s['cgpa'] for s in students)
prog_cgpas_sorted = {}
year_cgpas_sorted = {}
for p in set(s['prog'] for s in students):
    prog_cgpas_sorted[p] = sorted(s['cgpa'] for s in students if s['prog'] == p)
for y in set(str(s['yog']) for s in students):
    year_cgpas_sorted[y]  = sorted(s['cgpa'] for s in students if str(s['yog']) == y)

# ── 10. Level-wise per-program means ─────────────────────────────────────────
level_prog = {}
for prog in prog_summary:
    level_prog[prog] = {
        'CGPA100': prog_summary[prog]['cgpa100']['mean'],
        'CGPA200': prog_summary[prog]['cgpa200']['mean'],
        'CGPA300': prog_summary[prog]['cgpa300']['mean'],
        'CGPA400': prog_summary[prog]['cgpa400']['mean'],
    }

# ── 11. Gender × Program ─────────────────────────────────────────────────────
gender_prog = {}
for prog in prog_summary:
    gender_prog[prog] = {
        'Female': prog_summary[prog]['female'],
        'Male':   prog_summary[prog]['male'],
    }

# ── 12. CGPA improvement / decline across levels ─────────────────────────────
level_cols = ['cgpa100', 'cgpa200', 'cgpa300', 'cgpa400']
level_labels = ['Level 100', 'Level 200', 'Level 300', 'Level 400']
level_improvement = []
for col, label in zip(level_cols, level_labels):
    vals = [s[col] for s in students]
    level_improvement.append({'level': label, 'mean': round(sum(vals)/len(vals), 3)})

# ── 13. Student-level data (for lookup, anonymized) ──────────────────────────
student_records = [{
    'id':      s['id'],
    'prog':    s['prog'],
    'gender':  s['gender'],
    'yog':     s['yog'],
    'cgpa':    s['cgpa'],
    'cgpa100': s['cgpa100'],
    'cgpa200': s['cgpa200'],
    'cgpa300': s['cgpa300'],
    'cgpa400': s['cgpa400'],
    'sgpa':    s['sgpa'],
    'tier':    tier(s['cgpa']),
} for s in students]

# ── Build master JSON ─────────────────────────────────────────────────────────
master = {
    'meta': {
        'total_records': len(students),
        'total_columns': 10,
        'programs': sorted(prog_summary.keys()),
        'years': sorted(year_summary.keys()),
        'year_range': {'min': 2010, 'max': 2014},
        'gender_counts': {'Female': gender_summary['Female']['n'], 'Male': gender_summary['Male']['n']},
        'duplicate_id_pairs': 70,
        'missing_values': 'None in any column',
        'scale': '0–5 (5 = highest)',
        'note_duplicates': '65 of 70 duplicate IDs span different programs — treated as distinct students from same pool.',
        'note_extreme': '7 records have CGPA300 < 1.0 (min 0.63). 2 records have CGPA400 < 1.0 (min 0.00). All are kept — do not assume zero means missing.',
    },
    'overall':          overall,
    'cgpa_hist':        cgpa_hist,
    'sgpa_hist':        sgpa_hist,
    'tier_counts':      dict(tier_counts),
    'level_means':      level_means,
    'level_improvement':level_improvement,
    'prog_summary':     prog_summary,
    'year_summary':     year_summary,
    'gender_summary':   gender_summary,
    'level_prog':       level_prog,
    'gender_prog':      gender_prog,
    'year_prog':        {k: dict(v) for k, v in year_prog.items()},
    'scatter':          scatter,
    'students':         student_records,
    'all_cgpas_sorted': all_cgpas_sorted,
    'prog_cgpas_sorted':prog_cgpas_sorted,
    'year_cgpas_sorted':year_cgpas_sorted,
}

with open('data.json', 'w') as f:
    json.dump(master, f, indent=2)

# Also write as a script-includable JS file (works with file:// URLs, no fetch needed)
with open('data.js', 'w', encoding='utf-8') as f:
    f.write('/* Auto-generated by build_data.py — do not edit manually */\n')
    f.write('window.USPA = ')
    json.dump(master, f, separators=(',', ':'))
    f.write(';\n')

print('data.json and data.js written')
print('  data.json: ' + str(len(json.dumps(master)) // 1024) + ' KB approx')
print('Programs: ' + str(sorted(prog_summary.keys())))
print('Years: ' + str(sorted(year_summary.keys())))
print('Total students: ' + str(len(students)))
print('Tiers: ' + str(dict(Counter(tier(s['cgpa']) for s in students))))

