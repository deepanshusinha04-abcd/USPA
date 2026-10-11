/**
 * data-explorer.js — Phase 7: Data Explorer Feature
 *
 * Requirements:
 *  - Single source of truth: uses STATE.filteredStudents (or STATE.allStudents)
 *  - Synchronized with global filters
 *  - Local search: ID No, Prog Code (case-insensitive)
 *  - Interactive column sorting: asc/desc on all 11 columns
 *  - Pagination: 25, 50, 100 page-size options with correct range indicator
 *  - Composite row selection (ID + Prog) -> highlights row & opens My Performance
 *  - Dynamic summary KPIs: Records Shown, Mean CGPA, Mean SGPA, Max CGPA, Min CGPA
 *  - Client-side CSV export of currently filtered/searched records
 *  - Safe fallback empty state with reset filters integration
 */

'use strict';

(function () {
  // Local Data Explorer State (derived purely from existing global state)
  const DE_STATE = {
    searchQuery: '',
    sortColumn: 'cgpa',
    sortDirection: 'desc', // 'asc' | 'desc'
    currentPage: 1,
    pageSize: 25,
  };

  const COLUMNS = [
    { key: 'id',       label: 'ID No',       numeric: false, isId: true },
    { key: 'prog',     label: 'Prog Code',   numeric: false },
    { key: 'gender',   label: 'Gender',      numeric: false },
    { key: 'yog',      label: 'YoG',         numeric: true },
    { key: 'cgpa',     label: 'CGPA',        numeric: true, decimals: 2 },
    { key: 'cgpa100',  label: 'CGPA100',     numeric: true, decimals: 2 },
    { key: 'cgpa200',  label: 'CGPA200',     numeric: true, decimals: 2 },
    { key: 'cgpa300',  label: 'CGPA300',     numeric: true, decimals: 2 },
    { key: 'cgpa400',  label: 'CGPA400',     numeric: true, decimals: 2 },
    { key: 'sgpa',     label: 'SGPA',        numeric: true, decimals: 2 },
    { key: 'tier',     label: 'Category',    numeric: false, isBadge: true },
  ];

  /* ─── Initialization ─────────────────────────────────────────────── */
  function initDataExplorer() {
    setupToolbarEvents();
    setupTableSortEvents();
    renderDataExplorer();
  }

  /* ─── Event Setup ────────────────────────────────────────────────── */
  function setupToolbarEvents() {
    const searchInput = document.getElementById('de-search-input');
    const searchClear = document.getElementById('de-search-clear');
    const pageSizeSel = document.getElementById('de-pagesize-select');
    const exportBtn   = document.getElementById('de-btn-export');

    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        DE_STATE.searchQuery = e.target.value.trim().toLowerCase();
        DE_STATE.currentPage = 1;
        renderDataExplorer();
        if (searchClear) {
          searchClear.style.display = DE_STATE.searchQuery ? 'inline' : 'none';
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', function () {
        if (searchInput) searchInput.value = '';
        DE_STATE.searchQuery = '';
        DE_STATE.currentPage = 1;
        searchClear.style.display = 'none';
        renderDataExplorer();
      });
    }

    if (pageSizeSel) {
      pageSizeSel.addEventListener('change', function (e) {
        DE_STATE.pageSize = parseInt(e.target.value, 10) || 25;
        DE_STATE.currentPage = 1;
        renderDataExplorer();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', exportDataExplorerCSV);
    }

    // Pagination controls
    const prevBtn = document.getElementById('de-page-prev');
    const nextBtn = document.getElementById('de-page-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (DE_STATE.currentPage > 1) {
          DE_STATE.currentPage--;
          renderDataExplorer();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        const totalMatching = getFilteredAndSearchedData().length;
        const maxPage = Math.max(1, Math.ceil(totalMatching / DE_STATE.pageSize));
        if (DE_STATE.currentPage < maxPage) {
          DE_STATE.currentPage++;
          renderDataExplorer();
        }
      });
    }

    // Row selection delegation
    const tbody = document.getElementById('de-table-body');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        const tr = e.target.closest('tr[data-id][data-prog]');
        if (!tr) return;
        const id = tr.dataset.id;
        const prog = tr.dataset.prog;

        // Composite lookup
        const student = (window.STATE?.allStudents || []).find(function (s) {
          return String(s.id) === String(id) && s.prog === prog;
        });
        if (student && typeof window.selectStudentGlobal === 'function') {
          window.selectStudentGlobal(student);
          // Highlight row in Data Explorer
          highlightSelectedRow();
        }
      });
    }
  }

  function setupTableSortEvents() {
    const thead = document.getElementById('de-table-head');
    if (!thead) return;

    thead.addEventListener('click', function (e) {
      const th = e.target.closest('th[data-col]');
      if (!th) return;
      const col = th.dataset.col;

      if (DE_STATE.sortColumn === col) {
        DE_STATE.sortDirection = DE_STATE.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        DE_STATE.sortColumn = col;
        // Default numbers descending, text ascending
        const colDef = COLUMNS.find(function (c) { return c.key === col; });
        DE_STATE.sortDirection = colDef && colDef.numeric ? 'desc' : 'asc';
      }

      renderDataExplorer();
    });
  }

  /* ─── Data Pipeline ──────────────────────────────────────────────── */
  function getFilteredAndSearchedData() {
    const source = (window.STATE && Array.isArray(window.STATE.filteredStudents))
      ? window.STATE.filteredStudents
      : (window.STATE && Array.isArray(window.STATE.allStudents) ? window.STATE.allStudents : []);

    const q = DE_STATE.searchQuery;
    if (!q) return source;

    return source.filter(function (s) {
      const idStr = String(s.id).toLowerCase();
      const progStr = String(s.prog).toLowerCase();
      return idStr.includes(q) || progStr.includes(q);
    });
  }

  function getSortedData(dataset) {
    const col = DE_STATE.sortColumn;
    const dir = DE_STATE.sortDirection === 'asc' ? 1 : -1;
    const colDef = COLUMNS.find(function (c) { return c.key === col; });
    const isNum = colDef ? colDef.numeric : false;

    // Return a shallow copy sorted without mutating original dataset
    return dataset.slice().sort(function (a, b) {
      const vA = a[col];
      const vB = b[col];

      if (isNum) {
        const nA = typeof vA === 'number' && !isNaN(vA) ? vA : -9999;
        const nB = typeof vB === 'number' && !isNaN(vB) ? vB : -9999;
        return (nA - nB) * dir;
      }

      const sA = String(vA || '').toLowerCase();
      const sB = String(vB || '').toLowerCase();
      return sA.localeCompare(sB) * dir;
    });
  }

  /* ─── Main Render ────────────────────────────────────────────────── */
  function renderDataExplorer() {
    const dataMatching = getFilteredAndSearchedData();
    const totalCount = dataMatching.length;

    renderSummaryKPIs(dataMatching);

    const emptyContainer = document.getElementById('de-empty-state');
    const tableWrap = document.getElementById('de-table-wrap');
    const paginationBar = document.getElementById('de-pagination-bar');

    if (totalCount === 0) {
      if (emptyContainer) emptyContainer.style.display = 'block';
      if (tableWrap) tableWrap.style.display = 'none';
      if (paginationBar) paginationBar.style.display = 'none';
      return;
    }

    if (emptyContainer) emptyContainer.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';
    if (paginationBar) paginationBar.style.display = 'flex';

    // Sort
    const sortedData = getSortedData(dataMatching);

    // Pagination slice
    const totalPages = Math.max(1, Math.ceil(totalCount / DE_STATE.pageSize));
    if (DE_STATE.currentPage > totalPages) {
      DE_STATE.currentPage = totalPages;
    }
    const startIdx = (DE_STATE.currentPage - 1) * DE_STATE.pageSize;
    const endIdx = Math.min(startIdx + DE_STATE.pageSize, totalCount);
    const pageRows = sortedData.slice(startIdx, endIdx);

    renderTableHeader();
    renderTableRows(pageRows);
    renderPaginationInfo(startIdx + 1, endIdx, totalCount, totalPages);
    highlightSelectedRow();
  }

  /* ─── Render Components ──────────────────────────────────────────── */
  function renderSummaryKPIs(dataset) {
    const countEl   = document.getElementById('de-kpi-count');
    const avgCgpaEl = document.getElementById('de-kpi-avg-cgpa');
    const avgSgpaEl = document.getElementById('de-kpi-avg-sgpa');
    const maxCgpaEl = document.getElementById('de-kpi-max-cgpa');
    const minCgpaEl = document.getElementById('de-kpi-min-cgpa');

    if (!countEl) return;

    if (!dataset.length) {
      countEl.textContent   = '0';
      avgCgpaEl.textContent = '—';
      avgSgpaEl.textContent = '—';
      maxCgpaEl.textContent = '—';
      minCgpaEl.textContent = '—';
      return;
    }

    const n = dataset.length;
    const cgpas = dataset.map(function (s) { return s.cgpa; }).filter(function (v) { return typeof v === 'number' && !isNaN(v) && isFinite(v); });
    const sgpas = dataset.map(function (s) { return s.sgpa; }).filter(function (v) { return typeof v === 'number' && !isNaN(v) && isFinite(v); });

    const meanCgpa = cgpas.length ? cgpas.reduce(function (a, b) { return a + b; }, 0) / cgpas.length : 0;
    const meanSgpa = sgpas.length ? sgpas.reduce(function (a, b) { return a + b; }, 0) / sgpas.length : 0;
    const maxCgpa  = cgpas.length ? Math.max.apply(null, cgpas) : 0;
    const minCgpa  = cgpas.length ? Math.min.apply(null, cgpas) : 0;

    countEl.textContent   = n.toLocaleString();
    avgCgpaEl.textContent = meanCgpa.toFixed(2);
    avgSgpaEl.textContent = meanSgpa.toFixed(2);
    maxCgpaEl.textContent = maxCgpa.toFixed(2);
    minCgpaEl.textContent = minCgpa.toFixed(2);
  }

  function renderTableHeader() {
    const thead = document.getElementById('de-table-head');
    if (!thead) return;

    const thHtml = COLUMNS.map(function (c) {
      const isSorted = DE_STATE.sortColumn === c.key;
      const arrow = isSorted ? (DE_STATE.sortDirection === 'asc' ? '▲' : '▼') : '⇅';
      const numClass = c.numeric ? 'num-col' : '';
      const sortedClass = isSorted ? 'sorted' : '';
      return '<th data-col="' + c.key + '" class="' + numClass + ' ' + sortedClass + '" title="Click to sort by ' + c.label + '">' +
        c.label + ' <span class="de-sort-arrow">' + arrow + '</span>' +
      '</th>';
    }).join('');

    thead.innerHTML = '<tr>' + thHtml + '</tr>';
  }

  function renderTableRows(rows) {
    const tbody = document.getElementById('de-table-body');
    if (!tbody) return;

    tbody.innerHTML = rows.map(function (s) {
      const cls = (s.tier || '').replace(/\s/g, '');
      return '<tr data-id="' + s.id + '" data-prog="' + s.prog + '" title="Click to view student profile in My Performance">' +
        '<td class="col-id">' + s.id + '</td>' +
        '<td><span class="prog-badge">' + s.prog + '</span></td>' +
        '<td>' + s.gender + '</td>' +
        '<td class="num-col">' + s.yog + '</td>' +
        '<td class="num-col" style="font-weight:700;color:var(--text-primary)">' + s.cgpa.toFixed(2) + '</td>' +
        '<td class="num-col">' + s.cgpa100.toFixed(2) + '</td>' +
        '<td class="num-col">' + s.cgpa200.toFixed(2) + '</td>' +
        '<td class="num-col">' + s.cgpa300.toFixed(2) + '</td>' +
        '<td class="num-col">' + s.cgpa400.toFixed(2) + '</td>' +
        '<td class="num-col" style="color:var(--blue-600)">' + s.sgpa.toFixed(2) + '</td>' +
        '<td><span class="tier-badge tier-' + cls + '">' + s.tier + '</span></td>' +
      '</tr>';
    }).join('');
  }

  function renderPaginationInfo(start, end, total, totalPages) {
    const countEl = document.getElementById('de-page-count');
    const indicatorEl = document.getElementById('de-page-indicator');
    const prevBtn = document.getElementById('de-page-prev');
    const nextBtn = document.getElementById('de-page-next');

    if (countEl) {
      countEl.textContent = 'Showing ' + start.toLocaleString() + '–' + end.toLocaleString() + ' of ' + total.toLocaleString() + ' records';
    }
    if (indicatorEl) {
      indicatorEl.textContent = 'Page ' + DE_STATE.currentPage + ' of ' + totalPages;
    }
    if (prevBtn) {
      prevBtn.disabled = DE_STATE.currentPage <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = DE_STATE.currentPage >= totalPages;
    }
  }

  function highlightSelectedRow() {
    const tbody = document.getElementById('de-table-body');
    if (!tbody) return;

    const sel = window.STATE?.selectedStudent;
    tbody.querySelectorAll('tr').forEach(function (tr) {
      if (sel && String(tr.dataset.id) === String(sel.id) && tr.dataset.prog === sel.prog) {
        tr.classList.add('row-selected');
      } else {
        tr.classList.remove('row-selected');
      }
    });
  }

  /* ─── CSV Export ─────────────────────────────────────────────────── */
  function exportDataExplorerCSV() {
    const dataToExport = getFilteredAndSearchedData();
    if (!dataToExport.length) {
      alert('No records available to export.');
      return;
    }

    const headers = ['ID No', 'Prog Code', 'Gender', 'YoG', 'CGPA', 'CGPA100', 'CGPA200', 'CGPA300', 'CGPA400', 'SGPA', 'Performance Category'];
    const rows = dataToExport.map(function (s) {
      return [
        s.id,
        s.prog,
        s.gender,
        s.yog,
        s.cgpa.toFixed(2),
        s.cgpa100.toFixed(2),
        s.cgpa200.toFixed(2),
        s.cgpa300.toFixed(2),
        s.cgpa400.toFixed(2),
        s.sgpa.toFixed(2),
        '"' + (s.tier || '') + '"',
      ];
    });

    const csvContent = [
      headers.join(','),
      rows.map(function (r) { return r.join(','); }).join('\r\n')
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'USPA_Data_Explorer_' + new Date().toISOString().slice(0,10) + '.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ─── Public API Exposure ─────────────────────────────────────────── */
  window.initDataExplorer   = initDataExplorer;
  window.renderDataExplorer = renderDataExplorer;
  window.highlightSelectedRowInExplorer = highlightSelectedRow;
})();
