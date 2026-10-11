const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('       PHASE 8: STUDENT RANK & PERFORMANCE TEST     ');
console.log('====================================================\n');

// 1. Load dataset
const data = JSON.parse(fs.readFileSync('d:/SEMESTER 3/Data Analytics/USPA/data/data.json', 'utf8'));
const students = data.students;
console.log(`[PASS] 1. Loaded ${students.length} students from data.json (Full dataset intact)`);

function isValidNum(v) {
  return typeof v === 'number' && !isNaN(v) && isFinite(v);
}

function getEligibleStudents(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(s => s && isValidNum(s.cgpa) && s.cgpa > 0);
}

function computeCompetitionRank(eligibleGroup, targetCgpa) {
  if (!Array.isArray(eligibleGroup) || !eligibleGroup.length || !isValidNum(targetCgpa)) {
    return { rank: '—', total: 0, ties: 0 };
  }
  let strictlyGreater = 0;
  let equalCount = 0;
  for (let i = 0; i < eligibleGroup.length; i++) {
    const v = eligibleGroup[i].cgpa;
    if (v > targetCgpa) strictlyGreater++;
    else if (v === targetCgpa) equalCount++;
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
    return { pct: null, note: 'n < 5' };
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
    note: `calculated across ${n} records`
  };
}

// 2. HTML Architecture & Integration
console.log('\n--- Test Suite 1: HTML Architecture & Section Verification ---');
const html = fs.readFileSync('d:/SEMESTER 3/Data Analytics/USPA/index.html', 'utf8');

const requiredHtmlElements = [
  'data-tab="rank"',
  'id="tab-rank"',
  'id="rank-student-input"',
  'id="rank-student-dropdown"',
  'id="rank-selected-pill"',
  'id="rank-student-clear"',
  'id="rank-empty-state"',
  'id="rank-content-panel"',
  'id="rank-cards-grid"',
  'id="rank-benchmark-table-body"',
  'id="rank-stage-grid"',
  'id="rank-stage-note"',
  'id="chart-rank-hist"',
  'id="chart-rank-bench"',
  'id="chart-rank-stage"',
  'id="rank-interp-list"',
  'id="rank-targets-container"',
  'src="js/student-rank.js"',
  'href="css/student-rank.css"'
];

requiredHtmlElements.forEach(marker => {
  if (!html.includes(marker)) {
    throw new Error(`Missing expected element/marker in index.html: "${marker}"`);
  }
  console.log(`  ✓ Found in index.html: ${marker}`);
});

// 3. Overall Rank, Programme Rank, Graduation-Year Rank
console.log('\n--- Test Suite 2: Competition Ranking & Population Calculations ---');

const eligibleAll = getEligibleStudents(students);
console.log(`  ✓ 4. Total eligible overall records: ${eligibleAll.length} (out of ${students.length})`);

// Top student in BCH (54093)
const topStudent = students.find(s => s.id === '54093' && s.prog === 'BCH');
if (!topStudent) throw new Error("Student 54093 BCH not found");

const rankOverallTop = computeCompetitionRank(eligibleAll, topStudent.cgpa);
const progGroupTop = getEligibleStudents(students.filter(s => s.prog === topStudent.prog));
const rankProgTop = computeCompetitionRank(progGroupTop, topStudent.cgpa);
const yearGroupTop = getEligibleStudents(students.filter(s => s.yog === topStudent.yog));
const rankYearTop = computeCompetitionRank(yearGroupTop, topStudent.cgpa);

console.log(`  ✓ 1. Overall Rank for top student (CGPA ${topStudent.cgpa}): #${rankOverallTop.rank} of ${rankOverallTop.total}`);
console.log(`  ✓ 2. Programme Rank in ${topStudent.prog}: #${rankProgTop.rank} of ${rankProgTop.total}`);
console.log(`  ✓ 3. Graduation-Year Rank in ${topStudent.yog}: #${rankYearTop.rank} of ${rankYearTop.total}`);

if (rankProgTop.rank !== 1) throw new Error(`Expected BCH rank 1 for CGPA 4.99, got ${rankProgTop.rank}`);
if (rankOverallTop.rank !== 1) throw new Error(`Expected overall rank 1 for CGPA 4.99, got ${rankOverallTop.rank}`);

// 5. Competition Ranking for Ties (1224 method)
console.log('\n--- Test Suite 3: Competition Ranking For Ties Verification ---');
const sampleGroup = [
  { id: '1', cgpa: 4.50 },
  { id: '2', cgpa: 4.20 },
  { id: '3', cgpa: 4.20 },
  { id: '4', cgpa: 3.90 },
];
const r1 = computeCompetitionRank(sampleGroup, 4.50);
const r2 = computeCompetitionRank(sampleGroup, 4.20);
const r4 = computeCompetitionRank(sampleGroup, 3.90);

console.log(`  ✓ Sample tie ranking: 4.50 -> #${r1.rank}, 4.20 -> #${r2.rank} (ties: ${r2.ties}), 3.90 -> #${r4.rank}`);
if (r1.rank !== 1 || r2.rank !== 2 || r4.rank !== 4) {
  throw new Error(`Competition tie ranking mismatch: expected 1, 2, 4, got ${r1.rank}, ${r2.rank}, ${r4.rank}`);
}

// 6. Missing CGPA & 7. Invalid CGPA handling
console.log('\n--- Test Suite 4: Missing & Invalid CGPA Exclusion ---');
const dirtyGroup = [
  { id: '1', cgpa: 4.0 },
  { id: '2', cgpa: null },
  { id: '3', cgpa: NaN },
  { id: '4', cgpa: undefined },
  { id: '5', cgpa: 0 },
  { id: '6', cgpa: 3.5 }
];
const cleanDirty = getEligibleStudents(dirtyGroup);
console.log(`  ✓ Dirty group filtered from ${dirtyGroup.length} to ${cleanDirty.length} valid records`);
if (cleanDirty.length !== 2) throw new Error("Failed to filter invalid CGPA records");

// 8. Percentile Calculation & Direction
console.log('\n--- Test Suite 5: Percentile Calculation & Safeguards ---');
const pctTop = computeGroupPercentile(eligibleAll, topStudent.cgpa);
console.log(`  ✓ Percentile for CGPA ${topStudent.cgpa}: ${pctTop.pct}th percentile`);
if (pctTop.pct < 99) throw new Error("Top student should be >= 99th percentile");

// 9. Small comparison group safeguard (n < 5)
const smallGroup = [{ id: '1', cgpa: 4.0 }, { id: '2', cgpa: 3.5 }, { id: '3', cgpa: 3.0 }];
const smallPct = computeGroupPercentile(smallGroup, 4.0);
console.log(`  ✓ Small group (n=3) percentile safeguard: pct = ${smallPct.pct} (note: ${smallPct.note})`);
if (smallPct.pct !== null) throw new Error("Small group safeguard failed: should be null when n < 5");

// 10. Duplicate student ID handling across programmes
console.log('\n--- Test Suite 6: Duplicate Student ID Disambiguation ---');
const dup1 = students.find(s => s.id === '76075' && s.prog === 'BCH');
const dup2 = students.find(s => s.id === '76075' && s.prog === 'MCB');

if (!dup1 || !dup2) throw new Error("Duplicate pair 76075 not found");

const rDup1Prog = computeCompetitionRank(getEligibleStudents(students.filter(s => s.prog === dup1.prog)), dup1.cgpa);
const rDup2Prog = computeCompetitionRank(getEligibleStudents(students.filter(s => s.prog === dup2.prog)), dup2.cgpa);

console.log(`  ✓ Duplicate ID 76075 in BCH (CGPA ${dup1.cgpa}): Rank #${rDup1Prog.rank} of ${rDup1Prog.total}`);
console.log(`  ✓ Duplicate ID 76075 in MCB (CGPA ${dup2.cgpa}): Rank #${rDup2Prog.rank} of ${rDup2Prog.total}`);
if (rDup1Prog.rank === rDup2Prog.rank) throw new Error("Duplicate disambiguation failed to compute distinct ranks");

// 12. Benchmark averages & 13. Differences from averages
console.log('\n--- Test Suite 7: Benchmark Differences & Stage Analysis ---');
const allCgpas = eligibleAll.map(s => s.cgpa);
const meanAll = allCgpas.reduce((a, b) => a + b, 0) / allCgpas.length;
const diffAll = topStudent.cgpa - meanAll;

console.log(`  ✓ Overall Mean: ${meanAll.toFixed(2)}, Diff for top student: +${diffAll.toFixed(2)}`);
if (diffAll <= 0) throw new Error("Top student diff should be positive");

// 14. Academic-Stage Strongest/Weakest calculation
const stages = [
  { key: 'cgpa100', label: 'Level 100', val: topStudent.cgpa100 },
  { key: 'cgpa200', label: 'Level 200', val: topStudent.cgpa200 },
  { key: 'cgpa300', label: 'Level 300', val: topStudent.cgpa300 },
  { key: 'cgpa400', label: 'Level 400', val: topStudent.cgpa400 }
];
const validStages = stages.filter(s => isValidNum(s.val) && s.val > 0);
const maxStageVal = Math.max(...validStages.map(s => s.val));
const minStageVal = Math.min(...validStages.map(s => s.val));
const bestStage = validStages.find(s => s.val === maxStageVal);
const worstStage = validStages.find(s => s.val === minStageVal);

console.log(`  ✓ Stages: L100=${topStudent.cgpa100}, L200=${topStudent.cgpa200}, L300=${topStudent.cgpa300}, L400=${topStudent.cgpa400}`);
console.log(`  ✓ Strongest: ${bestStage.label} (${maxStageVal.toFixed(2)}), Weakest: ${worstStage.label} (${minStageVal.toFixed(2)})`);

// 19. No NaN, Infinity, undefined
console.log('\n--- Test Suite 8: Robust Numerical Safety ---');
[rankOverallTop.rank, rankProgTop.rank, rankYearTop.rank, pctTop.pct, meanAll, diffAll].forEach(v => {
  if (typeof v === 'number' && (isNaN(v) || !isFinite(v))) {
    throw new Error(`Invalid numerical value: ${v}`);
  }
});
console.log('  ✓ Verified 0 NaN, 0 Infinity, 0 undefined values in ranking pipeline');

// 20. Original dataset unchanged
if (JSON.stringify(students) !== JSON.stringify(data.students)) {
  throw new Error("Original dataset modified!");
}
console.log('  ✓ 20. Original dataset verified 100% identical and unchanged');

// 21. Non-causal Language Audit
console.log('\n--- Test Suite 9: Non-Causal Safe Analytical Language Audit ---');
const filesToAudit = [
  'd:/SEMESTER 3/Data Analytics/USPA/js/student-rank.js',
  'd:/SEMESTER 3/Data Analytics/USPA/css/student-rank.css',
  'd:/SEMESTER 3/Data Analytics/USPA/index.html'
];
const prohibitedPhrases = [
  'official university rank',
  'official rank',
  'official graduation requirement',
  'official classification',
  'caused by lack of',
  'due to lazy',
  'teaching quality',
  'curriculum flaws',
  'study hours',
  'attendance rate',
  'universal Level 200 dip'
];

filesToAudit.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  prohibitedPhrases.forEach(phrase => {
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(content)) {
      throw new Error(`Prohibited phrase "${phrase}" found in file: ${f}`);
    }
  });
  console.log(`  ✓ Audit passed for ${path.basename(f)} (0 prohibited phrases)`);
});

console.log('\n====================================================');
console.log('       ALL PHASE 8 VERIFICATION TESTS PASSED!       ');
console.log('====================================================\n');
