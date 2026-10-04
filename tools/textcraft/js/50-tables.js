// TextCraft · Edvault — Таблиці: рядки, стовпці, об’єднання, ширини, меню.
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ТАБЛИЦІ ═══════════════════════════ */
// Сітка таблиці з урахуванням об'єднаних клітинок: grid[рядок][стовпець] = клітинка
function tableGrid(table) {
  const grid = [], pos = new Map();
  Array.from(table.rows).forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    Array.from(tr.cells).forEach(cell => {
      while (grid[r][c]) c++;
      const cs = Math.max(1, cell.colSpan || 1), rs = Math.max(1, cell.rowSpan || 1);
      for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) { grid[r + i] = grid[r + i] || []; grid[r + i][c + j] = cell; }
      pos.set(cell, { r, c, cs, rs });
      c += cs;
    });
  });
  const rows = table.rows.length;
  grid.length = rows;
  const cols = Math.max(1, ...grid.map(row => (row ? row.length : 0)));
  return { grid, pos, rows, cols };
}
const newCell = () => { const td = document.createElement('td'); td.appendChild(document.createElement('br')); return td; };
// вставити клітинку в рядок так, щоб вона стала в стовпець col
function putCell(tr, cell, col, pos) {
  const ref = Array.from(tr.cells).find(c => pos.has(c) && pos.get(c).c > col);
  if (ref) ref.before(cell); else tr.appendChild(cell);
}
function cellIsEmpty(c) { return !c.textContent.replace(/​/g, '').trim() && !c.querySelector('img'); }
function moveCellContent(from, to) {
  if (cellIsEmpty(from)) return;
  if (cellIsEmpty(to)) { to.innerHTML = ''; } else to.appendChild(document.createElement('br'));
  while (from.firstChild) to.appendChild(from.firstChild);
}
// ── ширина стовпців: <colgroup> зі значеннями у відсотках ──
function colWidths(table) {
  const cg = table.querySelector(':scope > colgroup');
  return cg ? Array.from(cg.children).map(c => parseFloat(c.style.width) || 0) : null;
}
function setColWidths(table, ws) {
  let cg = table.querySelector(':scope > colgroup');
  if (!ws) { if (cg) cg.remove(); table.classList.remove('tc-fixed'); return; }
  const sum = ws.reduce((a, b) => a + b, 0) || 1;
  if (!cg) { cg = document.createElement('colgroup'); table.insertBefore(cg, table.firstChild); }
  cg.innerHTML = '';
  ws.forEach(w => { const col = document.createElement('col'); col.style.width = (Math.round(w / sum * 1000) / 10) + '%'; cg.appendChild(col); });
  table.classList.add('tc-fixed');
}
function measuredWidths(table) {
  const { grid, cols } = tableGrid(table);
  const tw = table.getBoundingClientRect().width || 1;
  const ws = [];
  for (let c = 0; c < cols; c++) {
    let w = 0;
    for (const row of grid) { const cell = row && row[c]; if (cell && (cell.colSpan || 1) === 1) { w = cell.getBoundingClientRect().width; break; } }
    ws.push(w || tw / cols);
  }
  return ws.map(w => w / tw * 100);
}

function tableAction(action) {
  const r = getRange();
  const cell = r && closestIn(r.startContainer, 'td,th');
  const table = cell ? cell.closest('table') : UI.currentTable;
  if (!table || !editor.contains(table)) return;
  const G = tableGrid(table);
  const p = (cell && G.pos.get(cell)) || { r: 0, c: 0, cs: 1, rs: 1 };
  const rowsEls = Array.from(table.rows);
  let msg = '';
  mutate(() => {
    let focus = null;
    const ws = colWidths(table);
    if (action === 'rowAbove' || action === 'rowBelow') {
      const at = action === 'rowAbove' ? p.r : p.r + p.rs; // новий рядок стане рядком з цим індексом
      const tr = document.createElement('tr');
      const seen = new Set();
      for (let c = 0; c < G.cols; c++) {
        const above = at > 0 ? G.grid[at - 1] && G.grid[at - 1][c] : null;
        const below = G.grid[at] && G.grid[at][c];
        if (above && above === below) { if (!seen.has(above)) { above.rowSpan = (above.rowSpan || 1) + 1; seen.add(above); } continue; }
        tr.appendChild(newCell());
      }
      if (at >= rowsEls.length) rowsEls[rowsEls.length - 1].after(tr); else rowsEls[at].before(tr);
      focus = tr.cells[0] || cell;
    } else if (action === 'colLeft' || action === 'colRight') {
      const at = action === 'colLeft' ? p.c : p.c + p.cs; // новий стовпець стане стовпцем з цим індексом
      const seen = new Set();
      rowsEls.forEach((tr, ri) => {
        const row = G.grid[ri] || [];
        const left = at > 0 ? row[at - 1] : null, right = row[at];
        if (left && left === right) { if (!seen.has(left)) { left.colSpan = (left.colSpan || 1) + 1; seen.add(left); } return; }
        if (right && G.pos.get(right).r !== ri && seen.has(right)) return;
        const c = newCell();
        putCell(tr, c, at - 1, G.pos);
        if (ri === p.r) focus = c;
      });
      if (ws) { const avg = 100 / (ws.length + 1); ws.splice(at, 0, avg); setColWidths(table, ws); }
    } else if (action === 'delRow') {
      if (rowsEls.length <= 1) { action = 'delTable'; }
      else {
        const R = p.r, tr = rowsEls[R];
        const seen = new Set();
        for (let c = 0; c < G.cols; c++) {
          const x = G.grid[R] && G.grid[R][c];
          if (!x || seen.has(x)) continue;
          seen.add(x);
          const xp = G.pos.get(x);
          if (xp.rs > 1) {
            x.rowSpan = xp.rs - 1;
            if (xp.r === R) putCell(rowsEls[R + 1], x, xp.c - 1, G.pos); // клітинка «спускається» в наступний рядок
          }
        }
        const next = rowsEls[R + 1] || rowsEls[R - 1];
        tr.remove();
        focus = next && next.cells[0];
      }
    } else if (action === 'delCol') {
      if (G.cols <= 1) { action = 'delTable'; }
      else {
        const C = p.c;
        const seen = new Set();
        G.grid.forEach(row => {
          const x = row && row[C];
          if (!x || seen.has(x)) return;
          seen.add(x);
          if ((x.colSpan || 1) > 1) x.colSpan = x.colSpan - 1; else x.remove();
        });
        Array.from(table.rows).forEach(tr => { if (!tr.cells.length) tr.remove(); });
        if (ws) { ws.splice(C, 1); setColWidths(table, ws.length ? ws : null); }
        const row = table.rows[Math.min(p.r, table.rows.length - 1)];
        focus = row && row.cells[Math.min(Math.max(0, C - 1), row.cells.length - 1)];
      }
    } else if (action === 'mergeRight') {
      const nb = G.grid[p.r] && G.grid[p.r][p.c + p.cs];
      const np = nb && G.pos.get(nb);
      if (!nb || np.r !== p.r || np.rs !== p.rs) { msg = 'Праворуч немає клітинки такої ж висоти'; return; }
      moveCellContent(nb, cell);
      cell.colSpan = p.cs + np.cs;
      nb.remove();
      focus = cell;
    } else if (action === 'mergeDown') {
      const nb = G.grid[p.r + p.rs] && G.grid[p.r + p.rs][p.c];
      const np = nb && G.pos.get(nb);
      if (!nb || np.c !== p.c || np.cs !== p.cs) { msg = 'Знизу немає клітинки такої ж ширини'; return; }
      moveCellContent(nb, cell);
      cell.rowSpan = p.rs + np.rs;
      nb.remove();
      Array.from(table.rows).forEach(tr => { if (!tr.cells.length) { tr.remove(); cell.rowSpan = Math.max(1, cell.rowSpan - 1); } });
      focus = cell;
    } else if (action === 'unmerge') {
      if (p.cs === 1 && p.rs === 1) { msg = 'Ця клітинка не об’єднана'; return; }
      for (let i = 0; i < p.rs; i++) {
        for (let j = 0; j < p.cs; j++) {
          if (!i && !j) continue;
          const nc = newCell();
          if (cell.dataset.bg) nc.dataset.bg = cell.dataset.bg;
          putCell(rowsEls[p.r + i], nc, p.c + j - 1 + 0.5, G.pos);
        }
      }
      cell.removeAttribute('colspan'); cell.removeAttribute('rowspan');
      focus = cell;
    } else if (action === 'header') {
      table.classList.toggle('tc-has-header');
      focus = cell;
    } else if (action === 'striped') {
      table.classList.toggle('tc-striped');
      focus = cell;
    } else if (action === 'colsEqual') {
      setColWidths(table, Array(G.cols).fill(1));
      focus = cell;
    } else if (action === 'colsAuto') {
      setColWidths(table, null);
      focus = cell;
    } else if (action === 'valign') {
      if (cell.dataset.valign) cell.removeAttribute('data-valign'); else cell.dataset.valign = 'middle';
      focus = cell;
    } else if (action.startsWith('bg:')) {
      const v = action.slice(3);
      if (v) cell.dataset.bg = v; else cell.removeAttribute('data-bg');
      focus = cell;
    } else if (action.startsWith('rowbg:')) {
      const v = action.slice(6);
      Array.from(rowsEls[p.r].cells).forEach(c => { if (v) c.dataset.bg = v; else c.removeAttribute('data-bg'); });
      focus = cell;
    }
    if (!table.className) table.removeAttribute('class');
    if (action === 'delTable') {
      const pp = emptyP();
      table.replaceWith(pp);
      caretStart(pp);
      UI.currentTable = null;
      return;
    }
    if (focus) caretEnd(focus);
  });
  if (msg) toast(msg);
}
const CELL_BG = [['', 'Без кольору', 'var(--surface)'], ['yellow', 'Жовтий', '#fde68a'], ['green', 'Зелений', '#bbf7d0'], ['blue', 'Блакитний', '#bfdbfe'], ['red', 'Червоний', '#fecaca'], ['purple', 'Фіолетовий', '#e9d5ff'], ['gray', 'Сірий', '#e2e8f0']];
function openTableMenu(kind, anchor) {
  const r = getRange();
  const cell = r && closestIn(r.startContainer, 'td,th');
  const table = cell ? cell.closest('table') : UI.currentTable;
  if (!table) return;
  let html = '';
  if (kind === 'rows') {
    html = '<div class="menu-label">Рядки</div>' + menuItem('rowAbove', 'Додати рядок вище', { icon: 'rowAbove' }) + menuItem('rowBelow', 'Додати рядок нижче', { icon: 'rowBelow' }) +
      '<div class="menu-sep"></div>' + menuItem('delRow', 'Видалити рядок', { icon: 'delRow', danger: true }) +
      '<div class="menu-hint">Висоту рядка можна змінити, потягнувши його нижню межу.</div>';
  } else if (kind === 'cols') {
    html = '<div class="menu-label">Стовпці</div>' + menuItem('colLeft', 'Додати стовпець ліворуч', { icon: 'colLeft' }) + menuItem('colRight', 'Додати стовпець праворуч', { icon: 'colRight' }) +
      '<div class="menu-sep"></div>' + menuItem('colsEqual', 'Однакова ширина стовпців', { icon: 'tCols' }) + menuItem('colsAuto', 'Ширина за вмістом', { icon: 'expand' }) +
      '<div class="menu-sep"></div>' + menuItem('delCol', 'Видалити стовпець', { icon: 'delCol', danger: true }) +
      '<div class="menu-hint">Ширину стовпця змінюйте, потягнувши межу між стовпцями.</div>';
  } else if (kind === 'cell') {
    const bg = cell ? cell.dataset.bg || '' : '';
    const merged = cell && ((cell.colSpan || 1) > 1 || (cell.rowSpan || 1) > 1);
    html = '<div class="menu-label">Клітинка</div>' + menuItem('mergeRight', 'Об’єднати з правою', { icon: 'merge' }) + menuItem('mergeDown', 'Об’єднати з нижньою', { icon: 'merge' }) +
      (merged ? menuItem('unmerge', 'Роз’єднати', { icon: 'unmerge' }) : '') +
      menuItem('valign', 'Текст по центру по висоті', { icon: 'alignCenter', on: cell && !!cell.dataset.valign }) +
      '<div class="menu-label">Колір клітинки</div><div class="cell-swatches">' + CELL_BG.map(([v, n, c]) => '<button data-v="bg:' + v + '" data-tip="' + n + '" style="background:' + c + '" class="' + (bg === v ? 'on' : '') + '"></button>').join('') + '</div>' +
      '<div class="menu-label">Колір усього рядка</div><div class="cell-swatches">' + CELL_BG.map(([v, n, c]) => '<button data-v="rowbg:' + v + '" data-tip="' + n + '" style="background:' + c + '"></button>').join('') + '</div>';
  } else if (kind === 'look') {
    html = '<div class="menu-label">Вигляд таблиці</div>' + menuItem('header', 'Рядок-заголовок', { icon: 'headerRow', on: table.classList.contains('tc-has-header') }) +
      menuItem('striped', 'Смугасті рядки', { icon: 'tRows', on: table.classList.contains('tc-striped') }) +
      '<div class="menu-sep"></div>' + menuItem('delTable', 'Видалити таблицю', { icon: 'trash', danger: true });
  }
  Pop.open(anchor, html, v => { tableAction(v); }, { minWidth: 240 });
}

// ── Зміна ширини стовпця й висоти рядка мишкою ──
(function () {
  const EDGE = 5;
  let hover = null, drag = null;
  function edgeAt(e) {
    const cell = e.target.closest && e.target.closest('td,th');
    if (!cell || !editor.contains(cell)) return null;
    const table = cell.closest('table');
    const rc = cell.getBoundingClientRect();
    const G = tableGrid(table);
    const p = G.pos.get(cell);
    if (!p) return null;
    if (Math.abs(e.clientX - rc.right) <= EDGE && p.c + p.cs < G.cols) return { kind: 'col', table, b: p.c + p.cs };
    if (Math.abs(e.clientX - rc.left) <= EDGE && p.c > 0) return { kind: 'col', table, b: p.c };
    if (Math.abs(e.clientY - rc.bottom) <= EDGE) return { kind: 'row', table, row: table.rows[p.r + p.rs - 1] };
    return null;
  }
  editor.addEventListener('mousemove', e => {
    if (drag || e.buttons) return;
    hover = edgeAt(e);
    editor.classList.toggle('col-resize', !!hover && hover.kind === 'col');
    editor.classList.toggle('row-resize', !!hover && hover.kind === 'row');
  });
  editor.addEventListener('mouseleave', () => { if (!drag) { hover = null; editor.classList.remove('col-resize', 'row-resize'); } });
  editor.addEventListener('mousedown', e => {
    if (!hover || e.button !== 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    History.commit();
    const h = hover;
    if (h.kind === 'col') {
      const ws = colWidths(h.table) || measuredWidths(h.table);
      setColWidths(h.table, ws);
      drag = { ...h, x0: e.clientX, ws: colWidths(h.table), tw: h.table.getBoundingClientRect().width };
    } else {
      drag = { ...h, y0: e.clientY, h0: h.row.getBoundingClientRect().height };
    }
  }, true);
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    if (drag.kind === 'col') {
      const d = (e.clientX - drag.x0) / drag.tw * 100;
      const ws = drag.ws.slice();
      const a = drag.b - 1, b2 = drag.b;
      const total = ws[a] + ws[b2];
      ws[a] = clamp(drag.ws[a] + d, 5, total - 5);
      ws[b2] = total - ws[a];
      setColWidths(drag.table, ws);
    } else {
      drag.row.style.height = Math.max(24, Math.round(drag.h0 + e.clientY - drag.y0)) + 'px';
    }
    UI.refreshSoon();
  });
  document.addEventListener('mouseup', () => {
    if (!drag) return;
    drag = null;
    editor.classList.remove('col-resize', 'row-resize');
    History.commit();
  });
  // подвійний клік по межі рядка — повернути автоматичну висоту
  editor.addEventListener('dblclick', e => {
    const h = edgeAt(e);
    if (!h) return;
    e.preventDefault();
    mutate(() => {
      if (h.kind === 'row') { h.row.style.height = ''; if (!h.row.getAttribute('style')) h.row.removeAttribute('style'); }
      else setColWidths(h.table, Array(tableGrid(h.table).cols).fill(1));
    });
  });
})();
function tableTab(cell, back) {
  const table = cell.closest('table');
  const cells = $$('td,th', table);
  const idx = cells.indexOf(cell);
  const target = back ? cells[idx - 1] : cells[idx + 1];
  if (target) { caretEnd(target); return; }
  if (!back) {
    mutate(() => {
      const tr = document.createElement('tr');
      const cols = cell.parentNode.cells.length;
      for (let k = 0; k < cols; k++) { const td = document.createElement('td'); td.appendChild(document.createElement('br')); tr.appendChild(td); }
      cell.parentNode.after(tr);
      caretStart(tr.cells[0]);
    });
  }
}

function toggleCollapsed(b) {
  mutate(() => {
    if (b.hasAttribute('data-collapsed')) b.removeAttribute('data-collapsed'); else b.setAttribute('data-collapsed', '');
    if (b.hasAttribute('data-collapsed')) caretEnd(b.firstElementChild);
  });
  UI.blockBarKey = '';
  UI.refreshSoon();
}
