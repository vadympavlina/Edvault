// Адмінка → «Структура»: дерево предметів і папок, вміст папки, вибір кількох елементів,
// перетягування, переміщення між предметами, масові дії й скасування.
// Модуль отримує стан і службові функції від admin.html через ctx.

export function initStructure(ctx) {
  const { st, save, afterChange, confirmBox, toast, editLesson, newLesson, I, esc, cmp, norm, count, store, dbUpdate, dbSet, generateId } = ctx;
  const $ = id => document.getElementById(id);
  const root = $('sec-structure');

  root.innerHTML = `
    <div class="sec-head"><div><h1>Структура</h1><p>Розкладайте уроки по папках: перетягуйте, виділяйте кілька (Ctrl, Shift), переносьте між предметами</p></div></div>
    <div class="st">
      <aside class="st-tree">
        <div class="st-tree-top"><div class="search-wrap">${I.search}<input class="search-inp" id="treeQ" type="search" placeholder="Предмет…" autocomplete="off" /></div></div>
        <div class="tree" id="tree" role="tree" aria-label="Предмети й папки"></div>
      </aside>
      <section class="st-pane">
        <div class="st-bar">
          <nav class="st-crumbs" id="stCrumbs" aria-label="Шлях"></nav>
          <div class="st-actions">
            <div class="search-wrap">${I.search}<input class="search-inp" id="stQ" type="search" placeholder="Знайти в предметі…" autocomplete="off" /></div>
            <button class="btn btn-line" id="stNewFolder" title="Нова папка тут">${I.folderPlus}<span class="btn-label">Папка</span></button>
            <button class="btn btn-solid" id="stNewLesson" title="Новий урок тут">${I.plus}<span class="btn-label">Урок</span></button>
          </div>
        </div>
        <div class="selbar" id="selBar" hidden>
          <label class="ck-all"><input type="checkbox" id="ckAll" aria-label="Виділити все" /></label>
          <b id="selN"></b>
          <button class="btn btn-outline" data-bulk="move">${I.folder}Перемістити до…</button>
          <button class="btn btn-line" data-bulk="tag" id="bulkTagBtn">${I.tag}Тег…</button>
          <button class="btn btn-line" data-bulk="del">${I.trash}Видалити</button>
          <button class="btn btn-ghost" data-bulk="clear" style="margin-left:auto">Скасувати вибір</button>
        </div>
        <div class="st-list card" id="stList" tabindex="0" aria-label="Вміст папки"></div>
        <p class="st-hint">Подвійний клік — відкрити або перейменувати · F2 — перейменувати · Delete — видалити · Backspace — на рівень вище · Ctrl+A — виділити все</p>
      </section>
    </div>`;

  // модальні вікна: «Перемістити до…» і «Тег»
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg" id="mMove" hidden><div class="modal" style="max-width:520px">
      <div class="modal-h"><h2 id="mMoveTitle">Перемістити до…</h2><button type="button" class="icon-btn" data-close aria-label="Закрити">${I.x}</button></div>
      <div class="modal-b" style="padding:10px 12px"><div class="search-wrap" style="max-width:none;margin-bottom:8px">${I.search}<input class="search-inp" id="moveQ" type="search" placeholder="Знайти папку або предмет…" autocomplete="off" /></div><div class="tree pick" id="moveTree"></div></div>
      <div class="modal-f" style="flex-wrap:wrap">
        <div class="new-in" id="moveNew"><input class="inp" id="moveNewName" placeholder="Нова папка в обраному місці" /><button type="button" class="btn btn-line" id="moveNewBtn">${I.folderPlus}Створити</button></div>
        <span class="hint" id="moveTarget">Оберіть папку</span>
        <button type="button" class="btn btn-ghost" data-close>Скасувати</button><button type="button" class="btn btn-solid" id="moveOk" disabled>Перемістити сюди</button>
      </div>
    </div></div>
    <div class="modal-bg" id="mBulkTag" hidden><div class="modal sm">
      <div class="modal-h"><h2>Тег для вибраних уроків</h2><button type="button" class="icon-btn" data-close aria-label="Закрити">${I.x}</button></div>
      <div class="modal-b"><div class="tag-pick" id="bulkTags"></div></div>
    </div></div>`);

  // ══════════ Індекси ══════════
  let X = null;
  const K = (sid, fid) => sid + '|' + (fid || '');
  function index() {
    const { S, L, F } = st();
    const fParent = fid => { const f = F[fid]; return f && F[f.parentId] && F[f.parentId].subjectId === f.subjectId ? f.parentId : null; };
    const lFolder = l => (F[l.folderId] && F[l.folderId].subjectId === l.subjectId ? l.folderId : null);
    const folders = new Map(), lessons = new Map();
    for (const [id, f] of Object.entries(F)) { if (!S[f.subjectId]) continue; const k = K(f.subjectId, fParent(id)); (folders.get(k) || folders.set(k, []).get(k)).push(id); }
    for (const [id, l] of Object.entries(L)) { const k = K(l.subjectId, lFolder(l)); (lessons.get(k) || lessons.set(k, []).get(k)).push(id); }
    folders.forEach(a => a.sort((x, y) => cmp(F[x].name, F[y].name)));
    lessons.forEach(a => a.sort((x, y) => cmp(L[x].title, L[y].title)));
    const deep = new Map();
    const deepCount = (sid, fid) => {
      const k = K(sid, fid);
      if (deep.has(k)) return deep.get(k);
      let n = (lessons.get(k) || []).length;
      for (const c of folders.get(k) || []) n += deepCount(sid, c);
      deep.set(k, n); return n;
    };
    X = { folders, lessons, deepCount, fParent, lFolder };
  }
  const subFolders = (sid, fid) => X.folders.get(K(sid, fid)) || [];
  const subLessons = (sid, fid) => X.lessons.get(K(sid, fid)) || [];
  function pathOf(fid) { const { F } = st(); const p = []; while (fid && F[fid] && p.length < 50) { p.unshift(fid); fid = X.fParent(fid); } return p; }
  function descendants(fid) { const { F } = st(); const out = [fid], sid = F[fid].subjectId; for (let i = 0; i < out.length; i++) out.push(...subFolders(sid, out[i])); return out; }

  // ══════════ Стан ══════════
  const saved = store.get('edvault_admin_struct2', {}) || {};
  let cur = { sid: saved.sid || '', fid: saved.fid || null };
  let open = new Set(saved.open || []);
  let sel = new Set(), anchor = null, q = '', treeQ = '', renaming = null, creating = false;
  const persist = () => store.set('edvault_admin_struct2', { sid: cur.sid, fid: cur.fid, open: [...open].slice(-200) });

  function go(sid, fid = null) {
    cur = { sid, fid }; sel.clear(); anchor = null; renaming = null; creating = false;
    if (q) { q = ''; $('stQ').value = ''; }
    open.add('s:' + sid); pathOf(fid).forEach(f => open.add('f:' + f));
    persist(); render();
  }

  // ══════════ Дерево ══════════
  function treeNode(kind, id, sid, name, lv, n, kids, mode, tq) {
    const key = kind + ':' + id;
    const isOpen = open.has(key) || !!tq;
    const on = mode === 'pick' ? pickTarget && pickTarget.key === key : (kind === 's' ? cur.sid === id && !cur.fid : cur.fid === id);
    return `<div class="tn${on ? ' on' : ''}" role="treeitem" data-node="${key}" data-drop="${key}" style="--lv:${lv}" aria-expanded="${kids ? isOpen : ''}">
      <button type="button" class="tw${kids ? '' : ' none'}" data-tw tabindex="-1" aria-label="Розгорнути">${kids ? I.chevR : ''}</button>
      <span class="ti ${kind === 'f' ? 'folder' : ''}">${kind === 'f' ? I.folder : I.book}</span><span class="tl">${esc(name)}</span><span class="tc">${n || ''}</span>
      ${mode !== 'pick' && kind === 'f' ? '' : ''}</div>`;
  }
  function treeHtml(mode = 'main', tq = '') {
    const { S, F, C } = st();
    const subs = Object.entries(S).sort((a, b) => cmp(a[1].name, b[1].name));
    const matchF = new Set();
    if (tq) for (const [fid, f] of Object.entries(F)) if (norm(f.name).includes(tq)) pathOf(fid).forEach(x => matchF.add(x));
    const walk = (sid, fid, lv) => subFolders(sid, fid).filter(c => !tq || matchF.has(c)).map(c => {
      const kids = subFolders(sid, c).length > 0;
      const inner = (open.has('f:' + c) || tq) && kids ? `<div role="group">${walk(sid, c, lv + 1)}</div>` : '';
      return treeNode('f', c, sid, F[c].name, lv, X.deepCount(sid, c), kids, mode, tq) + inner;
    }).join('');
    let html = '';
    for (const [sid, s] of subs) {
      const hit = !tq || norm(s.name).includes(tq) || subFolders(sid, null).some(f => matchF.has(f)) || [...matchF].some(f => F[f].subjectId === sid);
      if (!hit) continue;
      const kids = subFolders(sid, null).length > 0;
      html += treeNode('s', sid, sid, s.name + (s.active === false ? ' (сховано)' : ''), 0, X.deepCount(sid, null), kids, mode, tq && !norm(s.name).includes(tq) ? tq : '');
      if (kids && (open.has('s:' + sid) || (tq && !norm(s.name).includes(tq)))) html += `<div role="group">${walk(sid, null, 1)}</div>`;
    }
    return html || '<div class="empty-row">Нічого не знайдено</div>';
  }

  // ══════════ Вміст ══════════
  const fmtMeta = l => `${count(l.pagesCount || 1, 'сторінка', 'сторінки', 'сторінок')}${l.isUploaded ? ' · HTML-файл' : ''}`;
  function itemRow(kind, id, extra = '') {
    const { L, F, T } = st();
    const key = kind + ':' + id, isSel = sel.has(key);
    if (kind === 'f') {
      const f = F[id], n = X.deepCount(f.subjectId, id), sub = subFolders(f.subjectId, id).length;
      return `<div class="it${isSel ? ' sel' : ''}" data-k="${key}" data-drop="${key}" draggable="true" role="row" aria-selected="${isSel}">
        <input type="checkbox" class="ck" ${isSel ? 'checked' : ''} tabindex="-1" aria-label="Вибрати" /><span class="ico folder">${I.folder}</span>
        <div class="info">${renaming === key ? `<input class="inp ren" value="${esc(f.name)}" data-ren="${key}" />` : `<div class="name">${esc(f.name)}</div>`}<div class="meta">${[sub ? count(sub, 'папка', 'папки', 'папок') : '', count(n, 'урок', 'уроки', 'уроків')].filter(Boolean).join(' · ')}${extra}</div></div>
        <div class="acts"><button class="icon-btn" data-row="rename" title="Перейменувати (F2)">${I.edit}</button><button class="icon-btn danger" data-row="del" title="Видалити">${I.trash}</button></div></div>`;
    }
    const l = L[id], tag = T[l.tagId];
    return `<div class="it${isSel ? ' sel' : ''}" data-k="${key}" draggable="true" role="row" aria-selected="${isSel}">
      <input type="checkbox" class="ck" ${isSel ? 'checked' : ''} tabindex="-1" aria-label="Вибрати" /><span class="ico">${l.isUploaded ? I.file : I.doc}</span>
      <div class="info">${renaming === key ? `<input class="inp ren" value="${esc(l.title)}" data-ren="${key}" />` : `<div class="name">${esc(l.title || 'Без назви')}</div>`}<div class="meta">${fmtMeta(l)}${extra}</div></div>
      ${tag ? `<span class="pill hide-sm" style="background:${esc(tag.bg)};color:${esc(tag.text)}">${esc(tag.name)}</span>` : ''}
      <div class="acts"><a class="icon-btn hide-sm" href="lesson.html?id=${encodeURIComponent(id)}" target="_blank" rel="noopener" title="Відкрити на порталі">${I.eye}</a><button class="icon-btn" data-row="edit" title="Редагувати урок">${I.edit}</button></div></div>`;
  }
  let viewKeys = [];
  function renderPane() {
    const { S, F, L } = st();
    if (!cur.sid || !S[cur.sid]) {
      $('stCrumbs').innerHTML = ''; $('stList').innerHTML = '<div class="empty-row">Оберіть предмет у дереві ліворуч</div>';
      $('stNewFolder').disabled = $('stNewLesson').disabled = true; $('selBar').hidden = true; viewKeys = []; return;
    }
    if (cur.fid && (!F[cur.fid] || F[cur.fid].subjectId !== cur.sid)) cur.fid = null;
    $('stNewFolder').disabled = $('stNewLesson').disabled = false;
    const path = pathOf(cur.fid);
    $('stCrumbs').innerHTML = `<button data-go="s:${esc(cur.sid)}" data-drop="s:${esc(cur.sid)}" class="${path.length ? '' : 'cur'}">${I.book}${esc(S[cur.sid].name)}</button>` +
      path.map((f, i) => `<span class="sep">›</span><button data-go="f:${esc(f)}" data-drop="f:${esc(f)}" class="${i === path.length - 1 ? 'cur' : ''}">${esc(F[f].name)}</button>`).join('');
    let html = '';
    if (q) {
      // пошук по всьому предмету
      const fl = Object.keys(F).filter(id => F[id].subjectId === cur.sid && norm(F[id].name).includes(q)).sort((a, b) => cmp(F[a].name, F[b].name));
      const ll = Object.keys(L).filter(id => L[id].subjectId === cur.sid && norm(L[id].title).includes(q)).sort((a, b) => cmp(L[a].title, L[b].title));
      const where = fid => ' · ' + I.folder + esc([S[cur.sid].name, ...pathOf(fid).map(x => F[x].name)].join(' › '));
      viewKeys = [...fl.map(id => 'f:' + id), ...ll.map(id => 'l:' + id)];
      html = fl.map(id => itemRow('f', id, where(X.fParent(id)))).join('') + ll.map(id => itemRow('l', id, where(X.lFolder(L[id])))).join('');
      if (!viewKeys.length) html = '<div class="empty-row">Нічого не знайдено в цьому предметі</div>';
    } else {
      const fl = subFolders(cur.sid, cur.fid), ll = subLessons(cur.sid, cur.fid);
      viewKeys = [...fl.map(id => 'f:' + id), ...ll.map(id => 'l:' + id)];
      if (creating) html += `<div class="it new"><span class="ico folder">${I.folderPlus}</span><div class="info"><input class="inp ren" id="newFolderInp" placeholder="Назва нової папки — Enter, щоб створити" /></div></div>`;
      if (cur.fid) html += `<div class="it up" data-drop="${pathOf(cur.fid).length > 1 ? 'f:' + X.fParent(cur.fid) : 's:' + cur.sid}" data-up>${I.up || ''}<span>.. на рівень вище</span></div>`;
      html += fl.map(id => itemRow('f', id)).join('') + ll.map(id => itemRow('l', id)).join('');
      if (!viewKeys.length && !creating) html += `<div class="empty-row">Тут порожньо.<br>Перетягніть сюди уроки з іншої папки або дерева, чи створіть ${cur.fid ? 'підпапку' : 'папку'}.</div>`;
    }
    $('stList').innerHTML = html;
    sel.forEach(k => { if (!viewKeys.includes(k)) sel.delete(k); });
    paintSel();
    const ren = $('stList').querySelector('.ren');
    if (ren) { ren.focus(); ren.select(); }
  }
  function paintSel() {
    const n = sel.size;
    $('selBar').hidden = !n;
    $('selN').textContent = n ? `Вибрано: ${n}` : '';
    $('ckAll').checked = n && n === viewKeys.length;
    $('ckAll').indeterminate = n > 0 && n < viewKeys.length;
    $('bulkTagBtn').hidden = ![...sel].some(k => k[0] === 'l');
    $('stList').querySelectorAll('.it[data-k]').forEach(r => { const on = sel.has(r.dataset.k); r.classList.toggle('sel', on); r.setAttribute('aria-selected', on); const c = r.querySelector('.ck'); if (c) c.checked = on; });
  }
  function renderTree() { $('tree').innerHTML = treeHtml('main', treeQ); }
  function render() {
    if (!$('sec-structure').classList.contains('on') && !forceRender) { dirtyView = true; return; }
    dirtyView = false; index(); renderTree(); renderPane();
  }
  let dirtyView = true, forceRender = false;

  // ══════════ Взаємодія: дерево ══════════
  $('tree').addEventListener('click', e => {
    const n = e.target.closest('[data-node]'); if (!n) return;
    const [kind, id] = n.dataset.node.split(':');
    if (e.target.closest('[data-tw]')) { open.has(n.dataset.node) ? open.delete(n.dataset.node) : open.add(n.dataset.node); persist(); renderTree(); return; }
    const { F } = st();
    if (kind === 's') go(id, null); else go(F[id].subjectId, id);
  });
  $('treeQ').addEventListener('input', e => { treeQ = norm(e.target.value); renderTree(); });

  // ══════════ Взаємодія: список ══════════
  $('stCrumbs').addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    const [k, id] = b.dataset.go.split(':');
    k === 's' ? go(id, null) : go(cur.sid, id);
  });
  let qTimer = 0;
  $('stQ').addEventListener('input', e => { clearTimeout(qTimer); qTimer = setTimeout(() => { q = norm(e.target.value); sel.clear(); renderPane(); }, 100); });
  $('stNewFolder').addEventListener('click', () => { creating = true; q = ''; $('stQ').value = ''; renderPane(); });
  $('stNewLesson').addEventListener('click', () => newLesson({ subjectId: cur.sid, folderId: cur.fid }));

  function selectClick(key, e) {
    if (e.shiftKey && anchor && viewKeys.includes(anchor)) {
      const a = viewKeys.indexOf(anchor), b = viewKeys.indexOf(key);
      if (!(e.ctrlKey || e.metaKey)) sel.clear();
      viewKeys.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(k => sel.add(k));
    } else if (e.ctrlKey || e.metaKey || e.target.classList.contains('ck')) {
      sel.has(key) ? sel.delete(key) : sel.add(key); anchor = key;
    } else { sel.clear(); sel.add(key); anchor = key; }
    paintSel();
  }
  $('stList').addEventListener('click', e => {
    if (e.target.closest('.ren')) return;
    if (e.target.closest('[data-up]')) { goUp(); return; }
    const row = e.target.closest('.it[data-k]'); if (!row) { if (!e.target.closest('.it')) { sel.clear(); paintSel(); } return; }
    const key = row.dataset.k, [kind, id] = key.split(':');
    const act = e.target.closest('[data-row]')?.dataset.row;
    if (act === 'edit') return editLesson(id);
    if (act === 'rename') return startRename(key);
    if (act === 'del') { sel.clear(); sel.add(key); return bulkDelete([key]); }
    if (e.target.closest('a')) return;
    selectClick(key, e);
  });
  $('stList').addEventListener('dblclick', e => {
    if (e.target.closest('.ren, [data-row], .ck')) return;
    const row = e.target.closest('.it[data-k]'); if (!row) return;
    const [kind, id] = row.dataset.k.split(':');
    if (kind === 'f') go(cur.sid, id);
    else if (e.target.closest('.name')) startRename(row.dataset.k);
    else editLesson(id);
  });
  $('ckAll').addEventListener('change', e => { sel = new Set(e.target.checked ? viewKeys : []); paintSel(); });
  function goUp() { if (cur.fid) go(cur.sid, X.fParent(cur.fid)); }

  // ── Перейменування й нова папка ──
  function startRename(key) { renaming = key; renderPane(); }
  $('stList').addEventListener('keydown', async e => {
    const inp = e.target.closest('.ren'); if (!inp) return;
    e.stopPropagation();
    if (e.key === 'Escape') { renaming = null; creating = false; renderPane(); $('stList').focus(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const name = inp.value.trim();
    if (inp.id === 'newFolderInp') { if (name) await createFolder(name, cur.sid, cur.fid); creating = false; render(); $('stList').focus(); return; }
    await commitRename(inp.dataset.ren, name);
  });
  $('stList').addEventListener('focusout', e => {
    const inp = e.target.closest && e.target.closest('.ren'); if (!inp) return;
    setTimeout(() => { if (inp.isConnected && document.activeElement !== inp) { if (inp.id === 'newFolderInp') { const v = inp.value.trim(); creating = false; v ? createFolder(v, cur.sid, cur.fid).then(render) : renderPane(); } else commitRename(inp.dataset.ren, inp.value.trim()); } }, 0);
  });
  let renamingBusy = false;
  async function commitRename(key, name) {
    if (renamingBusy) return;
    const { L, F } = st(); const [kind, id] = key.split(':');
    const old = kind === 'f' ? F[id]?.name : L[id]?.title;
    renaming = null;
    if (!name || name === old) { renderPane(); return; }
    renamingBusy = true;
    const up = kind === 'f' ? { [`folders/${id}/name`]: name } : { [`lessons/${id}/title`]: name, [`lesson_meta/${id}/title`]: name };
    const undo = kind === 'f' ? { [`folders/${id}/name`]: old } : { [`lessons/${id}/title`]: old, [`lesson_meta/${id}/title`]: old };
    await apply(up, undo, 'Перейменовано');
    renamingBusy = false;
    $('stList').focus();
  }
  async function createFolder(name, sid, parentId) {
    const id = generateId(10), folder = { name, subjectId: sid, parentId: parentId || null };
    if (await save(() => dbSet(`/folders/${id}`, folder), 'Папку створено')) { st().F[id] = folder; afterChange(); open.add(parentId ? 'f:' + parentId : 's:' + sid); persist(); return id; }
    return null;
  }

  // ── Клавіатура ──
  document.addEventListener('keydown', e => {
    if (!$('sec-structure').classList.contains('on') || document.querySelector('.modal-bg:not([hidden])')) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.classList.contains('ck')) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'a') { e.preventDefault(); sel = new Set(viewKeys); paintSel(); }
    else if (k === 'Escape' && sel.size) { sel.clear(); paintSel(); }
    else if (k === 'Delete' && sel.size) { e.preventDefault(); bulkDelete([...sel]); }
    else if (k === 'F2' && sel.size === 1) { e.preventDefault(); startRename([...sel][0]); }
    else if (k === 'Enter' && sel.size === 1) { const [kind, id] = [...sel][0].split(':'); kind === 'f' ? go(cur.sid, id) : editLesson(id); }
    else if (k === 'Backspace' && cur.fid) { e.preventDefault(); goUp(); }
    else if ((k === 'ArrowDown' || k === 'ArrowUp') && viewKeys.length) {
      e.preventDefault();
      const i = anchor ? viewKeys.indexOf(anchor) : -1;
      const j = Math.max(0, Math.min(viewKeys.length - 1, i + (k === 'ArrowDown' ? 1 : -1)));
      selectClick(viewKeys[j], { shiftKey: e.shiftKey, ctrlKey: false, metaKey: false, target: {} });
      $('stList').querySelector(`[data-k="${CSS.escape(viewKeys[j])}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  });

  // ══════════ Перетягування ══════════
  let dragKeys = null, hoverTimer = 0, hoverNode = null;
  root.addEventListener('dragstart', e => {
    const row = e.target.closest('.it[data-k]'); if (!row) return;
    if (!sel.has(row.dataset.k)) { sel.clear(); sel.add(row.dataset.k); anchor = row.dataset.k; paintSel(); }
    dragKeys = [...sel];
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragKeys.join(','));
    const ghost = document.createElement('div'); ghost.className = 'drag-ghost'; ghost.textContent = dragKeys.length > 1 ? `${dragKeys.length} елементи` : (row.querySelector('.name')?.textContent || '');
    document.body.appendChild(ghost); e.dataTransfer.setDragImage(ghost, 10, 10); setTimeout(() => ghost.remove(), 0);
    requestAnimationFrame(() => $('stList').querySelectorAll('.it.sel').forEach(r => r.classList.add('dragging')));
  });
  root.addEventListener('dragend', () => { dragKeys = null; clearTimeout(hoverTimer); root.querySelectorAll('.dragging, .drop').forEach(x => x.classList.remove('dragging', 'drop')); });
  const targetOf = key => { const [k, id] = key.split(':'); const { F } = st(); return k === 's' ? { sid: id, fid: null } : { sid: F[id]?.subjectId, fid: id }; };
  function canDrop(keys, t) {
    if (!keys || !t.sid) return false;
    const { F } = st();
    return keys.some(k => {
      const [kind, id] = k.split(':');
      if (kind === 'f') return id !== t.fid && !(t.fid && pathOf(t.fid).includes(id)) && !(F[id].subjectId === t.sid && X.fParent(id) === t.fid);
      const l = st().L[id]; return !(l.subjectId === t.sid && X.lFolder(l) === t.fid);
    });
  }
  root.addEventListener('dragover', e => {
    const el = e.target.closest('[data-drop]');
    root.querySelectorAll('.drop').forEach(x => { if (x !== el) x.classList.remove('drop'); });
    if (!el || !dragKeys) return;
    if (dragKeys.includes(el.dataset.drop) || !canDrop(dragKeys, targetOf(el.dataset.drop))) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drop');
    // затримка над згорнутим вузлом дерева — розгортаємо його
    if (el.classList.contains('tn') && hoverNode !== el.dataset.node) {
      hoverNode = el.dataset.node; clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => { if (!open.has(hoverNode)) { open.add(hoverNode); renderTree(); } }, 650);
    }
  });
  root.addEventListener('drop', async e => {
    const el = e.target.closest('[data-drop]'); if (!el || !dragKeys) return;
    e.preventDefault();
    const keys = dragKeys; dragKeys = null;
    await moveTo(keys, targetOf(el.dataset.drop));
  });

  // ══════════ Операції з базою (атомарно + скасування) ══════════
  function applyLocal(map) {
    const { L, F } = st();
    for (const [p, v] of Object.entries(map)) {
      const [col, id, key] = p.split('/');
      const tgt = col === 'lesson_meta' ? L : col === 'folders' ? F : null;
      if (!tgt) continue;
      if (!key) { if (v === null) delete tgt[id]; else tgt[id] = JSON.parse(JSON.stringify(v)); }
      else if (tgt[id]) { if (v === null) delete tgt[id][key]; else tgt[id][key] = v; }
    }
  }
  async function apply(up, undo, msg) {
    if (!Object.keys(up).length) return false;
    const ok = await save(() => dbUpdate('/', up));
    if (!ok) return false;
    applyLocal(up); afterChange();
    if (msg) undoToast(msg, undo ? async () => { if (await save(() => dbUpdate('/', undo), 'Скасовано')) { applyLocal(undo); afterChange(); } } : null);
    return true;
  }
  function undoToast(msg, fn) {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ok';
    t.innerHTML = `${I.check}<span>${esc(msg)}</span>${fn ? '<button type="button" class="toast-undo">Скасувати</button>' : ''}`;
    box.appendChild(t);
    const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 220); };
    const timer = setTimeout(kill, fn ? 7000 : 2800);
    t.querySelector('.toast-undo')?.addEventListener('click', () => { clearTimeout(timer); kill(); fn(); });
  }

  // переміщення уроків і папок, зокрема в інший предмет (з усім вмістом папки)
  async function moveTo(keys, t) {
    const { L, F, S } = st();
    const up = {}, undo = {};
    const set = (p, v, old) => { up[p] = v; if (!(p in undo)) undo[p] = old === undefined ? null : old; };
    let n = 0, skipped = 0;
    const moving = new Set(keys.filter(k => k[0] === 'f').map(k => k.slice(2)));
    for (const key of keys) {
      const [kind, id] = key.split(':');
      if (kind === 'l') {
        const l = L[id]; if (!l) continue;
        // урок усередині папки, яку теж переносимо, — їде разом з нею
        if (l.folderId && pathOf(X.lFolder(l)).some(f => moving.has(f))) continue;
        if (l.subjectId === t.sid && X.lFolder(l) === t.fid) continue;
        set(`lessons/${id}/folderId`, t.fid, l.folderId || null); set(`lesson_meta/${id}/folderId`, t.fid, l.folderId || null);
        if (l.subjectId !== t.sid) { set(`lessons/${id}/subjectId`, t.sid, l.subjectId); set(`lesson_meta/${id}/subjectId`, t.sid, l.subjectId); }
        n++;
      } else {
        const f = F[id]; if (!f) continue;
        if (id === t.fid || (t.fid && pathOf(t.fid).includes(id))) { skipped++; continue; }
        if (pathOf(X.fParent(id)).some(p => moving.has(p))) continue;
        if (f.subjectId === t.sid && X.fParent(id) === t.fid) continue;
        set(`folders/${id}/parentId`, t.fid, f.parentId || null);
        if (f.subjectId !== t.sid) {
          for (const d of descendants(id)) {
            set(`folders/${d}/subjectId`, t.sid, F[d].subjectId);
            for (const lid of subLessons(f.subjectId, d)) { set(`lessons/${lid}/subjectId`, t.sid, L[lid].subjectId); set(`lesson_meta/${lid}/subjectId`, t.sid, L[lid].subjectId); }
          }
        }
        n++;
      }
    }
    if (skipped) toast('Папку не можна перемістити саму в себе', 'err');
    if (!n) return false;
    const dest = t.fid ? F[t.fid].name : S[t.sid].name;
    const ok = await apply(up, undo, `Переміщено ${count(n, 'елемент', 'елементи', 'елементів')} → ${dest}`);
    if (ok) { sel.clear(); open.add(t.fid ? 'f:' + t.fid : 's:' + t.sid); persist(); render(); }
    return ok;
  }

  // видалення: уроки — назавжди; папки — їхній вміст піднімається до найближчої вцілілої папки
  function bulkDelete(keys) {
    const { L, F } = st();
    const ls = keys.filter(k => k[0] === 'l').map(k => k.slice(2)).filter(id => L[id]);
    const fs = keys.filter(k => k[0] === 'f').map(k => k.slice(2)).filter(id => F[id]);
    if (!ls.length && !fs.length) return;
    const parts = [ls.length ? count(ls.length, 'урок', 'уроки', 'уроків') : '', fs.length ? count(fs.length, 'папку', 'папки', 'папок') : ''].filter(Boolean).join(' і ');
    const one = ls.length + fs.length === 1 ? (ls.length ? `урок «${L[ls[0]].title}»` : `папку «${F[fs[0]].name}»`) : parts;
    confirmBox(`Видалити ${one}?${fs.length ? ' Вміст папок не зникне — він переміститься на рівень вище.' : ''}${ls.length ? ' Видалені уроки не можна відновити.' : ''}`, async ok => {
      if (!ok) return;
      const dead = new Set(fs), up = {}, undo = {};
      const alive = fid => { while (fid && dead.has(fid)) fid = X.fParent(fid); return fid || null; };
      for (const id of fs) {
        up[`folders/${id}`] = null; undo[`folders/${id}`] = { ...F[id] };
        const sid = F[id].subjectId, target = alive(id);
        for (const c of subFolders(sid, id)) if (!dead.has(c)) { up[`folders/${c}/parentId`] = target; undo[`folders/${c}/parentId`] = F[c].parentId || null; }
        for (const lid of subLessons(sid, id)) if (!ls.includes(lid)) {
          up[`lessons/${lid}/folderId`] = up[`lesson_meta/${lid}/folderId`] = target;
          undo[`lessons/${lid}/folderId`] = undo[`lesson_meta/${lid}/folderId`] = L[lid].folderId || null;
        }
      }
      for (const id of ls) { up[`lessons/${id}`] = null; up[`lesson_meta/${id}`] = null; }
      if (fs.includes(cur.fid) || pathOf(cur.fid).some(f => dead.has(f))) cur.fid = alive(cur.fid);
      sel.clear();
      await apply(up, ls.length ? null : undo, `Видалено: ${parts}`);
      render();
    });
  }

  // ── «Перемістити до…» ──
  let pickTarget = null, moveKeys = null, moveQ = '';
  function openMoveDialog(keys) {
    moveKeys = keys; pickTarget = null; moveQ = ''; $('moveQ').value = '';
    index();
    $('mMoveTitle').textContent = `Перемістити ${count(keys.length, 'елемент', 'елементи', 'елементів')} до…`;
    paintMove();
    $('mMove').hidden = false; setTimeout(() => $('moveQ').focus(), 30);
  }
  function paintMove() {
    $('moveTree').innerHTML = treeHtml('pick', moveQ);
    const t = pickTarget && targetOf(pickTarget.key);
    const valid = t && canDrop(moveKeys, t);
    $('moveOk').disabled = !valid;
    const { F, S } = st();
    $('moveTarget').textContent = !t ? 'Оберіть папку або предмет' : valid ? `Куди: ${[S[t.sid].name, ...pathOf(t.fid).map(f => F[f].name)].join(' › ')}` : 'Сюди перемістити не можна';
    $('moveNew').hidden = !t;
  }
  $('moveTree').addEventListener('click', e => {
    const n = e.target.closest('[data-node]'); if (!n) return;
    if (e.target.closest('[data-tw]')) { open.has(n.dataset.node) ? open.delete(n.dataset.node) : open.add(n.dataset.node); paintMove(); return; }
    pickTarget = { key: n.dataset.node }; paintMove();
  });
  $('moveTree').addEventListener('dblclick', e => { if (e.target.closest('[data-node]') && !$('moveOk').disabled) $('moveOk').click(); });
  $('moveQ').addEventListener('input', e => { moveQ = norm(e.target.value); paintMove(); });
  $('moveOk').addEventListener('click', async () => {
    const t = targetOf(pickTarget.key); $('mMove').hidden = true;
    await moveTo(moveKeys, t);
    ctx.onBulkDone?.();
  });
  $('moveNewBtn').addEventListener('click', async () => {
    const name = $('moveNewName').value.trim(); if (!name || !pickTarget) return;
    const t = targetOf(pickTarget.key);
    const id = await createFolder(name, t.sid, t.fid);
    if (id) { $('moveNewName').value = ''; index(); open.add(pickTarget.key); pickTarget = { key: 'f:' + id }; paintMove(); }
  });
  $('moveNewName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('moveNewBtn').click(); } });

  // ── Тег для кількох уроків ──
  let tagKeys = null;
  function openTagDialog(keys) {
    const { T } = st();
    tagKeys = keys.filter(k => k[0] === 'l');
    $('bulkTags').innerHTML = `<button type="button" data-bt="" style="background:var(--bg);color:var(--subtle)">Без тегу</button>` +
      Object.entries(T).sort((a, b) => cmp(a[1].name, b[1].name)).map(([id, t]) => `<button type="button" data-bt="${esc(id)}" style="background:${esc(t.bg)};color:${esc(t.text)}" class="on">${esc(t.name)}</button>`).join('');
    $('mBulkTag').hidden = false;
  }
  $('bulkTags').addEventListener('click', async e => {
    const b = e.target.closest('[data-bt]'); if (!b) return;
    $('mBulkTag').hidden = true;
    const { L } = st(), tag = b.dataset.bt || null, up = {}, undo = {};
    for (const k of tagKeys) {
      const id = k.slice(2); if (!L[id]) continue;
      up[`lessons/${id}/tagId`] = up[`lesson_meta/${id}/tagId`] = tag;
      undo[`lessons/${id}/tagId`] = undo[`lesson_meta/${id}/tagId`] = L[id].tagId || null;
    }
    if (await apply(up, undo, tag ? `Тег «${st().T[tag].name}» додано` : 'Тег прибрано')) { render(); ctx.onBulkDone?.(); }
  });

  // масові дії зі смуги вибору
  $('selBar').addEventListener('click', e => {
    const b = e.target.closest('[data-bulk]'); if (!b) return;
    const keys = [...sel];
    if (b.dataset.bulk === 'move') openMoveDialog(keys);
    else if (b.dataset.bulk === 'tag') openTagDialog(keys);
    else if (b.dataset.bulk === 'del') bulkDelete(keys);
    else { sel.clear(); paintSel(); }
  });

  return {
    render: () => { forceRender = true; render(); forceRender = false; },
    renderIfVisible: render,
    show: () => { if (dirtyView) { forceRender = true; render(); forceRender = false; } },
    go: (sid, fid) => go(sid, fid || null),
    openMoveDialog, openTagDialog, bulkDelete,
    current: () => ({ ...cur }),
  };
}
