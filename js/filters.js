/**
 * filters.js — Sidebar & Search Filter Logic (Phase 3)
 *
 * Handles:
 *  - Populating dropdown options from dataset
 *  - Reacting to filter changes → calls applyFilters()
 *  - Cross-filtering API (setFilter) for interactive chart clicks
 *  - Student search (sidebar + student-profile tab)
 *  - Duplicate-safe student selection (composite ID + prog)
 *  - Visual disambiguation when multiple students share an ID
 *  - Reset all filters
 */

'use strict';

/* ─── Populate dropdowns ───────────────────────────────────────────── */
function initFilters(data) {
  const progSel  = document.getElementById('filter-prog');
  const yearSel  = document.getElementById('filter-year');

  if (progSel) {
    progSel.innerHTML = '<option value="">All Programmes</option>';
    data.meta.programs.slice().sort().forEach(p => {
      progSel.innerHTML += `<option value="${p}">${p}</option>`;
    });
  }

  if (yearSel) {
    yearSel.innerHTML = '<option value="">All Years</option>';
    data.meta.years.slice().sort().forEach(y => {
      yearSel.innerHTML += `<option value="${y}">${y}</option>`;
    });
  }

  // Performance Category dropdown (dynamically populated from single source of truth)
  const tierSel = document.getElementById('filter-tier');
  if (tierSel && window.PERFORMANCE_CATEGORIES) {
    tierSel.innerHTML = '<option value="">All Categories</option>' +
      window.PERFORMANCE_CATEGORIES.map(c => `<option value="${c.name}">${c.filterLabel}</option>`).join('');
  }

  // Radar prog select (on programs tab)
  const radarSel = document.getElementById('radar-prog-select');
  if (radarSel) {
    radarSel.innerHTML = '<option value="">— Pick a programme —</option>';
    data.meta.programs.slice().sort().forEach(p => {
      radarSel.innerHTML += `<option value="${p}">${p}</option>`;
    });
    radarSel.addEventListener('change', e => {
      if (typeof window.updateRadarChart === 'function') {
        window.updateRadarChart(e.target.value);
      }
    });
  }

  // Attach filter dropdown events
  ['prog', 'year', 'gender', 'tier'].forEach(key => {
    const el = document.getElementById(`filter-${key}`);
    if (el) {
      el.addEventListener('change', e => {
        STATE.filters[key] = e.target.value;
        applyFilters();
      });
    }
  });

  // Reset button
  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetFilters);
  }

  // Sidebar student search
  initStudentSearch();

  // Profile-tab search
  initProfileSearch();
}

/* ─── Cross-filtering helper (used by chart clicks) ────────────────── */
function setFilter(key, value) {
  if (STATE.filters[key] === value) return; // already set
  STATE.filters[key] = value;
  const el = document.getElementById(`filter-${key}`);
  if (el) el.value = value;
  applyFilters();
}

/* ─── Reset all filters ────────────────────────────────────────────── */
function resetFilters() {
  ['prog', 'year', 'gender', 'tier'].forEach(key => {
    STATE.filters[key] = '';
    const el = document.getElementById(`filter-${key}`);
    if (el) el.value = '';
  });

  clearStudentSelection();
  applyFilters();
}

/* ─── Student Search (Sidebar) ─────────────────────────────────────── */
function initStudentSearch() {
  const input    = document.getElementById('input-student');
  const drop     = document.getElementById('student-dropdown');
  const clearBtn = document.getElementById('student-clear');

  if (!input || !drop) return;

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 2) {
      drop.classList.remove('open');
      drop.innerHTML = '';
      return;
    }

    const matches = findStudentMatches(q, 12);
    renderStudentDropdown(drop, matches, (s) => {
      selectStudentGlobal(s);
      drop.classList.remove('open');
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.student-search-wrap')) {
      drop.classList.remove('open');
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearStudentSelection();
      input.value = '';
      clearBtn.style.display = 'none';
      drop.classList.remove('open');
    });
  }
}

/* ─── Profile Tab Search ───────────────────────────────────────────── */
function initProfileSearch() {
  const input   = document.getElementById('profile-search');
  const btn     = document.getElementById('profile-search-btn');
  const results = document.getElementById('profile-search-results');

  if (!input || !btn || !results) return;

  const doSearch = () => {
    const q = input.value.trim();
    results.style.display = 'none';
    results.innerHTML = '';
    if (!q) return;

    const matches = findStudentMatches(q, 20);
    if (!matches.length) {
      results.innerHTML = `
        <div class="student-no-results" style="padding:12px;background:var(--slate-50);border-radius:4px;border:1px solid var(--border)">
          No student found with ID matching "<strong>${escapeHtml(q)}</strong>".<br>
          <span style="font-size:0.72rem;color:var(--text-muted)">Try a known student ID such as 54093, 20956, or 47409.</span>
        </div>
      `;
      results.style.display = 'block';
      return;
    }

    if (matches.length === 1) {
      selectStudentGlobal(matches[0]);
      results.style.display = 'none';
      return;
    }

    // Multiple matches — show disambiguation card
    results.innerHTML = `
      <div style="background:var(--slate-50);padding:10px 14px;border:1px solid var(--blue-200);border-radius:6px">
        <div style="font-size:0.78rem;font-weight:700;color:var(--blue-700);margin-bottom:6px">
          Multiple records found (${matches.length} matches). Please select the intended student:
        </div>
        <div id="profile-disambiguation-list" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>
    `;
    const list = results.querySelector('#profile-disambiguation-list');
    matches.forEach(s => {
      const btn2 = document.createElement('button');
      btn2.className = 'student-option';
      btn2.style.cssText = 'border:1px solid var(--border);border-radius:4px;cursor:pointer;background:var(--surface);padding:8px 10px;text-align:left;display:flex;align-items:center;justify-content:space-between';
      btn2.innerHTML = `
        <div>
          <strong>ID ${s.id}</strong>
          <span class="prog-badge">${s.prog}</span>
          <span class="prog-badge">${s.yog}</span>
          <span class="prog-badge">${s.gender}</span>
        </div>
        <div>
          <span class="tier-badge tier-${s.tier.replace(/\s/g,'')}" style="font-size:0.65rem;margin-right:8px">${s.tier}</span>
          <span style="font-weight:800;color:var(--blue-600)">CGPA ${s.cgpa.toFixed(2)}</span>
        </div>
      `;
      btn2.addEventListener('click', () => {
        selectStudentGlobal(s);
        results.style.display = 'none';
      });
      list.appendChild(btn2);
    });
    results.style.display = 'block';
  };

  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
}

/* ─── Match search query against students (composite-aware) ────────── */
function findStudentMatches(query, limit = 10) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  // First search in currently filtered cohort
  let matches = (STATE.filteredStudents.length ? STATE.filteredStudents : STATE.allStudents)
    .filter(s => s.id.toString().includes(q));

  // If no matches in filtered set, fallback to full dataset to help the student find their record
  if (!matches.length && STATE.filteredStudents.length < STATE.allStudents.length) {
    matches = STATE.allStudents.filter(s => s.id.toString().includes(q));
  }

  return matches.slice(0, limit);
}

/* ─── Render dropdown list ─────────────────────────────────────────── */
function renderStudentDropdown(container, matches, onSelect) {
  container.innerHTML = '';
  if (!matches.length) {
    container.innerHTML = '<div class="student-no-results">No match found</div>';
    container.classList.add('open');
    return;
  }

  matches.forEach(s => {
    const div = document.createElement('div');
    div.className = 'student-option';
    div.innerHTML = `
      <div>
        <strong>${s.id}</strong>
        <span class="prog-badge">${s.prog}</span>
        <span class="prog-badge">${s.yog}</span>
      </div>
      <div style="font-size:0.75rem;color:var(--blue-600);font-weight:700">
        ${s.cgpa.toFixed(2)}
      </div>
    `;
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.alignItems = 'center';
    div.addEventListener('click', () => onSelect(s));
    container.appendChild(div);
  });
  container.classList.add('open');
}

/* ─── Select a student (global, duplicate-safe) ─────────────────────── */
function selectStudentGlobal(student) {
  if (!student) return;

  // Use id + prog as composite key
  STATE.selectedStudent = { id: student.id, prog: student.prog };

  // Find authoritative student object from allStudents
  const s = STATE.allStudents.find(
    x => x.id === student.id && x.prog === student.prog
  );
  if (!s) return;

  // Update inputs
  const sideInput = document.getElementById('input-student');
  if (sideInput) sideInput.value = `${s.id} (${s.prog})`;
  const clearBtn = document.getElementById('student-clear');
  if (clearBtn) clearBtn.style.display = 'block';

  const profileInput = document.getElementById('profile-search');
  if (profileInput) profileInput.value = `${s.id} (${s.prog})`;

  // Update active filter chips
  if (typeof window.updateFilterChips === 'function') {
    window.updateFilterChips();
  }

  // Render student profile
  if (typeof window.renderStudentProfile === 'function') {
    window.renderStudentProfile(s);
  }

  // Switch to student profile tab automatically
  const tabBtn = document.querySelector('.nav-tab[data-tab="student"]');
  if (tabBtn && !tabBtn.classList.contains('active')) {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    tabBtn.classList.add('active');
    const studentSec = document.getElementById('tab-student');
    if (studentSec) studentSec.classList.add('active');
  }

  // Re-render charts to update scatter highlight
  if (typeof window.updateAllCharts === 'function') {
    window.updateAllCharts(STATE.filteredStudents);
  }
}

/* ─── Clear student selection ──────────────────────────────────────── */
function clearStudentSelection() {
  STATE.selectedStudent = null;

  const sideInput = document.getElementById('input-student');
  if (sideInput) sideInput.value = '';
  const clearBtn = document.getElementById('student-clear');
  if (clearBtn) clearBtn.style.display = 'none';

  const profileInput = document.getElementById('profile-search');
  if (profileInput) profileInput.value = '';

  const emptyState = document.getElementById('student-empty-state');
  if (emptyState) emptyState.style.display = 'block';

  const profilePanel = document.getElementById('student-profile-panel');
  if (profilePanel) profilePanel.classList.remove('visible');

  if (typeof window.hideInsightExplorer === 'function') {
    window.hideInsightExplorer();
  }

  if (typeof window.updateFilterChips === 'function') {
    window.updateFilterChips();
  }

  if (typeof window.updateAllCharts === 'function') {
    window.updateAllCharts(STATE.filteredStudents);
  }

  if (typeof window.highlightSelectedRowInExplorer === 'function') {
    window.highlightSelectedRowInExplorer();
  }
}

/* Helper to escape html */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Expose for other modules */
window.initFilters           = initFilters;
window.setFilter             = setFilter;
window.resetFilters          = resetFilters;
window.selectStudentGlobal   = selectStudentGlobal;
window.clearStudentSelection = clearStudentSelection;
window.findStudentMatches    = findStudentMatches;
