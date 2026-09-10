/**
 * insights.js — Insight Explorer & Dynamic Insight Engine
 *
 * Pattern:  DATA → FINDING → EXPLANATION → ACTION
 *
 * All claims are generated strictly from available fields:
 * cgpa, sgpa, cgpa100/200/300/400, prog, yog, gender.
 * No subject-level, non-dataset, or external-factor claims.
 */

'use strict';

/* ─── Level context notes (data-driven context, no subject claims) ── */
const LEVEL_CONTEXT = {
  cgpa100: 'Level 100 establishes the cumulative baseline. A strong start here is positively correlated with overall performance in this dataset.',
  cgpa200: 'Overall, average performance declines from Level 100 to Level 200 (moving from 3.64 to 3.32) before recovering in later stages across the broader cohort.',
  cgpa300: 'Level 300 shows partial recovery for most students in this dataset (mean 3.42). Performance here reflects adjustment to more advanced coursework demands.',
  cgpa400: 'Level 400 shows the highest mean (3.53) across all levels in the dataset — students who persist tend to stabilise or improve in their final year.',
};

/* ─── Safe value helper ─────────────────────────────────────────── */
function _safe(v, fallback = 0) {
  if (v === undefined || v === null || isNaN(v) || !isFinite(v)) return fallback;
  return v;
}
function _peerLevelMean(peerGroup, key) {
  const vals = peerGroup.map(s => s[key]).filter(v => _safe(v, null) !== null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/* ─── Main: show stage insight explorer ────────────────────────── */
function showStageInsight(student, stageIdx, peerGroup, peerLabel) {
  const key   = window.LEVEL_KEYS[stageIdx];
  const label = window.LEVEL_LABELS[stageIdx];
  const myVal = _safe(student[key]);

  /* Stage comparison across this student's 4 levels */
  const allLevels  = window.LEVEL_KEYS.map(k => _safe(student[k]));
  const validLvls  = allLevels.filter(v => v > 0);
  const maxV       = validLvls.length ? Math.max(...validLvls) : myVal;
  const minV       = validLvls.length ? Math.min(...validLvls) : myVal;
  const allEqual   = maxV === minV;
  const isBest     = !allEqual && myVal === maxV;
  const isWorst    = !allEqual && myVal === minV;

  /* Trend from previous level */
  const prevKey  = stageIdx > 0 ? window.LEVEL_KEYS[stageIdx - 1] : null;
  const prevVal  = prevKey ? _safe(student[prevKey]) : null;
  const trendVsPrev = (prevVal !== null && prevVal > 0) ? window.roundN(myVal - prevVal, 2) : null;

  /* Peer benchmark */
  const peerMean = peerGroup.length ? _peerLevelMean(peerGroup, key) : null;
  const gapFromPeer = peerMean !== null ? window.roundN(myVal - peerMean, 2) : null;

  /* Highlight selected stage in grid */
  document.querySelectorAll('.stage-item').forEach((el, i) => {
    el.classList.toggle('ie-highlighted', i === stageIdx);
  });

  /* ── Build blocks ─────────────────────────────────────────── */

  // DATA
  const dataHtml = `
    <div><strong>Your ${label} CGPA:</strong> <span class="highlight-val">${myVal.toFixed(2)}</span></div>
    ${peerMean !== null
      ? `<div style="margin-top:4px;font-size:0.75rem">${peerLabel} mean at this level: <strong>${peerMean.toFixed(2)}</strong></div>`
      : ''}
    ${trendVsPrev !== null
      ? `<div style="margin-top:4px;font-size:0.75rem">Change from ${window.LEVEL_LABELS[stageIdx-1]}: <strong style="color:${trendVsPrev>=0?'var(--green-600)':'var(--red-600)'}">${trendVsPrev>=0?'+':''}${trendVsPrev.toFixed(2)}</strong></div>`
      : ''}
  `;

  // FINDING
  let finding;
  if (allEqual) {
    finding = `Your performance is consistent across all four levels (${myVal.toFixed(2)} at each level). There is no single best or worst stage.`;
  } else if (isBest) {
    finding = `<strong>${label} is your strongest stage</strong> with a CGPA of ${myVal.toFixed(2)} — the highest among your four academic levels (range: ${minV.toFixed(2)} – ${maxV.toFixed(2)}).`;
  } else if (isWorst) {
    finding = `<strong>${label} is your weakest stage</strong> with a CGPA of ${myVal.toFixed(2)} — the lowest among your four levels (range: ${minV.toFixed(2)} – ${maxV.toFixed(2)}).`;
  } else {
    finding = `${label} is an <strong>intermediate stage</strong> for you (${myVal.toFixed(2)}). Your overall range across levels is ${minV.toFixed(2)} – ${maxV.toFixed(2)}.`;
  }
  if (trendVsPrev !== null) {
    finding += ` Compared to the previous level, your score <strong>${trendVsPrev >= 0 ? 'improved' : 'declined'} by ${Math.abs(trendVsPrev).toFixed(2)}</strong>.`;
  }

  // EXPLANATION
  let explanation = LEVEL_CONTEXT[key] || '';
  if (gapFromPeer !== null) {
    const dir = gapFromPeer >= 0 ? 'above' : 'below';
    explanation += ` Your score is <strong>${Math.abs(gapFromPeer).toFixed(2)} points ${dir}</strong> the ${peerLabel} mean (${peerMean.toFixed(2)}) at this level.`;
    if (Math.abs(gapFromPeer) < 0.1) {
      explanation += ' This is very close to the group average.';
    }
  }

  // ACTION
  let action;
  if (isWorst && myVal < 2.50) {
    action = `Your ${label} score (${myVal.toFixed(2)}) is below the Pass threshold. If this level is in the past, review how it affected your cumulative average and whether any remedial options remain. If still in progress, maximising effort here has the greatest potential impact on your final CGPA.`;
  } else if (isWorst && myVal < 3.00) {
    action = `${label} was your lowest stage. A score of ${myVal.toFixed(2)} pulls your cumulative average downward. Reviewing academic support resources and consulting faculty advising for concepts taught at this level is the most actionable step for recovery.`;
  } else if (isWorst) {
    action = `While ${label} was your weakest stage, ${myVal.toFixed(2)} is within a solid band. The gap between your best (${maxV.toFixed(2)}) and this level (${myVal.toFixed(2)}) is ${(maxV-myVal).toFixed(2)} — closing this internal spread supports higher cumulative standing.`;
  } else if (isBest) {
    action = `Your academic approach during ${label} produced your highest attainment (${myVal.toFixed(2)}). Replicating the preparation methods and study techniques from this stage across remaining coursework will support sustained standing.`;
  } else if (gapFromPeer !== null && gapFromPeer < -0.30) {
    action = `Your ${label} score is ${Math.abs(gapFromPeer).toFixed(2)} below the ${peerLabel} average. Seeking departmental academic support, peer tutoring, or reviewing course evaluations from this stage will help narrow this gap.`;
  } else if (trendVsPrev !== null && trendVsPrev < -0.30) {
    action = `Your score changed by ${trendVsPrev.toFixed(2)} from ${window.LEVEL_LABELS[stageIdx-1]} to ${label}. Early awareness of inter-stage changes enables timely academic consultation and course-level review.`;
  } else if (gapFromPeer !== null && gapFromPeer > 0.30) {
    action = `You outperformed the ${peerLabel} average at ${label} by +${gapFromPeer.toFixed(2)} points. Maintaining this standard across future levels will reinforce positive academic trajectory.`;
  } else {
    action = `Continue monitoring performance level-by-level. Even small consistent improvements (0.1–0.2 per level) compound significantly across the four levels and improve your cumulative CGPA.`;
  }

  /* ── Render ─────────────────────────────────────────────────── */
  const container = document.getElementById('insight-explorer');
  if (!container) return;
  container.removeAttribute('hidden');
  container.innerHTML = `
    <div class="ie-panel">
      <div class="ie-header">
        <span class="ie-stage-label">
          ${isBest ? '🏆 ' : isWorst ? '⚠️ ' : '📌 '}${label} — Stage Analysis
        </span>
        <button class="ie-close" onclick="hideInsightExplorer()">✕ Close</button>
      </div>
      <div class="ie-steps">
        <div class="ie-step ie-step-data">
          <div class="ie-step-label"><span class="ie-icon">📊</span>&nbsp;DATA</div>
          <div class="ie-step-content">${dataHtml}</div>
        </div>
        <div class="ie-arrow">→</div>
        <div class="ie-step ie-step-finding">
          <div class="ie-step-label"><span class="ie-icon">🔍</span>&nbsp;FINDING</div>
          <div class="ie-step-content">${finding}</div>
        </div>
        <div class="ie-arrow">→</div>
        <div class="ie-step ie-step-explanation">
          <div class="ie-step-label"><span class="ie-icon">💡</span>&nbsp;EXPLANATION</div>
          <div class="ie-step-content">${explanation}</div>
        </div>
        <div class="ie-arrow">→</div>
        <div class="ie-step ie-step-action">
          <div class="ie-step-label"><span class="ie-icon">🎯</span>&nbsp;ACTION</div>
          <div class="ie-step-content">${action}</div>
        </div>
      </div>
    </div>
  `;
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ─── Hide the explorer ─────────────────────────────────────────── */
function hideInsightExplorer() {
  const c = document.getElementById('insight-explorer');
  if (c) { c.setAttribute('hidden', ''); c.innerHTML = ''; }
  document.querySelectorAll('.stage-item.ie-highlighted').forEach(el => el.classList.remove('ie-highlighted'));
}

/* ─── Validate a numeric value is usable ───────────────────────── */
function insightSafe(v) {
  return typeof v === 'number' && isFinite(v) && !isNaN(v);
}

window.showStageInsight   = showStageInsight;
window.hideInsightExplorer = hideInsightExplorer;
window.insightSafe         = insightSafe;
