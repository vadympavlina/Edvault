// TextCraft · Edvault — Підключення інтерфейсу та старт.
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ПІДКЛЮЧЕННЯ ІНТЕРФЕЙСУ ═══════════════════════════ */
function bindUi() {
  const tbEl = $('#toolbar');
  tbEl.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-cmd]');
    if (c && !c.disabled) { run(c.dataset.cmd); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    switch (act) {
      case 'blockStyle': openBlockStylePop(a); break;
      case 'fontSize': openFontSizePop(a); break;
      case 'color': openColorPop(a); break;
      case 'align': openAlignPop(a); break;
      case 'callout': openCalloutPop(a); break;
      case 'table': openTablePop(a); break;
      case 'docs': openDrawer(); break;
      case 'closeDrawer': closeDrawer(); break;
      case 'newDoc': newDoc(); break;
      case 'clearDoc': clearDoc(); break;
      case 'import': $('#importInput').click(); break;
      case 'toc': toggleToc(); break;
      case 'header': openHeaderModal(); break;
      case 'view': openViewPop(a); break;
      case 'help': renderHelp(); Modal.open('helpModal'); break;
      case 'export': History.commit(); openExportPop(a); break;
    }
  });
  $$('.topbar button, .drawer button').forEach(b => b.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); }));
  $('#imgInput').addEventListener('change', e => { const files = Array.from(e.target.files || []); e.target.value = ''; insertImages(files); });
  $('#importInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; importFile(f); });
  $('#linkOk').addEventListener('click', confirmLink);
  $('#linkRemove').addEventListener('click', () => { const a = linkCtx && linkCtx.a; Modal.close('linkModal'); if (a) removeLink(a); });
  const title = $('#docTitle');
  title.addEventListener('input', () => { state.version++; markDirty(); updateDocTitle(); if (state.header && state.header.enabled && !state.header.title) renderHeader(); });
  title.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); placeCaretInBlock(editor.firstElementChild, 'start'); } });
  document.addEventListener('selectionchange', () => {
    const r = editorRange();
    if (r) lastRange = r.cloneRange();
    if (Slash.open) Slash.check('selection');
    UI.refreshSoon();
  });
  scrollArea.addEventListener('scroll', () => {
    UI.refreshSoon();
    Toc.active();
    $('#backTop').classList.toggle('show', scrollArea.scrollTop > 700);
    if (Slash.open) Slash.close();
  }, { passive: true });
  window.addEventListener('resize', () => { UI.refreshSoon(); Pop.close(); });
  $('#backTop').addEventListener('click', () => scrollArea.scrollTo({ top: 0, behavior: 'smooth' }));
  editor.addEventListener('focus', () => { exec('enableObjectResizing', false); exec('enableInlineTableEditing', false); exec('defaultParagraphSeparator', 'p'); }, { once: true });
  window.addEventListener('beforeunload', e => {
    if (History.timer) History.commit();
    if (state.version !== state.savedVersion || state.saving || state.error) { saveNow(); e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { if (History.timer) History.commit(); saveNow(); } });
  window.addEventListener('pagehide', () => { if (History.timer) History.commit(); saveNow(); });
}

/* ═══════════════════════════ СТАРТ ═══════════════════════════ */
async function init() {
  fillIcons(document);
  exec('defaultParagraphSeparator', 'p');
  bindUi();
  updateUndoButtons();
  const ok = await Store.open();
  if (!ok) toast('Сховище браузера недоступне — документи не збережуться після закриття вкладки. Користуйтеся експортом.', 'err', { duration: 9000 });
  let rec = null;
  const migrated = ok ? await migrateLegacy() : null;
  if (migrated) rec = migrated;
  if (!rec) { let id = null; try { id = localStorage.getItem('textcraft3_current'); } catch (e) { /* ignore */ } if (id) rec = await Store.get(id).catch(() => null); }
  if (!rec) { const list = await Store.list().catch(() => []); if (list.length) rec = await Store.get(list[0].id).catch(() => null); }
  if (!rec) rec = await createDoc({});
  loadDoc(rec);
  if (migrated) toast('Ваш документ перенесено в нову версію TextCraft. Тепер можна мати кілька документів.', 'ok', { duration: 6000 });
  window.TextCraft = { History, normalize, getRange, wrapSelectionAsBlock, sanitizeHTML, mdToHtml, toMarkdown, saveNow, state, Store, run, exportClone, flushSave };
}
init();
