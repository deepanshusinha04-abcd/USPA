/**
 * student.js — Student Profile, Comparisons, Insights & Recommendations (Phase 3)
 *
 * Responsibilities:
 *  - Full student profile rendering with duplicate-safe ID + Prog key
 *  - Comparison benchmark selector (My Programme / My Grad Year / All Students)
 *  - Interactive Academic Stage Analysis with Insight Explorer triggering
 *  - Comparison Stage Table with level-by-level gap & interpretation
 *  - Dynamic, strictly data-driven sections:
 *      1. "What the data says" (Objective findings)
 *      2. "What does this mean for me?" (Interpretation)
 *      3. "How can I improve?" (Actionable recommendations)
 *  - Strictly NO unsupported inferences (no subject-level, external, or personal causes)
 */

'use strict';

/* ─── Chart instances ──────────────────────────────────────────────── */
let _studentLevelChart = null;
let _studentCmpChart   = null;

const STUDENT_COLOR = '#D97706'; // amber — individual student
const PEER_COLOR    = '#94A3B8'; // slate — benchmark group

/* ─── Main entry: render full profile ──────────────────────────────── */
function renderStudentProfile(s) {
  if (!s) return;

  // Show profile panel, hide empty state
  const emptyState = document.getElementById('student-empty-state');
  if (emptyState) emptyState.style.display = 'none';

  const panel = document.getElementById('student-profile-panel');
  if (panel) panel.classList.add('visible');

  // Check filter alignment & show notice if applicable
  renderFilterNotice(s);

  // Render components in strict visual hierarchy order
  renderProfileHeader(s);
  renderPerformanceSummary(s);
  renderComparison(s, STATE.comparisonMode);
  initComparisonToggle(s);
  renderStageGrid(s, STATE.comparisonMode);
  renderStudentLevelChart(s);
  renderInsights(s);
  renderTargetGoals(s);
}

/* ─── Update comparison context if global filters change ──────────── */
function updateStudentComparisonContext(s) {
  if (!s) return;
  renderFilterNotice(s);
  renderPerformanceSummary(s);
  renderComparison(s, STATE.comparisonMode);
  renderStageGrid(s, STATE.comparisonMode);
  renderInsights(s);
  renderTargetGoals(s);
}

/* ─── Filter Mismatch Notice ───────────────────────────────────────── */
function renderFilterNotice(s) {
  const el = document.getElementById('student-filter-notice');
  if (!el) return;

  const mismatches = [];
  if (STATE.filters.prog && STATE.filters.prog !== s.prog) {
    mismatches.push(`Programme filter is <strong>${STATE.filters.prog}</strong> (student is <strong>${s.prog}</strong>)`);
  }
  if (STATE.filters.year && STATE.filters.year !== String(s.yog)) {
    mismatches.push(`Graduation Year filter is <strong>${STATE.filters.year}</strong> (student is <strong>${s.yog}</strong>)`);
  }
  if (STATE.filters.gender && STATE.filters.gender !== s.gender) {
    mismatches.push(`Gender filter is <strong>${STATE.filters.gender}</strong> (student is <strong>${s.gender}</strong>)`);
  }
  if (STATE.filters.tier && STATE.filters.tier !== s.tier) {
    mismatches.push(`Category filter is <strong>${STATE.filters.tier}</strong> (student is <strong>${s.tier}</strong>)`);
  }

  if (mismatches.length) {
    el.style.display = 'block';
    el.className = 'student-filter-notice';
    el.innerHTML = `
      <span>ℹ️ Filter Context Notice: ${mismatches.join('; ')}. The profile and benchmarks below use the student's true cohort data.</span>
    `;
  } else {
    el.style.display = 'none';
    el.innerHTML = '';
  }
}

/* ─── Profile Header ────────────────────────────────────────────────── */
function renderProfileHeader(s) {
  const idLabel = document.getElementById('profile-id-label');
  if (idLabel) idLabel.textContent = `Student ID: ${s.id}  (Composite Key: ${s.id} · ${s.prog})`;

  const nameEl = document.getElementById('profile-name');
  if (nameEl) nameEl.textContent = `${s.prog} — Class of ${s.yog}`;

  const metaEl = document.getElementById('profile-meta');
  if (metaEl) {
    metaEl.innerHTML = [
      `<span>Programme: <strong>${s.prog}</strong></span>`,
      `<span>Graduation Year: <strong>${s.yog}</strong></span>`,
      `<span>Gender: <strong>${s.gender}</strong></span>`,
      `<span>Final SGPA: <strong>${s.sgpa.toFixed(2)}</strong></span>`,
    ].join('');
  }

  // Tier badge
  const tierEl = document.getElementById('profile-tier-badge');
  if (tierEl) {
    const cls = s.tier.replace(/\s/g, '');
    tierEl.innerHTML = `
      <span class="tier-badge tier-${cls}">${s.tier}</span>
      <span style="font-size:0.72rem;color:var(--blue-200);margin-left:6px">Dashboard Performance Classification</span>
    `;
  }

  const cgpaEl = document.getElementById('profile-cgpa-big');
  if (cgpaEl) cgpaEl.textContent = s.cgpa.toFixed(2);

  // Overall percentile rank in full dataset
  const sortedAll = window.USPA?.all_cgpas_sorted || [];
  const pct = computePercentile(sortedAll, s.cgpa);
  const pctEl = document.getElementById('profile-percentile-badge');
  if (pctEl) {
    pctEl.innerHTML = `
      <div class="percentile-badge">
        <div class="percentile-number">${pct}<sup style="font-size:0.85rem">th</sup></div>
        <div class="percentile-label">Overall Cohort Percentile</div>
      </div>
    `;
  }
}

/* ─── 1. My Performance Summary Grid (7 Core Metrics) ──────────────── */
function renderPerformanceSummary(s) {
  const container = document.getElementById('student-perf-summary');
  if (!container) return;

  const all = STATE.allStudents;
  const progStudents = all.filter(x => x.prog === s.prog);
  const yearStudents = all.filter(x => x.yog === s.yog);
  const benchmarkGroup = getComparisonGroup(s, STATE.comparisonMode);
  const benchmarkLabel = getComparisonLabel(s, STATE.comparisonMode);

  const overallAvg = mean(all.map(x => x.cgpa));
  const progAvg    = mean(progStudents.map(x => x.cgpa));
  const yearAvg    = mean(yearStudents.map(x => x.cgpa));
  const benchAvg   = mean(benchmarkGroup.map(x => x.cgpa));

  const diffBench  = roundN(s.cgpa - benchAvg, 2);
  const isAboveBench = diffBench >= 0;

  const cats = window.PERFORMANCE_CATEGORIES || [];
  const catObj = cats.find(c => c.name === s.tier) || { name: s.tier, color: '#2563EB', min: 0 };

  container.innerHTML = `
    <div class="summary-tile tile-highlight">
      <div class="st-label">My CGPA</div>
      <div class="st-val" style="color:var(--primary)">${s.cgpa.toFixed(2)}</div>
      <div class="st-sub">Cumulative average</div>
    </div>
    <div class="summary-tile">
      <div class="st-label">My SGPA</div>
      <div class="st-val" style="color:var(--blue-600)">${s.sgpa.toFixed(2)}</div>
      <div class="st-sub">Final semester</div>
    </div>
    <div class="summary-tile">
      <div class="st-label">Overall Average</div>
      <div class="st-val">${overallAvg.toFixed(2)}</div>
      <div class="st-sub">All 3,046 students</div>
    </div>
    <div class="summary-tile">
      <div class="st-label">Programme Avg</div>
      <div class="st-val">${progAvg.toFixed(2)}</div>
      <div class="st-sub">${s.prog} (${progStudents.length} peers)</div>
    </div>
    <div class="summary-tile">
      <div class="st-label">Grad Year Avg</div>
      <div class="st-val">${yearAvg.toFixed(2)}</div>
      <div class="st-sub">Class of ${s.yog} (${yearStudents.length})</div>
    </div>
    <div class="summary-tile">
      <div class="st-label">Benchmark Difference</div>
      <div class="st-val ${isAboveBench ? 'positive' : 'negative'}">
        ${isAboveBench ? '+' : ''}${diffBench.toFixed(2)}
      </div>
      <div class="st-sub">${isAboveBench ? 'Above' : 'Below'} ${benchmarkLabel}</div>
    </div>
    <div class="summary-tile">
      <div class="st-label">Performance Category</div>
      <div class="st-val" style="font-size:1.02rem;color:${catObj.color}">${s.tier}</div>
      <div class="st-sub">Configured Threshold: ≥ ${catObj.min.toFixed(2)}</div>
    </div>
  `;
}

/* ─── Stage Grid & Insight Explorer Hook ────────────────────────────── */
function renderStageGrid(s, mode = 'prog') {
  const group = getComparisonGroup(s, mode);
  const peerLevels = window.LEVEL_KEYS.map(k => roundN(mean(group.map(x => x[k])), 2));

  const stages = [
    { label: 'Level 100', key: 'cgpa100', val: s.cgpa100 },
    { label: 'Level 200', key: 'cgpa200', val: s.cgpa200 },
    { label: 'Level 300', key: 'cgpa300', val: s.cgpa300 },
    { label: 'Level 400', key: 'cgpa400', val: s.cgpa400 },
  ];

  const vals = stages.map(st => st.val).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
  const maxV = vals.length ? Math.max(...vals) : 0;
  const minV = vals.length ? Math.min(...vals) : 0;
  const allEqual = maxV === minV;

  const grid = document.getElementById('stage-grid');
  if (!grid) return;

  grid.innerHTML = stages.map((st, i) => {
    const isBest  = !allEqual && st.val === maxV;
    const isWorst = !allEqual && st.val === minV;
    const cls = isBest ? 'best' : isWorst ? 'worst' : '';
    const tag = isBest
      ? '<span class="stage-tag">Strongest</span>'
      : isWorst
      ? '<span class="stage-tag">Weakest</span>'
      : '';

    // Inter-stage change (Δ)
    let deltaHtml = '';
    if (i > 0) {
      const prevVal = stages[i - 1].val;
      const d = roundN(st.val - prevVal, 2);
      const isPos = d > 0.02;
      const isNeg = d < -0.02;
      const dCls = isPos ? 'delta-pos' : isNeg ? 'delta-neg' : 'delta-neu';
      const dSymbol = isPos ? '▲ +' : isNeg ? '▼ ' : '— ';
      deltaHtml = `<span class="stage-delta-tag ${dCls}">${dSymbol}${Math.abs(d).toFixed(2)} vs L${100 * i}</span>`;
    } else {
      deltaHtml = `<span class="stage-delta-tag delta-neu">Baseline</span>`;
    }

    const peerVal = peerLevels[i] || 0;
    const peerGap = roundN(st.val - peerVal, 2);
    const peerNote = `<div class="stage-peer-note">Peer: ${peerVal.toFixed(2)} (${peerGap >= 0 ? '+' : ''}${peerGap.toFixed(2)})</div>`;

    return `
      <div class="stage-item clickable ${cls}" onclick="handleStageClick(${i})" title="Click to inspect Level ${100 * (i + 1)} in Insight Explorer">
        ${tag}
        <div class="stage-label">${st.label}</div>
        <div class="stage-val">${st.val.toFixed(2)}</div>
        ${deltaHtml}
        ${peerNote}
      </div>
    `;
  }).join('');
}

/* Stage click handler */
function handleStageClick(stageIdx) {
  if (!STATE.selectedStudent) return;
  const s = STATE.allStudents.find(
    x => x.id === STATE.selectedStudent.id && x.prog === STATE.selectedStudent.prog
  );
  if (!s) return;

  const group = getComparisonGroup(s, STATE.comparisonMode);
  const label = getComparisonLabel(s, STATE.comparisonMode);

  if (typeof window.showStageInsight === 'function') {
    window.showStageInsight(s, stageIdx, group, label);
  }
}

/* ─── Individual Level Chart ────────────────────────────────────────── */
function renderStudentLevelChart(s) {
  if (_studentLevelChart) {
    _studentLevelChart.destroy();
    _studentLevelChart = null;
  }

  const canvas = document.getElementById('chart-student-level');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const vals = window.LEVEL_KEYS.map(k => s[k]);

  const cats = window.PERFORMANCE_CATEGORIES || [];
  const barColors = vals.map(v => {
    const cat = cats.find(c => v >= c.min) || cats[cats.length - 1];
    return cat ? cat.color : '#2563EB';
  });

  _studentLevelChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: window.LEVEL_LABELS,
      datasets: [{
        label: 'Student CGPA',
        data: vals,
        backgroundColor: barColors.map(c => c + 'CC'),
        borderColor: barColors,
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (evt, elements) => {
        if (elements.length) {
          handleStageClick(elements[0].index);
        }
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.label}: ${item.raw.toFixed(2)} — Click to explore stage`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0, max: 5.2,
          grid: { color: '#F1F5F9' },
          title: { display: true, text: 'CGPA', font: { size: 10 } }
        }
      }
    }
  });
}

/* ─── Comparison Mode Toggle ────────────────────────────────────────── */
function initComparisonToggle(s) {
  const container = document.getElementById('cmp-toggle');
  if (!container) return;

  container.querySelectorAll('.cmp-btn').forEach(btn => {
    btn.onclick = () => {
      container.querySelectorAll('.cmp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.comparisonMode = btn.dataset.cmp;
      renderComparison(s, STATE.comparisonMode);
      renderPerformanceSummary(s);
      renderStageGrid(s, STATE.comparisonMode);
      renderTargetGoals(s);
    };
  });
}

/* ─── Comparison Helpers ────────────────────────────────────────────── */
function getComparisonGroup(s, mode) {
  const all = STATE.allStudents;
  if (mode === 'prog') return all.filter(x => x.prog === s.prog);
  if (mode === 'year') return all.filter(x => x.yog === s.yog);
  return all;
}

function getComparisonLabel(s, mode) {
  if (mode === 'prog') return `${s.prog} programme peers`;
  if (mode === 'year') return `${s.yog} graduates`;
  return 'all students';
}

/* ─── Render Comparison ─────────────────────────────────────────────── */
function renderComparison(s, mode) {
  const group = getComparisonGroup(s, mode);
  const label = getComparisonLabel(s, mode);

  const peerLevels = window.LEVEL_KEYS.map(k => roundN(mean(group.map(x => x[k])), 3));
  const myLevels   = window.LEVEL_KEYS.map(k => s[k]);

  renderComparisonChart(myLevels, peerLevels, label);
  renderComparisonStageTable(s, peerLevels, label);
  renderGapDisplay(s, group, label);
  renderSGPADisplay(s, group, label);
  renderPercentileDisplay(s, group, mode, label);
}

/* Comparison Line Chart */
function renderComparisonChart(myLevels, peerLevels, peerLabel) {
  if (_studentCmpChart) {
    _studentCmpChart.destroy();
    _studentCmpChart = null;
  }

  const canvas = document.getElementById('chart-student-cmp');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  _studentCmpChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: window.LEVEL_LABELS,
      datasets: [
        {
          label: 'This student',
          data: myLevels,
          borderColor: STUDENT_COLOR,
          backgroundColor: STUDENT_COLOR + '22',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: STUDENT_COLOR,
          borderWidth: 2.5,
        },
        {
          label: `Peer mean (${peerLabel})`,
          data: peerLevels,
          borderColor: PEER_COLOR,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: PEER_COLOR,
          borderWidth: 1.5,
          borderDash: [5, 4],
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${item.raw.toFixed(3)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 1, max: 5.2,
          grid: { color: '#F1F5F9' },
          title: { display: true, text: 'CGPA', font: { size: 10 } }
        }
      }
    }
  });
}

/* Comparison Stage Table */
function renderComparisonStageTable(s, peerLevels, label) {
  const container = document.getElementById('cmp-stage-table-container');
  if (!container) return;

  const rows = window.LEVEL_KEYS.map((k, i) => {
    const studentVal = s[k];
    const peerVal = peerLevels[i];
    const gap = roundN(studentVal - peerVal, 2);
    const isAbove = gap >= 0;
    const gapCls = Math.abs(gap) < 0.05 ? 'gap-neutral' : isAbove ? 'gap-positive' : 'gap-negative';
    const interp = Math.abs(gap) < 0.05
      ? 'Equal to group mean'
      : isAbove
      ? `+${gap.toFixed(2)} above mean`
      : `${gap.toFixed(2)} below mean`;

    return `
      <tr style="cursor:pointer" onclick="handleStageClick(${i})" title="Click to view Level ${100*(i+1)} in Insight Explorer">
        <td>${window.LEVEL_LABELS[i]}</td>
        <td><strong>${studentVal.toFixed(2)}</strong></td>
        <td>${peerVal.toFixed(2)}</td>
        <td class="${gapCls}">${isAbove ? '+' : ''}${gap.toFixed(2)}</td>
        <td style="font-size:0.72rem">${interp}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="cmp-stage-table">
      <thead>
        <tr>
          <th>Academic Level</th>
          <th>Student</th>
          <th>Benchmark</th>
          <th>Gap</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/* Performance Gap Display */
function renderGapDisplay(s, group, label) {
  const peerAvg = mean(group.map(x => x.cgpa));
  const gap     = roundN(s.cgpa - peerAvg, 2);
  const isAbove = gap >= 0;
  const isNear  = Math.abs(gap) < 0.05;
  const el      = document.getElementById('perf-gap-display');
  if (!el) return;

  const statusText = isNear
    ? 'Near benchmark average'
    : isAbove
    ? 'Above benchmark average'
    : 'Below benchmark average';

  const friendlyDesc = isNear
    ? `Your CGPA of <strong>${s.cgpa.toFixed(2)}</strong> is right on par with the ${label} average (<strong>${peerAvg.toFixed(2)}</strong>).`
    : isAbove
    ? `Your CGPA is <strong>${gap.toFixed(2)} points above</strong> the ${label} average (<strong>${peerAvg.toFixed(2)}</strong>).`
    : `Your CGPA is <strong>${Math.abs(gap).toFixed(2)} points below</strong> the ${label} average (<strong>${peerAvg.toFixed(2)}</strong>).`;

  el.innerHTML = `
    <div class="gap-indicator">
      <div class="gap-val ${isAbove ? 'above' : 'below'}">
        ${isAbove ? '+' : ''}${gap.toFixed(2)}
      </div>
      <div class="gap-desc">
        <strong>${statusText}</strong><br>
        ${friendlyDesc}
      </div>
    </div>
    <div class="perf-bar-wrap" style="margin-top:10px">
      <div class="perf-bar-track">
        <div class="perf-bar-fill"
             style="width:${Math.min((s.cgpa/5)*100, 100)}%;
                    background:${isAbove ? 'var(--green-500)' : 'var(--amber-500)'}">
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-muted);margin-top:2px">
        <span>0.00</span><span>CGPA: ${s.cgpa.toFixed(2)}</span><span>5.00 Scale</span>
      </div>
    </div>
  `;
}

/* SGPA Display */
function renderSGPADisplay(s, group, label) {
  const peerSgpa = roundN(mean(group.map(x => x.sgpa)), 2);
  const diff     = roundN(s.sgpa - s.cgpa, 2);
  const trend    = diff > 0.05 ? '📈 Upward' : diff < -0.05 ? '📉 Downward' : '➡️ Stable';
  const trendCol = diff > 0.05 ? 'var(--green-700)' : diff < -0.05 ? 'var(--red-700)' : 'var(--slate-600)';
  const el       = document.getElementById('sgpa-display');
  if (!el) return;

  el.innerHTML = `
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:1.85rem;font-weight:900;color:var(--blue-600)">${s.sgpa.toFixed(2)}</div>
      <div style="font-size:0.72rem;color:var(--text-muted)">Final Semester SGPA</div>
    </div>
    <div class="stat-row">
      <span class="label">Shift vs Cumulative CGPA</span>
      <span class="value ${diff >= 0 ? 'positive' : 'negative'}">${diff >= 0 ? '+' : ''}${diff.toFixed(2)}</span>
    </div>
    <div class="stat-row">
      <span class="label">Benchmark Mean SGPA</span>
      <span class="value">${peerSgpa.toFixed(2)}</span>
    </div>
    <div class="stat-row">
      <span class="label">Recent Momentum</span>
      <span style="font-weight:700;color:${trendCol}">${trend}</span>
    </div>
  `;
}

/* Percentile Display (with sample size validity safeguard) */
function renderPercentileDisplay(s, group, mode, label) {
  const container = document.getElementById('percentile-display');
  if (!container) return;

  let sortedArr;
  if (mode === 'prog' && window.USPA?.prog_cgpas_sorted?.[s.prog]) {
    sortedArr = window.USPA.prog_cgpas_sorted[s.prog];
  } else if (mode === 'year' && window.USPA?.year_cgpas_sorted?.[String(s.yog)]) {
    sortedArr = window.USPA.year_cgpas_sorted[String(s.yog)];
  } else {
    sortedArr = window.USPA?.all_cgpas_sorted || group.map(x => x.cgpa).sort((a,b)=>a-b);
  }

  const n = sortedArr.length;

  // Mathematically valid condition: require n >= 5
  if (n < 5) {
    container.innerHTML = `
      <div style="text-align:center;padding:12px 0;color:var(--text-muted);font-size:0.78rem">
        Sample size too small (n = ${n}) to compute a statistically reliable percentile rank.
      </div>
    `;
    return;
  }

  const pct = computePercentile(sortedArr, s.cgpa);
  const col = pct >= 75 ? 'var(--green-600)' : pct >= 50 ? 'var(--blue-600)' : pct >= 25 ? 'var(--amber-600)' : 'var(--red-600)';

  container.innerHTML = `
    <div style="text-align:center">
      <div class="percentile-badge" style="background:${col}">
        <div class="percentile-number">${pct}<sup style="font-size:0.85rem">th</sup></div>
        <div class="percentile-label">Among ${label}</div>
      </div>
      <div style="margin-top:8px;font-size:0.75rem;color:var(--text-secondary);line-height:1.4">
        You scored equal to or higher than <strong>${pct}%</strong> of peers in ${label} (cohort of ${n} students).<br>
        <span style="font-size:0.68rem;color:var(--text-muted)">(This reflects your position in the cohort distribution, not an exact rank.)</span>
      </div>
    </div>
  `;
}

/* ─── Dynamic Insights (DATA → FINDING → EXPLANATION → ACTION) ─────── */
function renderInsights(s) {
  renderMeaningInsight(s);
  renderImprovementInsight(s);
}

function renderMeaningInsight(s) {
  const container = document.getElementById('insight-meaning-box');
  if (!container) return;

  const levels = window.LEVEL_KEYS.map(k => s[k]).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
  const maxV = levels.length ? Math.max(...levels) : s.cgpa;
  const minV = levels.length ? Math.min(...levels) : s.cgpa;
  const bestIdx = levels.indexOf(maxV);
  const worstIdx = levels.indexOf(minV);
  const allEqual = maxV === minV;

  const allStudents = STATE.allStudents;
  const progStudents = allStudents.filter(x => x.prog === s.prog);
  const yearStudents = allStudents.filter(x => x.yog === s.yog);

  const progMean  = mean(progStudents.map(x => x.cgpa));
  const yearMean  = mean(yearStudents.map(x => x.cgpa));
  const totalMean = mean(allStudents.map(x => x.cgpa));

  const gapProg  = roundN(s.cgpa - progMean, 2);
  const gapYear  = roundN(s.cgpa - yearMean, 2);
  const gapTotal = roundN(s.cgpa - totalMean, 2);
  const sgpaShift = roundN(s.sgpa - s.cgpa, 2);

  const matchedCat = (window.PERFORMANCE_CATEGORIES || []).find(c => c.name === s.tier);
  const tierDescription = matchedCat ? matchedCat.description : '';

  // Inter-stage deltas
  const delta12 = roundN(s.cgpa200 - s.cgpa100, 2);
  const delta23 = roundN(s.cgpa300 - s.cgpa200, 2);
  const delta34 = roundN(s.cgpa400 - s.cgpa300, 2);

  container.innerHTML = `
    <div class="dynamic-insight-section">
      <div class="di-title">
        <span class="di-icon">📊</span>
        <span>What the data says &amp; What it means for you</span>
      </div>
      <div class="di-body">
        <p>${tierDescription}</p>
        <hr class="di-separator">
        <p>
          <strong>Academic Benchmarks:</strong> Your CGPA of <strong>${s.cgpa.toFixed(2)}</strong> is
          <strong>${gapProg >= 0 ? '+' + gapProg.toFixed(2) + ' points above' : Math.abs(gapProg).toFixed(2) + ' points below'}</strong>
          your programme average (<strong>${progMean.toFixed(2)}</strong> in ${s.prog}),
          <strong>${gapYear >= 0 ? '+' + gapYear.toFixed(2) + ' points above' : Math.abs(gapYear).toFixed(2) + ' points below'}</strong>
          your graduating class average (<strong>${yearMean.toFixed(2)}</strong> in ${s.yog}), and
          <strong>${gapTotal >= 0 ? '+' + gapTotal.toFixed(2) + ' points above' : Math.abs(gapTotal).toFixed(2) + ' points below'}</strong>
          the university-wide average (<strong>${totalMean.toFixed(2)}</strong>).
        </p>
        ${!allEqual ? `
          <p>
            <strong>Stage Trajectory:</strong> Your peak performance occurred at
            <strong>${window.LEVEL_LABELS[bestIdx]}</strong> (${maxV.toFixed(2)}), while your most challenging level was
            <strong>${window.LEVEL_LABELS[worstIdx]}</strong> (${minV.toFixed(2)}), an inter-stage variation of
            <strong>${roundN(maxV - minV, 2).toFixed(2)}</strong> grade points.
            Transitions: Level 100 → 200: <strong>${delta12 >= 0 ? '+' : ''}${delta12.toFixed(2)}</strong>;
            Level 200 → 300: <strong>${delta23 >= 0 ? '+' : ''}${delta23.toFixed(2)}</strong>;
            Level 300 → 400: <strong>${delta34 >= 0 ? '+' : ''}${delta34.toFixed(2)}</strong>.
          </p>
        ` : '<p><strong>Stage Consistency:</strong> Your performance across all four academic levels was identical, exhibiting notable consistency.</p>'}
        <p>
          <strong>Final Semester Dynamic:</strong> Your final semester SGPA was <strong>${s.sgpa.toFixed(2)}</strong>, which is
          ${sgpaShift > 0.05
            ? `<strong style="color:var(--green-700)">+${sgpaShift.toFixed(2)} points higher</strong> than your cumulative average, demonstrating positive momentum in your final assessments.`
            : sgpaShift < -0.05
            ? `<strong style="color:var(--red-700)">${Math.abs(sgpaShift).toFixed(2)} points lower</strong> than your cumulative average, suggesting increased challenge in final-stage requirements.`
            : `virtually identical to your cumulative average, demonstrating stable continuous performance.`}
        </p>
      </div>
    </div>
  `;
}

/* ─── 5. Realistic Performance Targets & Goals ─────────────────────── */
function renderTargetGoals(s) {
  const container = document.getElementById('student-goals-box');
  if (!container) return;

  const all = STATE.allStudents;
  const progStudents = all.filter(x => x.prog === s.prog);
  const progAvg = roundN(mean(progStudents.map(x => x.cgpa)), 2);

  const cats = window.PERFORMANCE_CATEGORIES || [
    { name: 'Distinction',  min: 4.50 },
    { name: 'Upper Credit', min: 4.00 },
    { name: 'Lower Credit', min: 3.50 },
    { name: 'Merit',        min: 3.00 },
    { name: 'Pass',         min: 2.50 },
    { name: 'Below Pass',   min: 0.00 },
  ];

  // Current category
  const curCatIdx = cats.findIndex(c => c.name === s.tier);
  const isTopCat = curCatIdx === 0;
  const nextCat = !isTopCat && curCatIdx > 0 ? cats[curCatIdx - 1] : null;

  // Selected benchmark
  const benchmarkGroup = getComparisonGroup(s, STATE.comparisonMode);
  const benchmarkLabel = getComparisonLabel(s, STATE.comparisonMode);
  const benchmarkAvg   = roundN(mean(benchmarkGroup.map(x => x.cgpa)), 2);

  // 1. Next Category Goal
  let nextCatCard = '';
  if (isTopCat) {
    nextCatCard = `
      <div class="goal-card">
        <div>
          <div class="goal-card-header">
            <span class="goal-metric-title">Performance Category Milestone</span>
            <span class="goal-badge goal-badge-done">Distinction</span>
          </div>
          <div class="goal-val-wrap">
            <span class="goal-target-val">≥ 4.50</span>
            <span class="goal-gap-val" style="color:var(--green-700)">Top Category Attained</span>
          </div>
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width:100%;background:var(--green-600)"></div>
          </div>
          <div class="goal-footer-text">
            Your CGPA of <strong>${s.cgpa.toFixed(2)}</strong> places you in the highest dashboard performance category (Distinction). Focus is on academic consistency across continuing evaluations.
          </div>
        </div>
      </div>
    `;
  } else if (nextCat) {
    const gapToNext = roundN(nextCat.min - s.cgpa, 2);
    const prevMin = cats[curCatIdx].min;
    const catRange = nextCat.min - prevMin || 0.5;
    const progPct = Math.max(5, Math.min(100, Math.round(((s.cgpa - prevMin) / catRange) * 100)));
    nextCatCard = `
      <div class="goal-card">
        <div>
          <div class="goal-card-header">
            <span class="goal-metric-title">Next Category Milestone</span>
            <span class="goal-badge goal-badge-reach">${nextCat.name}</span>
          </div>
          <div class="goal-val-wrap">
            <span class="goal-target-val">${nextCat.min.toFixed(2)}</span>
            <span class="goal-gap-val" style="color:var(--amber-700)">+${gapToNext.toFixed(2)} grade points needed</span>
          </div>
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width:${progPct}%;background:var(--amber-500)"></div>
          </div>
          <div class="goal-footer-text">
            Advancing from <strong>${s.tier}</strong> to <strong>${nextCat.name}</strong> requires an overall CGPA of <strong>${nextCat.min.toFixed(2)}</strong> (+${gapToNext.toFixed(2)} points).
          </div>
        </div>
      </div>
    `;
  }

  // 2. Programme Parity Goal
  const progGap = roundN(s.cgpa - progAvg, 2);
  const isAboveProg = progGap >= 0;
  const progPct = Math.min(100, Math.round((s.cgpa / 5) * 100));
  const progCard = `
    <div class="goal-card">
      <div>
        <div class="goal-card-header">
          <span class="goal-metric-title">${s.prog} Programme Benchmark</span>
          <span class="goal-badge ${isAboveProg ? 'goal-badge-done' : 'goal-badge-target'}">
            ${isAboveProg ? 'Above Average' : 'Department Target'}
          </span>
        </div>
        <div class="goal-val-wrap">
          <span class="goal-target-val">${progAvg.toFixed(2)}</span>
          <span class="goal-gap-val" style="color:${isAboveProg ? 'var(--green-700)' : 'var(--amber-700)'}">
            ${isAboveProg ? `+${progGap.toFixed(2)} above average` : `${Math.abs(progGap).toFixed(2)} below average`}
          </span>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width:${progPct}%;background:${isAboveProg ? 'var(--green-600)' : 'var(--primary)'}"></div>
        </div>
        <div class="goal-footer-text">
          ${isAboveProg
            ? `Your CGPA is <strong>${progGap.toFixed(2)} points above</strong> your ${s.prog} programme peers (average: ${progAvg.toFixed(2)}).`
            : `Your CGPA is <strong>${Math.abs(progGap).toFixed(2)} points below</strong> your ${s.prog} programme peers (average: ${progAvg.toFixed(2)}). Reaching parity is a clear milestone.`}
        </div>
      </div>
    </div>
  `;

  // 3. Active Benchmark Goal
  const benchGap = roundN(s.cgpa - benchmarkAvg, 2);
  const isAboveBench = benchGap >= 0;
  const benchCard = `
    <div class="goal-card">
      <div>
        <div class="goal-card-header">
          <span class="goal-metric-title">Active Benchmark Target</span>
          <span class="goal-badge ${isAboveBench ? 'goal-badge-done' : 'goal-badge-target'}">
            ${isAboveBench ? 'Exceeding' : 'Target'}
          </span>
        </div>
        <div class="goal-val-wrap">
          <span class="goal-target-val">${benchmarkAvg.toFixed(2)}</span>
          <span class="goal-gap-val" style="color:${isAboveBench ? 'var(--green-700)' : 'var(--blue-700)'}">
            ${isAboveBench ? `+${benchGap.toFixed(2)} above` : `${Math.abs(benchGap).toFixed(2)} below`}
          </span>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width:${Math.min(100, Math.round((s.cgpa/5)*100))}%;background:${isAboveBench ? 'var(--green-600)' : 'var(--blue-500)'}"></div>
        </div>
        <div class="goal-footer-text">
          Comparing against <strong>${benchmarkLabel}</strong> (average: ${benchmarkAvg.toFixed(2)}).
          ${isAboveBench
            ? 'You are performing ahead of this peer group.'
            : `A gain of ${Math.abs(benchGap).toFixed(2)} points aligns your standing with this group's mean.`}
        </div>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="goal-container">
      <div class="goal-header">
        <div>
          <div class="goal-title">Realistic Performance Targets &amp; Goal Pathways</div>
          <div class="goal-desc">Concrete performance targets based on departmental averages, active peer benchmarks, and configured category thresholds.</div>
        </div>
      </div>
      <div class="goal-grid">
        ${nextCatCard}
        ${progCard}
        ${benchCard}
      </div>
      <div class="goal-disclaimer">
        ℹ️ <strong>Academic Target Guidance:</strong> Performance targets are numerical reference benchmarks computed from cohort distribution data. Academic results are evaluated solely through coursework and examination assessments; target attainment describes academic attainment and does not imply or guarantee specific external outcomes.
      </div>
    </div>
  `;
}

/* ─── 6. Actionable Improvement Recommendations (Phase 6 Engine) ──── */
function renderImprovementInsight(s) {
  const container = document.getElementById('insight-improve-box');
  if (!container) return;

  const allStudents = STATE.allStudents;
  const progStudents = allStudents.filter(x => x.prog === s.prog);
  const progLevels = window.LEVEL_KEYS.map(k => roundN(mean(progStudents.map(x => x[k])), 2));
  const progMean = roundN(mean(progStudents.map(x => x.cgpa)), 2);

  const benchmarkGroup = getComparisonGroup(s, STATE.comparisonMode);
  const benchmarkLabel = getComparisonLabel(s, STATE.comparisonMode);
  const benchmarkMean = roundN(mean(benchmarkGroup.map(x => x.cgpa)), 2);

  const levels = window.LEVEL_KEYS.map(k => s[k]).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
  const minV = levels.length ? Math.min(...levels) : s.cgpa;
  const maxV = levels.length ? Math.max(...levels) : s.cgpa;
  const worstIdx = levels.indexOf(minV);
  const bestIdx = levels.indexOf(maxV);

  const levelGaps = window.LEVEL_KEYS.map((k, i) => roundN(s[k] - progLevels[i], 2));
  const largestGapIdx = levelGaps.indexOf(Math.min(...levelGaps));
  const minGapVal = levelGaps[largestGapIdx];

  const sgpaShift = roundN(s.sgpa - s.cgpa, 2);
  const sortedAll = window.USPA?.all_cgpas_sorted || [];
  const pct = computePercentile(sortedAll, s.cgpa);

  const cats = window.PERFORMANCE_CATEGORIES || [
    { name: 'Distinction',  min: 4.50 },
    { name: 'Upper Credit', min: 4.00 },
    { name: 'Lower Credit', min: 3.50 },
    { name: 'Merit',        min: 3.00 },
    { name: 'Pass',         min: 2.50 },
    { name: 'Below Pass',   min: 0.00 },
  ];
  const curCatIdx = cats.findIndex(c => c.name === s.tier);
  const isTopCat = curCatIdx === 0;
  const nextCat = !isTopCat && curCatIdx > 0 ? cats[curCatIdx - 1] : null;

  // Potential candidates pool
  const candidates = [];

  // Candidate 1: Largest stage-level gap vs programme peers
  if (minGapVal < -0.15) {
    const stageKey = window.LEVEL_KEYS[largestGapIdx];
    const stageLabel = window.LEVEL_LABELS[largestGapIdx];
    const peerStageVal = progLevels[largestGapIdx];
    const myStageVal = s[stageKey];
    const gapAbs = Math.abs(minGapVal).toFixed(2);
    const prio = minGapVal < -0.30 ? 'high' : 'medium';

    candidates.push({
      priority: prio,
      score: prio === 'high' ? 90 + Math.abs(minGapVal) * 10 : 60 + Math.abs(minGapVal) * 10,
      type: 'stage_peer_gap',
      icon: '🔍',
      title: `Close the ${gapAbs}-point gap at ${stageLabel}`,
      why: `Your ${stageLabel} CGPA (${myStageVal.toFixed(2)}) is ${gapAbs} points below your ${s.prog} programme peer average (${peerStageVal.toFixed(2)}). This is your largest stage-level disparity relative to departmental peers.`,
      chips: [
        { label: `${stageLabel} CGPA`, val: myStageVal.toFixed(2) },
        { label: `${s.prog} Mean`, val: peerStageVal.toFixed(2) },
        { label: 'Peer Gap', val: `${minGapVal.toFixed(2)} pts`, isGap: true, isNeg: true },
      ],
      action: `Consulting departmental course tutors and faculty advisors for core competencies in ${stageLabel}, combined with focused study groups, will address the observed performance disparity and elevate your cumulative GPA.`,
      target: {
        type: `Programme Parity (${stageLabel})`,
        val: peerStageVal.toFixed(2),
        gap: `+${gapAbs} grade points`,
      },
    });
  }

  // Candidate 2: Lowest academic stage consolidation
  if (minV < 4.20 && (maxV - minV >= 0.20 || minV < 3.20)) {
    const worstStageLabel = window.LEVEL_LABELS[worstIdx];
    const gapToBest = roundN(maxV - minV, 2);
    const prio = minV < 2.80 ? 'high' : 'medium';

    candidates.push({
      priority: prio,
      score: prio === 'high' ? 85 + (3.0 - minV) * 10 : 55 + gapToBest * 5,
      type: 'stage_weakness',
      icon: '🎯',
      title: `Consolidate effort on ${worstStageLabel} academic stage`,
      why: `Your evaluation at ${worstStageLabel} (${minV.toFixed(2)}) represents your lowest stage across all levels, falling ${gapToBest.toFixed(2)} points below your peak stage (${window.LEVEL_LABELS[bestIdx]}: ${maxV.toFixed(2)}).`,
      chips: [
        { label: `${worstStageLabel} CGPA`, val: minV.toFixed(2) },
        { label: `Peak (${window.LEVEL_LABELS[bestIdx]})`, val: maxV.toFixed(2) },
        { label: 'Internal Spread', val: `-${gapToBest.toFixed(2)} pts`, isGap: true, isNeg: true },
      ],
      action: `Because each stage contributes equally to your overall average, targeted revision and academic advising on concepts evaluated during ${worstStageLabel} provide high leverage for cumulative standing.`,
      target: {
        type: 'Internal Stage Balance',
        val: maxV.toFixed(2),
        gap: `+${gapToBest.toFixed(2)} grade points`,
      },
    });
  }

  // Candidate 3: Final semester SGPA deceleration
  if (sgpaShift < -0.15) {
    const shiftAbs = Math.abs(sgpaShift).toFixed(2);
    const prio = sgpaShift < -0.30 ? 'high' : 'medium';

    candidates.push({
      priority: prio,
      score: prio === 'high' ? 88 + Math.abs(sgpaShift) * 10 : 58 + Math.abs(sgpaShift) * 10,
      type: 'sgpa_decel',
      icon: '⚠️',
      title: 'Address final semester SGPA deceleration',
      why: `Your final semester SGPA (${s.sgpa.toFixed(2)}) dropped by ${shiftAbs} points relative to your cumulative CGPA (${s.cgpa.toFixed(2)}), reflecting lower performance in senior-stage coursework.`,
      chips: [
        { label: 'Final SGPA', val: s.sgpa.toFixed(2) },
        { label: 'Cumulative CGPA', val: s.cgpa.toFixed(2) },
        { label: 'Momentum Shift', val: `${sgpaShift.toFixed(2)} pts`, isGap: true, isNeg: true },
      ],
      action: `Prioritize early assessment checkpoints, structured review schedules, and direct instructor consultations during final semesters to counteract senior-stage grade drops.`,
      target: {
        type: 'SGPA-CGPA Equilibrium',
        val: s.cgpa.toFixed(2),
        gap: `+${shiftAbs} grade points`,
      },
    });
  }

  // Candidate 4: Next Performance Category Milestone
  if (nextCat) {
    const gapToNext = roundN(nextCat.min - s.cgpa, 2);
    const prio = gapToNext <= 0.35 ? 'medium' : 'low';

    candidates.push({
      priority: prio,
      score: prio === 'medium' ? 70 - gapToNext * 20 : 40 - gapToNext * 10,
      type: 'category_reach',
      icon: '🏆',
      title: `Target Next Performance Category: ${nextCat.name}`,
      why: `Your cumulative CGPA (${s.cgpa.toFixed(2)}) is within ${gapToNext.toFixed(2)} grade points of the configured threshold for ${nextCat.name} (≥ ${nextCat.min.toFixed(2)}).`,
      chips: [
        { label: 'Current CGPA', val: s.cgpa.toFixed(2) },
        { label: `${nextCat.name} Min`, val: nextCat.min.toFixed(2) },
        { label: 'Category Gap', val: `+${gapToNext.toFixed(2)} pts`, isGap: true, isNeg: false },
      ],
      action: `Breaking down this ${gapToNext.toFixed(2)}-point requirement across future course modules with milestone checkpoints creates a clear, attainable path to the next category boundary.`,
      target: {
        type: `Dashboard Category (${nextCat.name})`,
        val: nextCat.min.toFixed(2),
        gap: `+${gapToNext.toFixed(2)} grade points`,
      },
    });
  }

  // Candidate 5: Programme Average Parity
  const progGap = roundN(s.cgpa - progMean, 2);
  if (progGap < -0.10) {
    const gapAbs = Math.abs(progGap).toFixed(2);
    candidates.push({
      priority: 'medium',
      score: 65 + Math.abs(progGap) * 10,
      type: 'prog_parity',
      icon: '📊',
      title: `Achieve parity with ${s.prog} programme average`,
      why: `Your CGPA (${s.cgpa.toFixed(2)}) is ${gapAbs} points below your programme peers (mean: ${progMean.toFixed(2)} across ${progStudents.length} students).`,
      chips: [
        { label: 'My CGPA', val: s.cgpa.toFixed(2) },
        { label: `${s.prog} Mean`, val: progMean.toFixed(2) },
        { label: 'Cohort Gap', val: `${progGap.toFixed(2)} pts`, isGap: true, isNeg: true },
      ],
      action: `Leverage programme-specific peer study sessions, department review workshops, and academic mentoring to reach departmental benchmark parity.`,
      target: {
        type: `Programme Average (${s.prog})`,
        val: progMean.toFixed(2),
        gap: `+${gapAbs} grade points`,
      },
    });
  }

  // Candidate 6: Active Benchmark Parity (if different from programme)
  const benchGap = roundN(s.cgpa - benchmarkMean, 2);
  if (benchGap < -0.15 && STATE.comparisonMode !== 'prog') {
    const gapAbs = Math.abs(benchGap).toFixed(2);
    candidates.push({
      priority: 'medium',
      score: 50 + Math.abs(benchGap) * 5,
      type: 'bench_parity',
      icon: '👥',
      title: `Align with ${benchmarkLabel} benchmark mean`,
      why: `Your CGPA (${s.cgpa.toFixed(2)}) trails the active ${benchmarkLabel} mean (${benchmarkMean.toFixed(2)}) by ${gapAbs} grade points.`,
      chips: [
        { label: 'My CGPA', val: s.cgpa.toFixed(2) },
        { label: `${benchmarkLabel} Mean`, val: benchmarkMean.toFixed(2) },
        { label: 'Benchmark Gap', val: `${benchGap.toFixed(2)} pts`, isGap: true, isNeg: true },
      ],
      action: `Monitoring academic trajectories against this broader benchmark cohort helps calibrate study pacing and assessment preparation.`,
      target: {
        type: `Active Benchmark (${benchmarkLabel})`,
        val: benchmarkMean.toFixed(2),
        gap: `+${gapAbs} grade points`,
      },
    });
  }

  // Candidate 7: SGPA Positive Momentum Maintenance (Low priority / Maintenance)
  if (sgpaShift > 0.15) {
    candidates.push({
      priority: 'low',
      score: 35 + sgpaShift * 10,
      type: 'sgpa_accel',
      icon: '🚀',
      title: 'Maintain positive final-semester trajectory',
      why: `Your final semester SGPA (${s.sgpa.toFixed(2)}) exceeded your cumulative CGPA (${s.cgpa.toFixed(2)}) by +${sgpaShift.toFixed(2)} grade points, indicating an accelerating academic finish.`,
      chips: [
        { label: 'Final SGPA', val: s.sgpa.toFixed(2) },
        { label: 'Cumulative CGPA', val: s.cgpa.toFixed(2) },
        { label: 'Momentum Gain', val: `+${sgpaShift.toFixed(2)} pts`, isGap: true, isNeg: false },
      ],
      action: `Carry forward the study routines, revision strategies, and time allocation methods from your final semester into ongoing or future academic milestones.`,
      target: {
        type: 'Maintain Final Momentum',
        val: s.sgpa.toFixed(2),
        gap: 'Sustain current pace',
      },
    });
  }

  // Candidate 8: High Performer / Distinction Academic Consistency (Low priority)
  if (isTopCat || s.cgpa >= 4.30) {
    candidates.push({
      priority: 'low',
      score: 30,
      type: 'high_perf_consist',
      icon: '⭐',
      title: 'Preserve top-tier performance consistency',
      why: `Your CGPA of ${s.cgpa.toFixed(2)} places you in the top category tier (${s.tier}). Maintaining this standing requires minimizing stage-to-stage volatility.`,
      chips: [
        { label: 'My CGPA', val: s.cgpa.toFixed(2) },
        { label: 'Category', val: s.tier },
        { label: 'Percentile', val: `${pct}th` },
      ],
      action: `Maintain rigorous coursework preparation, participate in advanced peer mentoring or research initiatives, and sustain steady continuous evaluation performance.`,
      target: {
        type: 'Category Maintenance',
        val: '≥ 4.50',
        gap: 'Maintain current standard',
      },
    });
  }

  // Candidate 9: Cohort Percentile Progression
  if (pct < 50) {
    const medCGPA = 3.54;
    const gapToMed = roundN(medCGPA - s.cgpa, 2);
    candidates.push({
      priority: 'medium',
      score: 52,
      type: 'pct_median',
      icon: '📈',
      title: 'Target cohort median (50th percentile) milestone',
      why: `Positioned at the ${pct}th percentile, closing the gap to the cohort median (~3.54 CGPA) requires a +${gapToMed.toFixed(2)} grade point increase.`,
      chips: [
        { label: 'My Percentile', val: `${pct}th` },
        { label: 'Cohort Median', val: `${medCGPA.toFixed(2)}` },
        { label: 'Required Gain', val: `+${gapToMed.toFixed(2)} pts`, isGap: true, isNeg: false },
      ],
      action: `Focus on semester-by-semester 0.20-point gains through regular revision and tutoring support to steadily advance within the distribution.`,
      target: {
        type: 'Cohort Median Standing',
        val: medCGPA.toFixed(2),
        gap: `+${gapToMed.toFixed(2)} grade points`,
      },
    });
  }

  // Prioritization & Capping (1 primary, up to 2 secondary, 1 maintenance/low)
  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  const selectedRecs = [];
  const highPrio = candidates.filter(c => c.priority === 'high');
  const medPrio  = candidates.filter(c => c.priority === 'medium');
  const lowPrio  = candidates.filter(c => c.priority === 'low');

  // Select 1 Primary
  if (highPrio.length) {
    selectedRecs.push(highPrio[0]);
  } else if (medPrio.length) {
    selectedRecs.push(medPrio[0]);
  } else if (lowPrio.length) {
    selectedRecs.push(lowPrio[0]);
  }

  // Select up to 2 Secondary
  const usedTypes = new Set(selectedRecs.map(r => r.type));
  const remainingMed = medPrio.filter(r => !usedTypes.has(r.type));
  for (let i = 0; i < Math.min(2, remainingMed.length); i++) {
    selectedRecs.push(remainingMed[i]);
    usedTypes.add(remainingMed[i].type);
  }

  // Select 1 Maintenance / Low if available and not yet included
  const remainingLow = lowPrio.filter(r => !usedTypes.has(r.type));
  if (remainingLow.length && selectedRecs.length < 4) {
    selectedRecs.push(remainingLow[0]);
  }

  // If still fewer than 2 recommendations (e.g. perfectly flat, high performer), add fallback consistency
  if (selectedRecs.length === 0) {
    selectedRecs.push({
      priority: 'low',
      icon: '📌',
      title: 'Maintain current academic standard across stages',
      why: `Your CGPA (${s.cgpa.toFixed(2)}) exhibits steady progression without pronounced stage disparities.`,
      chips: [
        { label: 'CGPA', val: s.cgpa.toFixed(2) },
        { label: 'SGPA', val: s.sgpa.toFixed(2) },
        { label: 'Prog', val: s.prog },
      ],
      action: 'Continue utilizing current study strategies and maintain steady engagement across remaining evaluations.',
      target: {
        type: 'Maintain Standing',
        val: s.cgpa.toFixed(2),
        gap: 'Steady performance',
      },
    });
  }

  container.innerHTML = `
    <div class="dynamic-insight-section">
      <div class="di-title">
        <span class="di-icon">💡</span>
        <span>How can I improve? (Explainable Data-Driven Recommendations)</span>
      </div>
      <div class="data-note">
        Recommendations are generated purely from your numerical academic trajectory (CGPA, SGPA, CGPA100–400, and cohort benchmarks). Every recommendation provides an explicit mathematical reason ("Why am I getting this recommendation?"), underlying data metrics, and a concrete target.
      </div>
      <div class="rec-list-p3">
        ${selectedRecs.map(r => `
          <div class="rec-item-p3 priority-${r.priority}">
            <div class="rec-header-p3">
              <div class="rec-header-left">
                <span class="rec-icon-p3">${r.icon}</span>
                <span class="rec-title-p3">${r.title}</span>
              </div>
              <span class="rec-prio-badge prio-${r.priority}">${r.priority} Priority</span>
            </div>

            <div class="rec-why-box">
              <div class="rec-why-title">🔍 Why am I getting this recommendation?</div>
              <div>${r.why}</div>
            </div>

            <div class="rec-metrics-strip">
              <span class="rec-strip-label">Based on:</span>
              ${r.chips.map(c => `
                <span class="rec-metric-chip ${c.isGap ? (c.isNeg ? 'chip-gap-neg' : 'chip-gap-pos') : ''}">
                  <span>${c.label}:</span>
                  <strong>${c.val}</strong>
                </span>
              `).join('')}
            </div>

            <div class="rec-text-p3">
              <strong>Action Guidance:</strong> ${r.action}
            </div>

            <div class="rec-target-strip">
              <div class="rec-target-left">
                <span>🎯 <span class="rec-target-type">${r.target.type}</span></span>
                <span>Target: <span class="rec-target-val">${r.target.val}</span></span>
              </div>
              <div>
                <span class="rec-target-gap">${r.target.gap}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ─── Window exports ────────────────────────────────────────────────── */
window.renderStudentProfile           = renderStudentProfile;
window.renderPerformanceSummary       = renderPerformanceSummary;
window.renderTargetGoals              = renderTargetGoals;
window.updateStudentComparisonContext = updateStudentComparisonContext;
window.handleStageClick               = handleStageClick;
