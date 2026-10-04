// TextCraft · Edvault — Експорт у HTML і довідка.
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ЕКСПОРТ ═══════════════════════════ */
function fileName() { return docLabel().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'document'; }
function downloadFile(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Файл «' + name + '» збережено', 'ok');
}
function exportClone() {
  const c = editor.cloneNode(true);
  ['id', 'contenteditable', 'spellcheck', 'role', 'aria-multiline', 'aria-label'].forEach(a => c.removeAttribute(a));
  c.className = 'tc-content';
  $$('img', c).forEach(img => {
    const a = img.dataset.asset && Assets.get(img.dataset.asset);
    if (a) img.setAttribute('src', a.data);
    img.removeAttribute('data-asset');
    img.removeAttribute('draggable');
    img.setAttribute('loading', 'lazy');
    if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
  });
  $$('[data-empty]', c).forEach(el => el.removeAttribute('data-empty'));
  $$('.tc-toggle', c).forEach(b => {
    const d = document.createElement('details');
    d.className = 'tc-block tc-toggle';
    const sum = document.createElement('summary');
    const title = b.firstElementChild;
    if (title) { while (title.firstChild) sum.appendChild(title.firstChild); title.remove(); }
    if (!sum.textContent.trim()) sum.textContent = 'Відповідь';
    d.appendChild(sum);
    while (b.firstChild) d.appendChild(b.firstChild);
    b.replaceWith(d);
  });
  $$('figcaption', c).forEach(f => { if (isEmptyBlock(f)) f.remove(); });
  while (c.firstElementChild && isSplittable(c.firstElementChild) && isEmptyBlock(c.firstElementChild)) c.firstElementChild.remove();
  while (c.lastElementChild && isSplittable(c.lastElementChild) && isEmptyBlock(c.lastElementChild)) c.lastElementChild.remove();
  $$('a[href]', c).forEach(setExternal);
  let n = 0;
  $$('h1,h2,h3', c).forEach(h => { h.id = 'sec-' + (++n); });
  const origBlocks = $$('.tc-prompt,pre.tc-code', editor);
  $$('.tc-prompt,pre.tc-code', c).forEach((b, i) => {
    b.setAttribute('data-copy', plainText(origBlocks[i] || b));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tc-copy';
    btn.textContent = 'Копіювати';
    b.insertBefore(btn, b.firstChild);
  });
  return c;
}
const EXPORT_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
.x-layout{display:flex;align-items:flex-start;min-height:100vh}
.x-toc{width:270px;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto;background:var(--surface);border-right:1px solid var(--border);padding:20px 12px 28px}
.x-toc-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:0 10px 10px}
.x-toc input{width:100%;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);padding:0 10px;font:13px 'Inter',sans-serif;outline:none;margin-bottom:8px}
.x-toc input:focus{border-color:var(--accent-border)}
.x-toc a{display:block;padding:6px 10px;margin-bottom:1px;border-radius:7px;font-size:13px;line-height:1.4;color:var(--text2);text-decoration:none;border-left:2px solid transparent;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.x-toc a:hover{background:var(--surface2);color:var(--text)}
.x-toc a.l1{font-weight:600;color:var(--text)}
.x-toc a.l2{padding-left:20px}
.x-toc a.l3{padding-left:32px;font-size:12.5px}
.x-toc a.active{background:var(--accent-light);color:var(--accent);border-left-color:var(--accent)}
.x-toc a.hidden{display:none}
.x-main{flex:1;min-width:0}
.x-wrap{max-width:var(--page-w,960px);margin:0 auto;padding:40px 24px 120px}
.x-page{--pad-x:72px;--pad-y:60px;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-sm);padding:var(--pad-y) var(--pad-x)}
.x-page .doc-header{margin:calc(-1*var(--pad-y)) calc(-1*var(--pad-x)) 36px;border-radius:13px 13px 0 0}
.tc-content .tc-prompt,.tc-content pre.tc-code{position:relative}
.tc-copy{position:absolute;top:5px;right:8px;z-index:2;height:26px;padding:0 11px;border-radius:7px;cursor:pointer;font:600 11.5px 'Inter',sans-serif;border:1px solid var(--accent-border);background:var(--surface);color:var(--accent);transition:background .12s,color .12s}
.tc-copy:hover{background:var(--accent);color:var(--on-accent)}
pre.tc-code .tc-copy{top:4px;border-color:rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:var(--code-text)}
pre.tc-code .tc-copy:hover{background:rgba(255,255,255,.18);color:#fff}
.tc-copy.done{background:var(--success)!important;border-color:var(--success)!important;color:#fff!important}
.tc-content figure.tc-figure img{cursor:zoom-in}
.x-progress{position:fixed;top:0;left:0;height:3px;width:0;background:var(--accent);z-index:50}
.x-top{position:fixed;right:24px;bottom:24px;width:42px;height:42px;border-radius:50%;border:1px solid var(--border2);background:var(--surface);color:var(--text2);box-shadow:var(--shadow-md);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .15s,transform .15s}
.x-top.show{opacity:1;pointer-events:auto;transform:none}
.x-top svg{width:18px;height:18px}
.x-lightbox{position:fixed;inset:0;z-index:100;display:none;align-items:center;justify-content:center;background:rgba(10,12,18,.9);cursor:zoom-out}
.x-lightbox.open{display:flex}
.x-lightbox img{max-width:94vw;max-height:90vh;border-radius:8px}
.x-foot{text-align:center;font-size:12px;color:var(--muted);margin-top:18px}
@media(max-width:900px){.x-layout{display:block}.x-toc{position:static;width:auto;height:auto;max-height:280px;border-right:0;border-bottom:1px solid var(--border)}.x-page{--pad-x:36px;--pad-y:36px}}
@media(max-width:640px){.x-page{--pad-x:20px;--pad-y:26px;border-radius:12px}.x-wrap{padding:12px 8px 60px}}
@media print{.x-toc,.x-progress,.x-top,.tc-copy,.x-foot{display:none!important}body{background:#fff}.x-wrap{padding:0;max-width:none}.x-page{border:0;box-shadow:none;padding:0}.x-page .doc-header{margin:0 0 28px;border-radius:12px}.tc-content .tc-block,.tc-content pre.tc-code,.tc-content figure,.tc-content table{break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;
const EXPORT_JS = `
(function(){
  var root=document.documentElement,mq=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)');
  function th(){root.setAttribute('data-theme',mq&&mq.matches?'dark':'light')}th();
  if(mq&&mq.addEventListener)mq.addEventListener('change',th);
  function copy(text,done){
    function fb(){var t=document.createElement('textarea');t.value=text;t.style.cssText='position:fixed;opacity:0';document.body.appendChild(t);t.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}t.remove();done(ok)}
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){done(true)},fb);else fb();
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.tc-copy');
    if(b){var blk=b.parentNode;copy(blk.getAttribute('data-copy')||'',function(ok){b.classList.add('done');b.textContent=ok?'Скопійовано':'Виділіть і Ctrl+C';setTimeout(function(){b.classList.remove('done');b.textContent='Копіювати'},1600)});return}
    var img=e.target.closest&&e.target.closest('.tc-content figure img');
    if(img){var lb=document.getElementById('xLightbox');lb.querySelector('img').src=img.src;lb.classList.add('open');return}
    if(e.target.closest&&e.target.closest('#xLightbox'))document.getElementById('xLightbox').classList.remove('open');
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')document.getElementById('xLightbox').classList.remove('open')});
  window.addEventListener('beforeprint',function(){[].forEach.call(document.querySelectorAll('details.tc-toggle'),function(d){d.open=true})});
  var links=[].slice.call(document.querySelectorAll('.x-toc a')),heads=links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1))});
  var bar=document.getElementById('xProgress'),top=document.getElementById('xTop'),sch=false;
  function upd(){sch=false;var d=document.documentElement,max=d.scrollHeight-d.clientHeight;bar.style.width=(max>0?Math.min(100,d.scrollTop/max*100):0)+'%';top.classList.toggle('show',d.scrollTop>600);
    var cur=0;for(var i=0;i<heads.length;i++){if(heads[i]&&heads[i].getBoundingClientRect().top<=110)cur=i;else break}
    links.forEach(function(a,i){a.classList.toggle('active',i===cur)})}
  window.addEventListener('scroll',function(){if(!sch){sch=true;requestAnimationFrame(upd)}},{passive:true});upd();
  top.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
  var f=document.getElementById('xTocFilter');if(f)f.addEventListener('input',function(){var q=f.value.trim().toLowerCase();links.forEach(function(a){a.classList.toggle('hidden',!!q&&a.textContent.toLowerCase().indexOf(q)<0)})});
})();
`;
// Текст CSS-файлу редактора, щоб вбудувати його в експортований HTML (файл має працювати сам по собі)
async function cssText(id) {
  const l = document.getElementById(id);
  try { const t = Array.from(l.sheet.cssRules).map(r => r.cssText).join('\n'); if (t) return t; } catch (e) { /* правила недоступні (file://) */ }
  try { return await (await fetch(l.href)).text(); } catch (e) { return ''; }
}
async function exportHtml() {
  const title = docLabel();
  const [tokensCss, contentCss] = await Promise.all([cssText('tcTokens'), cssText('tcContentCss')]);
  const content = exportClone();
  const heads = $$('h1,h2,h3', content).filter(h => !h.closest('.tc-block,td,th,li,blockquote'));
  const toc = heads.length ? '<aside class="x-toc"><div class="x-toc-title">Зміст</div>' + (heads.length > 8 ? '<input type="text" id="xTocFilter" placeholder="Пошук у змісті…">' : '') +
    heads.map(h => '<a class="l' + h.tagName[1] + '" href="#' + h.id + '">' + esc(h.textContent.trim() || '(без назви)') + '</a>').join('') + '</aside>' : '';
  const h = state.header || defaultHeader();
  const width = { narrow: '780px', normal: '960px', wide: '1320px' }[viewPrefs().width || 'normal'];
  const html = '<!DOCTYPE html>\n<html lang="uk" data-theme="light" data-font="' + esc(viewPrefs().font || 'serif') + '">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="generator" content="TextCraft · Edvault">\n<title>' + esc(title) + '</title>\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet">\n' +
    '<style>' + tokensCss + '</style>\n<style>' + contentCss + '</style>\n<style>:root{--page-w:' + width + '}' + EXPORT_CSS + '</style>\n</head>\n<body>\n' +
    '<div class="x-progress" id="xProgress"></div>\n<div class="x-layout">' + toc + '<main class="x-main"><div class="x-wrap"><article class="x-page">' +
    (h.enabled ? headerMarkup(h, headerTitle(h)) : '') + '\n' + content.outerHTML + '\n</article><div class="x-foot">Створено в TextCraft · Edvault</div></div></main></div>\n' +
    '<button class="x-top" id="xTop" aria-label="Догори"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg></button>\n' +
    '<div class="x-lightbox" id="xLightbox"><img alt=""></div>\n<script>' + EXPORT_JS + '<\/script>\n</body>\n</html>\n';
  downloadFile(fileName() + '.html', html, 'text/html;charset=utf-8');
}

/* ═══════════════════════════ ДОВІДКА ═══════════════════════════ */
function renderHelp() {
  const k = s => s.split('+').map(x => '<span class="kbd">' + esc(IS_MAC ? x.replace('Ctrl', '⌘').replace('Alt', '⌥').replace('Shift', '⇧') : x) + '</span>').join('');
  const rows = [
    ['grp', 'Основне'],
    ['Скасувати / повторити', k('Ctrl+Z') + ' ' + k('Ctrl+Shift+Z')],
    ['Зберегти (автозбереження й так працює)', k('Ctrl+S')],
    ['Вставити блок (промпт, callout, таблицю…)', k('/') + ' на порожньому рядку'],
    ['Перетворити виділене на промпт / callout / код', 'виділіть текст → «Блок»'],
    ['grp', 'Текст'],
    ['Жирний / курсив / підкреслення', k('Ctrl+B') + ' ' + k('Ctrl+I') + ' ' + k('Ctrl+U')],
    ['Закреслення', k('Ctrl+Shift+S')],
    ['Код у рядку', k('Ctrl+E')],
    ['Посилання', k('Ctrl+K')],
    ['Очистити форматування', k('Ctrl+\\')],
    ['Заголовок 1 / 2 / 3 / звичайний текст', k('Ctrl+Alt+1') + ' … ' + k('Ctrl+Alt+0')],
    ['Списки: нумерований / маркований / чекліст', k('Ctrl+Shift+7') + ' ' + k('Ctrl+Shift+8') + ' ' + k('Ctrl+Shift+9')],
    ['Перемістити блок вище / нижче', k('Alt+Shift+↑') + ' ' + k('Alt+Shift+↓')],
    ['grp', 'Швидкий Markdown (на початку рядка + пробіл)'],
    ['Заголовки', k('#') + ' ' + k('##') + ' ' + k('###')],
    ['Списки та чекліст', k('-') + ' ' + k('1.') + ' ' + k('[]')],
    ['Цитата', k('>')],
    ['Блок коду / розділювач (+ Enter)', k('```') + ' ' + k('---')],
    ['grp', 'Блоки'],
    ['Вийти з блоку (callout, цитата)', 'Enter на порожньому рядку'],
    ['Вийти з блоку коду', 'Enter двічі в кінці або ' + k('Ctrl+Enter')],
    ['Прибрати оформлення блоку', k('Backspace') + ' на початку блоку'],
    ['Таблиця: наступна / попередня клітинка', k('Tab') + ' ' + k('Shift+Tab')],
    ['Зображення: вставити', k('Ctrl+V') + ' або перетягніть файл'],
  ];
  $('#helpGrid').innerHTML = rows.map(r => r[0] === 'grp' ? '<div class="grp">' + r[1] + '</div>' : '<span>' + esc(r[0]) + '</span><span>' + r[1] + '</span>').join('');
}
