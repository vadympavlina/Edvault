// TextCraft · Edvault — підсвітка синтаксису в блоках коду.
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ПІДСВІТКА КОДУ ═══════════════════════════
   У редакторі розмітку блоку коду не чіпаємо (там лише текст — так не ламаються курсор і набір):
   кольори малює CSS Custom Highlight API поверх тексту. В експортованому HTML ті самі токени
   стають звичайними <span class="tk-…">. */
const HL_TYPES = ['kw', 'str', 'num', 'com', 'fn', 'tag', 'attr', 'prop', 'lit'];
const HL_KW = {
  javascript: 'await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async get set',
  typescript: 'await break case catch class const continue default delete do else enum export extends finally for from function if implements import in instanceof interface let new of private protected public readonly return static super switch this throw try type typeof var void while yield async as declare namespace abstract keyof',
  python: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield print self',
  java: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new package private protected public return short static super switch synchronized this throw throws try void volatile while var String',
  csharp: 'abstract as base bool break byte case catch char class const continue decimal default delegate do double else enum event explicit extern finally float for foreach if implicit in int interface internal is lock long namespace new object operator out override params private protected public readonly ref return sealed short static string struct switch this throw try typeof uint ulong using var virtual void while async await',
  cpp: 'auto bool break case catch char class const constexpr continue default delete do double else enum explicit extern float for friend goto if inline int long namespace new operator private protected public return short signed sizeof static struct switch template this throw try typedef typename union unsigned using virtual void volatile while include define std cout cin endl string vector',
  php: 'abstract and array as break case catch class clone const continue declare default do echo else elseif empty endforeach endif endwhile extends final finally fn for foreach function global if implements include instanceof interface isset list namespace new or print private protected public require require_once return static switch throw trait try unset use var while',
  sql: 'select from where and or not insert into values update set delete create table drop alter add primary key foreign references join left right inner outer full on as order by group having limit offset distinct union all in is null like between exists case when then else end count sum avg min max index view default unique',
  bash: 'if then else elif fi for while until do done case esac function in return exit echo export local read cd ls mkdir rm cp mv cat grep sudo source',
  css: '',
};
const HL_LIT = /^(true|false|null|undefined|None|True|False|NaN|nil)$/;

// Повертає список [початок, кінець, тип] для тексту
function hlTokens(text, lang) {
  const out = [];
  const push = (a, b, t) => { if (b > a) out.push([a, b, t]); };
  lang = lang || '';
  if (lang === 'text' || lang === 'markdown') {
    if (lang === 'markdown') { const re = /^(#{1,6} .*)$|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)/gm; let m; while ((m = re.exec(text))) push(m.index, m.index + m[0].length, m[1] ? 'kw' : m[2] ? 'str' : 'attr'); }
    return out;
  }
  if (lang === 'html' || lang === 'xml') {
    const re = /(<!--[^]*?-->)|(<\/?)([\w:-]+)|([\w:-]+)(?==)|("[^"]*"|'[^']*')|(\/?>)/g;
    let m, inTag = false;
    while ((m = re.exec(text))) {
      const i = m.index;
      if (m[1]) push(i, i + m[1].length, 'com');
      else if (m[3]) { push(i + m[2].length, i + m[2].length + m[3].length, 'tag'); inTag = true; }
      else if (m[4] && inTag) push(i, i + m[4].length, 'attr');
      else if (m[5] && inTag) push(i, i + m[5].length, 'str');
      else if (m[6]) inTag = false;
    }
    return out;
  }
  if (lang === 'json') {
    const re = /("(?:[^"\\\n]|\\.)*")(\s*:)?|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|\b(true|false|null)\b/g;
    let m; while ((m = re.exec(text))) { const i = m.index; if (m[1]) push(i, i + m[1].length, m[2] ? 'prop' : 'str'); else if (m[3]) push(i, i + m[3].length, 'num'); else push(i, i + m[4].length, 'lit'); }
    return out;
  }
  if (lang === 'css') {
    const re = /(\/\*[^]*?\*\/)|("[^"\n]*"|'[^'\n]*')|(@[\w-]+)|([\w-]+)(?=\s*:[^;{}]*[;}\n])|(#[0-9a-fA-F]{3,8}\b|-?\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b)/g;
    let m; while ((m = re.exec(text))) { const i = m.index; if (m[1]) push(i, i + m[1].length, 'com'); else if (m[2]) push(i, i + m[2].length, 'str'); else if (m[3]) push(i, i + m[3].length, 'kw'); else if (m[4]) push(i, i + m[4].length, 'prop'); else push(i, i + m[5].length, 'num'); }
    return out;
  }
  if (lang === 'yaml') {
    const re = /(#.*)|^(\s*-?\s*)([\w.-]+)(?=\s*:)|("[^"\n]*"|'[^'\n]*')|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null|yes|no)\b/gm;
    let m; while ((m = re.exec(text))) { const i = m.index; if (m[1]) push(i, i + m[1].length, 'com'); else if (m[3]) push(i + m[2].length, i + m[2].length + m[3].length, 'prop'); else if (m[4]) push(i, i + m[4].length, 'str'); else if (m[5]) push(i, i + m[5].length, 'num'); else push(i, i + m[6].length, 'lit'); }
    return out;
  }
  // мови, схожі на C / Python / shell — спільний розбір
  const hash = lang === 'python' || lang === 'bash' || lang === '';
  const slash = lang !== 'python' && lang !== 'bash';
  const sqlc = lang === 'sql';
  const kw = new Set((HL_KW[lang] || HL_KW.javascript + ' ' + HL_KW.python).split(' '));
  const ci = lang === 'sql';
  const parts = [];
  if (slash) parts.push('\\/\\*[^]*?\\*\\/', '\\/\\/.*');
  if (hash) parts.push('#.*');
  if (sqlc) parts.push('--.*');
  const re = new RegExp('(' + parts.join('|') + ')|("""[^]*?"""|\'\'\'[^]*?\'\'\'|"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)|(\\b0x[0-9a-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)|(\\$\\{?[A-Za-z_]\\w*\\}?)|([A-Za-z_][\\w$]*)', 'g');
  let m;
  while ((m = re.exec(text))) {
    const i = m.index;
    if (m[1]) push(i, i + m[1].length, 'com');
    else if (m[2]) push(i, i + m[2].length, 'str');
    else if (m[3]) push(i, i + m[3].length, 'num');
    else if (m[4]) push(i, i + m[4].length, 'attr');
    else if (m[5]) {
      const w = m[5];
      if (HL_LIT.test(w)) push(i, i + w.length, 'lit');
      else if (kw.has(ci ? w.toLowerCase() : w)) push(i, i + w.length, 'kw');
      else if (/^\s*\(/.test(text.slice(i + w.length, i + w.length + 3))) push(i, i + w.length, 'fn');
    }
  }
  return out;
}

// HTML з токенами для експорту
function hlHtml(text, lang) {
  let html = '', at = 0;
  for (const [a, b, t] of hlTokens(text, lang)) { html += esc(text.slice(at, a)) + '<span class="tk-' + t + '">' + esc(text.slice(a, b)) + '</span>'; at = b; }
  return html + esc(text.slice(at));
}

// Підсвітка в редакторі
const HL = {
  ok: !!(window.CSS && CSS.highlights && window.Highlight),
  cache: new WeakMap(),
  queued: 0,
  schedule() { if (this.ok && !this.queued) this.queued = requestAnimationFrame(() => { this.queued = 0; this.paint(); }); },
  paint() {
    const sets = {};
    HL_TYPES.forEach(t => { sets[t] = []; });
    $$('pre.tc-code > code', editor).forEach(code => {
      const lang = code.parentNode.dataset.lang || '';
      const text = code.textContent;
      const key = lang + '\u0000' + text;
      let c = this.cache.get(code);
      if (!c || c.key !== key) { c = { key, tokens: lang === 'text' ? [] : hlTokens(text, lang) }; this.cache.set(code, c); }
      if (!c.tokens.length) return;
      // зміщення в тексті → вузли (у блоці може бути кілька текстових вузлів)
      const nodes = []; const w = document.createTreeWalker(code, NodeFilter.SHOW_TEXT); let n, pos = 0;
      while ((n = w.nextNode())) { nodes.push([n, pos]); pos += n.length; }
      const at = off => { for (let k = nodes.length - 1; k >= 0; k--) if (off >= nodes[k][1]) return [nodes[k][0], Math.min(off - nodes[k][1], nodes[k][0].length)]; return null; };
      for (const [a, b, t] of c.tokens) {
        const s = at(a), e = at(b); if (!s || !e) continue;
        const r = new Range(); try { r.setStart(s[0], s[1]); r.setEnd(e[0], e[1]); sets[t].push(r); } catch (err) { /* вузол змінився — перемалюємо наступного разу */ }
      }
    });
    HL_TYPES.forEach(t => CSS.highlights.set('tc-' + t, new Highlight(...sets[t])));
  },
  init() {
    if (!this.ok) return;
    new MutationObserver(() => this.schedule()).observe(editor, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-lang'] });
    this.schedule();
  },
};
