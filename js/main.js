/**
 * main.js — USPA Dashboard Boot & Global State (Phase 3)
 *
 * Responsibilities:
 *  - Read window.USPA (from data/data.js)
 *  - Maintain global filter state
 *  - Expose applyFilters() which re-derives filtered students
 *  - Render dismissible active-filter chips
 *  - Calculate and render cohort-level insights ("What the data says")
 *  - Update KPIs and all charts
 *  - Support seamless cross-filtering and student profile updates
 */

'use strict';

/* ─── Global constants ─────────────────────────────────────────────── */
const LEVEL_KEYS   = ['cgpa100', 'cgpa200', 'cgpa300', 'cgpa400'];
const LEVEL_LABELS = ['Level 100', 'Level 200', 'Level 300', 'Level 400'];

/* ─── Global state ─────────────────────────────────────────────────── */
const STATE = {
  filters: {
    prog:   '',   // programme code or ''
    year:   '',   // '2010'…'2014' or ''
    gender: '',   // 'Female' | 'Male' | ''
    tier:   '',   // tier label or ''
  },
  selectedStudent: null,   // { id, prog } or null — composite safe key
  comparisonMode:  'prog', // 'prog' | 'year' | 'all'
  filteredStudents: [],    // derived from USPA.students after filter
  allStudents: [],         // full list (never mutated)
};

/* ─── Configurable Performance Categories & Explicit Thresholds ─────── */
const PERFORMANCE_CATEGORIES = [
  {
    name: 'Distinction',
    min: 4.50,
    max: 5.00,
    color: '#16A34A',
    badgeClass: 'tier-Distinction',
    filterLabel: 'Distinction (≥ 4.50)',
    description: 'Outstanding performance across all completed academic stages (CGPA 4.50 – 5.00).'
  },
  {
    name: 'Upper Credit',
    min: 4.00,
    max: 4.499,
    color: '#2563EB',
    badgeClass: 'tier-UpperCredit',
    filterLabel: 'Upper Credit (4.00–4.49)',
    description: 'High academic achievement well above institutional average (CGPA 4.00 – 4.49).'
  },
  {
    name: 'Lower Credit',
    min: 3.50,
    max: 3.999,
    color: '#60A5FA',
    badgeClass: 'tier-LowerCredit',
    filterLabel: 'Lower Credit (3.50–3.99)',
    description: 'Solid academic standing above the cohort median (CGPA 3.50 – 3.99).'
  },
  {
    name: 'Merit',
    min: 3.00,
    max: 3.499,
    color: '#D97706',
    badgeClass: 'tier-Merit',
    filterLabel: 'Merit (3.00–3.49)',
    description: 'Acceptable competence meeting standard degree benchmarks (CGPA 3.00 – 3.49).'
  },
  {
    name: 'Pass',
    min: 2.50,
    max: 2.999,
    color: '#F59E0B',
    badgeClass: 'tier-Pass',
    filterLabel: 'Pass (2.50–2.99)',
    description: 'Attainment within configured Pass benchmark range (CGPA 2.50 – 2.99).'
  },
  {
    name: 'Below Pass',
    min: 0.00,
    max: 2.499,
    color: '#DC2626',
    badgeClass: 'tier-BelowPass',
    filterLabel: 'Below Pass (< 2.50)',
    description: 'Cumulative average below the configured Pass benchmark threshold (CGPA < 2.50).'
  }
];

/* ─── Tier helper (reads from configurable definitions) ────────────── */
function getTier(cgpa) {
  if (typeof cgpa !== 'number' || isNaN(cgpa)) return 'Below Pass';
  for (const cat of PERFORMANCE_CATEGORIES) {
    if (cgpa >= cat.min) return cat.name;
  }
  return 'Below Pass';
}

/* ─── Render Tier Explanations in UI ───────────────────────────────── */
function renderTierDefinitions() {
  const container = document.getElementById('tier-definitions-list');
  if (!container) return;
  container.innerHTML = PERFORMANCE_CATEGORIES.map(c => `
    <div style="display:flex;align-items:flex-start;gap:6px;line-height:1.4">
      <span class="legend-dot" style="background:${c.color};width:8px;height:8px;margin-top:4px;flex-shrink:0;"></span>
      <div><strong>${c.name} (${c.min === 0 ? '< 2.50' : '≥ ' + c.min.toFixed(2)}):</strong> ${c.description}</div>
    </div>
  `).join('');
}

/* ─── Robust Stats helpers (NaN/Infinity immune) ───────────────────── */
function mean(arr) {
  if (!Array.isArray(arr) || !arr.length) return 0;
  const valid = arr.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function roundN(v, n = 2) {
  if (typeof v !== 'number' || isNaN(v) || !isFinite(v)) return 0;
  const factor = 10 ** n;
  return Math.round(v * factor) / factor;
}

/**
 * Compute the percentile of `value` within a SORTED ascending array.
 * Formula: ((count strictly below + 0.5 * count equal) / total) * 100
 * Guaranteed to return an integer 0–100 without NaN.
 */
function computePercentile(sortedArr, value) {
  if (!Array.isArray(sortedArr) || !sortedArr.length || typeof value !== 'number' || isNaN(value)) {
    return 50;
  }
  let lt = 0, eq = 0;
  for (let i = 0; i < sortedArr.length; i++) {
    const v = sortedArr[i];
    if (v < value)  lt++;
    else if (v === value) eq++;
    else break;
  }
  const pct = ((lt + 0.5 * eq) / sortedArr.length) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/* ─── Apply Filters ────────────────────────────────────────────────── */
function applyFilters() {
  const { prog, year, gender, tier } = STATE.filters;
  
  STATE.filteredStudents = STATE.allStudents.filter(s => {
    if (prog   && s.prog   !== prog)        return false;
    if (year   && String(s.yog) !== year)   return false;
    if (gender && s.gender !== gender)      return false;
    if (tier   && s.tier   !== tier)        return false;
    return true;
  });

  updateKPIs(STATE.filteredStudents);
  updateCohortInsights(STATE.filteredStudents);
  updateFilterChips();
  updateFilterCountBadge(STATE.filteredStudents.length);
  updateAllCharts(STATE.filteredStudents);

  // If a student is selected, update their profile with the fresh filter context
  if (STATE.selectedStudent) {
    const s = STATE.allStudents.find(
      x => x.id === STATE.selectedStudent.id && x.prog === STATE.selectedStudent.prog
    );
    if (s && typeof window.updateStudentComparisonContext === 'function') {
      window.updateStudentComparisonContext(s);
    }
  }

  // Update Data Explorer if available
  if (typeof window.renderDataExplorer === 'function') {
    window.renderDataExplorer();
  }
}

/* ─── Active Filter Chips ──────────────────────────────────────────── */
function updateFilterChips() {
  const strip = document.getElementById('active-filter-strip');
  const chipsContainer = document.getElementById('active-chips');
  if (!strip || !chipsContainer) return;

  const chips = [];
  const { prog, year, gender, tier } = STATE.filters;

  if (prog) {
    chips.push({ key: 'prog', label: 'Prog', val: prog });
  }
  if (year) {
    chips.push({ key: 'year', label: 'Year', val: year });
  }
  if (gender) {
    chips.push({ key: 'gender', label: 'Gender', val: gender });
  }
  if (tier) {
    chips.push({ key: 'tier', label: 'Category', val: tier });
  }
  if (STATE.selectedStudent) {
    chips.push({
      key: 'student',
      label: 'Student',
      val: `${STATE.selectedStudent.id} (${STATE.selectedStudent.prog})`,
      isStudent: true
    });
  }

  if (!chips.length) {
    strip.style.display = 'none';
    chipsContainer.innerHTML = '';
    return;
  }

  strip.style.display = 'flex';
  chipsContainer.innerHTML = chips.map(c => `
    <span class="filter-chip ${c.isStudent ? 'chip-student' : ''}">
      <span class="chip-key">${c.label}:</span>
      <span>${c.val}</span>
      <button class="chip-remove" data-key="${c.key}" title="Remove this filter">✕</button>
    </span>
  `).join('');

  // Wire up chip remove buttons
  chipsContainer.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if (key === 'student') {
        if (typeof window.clearStudentSelection === 'function') {
          window.clearStudentSelection();
        }
      } else {
        STATE.filters[key] = '';
        const sel = document.getElementById(`filter-${key}`);
        if (sel) sel.value = '';
        applyFilters();
      }
    });
  });
}

/* ─── Cohort Insights: What the Data Says ──────────────────────────── */
function updateCohortInsights(fs) {
  const strongProgEl = document.getElementById('ai-strong-prog');
  const strongProgSub = document.getElementById('ai-strong-prog-sub');
  const l200DipEl = document.getElementById('ai-l200-dip');
  const l200DipSub = document.getElementById('ai-l200-dip-sub');
  const genderGapEl = document.getElementById('ai-gender-gap');
  const genderGapSub = document.getElementById('ai-gender-gap-sub');

  if (!strongProgEl) return;

  if (!fs.length) {
    strongProgEl.textContent = '—';
    strongProgSub.textContent = 'no matching records';
    l200DipEl.textContent = '—';
    l200DipSub.textContent = 'no matching records';
    genderGapEl.textContent = '—';
    genderGapSub.textContent = 'no matching records';
    return;
  }

  // 1. Strongest programme in filtered cohort
  const progs = {};
  fs.forEach(s => {
    if (!progs[s.prog]) progs[s.prog] = [];
    progs[s.prog].push(s.cgpa);
  });
  let topProg = '', topAvg = -1, topCount = 0;
  for (const [p, vals] of Object.entries(progs)) {
    const avg = mean(vals);
    if (avg > topAvg) {
      topAvg = avg;
      topProg = p;
      topCount = vals.length;
    }
  }
  if (topProg) {
    strongProgEl.textContent = `${topProg} (${topAvg.toFixed(2)})`;
    strongProgSub.textContent = `${topCount} student${topCount > 1 ? 's' : ''} in cohort`;
  } else {
    strongProgEl.textContent = '—';
  }

  // 2. Level 100 → Level 200 trajectory
  const l100 = mean(fs.map(s => s.cgpa100));
  const l200 = mean(fs.map(s => s.cgpa200));
  const shift = roundN(l200 - l100, 2);
  if (l100 > 0 && l200 > 0) {
    l200DipEl.textContent = `${shift > 0 ? '+' : ''}${shift.toFixed(2)} CGPA`;
    l200DipEl.style.color = shift < 0 ? 'var(--red-600)' : 'var(--green-600)';
    if (shift < 0) {
      l200DipSub.textContent = 'For the selected cohort, average performance declines from Level 100 to Level 200.';
    } else if (shift > 0) {
      l200DipSub.textContent = 'For the selected cohort, average performance increases from Level 100 to Level 200.';
    } else {
      l200DipSub.textContent = 'For the selected cohort, average performance is unchanged from Level 100 to Level 200.';
    }
  } else {
    l200DipEl.textContent = '—';
    l200DipSub.textContent = 'no data for this stage';
  }

  // 3. Gender comparison gap
  const females = fs.filter(s => s.gender === 'Female');
  const males = fs.filter(s => s.gender === 'Male');
  if (females.length && males.length) {
    const fAvg = mean(females.map(s => s.cgpa));
    const mAvg = mean(males.map(s => s.cgpa));
    const gap = roundN(fAvg - mAvg, 2);
    genderGapEl.textContent = `${gap >= 0 ? 'F +' : 'M +'}${Math.abs(gap).toFixed(2)}`;
    genderGapSub.textContent = `F: ${fAvg.toFixed(2)} vs M: ${mAvg.toFixed(2)}`;
  } else if (females.length) {
    genderGapEl.textContent = '100% Female';
    genderGapSub.textContent = `Mean CGPA: ${mean(females.map(s=>s.cgpa)).toFixed(2)}`;
  } else if (males.length) {
    genderGapEl.textContent = '100% Male';
    genderGapSub.textContent = `Mean CGPA: ${mean(males.map(s=>s.cgpa)).toFixed(2)}`;
  } else {
    genderGapEl.textContent = '—';
  }
}

/* ─── KPI Cards ────────────────────────────────────────────────────── */
function updateKPIs(fs) {
  const n = fs.length;
  document.getElementById('kpi-total').textContent = n.toLocaleString();
  document.getElementById('kpi-total-sub').textContent =
    `of ${STATE.allStudents.length.toLocaleString()} in dataset`;

  if (n === 0) {
    ['kpi-avg-cgpa','kpi-top-pct','kpi-gender'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
    return;
  }

  const avgCGPA = mean(fs.map(s => s.cgpa));
  document.getElementById('kpi-avg-cgpa').textContent = roundN(avgCGPA, 2).toFixed(2);
  const totalAvg = mean(STATE.allStudents.map(s => s.cgpa));
  document.getElementById('kpi-avg-sub').textContent =
    `on 5.00 scale (dataset avg: ${roundN(totalAvg, 2).toFixed(2)})`;

  const topN = fs.filter(s => s.cgpa >= 3.50).length;
  const topPct = Math.round((topN / n) * 100);
  document.getElementById('kpi-top-pct').textContent = topPct + '%';
  document.getElementById('kpi-top-sub').textContent =
    `${topN.toLocaleString()} students with CGPA ≥ 3.50`;

  const fCount = fs.filter(s => s.gender === 'Female').length;
  const mCount = n - fCount;
  document.getElementById('kpi-gender').textContent = `${fCount} / ${mCount}`;
  document.getElementById('kpi-gender-sub').textContent =
    `${Math.round((fCount/n)*100)}% F · ${Math.round((mCount/n)*100)}% M`;
}

/* ─── Filter count badge ───────────────────────────────────────────── */
function updateFilterCountBadge(n) {
  const el = document.getElementById('filter-count-badge');
  if (!el) return;
  const total = STATE.allStudents.length;
  if (n === total) {
    el.textContent = `${n.toLocaleString()} students shown (all)`;
    el.style.color = '';
  } else if (n === 0) {
    el.textContent = `0 students match current filters`;
    el.style.color = 'var(--red-600)';
  } else {
    el.textContent = `${n.toLocaleString()} / ${total.toLocaleString()} students shown`;
    el.style.color = 'var(--primary)';
  }
}

/* ─── Tab switching ────────────────────────────────────────────────── */
function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tab;
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const targetSec = document.getElementById('tab-' + id);
      if (targetSec) targetSec.classList.add('active');
      // Resize charts when switching to a tab
      Object.values(window._charts || {}).forEach(c => { if (c) c.resize(); });
    });
  });
}

/* ─── Boot ─────────────────────────────────────────────────────────── */
function boot() {
  const data = window.USPA;
  if (!data) {
    document.getElementById('loading').innerHTML =
      '<div style="color:#f87171;font-size:1rem">Error: data/data.js not found.<br>Run build_data.py first.</div>';
    return;
  }

  // Store full student list (augment with tier if missing)
  STATE.allStudents = data.students.map(s => ({
    ...s,
    tier: s.tier || getTier(s.cgpa),
  }));
  STATE.filteredStudents = [...STATE.allStudents];

  // Header badge
  document.getElementById('header-badge').textContent =
    `${STATE.allStudents.length.toLocaleString()} students · 17 programmes · 2010–2014`;

  // Init clear-all on filter chips
  const clearAllBtn = document.getElementById('chips-clear-all');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (typeof window.resetFilters === 'function') {
        window.resetFilters();
      }
    });
  }

  // Init subsystems
  initTabs();
  renderTierDefinitions();
  if (typeof window.initFilters === 'function') window.initFilters(data);
  if (typeof window.initAllCharts === 'function') window.initAllCharts(data);
  if (typeof window.initDataExplorer === 'function') window.initDataExplorer();
  applyFilters();

  // Hide loading
  document.getElementById('loading').style.display = 'none';
}

// Run when DOM + data.js are ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* ─── Expose helpers to other modules ─────────────────────────────── */
window.PERFORMANCE_CATEGORIES = PERFORMANCE_CATEGORIES;
window.LEVEL_KEYS   = LEVEL_KEYS;
window.LEVEL_LABELS = LEVEL_LABELS;
window.STATE        = STATE;
window.applyFilters = applyFilters;
window.updateFilterChips = updateFilterChips;
window.getTier      = getTier;
window.mean         = mean;
window.roundN       = roundN;
window.computePercentile = computePercentile;
