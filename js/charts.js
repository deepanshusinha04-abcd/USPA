/**
 * charts.js — All Interactive Charts (Phase 3)
 *
 * Capabilities:
 *  - 11 Chart.js charts covering all required views
 *  - Interactive cross-filtering on click (tier, prog, year)
 *  - Interactive scatter click → student selection
 *  - Selected student visual highlight ring on scatter plot
 *  - Hover states and pointer styling
 *  - Informative tooltips with clear values and context
 *  - Robust empty/no-data state overlays
 */

'use strict';

/* ─── Chart.js global defaults & theme ─────────────────────────────── */
const FONT_FAMILY = "'Inter', system-ui, -apple-system, sans-serif";
const PALETTE = {
  blue:     '#2563EB',
  green:    '#16A34A',
  amber:    '#D97706',
  red:      '#DC2626',
  slate:    '#64748B',
  blue100:  '#DBEAFE',
  green100: '#DCFCE7',
  amber100: '#FEF3C7',
  red100:   '#FFE4E6',
};

const PROG_COLORS = [
  '#2563EB','#1D4ED8','#1E40AF',
  '#16A34A','#15803D','#14532D',
  '#D97706','#B45309','#92400E',
  '#DC2626','#B91C1C','#991B1B',
  '#64748B','#475569','#334155',
  '#0E7490','#0369A1',
];

function getTierOrder() {
  if (window.PERFORMANCE_CATEGORIES && window.PERFORMANCE_CATEGORIES.length) {
    return window.PERFORMANCE_CATEGORIES.map(c => c.name);
  }
  return ['Distinction','Upper Credit','Lower Credit','Merit','Pass','Below Pass'];
}
function getTierColors() {
  if (window.PERFORMANCE_CATEGORIES && window.PERFORMANCE_CATEGORIES.length) {
    return Object.fromEntries(window.PERFORMANCE_CATEGORIES.map(c => [c.name, c.color]));
  }
  return {
    'Distinction':  '#16A34A',
    'Upper Credit': '#2563EB',
    'Lower Credit': '#60A5FA',
    'Merit':        '#D97706',
    'Pass':         '#F59E0B',
    'Below Pass':   '#DC2626',
  };
}

Chart.defaults.font.family = FONT_FAMILY;
Chart.defaults.font.size   = 11;
Chart.defaults.color       = '#475569';
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding  = 10;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.94)';
Chart.defaults.plugins.tooltip.titleFont       = { size: 11, weight: '700' };
Chart.defaults.plugins.tooltip.bodyFont        = { size: 11 };
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.cornerRadius    = 6;

/* ─── Chart instance registry ──────────────────────────────────────── */
window._charts = {};

function destroyChart(id) {
  if (window._charts[id]) {
    window._charts[id].destroy();
    window._charts[id] = null;
  }
}
function getCanvas(id) {
  const el = document.getElementById(id);
  return el ? el.getContext('2d') : null;
}

/* ─── Empty state helper ───────────────────────────────────────────── */
const CHART_CANVAS_IDS = [
  'chart-hist',
  'chart-tier',
  'chart-prog-bar-ov',
  'chart-year-ov',
  'chart-scatter',
  'chart-gender-avg',
  'chart-gender-level',
  'chart-hist-overlay',
  'chart-prog-stacked',
  'chart-prog-bar',
  'chart-trajectory',
  'chart-year-full',
];

function setChartEmptyState(canvasId, isEmpty, msg = 'No data matches current filters') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const wrap = canvas.closest('.chart-wrap');
  if (!wrap) return;

  let overlay = wrap.querySelector('.chart-empty-msg');
  if (isEmpty) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'chart-empty-msg';
      overlay.innerHTML = `
        <div class="cem-icon">📊</div>
        <div class="cem-text">${msg}</div>
        <div class="cem-hint">Adjust or reset filters to display data</div>
      `;
      wrap.appendChild(overlay);
    }
  } else if (overlay) {
    overlay.remove();
  }
}

/* ═══════════════════════════════════════════════════════════════════
   INIT ALL CHARTS
════════════════════════════════════════════════════════════════════ */
function initAllCharts(data) {
  window._baseData = data;

  initHistChart();
  initTierChart();
  initProgBarOvChart();
  initYearOvChart();
  initScatterChart();
  initGenderAvgChart();
  initGenderLevelChart();
  initHistOverlayChart();
  initRadarChart(data);
  initProgStackedChart();
  initProgBarChart();
  initTrajectoryChart();
  initYearFullChart();
}

/* ═══════════════════════════════════════════════════════════════════
   UPDATE ALL CHARTS
════════════════════════════════════════════════════════════════════ */
function updateAllCharts(fs) {
  const hasData = fs && fs.length > 0;

  CHART_CANVAS_IDS.forEach(id => {
    setChartEmptyState(id, !hasData);
  });

  if (!hasData) {
    // Clear datasets from all charts gracefully
    Object.values(window._charts).forEach(c => {
      if (c && c.data) {
        c.data.datasets = [];
        c.update('none');
      }
    });
    const legend = document.getElementById('tier-legend');
    if (legend) legend.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted)">No students</span>';
    const tbody = document.getElementById('prog-table-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No data matching filters</td></tr>';
    return;
  }

  updateHistChart(fs);
  updateTierChart(fs);
  updateProgBarOvChart(fs);
  updateYearOvChart(fs);
  updateScatterChart(fs);
  updateGenderAvgChart(fs);
  updateGenderLevelChart(fs);
  updateHistOverlayChart(fs);
  updateProgStackedChart(fs);
  updateProgBarChart(fs);
  updateTrajectoryChart(fs);
  updateYearFullChart(fs);
}

/* ──────────────────────────────────────────────────────────────────
   1. CGPA HISTOGRAM
─────────────────────────────────────────────────────────────────── */
function initHistChart() {
  destroyChart('hist');
  const ctx = getCanvas('chart-hist');
  if (!ctx) return;

  window._charts.hist = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: ([item]) => `CGPA range: ${item.label}`,
            label: (item) => ` ${item.raw} student${item.raw > 1 ? 's' : ''}`,
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'CGPA (midpoint of bin)', font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          title: { display: true, text: 'Students', font: { size: 10 } },
          beginAtZero: true,
          grid: { color: '#F1F5F9' },
        }
      }
    }
  });
}

function buildHistBins(values, bins = 20) {
  if (!values || !values.length) return { labels: [], counts: [] };
  const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (!valid.length) return { labels: [], counts: [] };

  const mn = Math.min(...valid);
  const mx = Math.max(...valid);
  const bw = mx === mn ? 0.2 : (mx - mn) / bins;
  const counts = new Array(bins).fill(0);
  const labels = [];
  for (let i = 0; i < bins; i++) {
    const lo = mn + i * bw;
    const hi = lo + bw;
    labels.push(((lo + hi) / 2).toFixed(2));
  }
  for (const v of valid) {
    const idx = Math.min(Math.floor((v - mn) / (bw || 1)), bins - 1);
    counts[idx]++;
  }
  return { labels, counts };
}

function histBarColors(labels) {
  const cats = window.PERFORMANCE_CATEGORIES || [];
  return labels.map(l => {
    const v = parseFloat(l);
    const cat = cats.find(c => v >= c.min) || cats[cats.length - 1];
    return cat ? cat.color : PALETTE.blue;
  });
}

function updateHistChart(fs) {
  const values = fs.map(s => s.cgpa);
  const { labels, counts } = buildHistBins(values, 20);
  const avg = mean(values);
  const c = window._charts.hist;
  if (!c) return;

  // Selected student highlight
  let studentBinIdx = -1;
  const badge = document.getElementById('hist-student-badge');
  if (STATE.selectedStudent && STATE.allStudents.length) {
    const sel = STATE.allStudents.find(
      x => x.id === STATE.selectedStudent.id && x.prog === STATE.selectedStudent.prog
    );
    if (sel && typeof sel.cgpa === 'number' && values.length) {
      const mn = Math.min(...values);
      const mx = Math.max(...values);
      const bw = mx === mn ? 0.2 : (mx - mn) / 20;
      studentBinIdx = Math.min(Math.floor((sel.cgpa - mn) / (bw || 1)), 19);
      if (badge && studentBinIdx >= 0) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = `🎓 Selected Student: ID ${sel.id} (${sel.prog}) — CGPA ${sel.cgpa.toFixed(2)} sits in bin ${labels[studentBinIdx] || ''}`;
      }
    } else if (badge) {
      badge.style.display = 'none';
    }
  } else if (badge) {
    badge.style.display = 'none';
  }

  const bgColors = histBarColors(labels);
  const borderColors = labels.map((_, i) => i === studentBinIdx ? '#B45309' : 'transparent');
  const borderWidths = labels.map((_, i) => i === studentBinIdx ? 3 : 0);

  c.data.labels = labels;
  c.data.datasets = [{
    label: 'Students',
    data: counts,
    backgroundColor: bgColors,
    borderColor: borderColors,
    borderWidth: borderWidths,
    borderRadius: 3,
    borderSkipped: false,
  }];
  c.options.plugins.title = {
    display: true,
    text: `Cohort Mean: ${avg.toFixed(3)} | Total: ${fs.length.toLocaleString()} students`,
    font: { size: 11, weight: '600' },
    color: '#64748B',
    padding: { bottom: 4 }
  };
  c.update('none');
}

/* ──────────────────────────────────────────────────────────────────
   2. PERFORMANCE TIER DOUGHNUT (Interactive click-to-filter)
─────────────────────────────────────────────────────────────────── */
function initTierChart() {
  destroyChart('tier');
  const ctx = getCanvas('chart-tier');
  if (!ctx) return;

  window._charts.tier = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const tier = window._charts.tier.data.labels[idx];
        if (tier && typeof window.setFilter === 'function') {
          window.setFilter('tier', tier);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const total = item.dataset.data.reduce((a,b)=>a+b,0) || 1;
              const pct = Math.round((item.raw / total) * 100);
              return ` ${item.label}: ${item.raw} (${pct}%) — Click to filter`;
            }
          }
        }
      }
    }
  });
}

function updateTierChart(fs) {
  const tierOrder = getTierOrder();
  const tierColors = getTierColors();
  const counts = {};
  tierOrder.forEach(t => counts[t] = 0);
  fs.forEach(s => { if (counts[s.tier] !== undefined) counts[s.tier]++; });
  const labels = tierOrder.filter(t => counts[t] > 0);
  const data   = labels.map(t => counts[t]);
  const colors = labels.map(t => tierColors[t] || PALETTE.blue);
  const c = window._charts.tier;
  if (!c) return;

  c.data.labels   = labels;
  c.data.datasets = [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }];
  c.update('none');

  const legend = document.getElementById('tier-legend');
  if (legend) {
    legend.innerHTML = labels.map((l, i) =>
      `<div class="legend-row" style="cursor:pointer" onclick="setFilter('tier', '${l}')" title="Click to filter by ${l}">
        <div class="legend-dot" style="background:${colors[i]}"></div>
        <span>${l}</span>
        <span style="margin-left:auto;font-weight:700">${data[i]}</span>
      </div>`
    ).join('');
  }
}

/* ──────────────────────────────────────────────────────────────────
   3. PROGRAMME BAR — Overview mini (Interactive click-to-filter)
─────────────────────────────────────────────────────────────────── */
function initProgBarOvChart() {
  destroyChart('progBarOv');
  const ctx = getCanvas('chart-prog-bar-ov');
  if (!ctx) return;

  window._charts.progBarOv = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const label = window._charts.progBarOv.data.labels[elements[0].index];
        if (label && typeof window.setFilter === 'function') {
          window.setFilter('prog', label);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` Avg CGPA: ${item.raw.toFixed(3)} (n=${item.dataset.statsMeta?.[item.dataIndex]?.n || ''}) — Click to filter`
          }
        }
      },
      scales: {
        x: { min: 0, max: 5, grid: { color: '#F1F5F9' }, title: { display: true, text: 'Mean CGPA', font: { size: 10 } } },
        y: { grid: { display: false } }
      }
    }
  });
}

function getProgStats(fs) {
  const groups = {};
  fs.forEach(s => {
    if (!groups[s.prog]) groups[s.prog] = [];
    groups[s.prog].push(s.cgpa);
  });
  return Object.entries(groups).map(([prog, vals]) => ({
    prog,
    avg: mean(vals),
    n: vals.length,
  })).sort((a, b) => b.avg - a.avg);
}

function updateProgBarOvChart(fs) {
  const stats = getProgStats(fs);
  const c = window._charts.progBarOv;
  if (!c) return;

  c.data.labels = stats.map(s => s.prog);
  c.data.datasets = [{
    label: 'Avg CGPA',
    data: stats.map(s => roundN(s.avg, 3)),
    backgroundColor: stats.map((_, i) => PROG_COLORS[i % PROG_COLORS.length] + 'CC'),
    borderColor:     stats.map((_, i) => PROG_COLORS[i % PROG_COLORS.length]),
    borderWidth: 1,
    borderRadius: 3,
    statsMeta: stats,
  }];
  c.update('none');
}

/* ──────────────────────────────────────────────────────────────────
   4. YEAR TREND — Overview mini (Interactive click-to-filter)
─────────────────────────────────────────────────────────────────── */
function initYearOvChart() {
  destroyChart('yearOv');
  const ctx = getCanvas('chart-year-ov');
  if (!ctx) return;

  window._charts.yearOv = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const yr = window._charts.yearOv.data.labels[elements[0].index];
        if (yr && typeof window.setFilter === 'function') {
          window.setFilter('year', String(yr));
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` Avg CGPA: ${item.raw.toFixed(3)} — Click to filter`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { min: 2.5, max: 4.5, grid: { color: '#F1F5F9' }, title: { display: true, text: 'Mean CGPA', font: { size: 10 } } }
      }
    }
  });
}

function updateYearOvChart(fs) {
  const groups = {};
  fs.forEach(s => { if (!groups[s.yog]) groups[s.yog] = []; groups[s.yog].push(s.cgpa); });
  const years = Object.keys(groups).sort();
  const avgs  = years.map(y => roundN(mean(groups[y]), 3));
  const c = window._charts.yearOv;
  if (!c) return;

  c.data.labels = years;
  c.data.datasets = [{
    label: 'Avg CGPA',
    data: avgs,
    borderColor: PALETTE.blue,
    backgroundColor: PALETTE.blue + '22',
    fill: true,
    tension: 0.3,
    pointRadius: 5,
    pointBackgroundColor: PALETTE.blue,
  }];
  c.update('none');
}

/* ──────────────────────────────────────────────────────────────────
   5. SCATTER: CGPA vs SGPA (Interactive click → select student)
─────────────────────────────────────────────────────────────────── */
function initScatterChart() {
  destroyChart('scatter');
  const ctx = getCanvas('chart-scatter');
  if (!ctx) return;

  window._charts.scatter = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const el = elements[0];
        const ds = window._charts.scatter.data.datasets[el.datasetIndex];
        const pt = ds?.data?.[el.index];
        if (pt && pt.id && pt.prog && typeof window.selectStudentGlobal === 'function') {
          window.selectStudentGlobal({ id: pt.id, prog: pt.prog });
        }
      },
      plugins: {
        legend: { display: true, position: 'right', labels: { boxWidth: 10, font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: (item) => {
              const d = item.raw;
              return [
                ` 🎓 ID: ${d.id}  (${d.prog}, ${d.yog})`,
                ` CGPA: ${d.x.toFixed(2)}  |  SGPA: ${d.y.toFixed(2)}`,
                ` Click dot to view complete student profile`,
              ];
            }
          }
        }
      },
      scales: {
        x: { min: 1, max: 5.2, title: { display: true, text: 'CGPA (Cumulative)', font: { size: 10 } }, grid: { color: '#F1F5F9' } },
        y: { min: 1, max: 5.2, title: { display: true, text: 'SGPA (Final Semester)', font: { size: 10 } }, grid: { color: '#F1F5F9' } },
      }
    }
  });

  const colorByEl = document.getElementById('scatter-color-by');
  if (colorByEl) {
    colorByEl.addEventListener('change', () => {
      updateScatterChart(STATE.filteredStudents);
    });
  }
}

function updateScatterChart(fs) {
  const colorByEl = document.getElementById('scatter-color-by');
  const colorBy = colorByEl ? colorByEl.value : 'prog';
  const c = window._charts.scatter;
  if (!c) return;

  const diagPoints = [{ x: 1, y: 1 }, { x: 5, y: 5 }];
  let datasets = [];

  if (colorBy === 'prog') {
    const progs = [...new Set(fs.map(s => s.prog))].sort();
    datasets = progs.map((p, i) => ({
      label: p,
      data: fs.filter(s => s.prog === p).map(s => ({ x: s.cgpa, y: s.sgpa, id: s.id, prog: s.prog, yog: s.yog, gender: s.gender })),
      backgroundColor: PROG_COLORS[i % PROG_COLORS.length] + '99',
      pointRadius: 3.5,
      pointHoverRadius: 6,
    }));
  } else if (colorBy === 'gender') {
    const genders = ['Female', 'Male'];
    const gColors = [PALETTE.blue, PALETTE.amber];
    datasets = genders.map((g, i) => ({
      label: g,
      data: fs.filter(s => s.gender === g).map(s => ({ x: s.cgpa, y: s.sgpa, id: s.id, prog: s.prog, yog: s.yog, gender: s.gender })),
      backgroundColor: gColors[i] + '99',
      pointRadius: 3.5,
      pointHoverRadius: 6,
    }));
  } else {
    // tier
    const tierOrder = getTierOrder();
    const tierColors = getTierColors();
    datasets = tierOrder.map(t => ({
      label: t,
      data: fs.filter(s => s.tier === t).map(s => ({ x: s.cgpa, y: s.sgpa, id: s.id, prog: s.prog, yog: s.yog, gender: s.gender })),
      backgroundColor: (tierColors[t] || PALETTE.blue) + '99',
      pointRadius: 3.5,
      pointHoverRadius: 6,
    })).filter(ds => ds.data.length > 0);
  }

  // 1:1 diagonal reference line
  datasets.push({
    label: '1:1 Reference',
    data: diagPoints,
    type: 'line',
    borderColor: '#CBD5E1',
    borderDash: [6, 4],
    borderWidth: 1.5,
    pointRadius: 0,
    fill: false,
    tension: 0,
    showInLegend: false,
  });

  // Selected student highlight ring
  if (STATE.selectedStudent) {
    const sel = STATE.allStudents.find(
      x => x.id === STATE.selectedStudent.id && x.prog === STATE.selectedStudent.prog
    );
    if (sel) {
      datasets.push({
        label: `Selected Student: ${sel.id} (${sel.prog})`,
        data: [{ x: sel.cgpa, y: sel.sgpa, id: sel.id, prog: sel.prog, yog: sel.yog, gender: sel.gender }],
        backgroundColor: '#D97706',
        borderColor: '#B45309',
        borderWidth: 3,
        pointRadius: 9,
        pointHoverRadius: 11,
        order: -10,
      });
    }
  }

  c.data.datasets = datasets;
  c.update('none');
}

/* ──────────────────────────────────────────────────────────────────
   6. GENDER-WISE AVERAGE CGPA (Viz 6)
─────────────────────────────────────────────────────────────────── */
function initGenderAvgChart() {
  destroyChart('genderAvg');
  const ctx = getCanvas('chart-gender-avg');
  if (!ctx) return;

  window._charts.genderAvg = new Chart(ctx, {
    type: 'bar',
    data: { labels: ['Female', 'Male'], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const g = elements[0].index === 0 ? 'Female' : 'Male';
        if (typeof window.setFilter === 'function') {
          window.setFilter('gender', g);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const meta = item.dataset.statsMeta?.[item.dataIndex];
              return [
                ` Mean CGPA: ${item.raw.toFixed(3)}`,
                ` Count: ${meta?.n || 0} students (${meta?.pct || 0}%)`,
                ` Click to filter by ${item.label}`,
              ];
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0, max: 5,
          grid: { color: '#F1F5F9' },
          title: { display: true, text: 'Mean CGPA', font: { size: 10 } }
        }
      }
    }
  });
}

function updateGenderAvgChart(fs) {
  const c = window._charts.genderAvg;
  if (!c) return;

  const female = fs.filter(s => s.gender === 'Female');
  const male   = fs.filter(s => s.gender === 'Male');
  const total  = fs.length || 1;

  const fAvg = female.length ? roundN(mean(female.map(s => s.cgpa)), 3) : 0;
  const mAvg = male.length ? roundN(mean(male.map(s => s.cgpa)), 3) : 0;

  const statsMeta = [
    { n: female.length, pct: Math.round((female.length / total) * 100) },
    { n: male.length,   pct: Math.round((male.length / total) * 100) },
  ];

  c.data.labels = ['Female', 'Male'];
  c.data.datasets = [{
    label: 'Mean CGPA',
    data: [fAvg, mAvg],
    backgroundColor: [PALETTE.blue + 'CC', PALETTE.amber + 'CC'],
    borderColor:     [PALETTE.blue, PALETTE.amber],
    borderWidth: 1.5,
    borderRadius: 4,
    statsMeta: statsMeta,
  }];
  c.update('none');
}

/* ──────────────────────────────────────────────────────────────────
   GENDER × LEVEL GROUPED BAR
─────────────────────────────────────────────────────────────────── */
function initGenderLevelChart() {
  destroyChart('genderLevel');
  const ctx = getCanvas('chart-gender-level');
  if (!ctx) return;

  window._charts.genderLevel = new Chart(ctx, {
    type: 'bar',
    data: { labels: window.LEVEL_LABELS, datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${item.raw.toFixed(3)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { min: 2, max: 5, grid: { color: '#F1F5F9' }, title: { display: true, text: 'Mean CGPA', font: { size: 10 } } }
      }
    }
  });
}

function updateGenderLevelChart(fs) {
  const female = fs.filter(s => s.gender === 'Female');
  const male   = fs.filter(s => s.gender === 'Male');
  const c = window._charts.genderLevel;
  if (!c) return;

  c.data.datasets = [
    {
      label: 'Female',
      data: window.LEVEL_KEYS.map(k => roundN(mean(female.map(s => s[k])), 3)),
      backgroundColor: PALETTE.blue + 'CC',
      borderColor: PALETTE.blue,
      borderWidth: 1,
      borderRadius: 3,
    },
    {
      label: 'Male',
      data: window.LEVEL_KEYS.map(k => roundN(mean(male.map(s => s[k])), 3)),
      backgroundColor: PALETTE.amber + 'CC',
      borderColor: PALETTE.amber,
      borderWidth: 1,
      borderRadius: 3,
    }
  ];
  c.update('none');
}

/* ──────────────────────────────────────────────────────────────────
   7. HISTOGRAM OVERLAY (Filtered vs All)
─────────────────────────────────────────────────────────────────── */
function initHistOverlayChart() {
  destroyChart('histOverlay');
  const ctx = getCanvas('chart-hist-overlay');
  if (!ctx) return;

  window._charts.histOverlay = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${item.raw}%`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, title: { display: true, text: 'CGPA (midpoint)', font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, title: { display: true, text: '% of cohort', font: { size: 10 } } }
      }
    }
  });
}

function toPercent(counts) {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return counts.map(c => roundN((c / total) * 100, 1));
}

function updateHistOverlayChart(fs) {
  const all = STATE.allStudents;
  const bins = 20;
  const { labels, counts: allCounts } = buildHistBins(all.map(s => s.cgpa), bins);

  const mn = Math.min(...all.map(s => s.cgpa));
  const mx = Math.max(...all.map(s => s.cgpa));
  const bw = (mx - mn) / bins;
  const fsCounts = new Array(bins).fill(0);
  fs.forEach(s => {
    const idx = Math.min(Math.floor((s.cgpa - mn) / (bw || 1)), bins - 1);
    fsCounts[idx]++;
  });

  const c = window._charts.histOverlay;
  if (!c) return;

  c.data.labels = labels;
  c.data.datasets = [
    {
      label: 'Filtered group',
      data: toPercent(fsCounts),
      backgroundColor: PALETTE.blue + 'BB',
      borderRadius: 3,
      order: 1,
    },
    {
      label: 'All students (baseline)',
      data: toPercent(allCounts),
      type: 'line',
      borderColor: '#94A3B8',
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 1.5,
      borderDash: [4, 4],
      order: 0,
    }
  ];
  c.update('none');
}

/* ──────────────────────────────────────────────────────────────────
   8. PROGRAMME RADAR
─────────────────────────────────────────────────────────────────── */
function initRadarChart(data) {
  destroyChart('radar');
  const ctx = getCanvas('chart-radar');
  if (!ctx) return;

  window._charts.radar = new Chart(ctx, {
    type: 'radar',
    data: { labels: ['Level 100','Level 200','Level 300','Level 400','SGPA'], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${item.raw.toFixed(3)}`
          }
        }
      },
      scales: {
        r: {
          min: 1, max: 5,
          ticks: { stepSize: 1, font: { size: 9 } },
          grid:  { color: '#E2E8F0' },
          pointLabels: { font: { size: 10, weight: '600' } }
        }
      }
    }
  });
}

function updateRadarChart(prog) {
  const c = window._charts.radar;
  const data = window._baseData;
  if (!c || !data) return;

  const allMeans = [
    data.level_means.CGPA100,
    data.level_means.CGPA200,
    data.level_means.CGPA300,
    data.level_means.CGPA400,
    data.overall.SGPA.mean,
  ];

  if (!prog) {
    c.data.datasets = [{
      label: 'All students (mean)',
      data: allMeans,
      borderColor: '#94A3B8',
      backgroundColor: 'rgba(148,163,184,0.15)',
      pointRadius: 4,
    }];
    c.update('none');
    return;
  }

  const progStudents = STATE.filteredStudents.filter(s => s.prog === prog);
  if (!progStudents.length) return;

  const progMeans = [
    roundN(mean(progStudents.map(s => s.cgpa100)), 3),
    roundN(mean(progStudents.map(s => s.cgpa200)), 3),
    roundN(mean(progStudents.map(s => s.cgpa300)), 3),
    roundN(mean(progStudents.map(s => s.cgpa400)), 3),
    roundN(mean(progStudents.map(s => s.sgpa)),    3),
  ];

  c.data.datasets = [
    {
      label: prog,
      data: progMeans,
      borderColor: PALETTE.blue,
      backgroundColor: PALETTE.blue + '33',
      pointRadius: 5,
      pointBackgroundColor: PALETTE.blue,
      borderWidth: 2,
    },
    {
      label: 'All students (mean)',
      data: allMeans,
      borderColor: '#94A3B8',
      backgroundColor: 'rgba(148,163,184,0.1)',
      pointRadius: 3,
      borderWidth: 1.5,
      borderDash: [4, 4],
    }
  ];
  c.update('none');
}

/* ──────────────────────────────────────────────────────────────────
   8. PROGRAM PERFORMANCE COMPARISON — STACKED BAR (Viz 8)
─────────────────────────────────────────────────────────────────── */
let _stackedMode = 'count'; // 'count' | 'percent'

function initProgStackedChart() {
  destroyChart('progStacked');
  const ctx = getCanvas('chart-prog-stacked');
  if (!ctx) return;

  window._charts.progStacked = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const prog = window._charts.progStacked.data.labels[elements[0].index];
        if (prog && typeof window.setFilter === 'function') {
          window.setFilter('prog', prog);
        }
      },
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 8 } },
        tooltip: {
          callbacks: {
            label: (item) => {
              const raw = item.raw;
              const meta = item.dataset.statsMeta?.[item.dataIndex];
              if (_stackedMode === 'percent') {
                return ` ${item.dataset.label}: ${raw.toFixed(1)}% (${meta?.count || 0} students) — Click to filter`;
              }
              return ` ${item.dataset.label}: ${raw} students (${meta?.pct || 0}%) — Click to filter`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          title: { display: true, text: 'Degree Programme', font: { size: 10 } }
        },
        y: {
          stacked: true,
          grid: { color: '#F1F5F9' },
          title: {
            display: true,
            text: _stackedMode === 'percent' ? '% of Programme Cohort' : 'Number of Students',
            font: { size: 10 }
          },
          max: _stackedMode === 'percent' ? 100 : undefined,
        }
      }
    }
  });

  // Toggle button listeners
  const toggleWrap = document.getElementById('stacked-mode-toggle');
  if (toggleWrap) {
    toggleWrap.querySelectorAll('.chart-toggle-btn').forEach(btn => {
      btn.onclick = () => {
        toggleWrap.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _stackedMode = btn.dataset.mode;
        if (window._charts.progStacked) {
          window._charts.progStacked.options.scales.y.max = _stackedMode === 'percent' ? 100 : undefined;
          window._charts.progStacked.options.scales.y.title.text = _stackedMode === 'percent' ? '% of Programme Cohort' : 'Number of Students';
        }
        updateProgStackedChart(STATE.filteredStudents);
      };
    });
  }
}

function updateProgStackedChart(fs) {
  const c = window._charts.progStacked;
  if (!c) return;

  const progs = window._baseData?.meta?.programs?.slice().sort() || [...new Set(fs.map(s => s.prog))].sort();
  const tierOrder = getTierOrder();
  const tierColors = getTierColors();

  // For each prog, count students per tier
  const progData = progs.map(p => {
    const pStudents = fs.filter(s => s.prog === p);
    const total = pStudents.length;
    const tierCounts = {};
    tierOrder.forEach(t => tierCounts[t] = 0);
    pStudents.forEach(s => {
      if (tierCounts[s.tier] !== undefined) tierCounts[s.tier]++;
    });
    return { prog: p, total, tierCounts };
  });

  // Build datasets in reverse tier order (Below Pass on bottom, Distinction on top for natural stack)
  const datasets = tierOrder.slice().reverse().map(tierName => {
    const color = tierColors[tierName] || PALETTE.blue;
    const dataVals = [];
    const statsMeta = [];

    progData.forEach(pd => {
      const count = pd.tierCounts[tierName] || 0;
      const pct = pd.total ? roundN((count / pd.total) * 100, 1) : 0;
      dataVals.push(_stackedMode === 'percent' ? pct : count);
      statsMeta.push({ count, pct, total: pd.total });
    });

    return {
      label: tierName,
      data: dataVals,
      backgroundColor: color,
      borderWidth: 0.5,
      borderColor: '#fff',
      statsMeta: statsMeta,
    };
  });

  c.data.labels = progs;
  c.data.datasets = datasets;
  c.update('none');
}

/* ──────────────────────────────────────────────────────────────────
   9. PROGRAMME BAR — Detailed (Interactive click-to-filter)
─────────────────────────────────────────────────────────────────── */
function initProgBarChart() {
  destroyChart('progBar');
  const ctx = getCanvas('chart-prog-bar');
  if (!ctx) return;

  window._charts.progBar = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const label = window._charts.progBar.data.labels[elements[0].index];
        if (label && typeof window.setFilter === 'function') {
          window.setFilter('prog', label);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` Avg CGPA: ${item.raw.toFixed(3)} — Click to filter`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { min: 0, max: 5, grid: { color: '#F1F5F9' }, title: { display: true, text: 'Mean CGPA', font: { size: 10 } } }
      }
    }
  });
}

function updateProgBarChart(fs) {
  const stats = getProgStats(fs);
  const c = window._charts.progBar;
  if (!c) return;

  c.data.labels = stats.map(s => s.prog);
  c.data.datasets = [{
    label: 'Avg CGPA',
    data: stats.map(s => roundN(s.avg, 3)),
    backgroundColor: stats.map((_, i) => PROG_COLORS[i % PROG_COLORS.length] + 'CC'),
    borderColor:     stats.map((_, i) => PROG_COLORS[i % PROG_COLORS.length]),
    borderWidth: 1,
    borderRadius: 4,
  }];
  c.update('none');

  updateProgTable(fs, stats);
}

function updateProgTable(fs, stats) {
  const tbody = document.getElementById('prog-table-body');
  if (!tbody) return;

  tbody.innerHTML = stats.map(({ prog, avg, n }) => {
    const ss = fs.filter(s => s.prog === prog);
    const l1 = roundN(mean(ss.map(s => s.cgpa100)), 2);
    const l2 = roundN(mean(ss.map(s => s.cgpa200)), 2);
    const l3 = roundN(mean(ss.map(s => s.cgpa300)), 2);
    const l4 = roundN(mean(ss.map(s => s.cgpa400)), 2);
    const tier = getTier(avg);
    return `
      <tr style="cursor:pointer" onclick="setFilter('prog', '${prog}')" title="Click to filter by ${prog}">
        <td><strong>${prog}</strong></td>
        <td>${n}</td>
        <td><strong>${avg.toFixed(2)}</strong></td>
        <td>${l1.toFixed(2)}</td>
        <td>${l2.toFixed(2)}</td>
        <td>${l3.toFixed(2)}</td>
        <td>${l4.toFixed(2)}</td>
        <td><span class="tier-badge tier-${tier.replace(/\s/g,'')}" style="font-size:0.65rem">${tier}</span></td>
      </tr>
    `;
  }).join('');
}

/* ──────────────────────────────────────────────────────────────────
   10. LEVEL TRAJECTORY LINE (Trends)
─────────────────────────────────────────────────────────────────── */
function initTrajectoryChart() {
  destroyChart('traj');
  const ctx = getCanvas('chart-trajectory');
  if (!ctx) return;

  window._charts.traj = new Chart(ctx, {
    type: 'line',
    data: { labels: window.LEVEL_LABELS, datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'right' },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${item.raw.toFixed(3)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { min: 2.5, max: 4.5, grid: { color: '#F1F5F9' }, title: { display: true, text: 'Mean CGPA', font: { size: 10 } } }
      }
    }
  });

  const trajEl = document.getElementById('traj-group-by');
  if (trajEl) {
    trajEl.addEventListener('change', () => {
      updateTrajectoryChart(STATE.filteredStudents);
    });
  }
}

function levelMeans(arr) {
  return window.LEVEL_KEYS.map(k => roundN(mean(arr.map(s => s[k])), 3));
}

function updateTrajectoryChart(fs) {
  const trajEl = document.getElementById('traj-group-by');
  const groupBy = trajEl ? trajEl.value : 'overall';
  const c = window._charts.traj;
  if (!c) return;

  if (groupBy === 'overall') {
    c.data.datasets = [{
      label: 'Filtered cohort',
      data: levelMeans(fs),
      borderColor: PALETTE.blue,
      backgroundColor: PALETTE.blue + '22',
      tension: 0.3,
      fill: true,
      pointRadius: 5,
      pointBackgroundColor: PALETTE.blue,
    }];
  } else if (groupBy === 'gender') {
    const female = fs.filter(s => s.gender === 'Female');
    const male   = fs.filter(s => s.gender === 'Male');
    c.data.datasets = [
      {
        label: 'Female',
        data: levelMeans(female),
        borderColor: PALETTE.blue,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: PALETTE.blue,
      },
      {
        label: 'Male',
        data: levelMeans(male),
        borderColor: PALETTE.amber,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: PALETTE.amber,
      }
    ];
  } else if (groupBy === 'prog') {
    const progs = [...new Set(fs.map(s => s.prog))];
    const top6 = progs.sort((a, b) =>
      fs.filter(s => s.prog === b).length - fs.filter(s => s.prog === a).length
    ).slice(0, 6);
    c.data.datasets = top6.map((p, i) => ({
      label: p,
      data: levelMeans(fs.filter(s => s.prog === p)),
      borderColor: PROG_COLORS[i % PROG_COLORS.length],
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: PROG_COLORS[i % PROG_COLORS.length],
      borderWidth: 2,
    }));
  } else {
    // by year
    const years = [...new Set(fs.map(s => s.yog))].sort();
    c.data.datasets = years.map((y, i) => ({
      label: String(y),
      data: levelMeans(fs.filter(s => s.yog === y)),
      borderColor: PROG_COLORS[i % PROG_COLORS.length],
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: PROG_COLORS[i % PROG_COLORS.length],
      borderWidth: 2,
    }));
  }

  // Overlay selected student trajectory if a student is active
  if (typeof STATE !== 'undefined' && STATE.selectedStudent) {
    const sel = STATE.allStudents.find(
      x => x.id === STATE.selectedStudent.id && x.prog === STATE.selectedStudent.prog
    );
    if (sel) {
      const lkeys = window.LEVEL_KEYS || ['cgpa100', 'cgpa200', 'cgpa300', 'cgpa400'];
      c.data.datasets.push({
        label: `Student ${sel.id} (${sel.prog})`,
        data: lkeys.map(k => sel[k]),
        borderColor: '#D97706',
        backgroundColor: '#D9770622',
        borderWidth: 2.5,
        borderDash: [5, 4],
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#D97706',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        tension: 0.3,
        fill: false,
        order: 0,
      });
    }
  }

  c.update('none');
}

/* ──────────────────────────────────────────────────────────────────
   11. YEAR TREND FULL (Interactive click-to-filter)
─────────────────────────────────────────────────────────────────── */
function initYearFullChart() {
  destroyChart('yearFull');
  const ctx = getCanvas('chart-year-full');
  if (!ctx) return;

  window._charts.yearFull = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const yr = window._charts.yearFull.data.labels[elements[0].index];
        if (yr && typeof window.setFilter === 'function') {
          window.setFilter('year', String(yr));
        }
      },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label: (item) => {
              if (item.dataset.type === 'line') return ` Avg CGPA: ${item.raw.toFixed(3)} — Click to filter`;
              return ` Students: ${item.raw} — Click to filter`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#F1F5F9' }, position: 'left', title: { display: true, text: 'Student count', font: { size: 10 } } },
        y1: {
          grid: { drawOnChartArea: false },
          position: 'right',
          min: 2.5, max: 4.5,
          title: { display: true, text: 'Mean CGPA', font: { size: 10 } }
        }
      }
    }
  });
}

function updateYearFullChart(fs) {
  const groups = {};
  fs.forEach(s => { if (!groups[s.yog]) groups[s.yog] = []; groups[s.yog].push(s.cgpa); });
  const years = Object.keys(groups).sort();
  const counts = years.map(y => groups[y].length);
  const avgs   = years.map(y => roundN(mean(groups[y]), 3));
  const c = window._charts.yearFull;
  if (!c) return;

  c.data.labels = years;
  c.data.datasets = [
    {
      label: 'Student count',
      data: counts,
      backgroundColor: PALETTE.blue + '55',
      borderColor: PALETTE.blue,
      borderWidth: 1,
      borderRadius: 4,
      yAxisID: 'y',
    },
    {
      label: 'Mean CGPA',
      type: 'line',
      data: avgs,
      borderColor: PALETTE.green,
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 5,
      pointBackgroundColor: PALETTE.green,
      borderWidth: 2,
      yAxisID: 'y1',
    }
  ];
  c.update('none');
}

/* Expose */
window.initAllCharts        = initAllCharts;
window.updateAllCharts      = updateAllCharts;
window.updateRadarChart     = updateRadarChart;
window.initGenderAvgChart   = initGenderAvgChart;
window.updateGenderAvgChart = updateGenderAvgChart;
window.initProgStackedChart = initProgStackedChart;
window.updateProgStackedChart = updateProgStackedChart;
window.PROG_COLORS          = PROG_COLORS;
window.TIER_COLORS          = TIER_COLORS;
window.TIER_ORDER           = TIER_ORDER;
window.levelMeans           = levelMeans;
window.setChartEmptyState   = setChartEmptyState;
