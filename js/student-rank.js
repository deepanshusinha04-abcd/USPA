/**
 * student-rank.js — Phase 8: Student Rank & Performance Summary
 *
 * Methodology:
 *  - Competition ranking ("1224" method):
 *      Rank = 1 + number of eligible students whose CGPA is strictly greater.
 *      Students tied on CGPA receive the same rank.
 *  - Percentile within group:
 *      ((count strictly below + 0.5 * count equal) / total) * 100
 *      Small group safeguard: requires n >= 5.
 *  - Populations:
 *      Overall Rank: ALL eligible students in full dataset (STATE.allStudents).
 *      Programme Rank: ALL eligible students with same programme.
 *      Graduation-Year Rank: ALL eligible students with same graduation year (YoG).
 *  - Duplicate-safe student selection: ID + Prog composite key.
 *  - Academic stage analysis: CGPA100–400 with strongest/weakest stage identification.
 *  - Charts:
 *      1. CGPA Distribution Histogram (with student position highlighted).
 *      2. Benchmark Comparison Bar Chart (Student vs Overall vs Prog vs Year).
 *      3. Academic Stage Performance Line/Bar Chart (Student vs Programme Level Means).
 */

'use strict';

(function () {
  let _chartRankHist = null;
  let _chartRankBench = null;
  let _chartRankStage = null;

  /* ─── Safe Value & Math Helpers ───────────────────────────────────── */
  function isValidNum(v) {
    return typeof v === 'number' && !isNaN(v) && isFinite(v);
  }

  function getEligibleStudents(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(function (s) {
      return s && isValidNum(s.cgpa) && s.cgpa > 0;
    });
  }

  /**
   * Competition ranking: Rank = 1 + count(students with CGPA > target CGPA)
   */
  function computeCompetitionRank(eligibleGroup, targetCgpa) {
    if (!Array.isArray(eligibleGroup) || !eligibleGroup.length || !isValidNum(targetCgpa)) {
      return { rank: '—', total: 0, ties: 0 };
    }
    let strictlyGreater = 0;
    let equalCount = 0;

    for (let i = 0; i < eligibleGroup.length; i++) {
      const v = eligibleGroup[i].cgpa;
      if (v > targetCgpa) {
        strictlyGreater++;
      } else if (v === targetCgpa) {
        equalCount++;
      }
    }

    return {
      rank: strictlyGreater + 1,
      total: eligibleGroup.length,
      ties: equalCount > 1 ? equalCount : 1
    };
  }

  function computeGroupPercentile(eligibleGroup, targetCgpa) {
    const n = eligibleGroup.length;
    if (n < 5 || !isValidNum(targetCgpa)) {
      return { pct: null, note: 'n < 5 (sample too small)' };
    }
    let strictlyBelow = 0;
    let strictlyEqual = 0;
    for (let i = 0; i < n; i++) {
      const v = eligibleGroup[i].cgpa;
      if (v < targetCgpa) strictlyBelow++;
      else if (v === targetCgpa) strictlyEqual++;
    }
    const pct = ((strictlyBelow + 0.5 * strictlyEqual) / n) * 100;
    return {
      pct: Math.max(0, Math.min(100, Math.round(pct))),
      note: 'calculated across ' + n + ' records'
    };
  }

  function calcMean(arr) {
    const valid = arr.filter(isValidNum);
    if (!valid.length) return null;
    return valid.reduce(function (a, b) { return a + b; }, 0) / valid.length;
  }

  /* ─── Initialization ─────────────────────────────────────────────── */
  function initStudentRank() {
    setupRankSearchEvents();
    renderStudentRankView();
  }

  /* ─── Search & Selection Events ──────────────────────────────────── */
  function setupRankSearchEvents() {
    const input = document.getElementById('rank-student-input');
    const drop = document.getElementById('rank-student-dropdown');
    const clearBtn = document.getElementById('rank-student-clear');

    if (!input || !drop) return;

    input.addEventListener('input', function () {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) {
        drop.classList.remove('open');
        drop.innerHTML = '';
        return;
      }

      const all = window.STATE?.allStudents || [];
      const matches = all.filter(function (s) {
        return String(s.id).toLowerCase().includes(q) || String(s.prog).toLowerCase().includes(q);
      }).slice(0, 15);

      if (!matches.length) {
        drop.innerHTML = '<div style="padding:10px;font-size:0.75rem;color:var(--text-muted)">No matching student found</div>';
        drop.classList.add('open');
        return;
      }

      drop.innerHTML = matches.map(function (s) {
        return '<div class="rank-search-option" data-id="' + s.id + '" data-prog="' + s.prog + '">' +
          '<div>' +
            '<strong>ID ' + s.id + '</strong> ' +
            '<span class="prog-badge">' + s.prog + '</span> ' +
            '<span class="prog-badge">' + s.yog + '</span> ' +
            '<span class="prog-badge">' + s.gender + '</span>' +
          '</div>' +
          '<div>' +
            '<span style="font-size:0.72rem;color:var(--text-muted);margin-right:6px">' + (s.tier || '') + '</span>' +
            '<strong style="color:var(--blue-600)">' + s.cgpa.toFixed(2) + '</strong>' +
          '</div>' +
        '</div>';
      }).join('');
      drop.classList.add('open');
    });

    drop.addEventListener('click', function (e) {
      const opt = e.target.closest('.rank-search-option');
      if (!opt) return;
      const id = opt.dataset.id;
      const prog = opt.dataset.prog;

      const student = (window.STATE?.allStudents || []).find(function (s) {
        return String(s.id) === String(id) && s.prog === prog;
      });

      if (student && typeof window.selectStudentGlobal === 'function') {
        window.selectStudentGlobal(student);
        // Switch back or stay on rank tab
        const rankTab = document.querySelector('.nav-tab[data-tab="rank"]');
        if (rankTab) {
          document.querySelectorAll('.nav-tab').forEach(function (b) { b.classList.remove('active'); });
          document.querySelectorAll('.section').forEach(function (s) { s.classList.remove('active'); });
          rankTab.classList.add('active');
          const rankSec = document.getElementById('tab-rank');
          if (rankSec) rankSec.classList.add('active');
        }
        renderStudentRankView();
      }

      drop.classList.remove('open');
      input.value = '';
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.rank-search-input-wrap')) {
        drop.classList.remove('open');
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (typeof window.clearStudentSelection === 'function') {
          window.clearStudentSelection();
        }
        renderStudentRankView();
      });
    }
  }

  /* ─── Main Render ────────────────────────────────────────────────── */
  function renderStudentRankView() {
    const emptyState = document.getElementById('rank-empty-state');
    const contentPanel = document.getElementById('rank-content-panel');
    const selectedPill = document.getElementById('rank-selected-pill');
    const clearBtn = document.getElementById('rank-student-clear');

    const sel = window.STATE?.selectedStudent;
    const all = window.STATE?.allStudents || [];
    const student = sel ? all.find(function (s) { return String(s.id) === String(sel.id) && s.prog === sel.prog; }) : null;

    if (!student) {
      if (emptyState) emptyState.style.display = 'block';
      if (contentPanel) contentPanel.style.display = 'none';
      if (selectedPill) selectedPill.style.display = 'none';
      if (clearBtn) clearBtn.style.display = 'none';
      destroyRankCharts();
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (contentPanel) contentPanel.style.display = 'block';
    if (clearBtn) clearBtn.style.display = 'inline-block';

    if (selectedPill) {
      selectedPill.style.display = 'inline-flex';
      selectedPill.innerHTML = '👤 Currently Selected: <strong>ID ' + student.id + '</strong> (' + student.prog + ' &bull; Class of ' + student.yog + ' &bull; CGPA: ' + student.cgpa.toFixed(2) + ')';
    }

    // 1. Populations
    const eligibleOverall = getEligibleStudents(all);
    const eligibleProg    = getEligibleStudents(all.filter(function (s) { return s.prog === student.prog; }));
    const eligibleYear    = getEligibleStudents(all.filter(function (s) { return s.yog === student.yog; }));

    // 2. Ranks
    const rankOverall = computeCompetitionRank(eligibleOverall, student.cgpa);
    const rankProg    = computeCompetitionRank(eligibleProg, student.cgpa);
    const rankYear    = computeCompetitionRank(eligibleYear, student.cgpa);

    // 3. Percentiles
    const pctOverall = computeGroupPercentile(eligibleOverall, student.cgpa);
    const pctProg    = computeGroupPercentile(eligibleProg, student.cgpa);
    const pctYear    = computeGroupPercentile(eligibleYear, student.cgpa);

    // 4. Means
    const meanOverall = calcMean(eligibleOverall.map(function (s) { return s.cgpa; }));
    const meanProg    = calcMean(eligibleProg.map(function (s) { return s.cgpa; }));
    const meanYear    = calcMean(eligibleYear.map(function (s) { return s.cgpa; }));

    const sgpaOverall = calcMean(eligibleOverall.map(function (s) { return s.sgpa; }));
    const sgpaProg    = calcMean(eligibleProg.map(function (s) { return s.sgpa; }));
    const sgpaYear    = calcMean(eligibleYear.map(function (s) { return s.sgpa; }));

    // 5. Render sections
    renderRankCards(student, rankOverall, rankProg, rankYear, pctOverall);
    renderBenchmarkTable(student, {
      meanOverall: meanOverall, meanProg: meanProg, meanYear: meanYear,
      sgpaOverall: sgpaOverall, sgpaProg: sgpaProg, sgpaYear: sgpaYear,
      nOverall: eligibleOverall.length, nProg: eligibleProg.length, nYear: eligibleYear.length
    });
    renderStageAnalysis(student, all);
    renderDynamicInterpretation(student, {
      rankOverall: rankOverall, rankProg: rankProg, rankYear: rankYear,
      pctOverall: pctOverall, meanOverall: meanOverall, meanProg: meanProg, meanYear: meanYear
    });
    renderRankTargets(student, rankProg, eligibleProg);

    // 6. Charts
    renderRankDistributionChart(eligibleOverall, student);
    renderRankBenchmarkChart(student, meanOverall, meanProg, meanYear);
    renderRankStageChart(student, all);
  }

  /* ─── Render Components ──────────────────────────────────────────── */
  function renderRankCards(student, rankOverall, rankProg, rankYear, pctOverall) {
    const el = document.getElementById('rank-cards-grid');
    if (!el) return;

    el.innerHTML = [
      '<div class="rank-card highlight">' +
        '<div class="rank-card-label">Overall CGPA Rank</div>' +
        '<div class="rank-card-val" style="color:var(--primary)">#' + rankOverall.rank + '</div>' +
        '<div class="rank-card-sub">of ' + rankOverall.total.toLocaleString() + ' eligible records</div>' +
      '</div>',
      '<div class="rank-card">' +
        '<div class="rank-card-label">Programme Rank</div>' +
        '<div class="rank-card-val" style="color:var(--blue-600)">#' + rankProg.rank + '</div>' +
        '<div class="rank-card-sub">of ' + rankProg.total.toLocaleString() + ' in ' + student.prog + '</div>' +
      '</div>',
      '<div class="rank-card">' +
        '<div class="rank-card-label">Grad Year Rank</div>' +
        '<div class="rank-card-val" style="color:var(--amber-600)">#' + rankYear.rank + '</div>' +
        '<div class="rank-card-sub">of ' + rankYear.total.toLocaleString() + ' in ' + student.yog + '</div>' +
      '</div>',
      '<div class="rank-card">' +
        '<div class="rank-card-label">Overall Percentile</div>' +
        '<div class="rank-card-val" style="color:var(--green-700)">' + (pctOverall.pct !== null ? pctOverall.pct + 'th' : '—') + '</div>' +
        '<div class="rank-card-sub">' + pctOverall.note + '</div>' +
      '</div>',
      '<div class="rank-card">' +
        '<div class="rank-card-label">Student CGPA</div>' +
        '<div class="rank-card-val">' + student.cgpa.toFixed(2) + '</div>' +
        '<div class="rank-card-sub">Cumulative average</div>' +
      '</div>',
      '<div class="rank-card">' +
        '<div class="rank-card-label">Student SGPA</div>' +
        '<div class="rank-card-val">' + (isValidNum(student.sgpa) ? student.sgpa.toFixed(2) : '—') + '</div>' +
        '<div class="rank-card-sub">Final semester GPA</div>' +
      '</div>'
    ].join('');
  }

  function renderBenchmarkTable(student, b) {
    const el = document.getElementById('rank-benchmark-table-body');
    if (!el) return;

    function fmtDiff(val) {
      if (val === null || !isValidNum(val)) return '—';
      const roundVal = Math.round(val * 100) / 100;
      if (roundVal > 0) return '<span class="diff-positive">+' + roundVal.toFixed(2) + '</span>';
      if (roundVal < 0) return '<span class="diff-negative">' + roundVal.toFixed(2) + '</span>';
      return '<span class="diff-neutral">0.00</span>';
    }

    const diffCgpaOverall = b.meanOverall !== null ? student.cgpa - b.meanOverall : null;
    const diffCgpaProg    = b.meanProg !== null ? student.cgpa - b.meanProg : null;
    const diffCgpaYear    = b.meanYear !== null ? student.cgpa - b.meanYear : null;

    const diffSgpaOverall = (isValidNum(student.sgpa) && b.sgpaOverall !== null) ? student.sgpa - b.sgpaOverall : null;
    const diffSgpaProg    = (isValidNum(student.sgpa) && b.sgpaProg !== null) ? student.sgpa - b.sgpaProg : null;
    const diffSgpaYear    = (isValidNum(student.sgpa) && b.sgpaYear !== null) ? student.sgpa - b.sgpaYear : null;

    el.innerHTML = [
      '<tr>' +
        '<td><strong>Cumulative CGPA</strong></td>' +
        '<td class="num-col" style="font-weight:800;color:var(--text-primary)">' + student.cgpa.toFixed(2) + '</td>' +
        '<td class="num-col">' + (b.meanOverall !== null ? b.meanOverall.toFixed(2) : '—') + '</td>' +
        '<td class="num-col">' + fmtDiff(diffCgpaOverall) + '</td>' +
        '<td class="num-col">' + (b.meanProg !== null ? b.meanProg.toFixed(2) : '—') + ' (' + student.prog + ')</td>' +
        '<td class="num-col">' + fmtDiff(diffCgpaProg) + '</td>' +
        '<td class="num-col">' + (b.meanYear !== null ? b.meanYear.toFixed(2) : '—') + ' (' + student.yog + ')</td>' +
        '<td class="num-col">' + fmtDiff(diffCgpaYear) + '</td>' +
      '</tr>',
      '<tr>' +
        '<td><strong>Final Semester SGPA</strong></td>' +
        '<td class="num-col" style="font-weight:800;color:var(--blue-600)">' + (isValidNum(student.sgpa) ? student.sgpa.toFixed(2) : '—') + '</td>' +
        '<td class="num-col">' + (b.sgpaOverall !== null ? b.sgpaOverall.toFixed(2) : '—') + '</td>' +
        '<td class="num-col">' + fmtDiff(diffSgpaOverall) + '</td>' +
        '<td class="num-col">' + (b.sgpaProg !== null ? b.sgpaProg.toFixed(2) : '—') + ' (' + student.prog + ')</td>' +
        '<td class="num-col">' + fmtDiff(diffSgpaProg) + '</td>' +
        '<td class="num-col">' + (b.sgpaYear !== null ? b.sgpaYear.toFixed(2) : '—') + ' (' + student.yog + ')</td>' +
        '<td class="num-col">' + fmtDiff(diffSgpaYear) + '</td>' +
      '</tr>'
    ].join('');
  }

  function renderStageAnalysis(student, all) {
    const el = document.getElementById('rank-stage-grid');
    const noteEl = document.getElementById('rank-stage-note');
    if (!el) return;

    const stages = [
      { key: 'cgpa100', label: 'Level 100', val: student.cgpa100 },
      { key: 'cgpa200', label: 'Level 200', val: student.cgpa200 },
      { key: 'cgpa300', label: 'Level 300', val: student.cgpa300 },
      { key: 'cgpa400', label: 'Level 400', val: student.cgpa400 },
    ];

    const validStages = stages.filter(function (s) { return isValidNum(s.val) && s.val > 0; });

    let maxVal = -1, minVal = 999;
    if (validStages.length >= 2) {
      validStages.forEach(function (s) {
        if (s.val > maxVal) maxVal = s.val;
        if (s.val < minVal) minVal = s.val;
      });
    }

    el.innerHTML = stages.map(function (s) {
      const isValid = isValidNum(s.val) && s.val > 0;
      const isBest = isValid && validStages.length >= 2 && s.val === maxVal && maxVal !== minVal;
      const isWorst = isValid && validStages.length >= 2 && s.val === minVal && maxVal !== minVal;

      let boxCls = 'rank-stage-box';
      let badge = '';
      if (isBest) {
        boxCls += ' stage-best';
        badge = '<span class="rank-stage-badge badge-strongest">Strongest Stage</span>';
      } else if (isWorst) {
        boxCls += ' stage-worst';
        badge = '<span class="rank-stage-badge badge-weakest">Weakest Stage</span>';
      }

      return '<div class="' + boxCls + '">' +
        '<div class="rank-stage-name">' + s.label + '</div>' +
        '<div class="rank-stage-val">' + (isValid ? s.val.toFixed(2) : '—') + '</div>' +
        '<div>' + (badge || '<span style="font-size:0.65rem;color:var(--text-muted)">Stage Evaluation</span>') + '</div>' +
      '</div>';
    }).join('');

    if (noteEl) {
      if (validStages.length < 2) {
        noteEl.textContent = 'Fewer than two valid stage values are available for this student; strongest and weakest stage comparison is unavailable.';
      } else if (maxVal === minVal) {
        noteEl.textContent = 'Stage evaluations are uniform across all stages (CGPA ' + maxVal.toFixed(2) + ').';
      } else {
        const bestStage = validStages.find(function (s) { return s.val === maxVal; });
        const worstStage = validStages.find(function (s) { return s.val === minVal; });
        noteEl.textContent = 'Highest observed stage performance occurred at ' + bestStage.label + ' (' + maxVal.toFixed(2) + '), while most challenging stage was ' + worstStage.label + ' (' + minVal.toFixed(2) + '), showing an internal variation of ' + (maxVal - minVal).toFixed(2) + ' grade points.';
      }
    }
  }

  function renderDynamicInterpretation(student, d) {
    const el = document.getElementById('rank-interp-list');
    if (!el) return;

    const items = [];

    // 1. Overall comparison
    if (d.meanOverall !== null) {
      const diff = student.cgpa - d.meanOverall;
      if (Math.abs(diff) < 0.05) {
        items.push('The student\'s CGPA of <strong>' + student.cgpa.toFixed(2) + '</strong> aligns closely with the overall dataset average of <strong>' + d.meanOverall.toFixed(2) + '</strong> across all ' + d.rankOverall.total.toLocaleString() + ' eligible records.');
      } else if (diff > 0) {
        items.push('The student\'s CGPA of <strong>' + student.cgpa.toFixed(2) + '</strong> is <strong>+' + diff.toFixed(2) + ' points above</strong> the overall dataset average of <strong>' + d.meanOverall.toFixed(2) + '</strong>.');
      } else {
        items.push('The student\'s CGPA of <strong>' + student.cgpa.toFixed(2) + '</strong> is <strong>' + Math.abs(diff).toFixed(2) + ' points below</strong> the overall dataset average of <strong>' + d.meanOverall.toFixed(2) + '</strong>.');
      }
    }

    // 2. Programme comparison & Rank
    if (d.meanProg !== null) {
      const pDiff = student.cgpa - d.meanProg;
      items.push('Within the <strong>' + student.prog + '</strong> programme, the student ranks <strong>#' + d.rankProg.rank + ' of ' + d.rankProg.total.toLocaleString() + '</strong> eligible records (' + (pDiff >= 0 ? '+' : '') + pDiff.toFixed(2) + ' points relative to programme mean of ' + d.meanProg.toFixed(2) + ').');
    }

    // 3. Grad Year Rank
    if (d.meanYear !== null) {
      items.push('Among peers in the graduating <strong>Class of ' + student.yog + '</strong>, the student ranks <strong>#' + d.rankYear.rank + ' of ' + d.rankYear.total.toLocaleString() + '</strong> eligible records.');
    }

    // 4. Overall percentile
    if (d.pctOverall.pct !== null) {
      items.push('The student is positioned at the <strong>' + d.pctOverall.pct + 'th percentile</strong> of all eligible records in the study dataset.');
    }

    // 5. Final semester SGPA momentum
    if (isValidNum(student.sgpa)) {
      const shift = student.sgpa - student.cgpa;
      if (shift > 0.05) {
        items.push('Final semester SGPA of <strong>' + student.sgpa.toFixed(2) + '</strong> shows positive progression (+<strong>' + shift.toFixed(2) + '</strong> grade points) relative to cumulative CGPA.');
      } else if (shift < -0.05) {
        items.push('Final semester SGPA of <strong>' + student.sgpa.toFixed(2) + '</strong> reflects a decline of <strong>' + Math.abs(shift).toFixed(2) + '</strong> grade points relative to cumulative CGPA.');
      } else {
        items.push('Final semester SGPA of <strong>' + student.sgpa.toFixed(2) + '</strong> is virtually identical to cumulative CGPA, reflecting stable academic consistency.');
      }
    }

    el.innerHTML = items.map(function (it) { return '<li>' + it + '</li>'; }).join('');
  }

  function renderRankTargets(student, rankProg, eligibleProg) {
    const container = document.getElementById('rank-targets-container');
    if (!container) return;

    const cats = window.PERFORMANCE_CATEGORIES || [];
    const curCatIdx = cats.findIndex(function (c) { return c.name === student.tier; });
    const isTopCat = curCatIdx === 0;
    const nextCat = !isTopCat && curCatIdx > 0 ? cats[curCatIdx - 1] : null;

    let catCard = '';
    if (isTopCat) {
      catCard = '<div class="rank-target-card">' +
        '<div class="rank-target-header">' +
          '<span class="rank-target-title">Performance Category Milestone</span>' +
          '<span class="goal-badge goal-badge-done">Distinction</span>' +
        '</div>' +
        '<div class="rank-target-vals">' +
          '<span class="rank-target-big">≥ 4.50</span>' +
          '<span class="rank-target-gap" style="color:var(--green-700)">Top Category Attained</span>' +
        '</div>' +
        '<div class="rank-target-desc">' +
          'Student is situated in the highest dashboard-configured category. Target is performance consistency across continuing coursework.' +
        '</div>' +
      '</div>';
    } else if (nextCat) {
      const gap = Math.round((nextCat.min - student.cgpa) * 100) / 100;
      catCard = '<div class="rank-target-card">' +
        '<div class="rank-target-header">' +
          '<span class="rank-target-title">Next Category Milestone</span>' +
          '<span class="goal-badge goal-badge-reach">' + nextCat.name + '</span>' +
        '</div>' +
        '<div class="rank-target-vals">' +
          '<span class="rank-target-big">' + nextCat.min.toFixed(2) + '</span>' +
          '<span class="rank-target-gap">+' + gap.toFixed(2) + ' grade points needed</span>' +
        '</div>' +
        '<div class="rank-target-desc">' +
          'Advancement from ' + student.tier + ' to ' + nextCat.name + ' requires reaching the configured threshold of ' + nextCat.min.toFixed(2) + '.' +
        '</div>' +
      '</div>';
    }

    // Rank Step-Up Target: Gap to next higher CGPA in programme
    let rankCard = '';
    const sortedProg = eligibleProg.slice().sort(function (a, b) { return b.cgpa - a.cgpa; });
    const higherStudents = sortedProg.filter(function (s) { return s.cgpa > student.cgpa; });

    if (higherStudents.length > 0) {
      const nextAbove = higherStudents[higherStudents.length - 1]; // closest higher student
      const gapToAbove = Math.round((nextAbove.cgpa - student.cgpa + 0.01) * 100) / 100;
      rankCard = '<div class="rank-target-card">' +
        '<div class="rank-target-header">' +
          '<span class="rank-target-title">Programme Rank Advancement Target</span>' +
          '<span class="goal-badge goal-badge-target">Rank #' + (rankProg.rank - 1) + '</span>' +
        '</div>' +
        '<div class="rank-target-vals">' +
          '<span class="rank-target-big">' + nextAbove.cgpa.toFixed(2) + '</span>' +
          '<span class="rank-target-gap">+' + (nextAbove.cgpa - student.cgpa).toFixed(2) + ' pts to match</span>' +
        '</div>' +
        '<div class="rank-target-desc">' +
          'Next higher-ranked record in ' + student.prog + ' has CGPA ' + nextAbove.cgpa.toFixed(2) + '. A gain of ' + (nextAbove.cgpa - student.cgpa).toFixed(2) + ' grade points aligns with the next ranking echelon.' +
        '</div>' +
      '</div>';
    } else {
      rankCard = '<div class="rank-target-card">' +
        '<div class="rank-target-header">' +
          '<span class="rank-target-title">Programme Standing</span>' +
          '<span class="goal-badge goal-badge-done">Rank #1 in Programme</span>' +
        '</div>' +
        '<div class="rank-target-vals">' +
          '<span class="rank-target-big">' + student.cgpa.toFixed(2) + '</span>' +
          '<span class="rank-target-gap" style="color:var(--green-700)">Highest Standing</span>' +
        '</div>' +
        '<div class="rank-target-desc">' +
          'Currently holds the highest recorded CGPA in ' + student.prog + ' among all eligible records.' +
        '</div>' +
      '</div>';
    }

    container.innerHTML = catCard + rankCard;
  }

  /* ─── Charts ─────────────────────────────────────────────────────── */
  function destroyRankCharts() {
    if (_chartRankHist)  { _chartRankHist.destroy();  _chartRankHist = null; }
    if (_chartRankBench) { _chartRankBench.destroy(); _chartRankBench = null; }
    if (_chartRankStage) { _chartRankStage.destroy(); _chartRankStage = null; }
  }

  function renderRankDistributionChart(eligibleOverall, student) {
    const canvas = document.getElementById('chart-rank-hist');
    if (!canvas) return;
    if (_chartRankHist) _chartRankHist.destroy();

    // 20 bins between 1.50 and 5.00
    const binCount = 20;
    const minVal = 1.5;
    const maxVal = 5.0;
    const binWidth = (maxVal - minVal) / binCount;

    const bins = new Array(binCount).fill(0);
    const labels = [];
    for (let i = 0; i < binCount; i++) {
      const bStart = minVal + i * binWidth;
      const bEnd = bStart + binWidth;
      labels.push(bStart.toFixed(2) + '–' + bEnd.toFixed(2));
    }

    eligibleOverall.forEach(function (s) {
      let idx = Math.floor((s.cgpa - minVal) / binWidth);
      if (idx < 0) idx = 0;
      if (idx >= binCount) idx = binCount - 1;
      bins[idx]++;
    });

    let studentBinIdx = Math.floor((student.cgpa - minVal) / binWidth);
    if (studentBinIdx < 0) studentBinIdx = 0;
    if (studentBinIdx >= binCount) studentBinIdx = binCount - 1;

    const bgColors = bins.map(function (_, i) {
      return i === studentBinIdx ? '#D97706' : '#93C5FD'; // amber for student's bin, light blue otherwise
    });

    _chartRankHist = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Students in CGPA Interval',
          data: bins,
          backgroundColor: bgColors,
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: function (ctx) {
                if (ctx.dataIndex === studentBinIdx) {
                  return '⭐ Selected Student CGPA (' + student.cgpa.toFixed(2) + ') sits in this interval!';
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { font: { size: 10 } },
            grid: { color: '#F1F5F9' }
          }
        }
      }
    });
  }

  function renderRankBenchmarkChart(student, meanOverall, meanProg, meanYear) {
    const canvas = document.getElementById('chart-rank-bench');
    if (!canvas) return;
    if (_chartRankBench) _chartRankBench.destroy();

    const labels = [
      'Student CGPA',
      'Overall Mean (' + (meanOverall ? meanOverall.toFixed(2) : '—') + ')',
      student.prog + ' Programme Mean (' + (meanProg ? meanProg.toFixed(2) : '—') + ')',
      'Class of ' + student.yog + ' Mean (' + (meanYear ? meanYear.toFixed(2) : '—') + ')'
    ];

    const vals = [
      student.cgpa,
      meanOverall || 0,
      meanProg || 0,
      meanYear || 0
    ];

    const colors = [
      '#D97706', // amber student
      '#64748B', // slate overall
      '#2563EB', // blue prog
      '#7C3AED'  // purple year
    ];

    _chartRankBench = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: vals,
          backgroundColor: colors,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.label + ': ' + ctx.raw.toFixed(2) + ' CGPA';
              }
            }
          }
        },
        scales: {
          x: { ticks: { font: { size: 11 } }, grid: { display: false } },
          y: { min: 0, max: 5.0, ticks: { stepSize: 1.0 }, grid: { color: '#F1F5F9' } }
        }
      }
    });
  }

  function renderRankStageChart(student, all) {
    const canvas = document.getElementById('chart-rank-stage');
    if (!canvas) return;
    if (_chartRankStage) _chartRankStage.destroy();

    const progStudents = all.filter(function (s) { return s.prog === student.prog; });

    const p100 = calcMean(progStudents.map(function (s) { return s.cgpa100; }));
    const p200 = calcMean(progStudents.map(function (s) { return s.cgpa200; }));
    const p300 = calcMean(progStudents.map(function (s) { return s.cgpa300; }));
    const p400 = calcMean(progStudents.map(function (s) { return s.cgpa400; }));

    _chartRankStage = new Chart(canvas, {
      type: 'line',
      data: {
        labels: ['Level 100', 'Level 200', 'Level 300', 'Level 400'],
        datasets: [
          {
            label: 'Student Stage CGPA',
            data: [student.cgpa100, student.cgpa200, student.cgpa300, student.cgpa400],
            borderColor: '#D97706',
            backgroundColor: 'rgba(217, 119, 6, 0.1)',
            borderWidth: 3,
            pointRadius: 6,
            pointBackgroundColor: '#D97706',
            tension: 0.1,
            fill: false
          },
          {
            label: student.prog + ' Programme Peer Stage Mean',
            data: [p100, p200, p300, p400],
            borderColor: '#94A3B8',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 4,
            pointBackgroundColor: '#94A3B8',
            tension: 0.1,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ': ' + ctx.raw.toFixed(2);
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { min: 1.0, max: 5.0, ticks: { stepSize: 0.5 }, grid: { color: '#F1F5F9' } }
        }
      }
    });
  }

  /* ─── Public API Exposure ─────────────────────────────────────────── */
  window.initStudentRank = initStudentRank;
  window.renderStudentRankView = renderStudentRankView;
  window.computeCompetitionRank = computeCompetitionRank;
  window.computeGroupPercentile = computeGroupPercentile;
})();
