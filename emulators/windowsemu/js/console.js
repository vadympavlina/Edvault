// Емулятор Windows · вікно «Командний рядок»: введення, історія ↑↓, Tab, Ctrl+C, кольори, ping по рядку.
import { Cmd } from './cmd.js';
import { appIcon } from './icons.js';
import { WM, esc } from './ui.js';

const PALETTE = ['#0c0c0c', '#0037da', '#13a10e', '#3a96dd', '#c50f1f', '#881798', '#c19c00', '#cccccc', '#767676', '#3b78ff', '#16c60c', '#61d6d6', '#e74856', '#b4009e', '#f9f1a5', '#f2f2f2'];

export class Console {
  constructor(sys, cwd, { admin = false } = {}) {
    this.sys = sys;
    this.win = WM.open({ app: 'cmd', exe: 'cmd.exe', title: admin ? 'Адміністратор: Командний рядок' : 'Командний рядок', icon: appIcon('cmd', 16), w: 780, h: 460, minW: 420, minH: 220 });
    this.cmd = new Cmd(sys.fs, {
      open: (a, p) => sys.launch(a, p),
      tasks: () => WM.wins.map(w => ({ name: w.exe, pid: w.pid, title: w.title })),
      admin,
      procs: () => sys.procList(),
      critical: by => sys.isCritical(by),
      kill: by => sys.killProc(by),
    });
    if (cwd && sys.fs.isDir(cwd)) this.cmd.cwd = sys.fs.real(cwd);
    this.hi = -1; this.draft = '';
    this.win.body.innerHTML = `<div class="con" tabindex="-1"><pre class="con-out"></pre><div class="con-line"><span class="con-pr"></span><input class="con-in" aria-label="Команда" spellcheck="false" autocomplete="off" autocapitalize="off"></div></div>`;
    this.$ = s => this.win.body.querySelector(s);
    this.out = this.$('.con-out'); this.inp = this.$('.con-in');
    this.write(this.cmd.banner());
    this.updatePrompt();
    this.bind();
    this.win.onFocus = () => setTimeout(() => this.inp.focus({ preventScroll: true }), 0);
    this.win.onFocus();
    this.win.console = this;
    this.win.cleanup(() => { clearTimeout(this.timer); this.stream = null; });
  }
  write(lines, cls = '') { const f = document.createDocumentFragment(); for (const l of lines) { const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = l + '\n'; f.appendChild(s); } this.out.appendChild(f); this.scroll(); }
  scroll() { const c = this.$('.con'); c.scrollTop = c.scrollHeight; }
  updatePrompt() { this.$('.con-pr').textContent = this.asking ? '' : this.cmd.prompt; this.$('.con-line').classList.toggle('busy', !!this.stream); }
  setColor(c) { const con = this.$('.con'); con.style.background = PALETTE[parseInt(c[0], 16)]; con.style.color = PALETTE[parseInt(c[1], 16)]; con.style.setProperty('--caret', PALETTE[parseInt(c[1], 16)]); }
  bind() {
    const con = this.$('.con');
    con.addEventListener('mouseup', () => { if (!getSelection().toString()) this.inp.focus({ preventScroll: true }); });
    this.inp.addEventListener('keydown', e => {
      if (this.stream) { if (e.ctrlKey && (e.code === 'KeyC' || e.key === 'c')) { e.preventDefault(); this.stopStream(); } else e.preventDefault(); return; }
      if (e.key === 'Enter') { e.preventDefault(); this.exec(this.inp.value); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const h = this.cmd.history; if (!h.length) return;
        if (this.hi < 0) { this.draft = this.inp.value; this.hi = h.length; }
        this.hi = Math.max(0, Math.min(h.length, this.hi + (e.key === 'ArrowUp' ? -1 : 1)));
        this.inp.value = this.hi === h.length ? this.draft : h[this.hi];
        setTimeout(() => this.inp.setSelectionRange(this.inp.value.length, this.inp.value.length));
        return;
      }
      if (e.key === 'Tab') { e.preventDefault(); this.inp.value = this.cmd.complete(this.inp.value); return; }
      if (e.key === 'Escape') { e.preventDefault(); this.inp.value = ''; return; }
      if (e.ctrlKey && (e.code === 'KeyC') && !getSelection().toString()) { e.preventDefault(); this.write([this.cmd.prompt + this.inp.value + '^C', '']); this.inp.value = ''; if (this.asking) { this.cmd.pending = null; this.asking = false; this.updatePrompt(); } return; }
      if (e.ctrlKey && e.code === 'KeyL') { e.preventDefault(); this.out.textContent = ''; return; }
      this.hi = -1; this.cmd.tab = null;
    });
  }
  exec(line) {
    // питання «Ви впевнені (Y/N)?» і відповідь — в одному рядку
    if (this.asking) { this.out.lastChild?.remove(); this.write([this.lastAsk + line]); }
    else this.write([this.cmd.prompt + line]);
    this.inp.value = ''; this.hi = -1;
    const r = this.cmd.run(line);
    this.apply(r);
  }
  apply(r) {
    if (r.clear) this.out.textContent = '';
    if (r.ask) { const q = r.out.pop(); if (r.out.length) this.write(r.out); this.asking = true; this.lastAsk = q; this.write([q]); this.$('.con-pr').textContent = ''; this.inp.focus(); return; }
    this.asking = false;
    if (r.out.length) this.write(r.out);
    if (r.title) this.win.setTitle(r.title);
    if (r.color) this.setColor(r.color);
    if (r.exit) { this.win.close(true); return; }
    if (r.stream) { this.runStream(r.stream); return; }
    if (!r.clear || r.out.length) this.write(['']);
    this.updatePrompt();
  }
  // ping: рядки з’являються по одному
  runStream(st) {
    this.stream = st; this.updatePrompt();
    const tick = () => {
      if (!this.stream || !this.win.el.isConnected) return;
      const l = st.next();
      if (l == null) { this.write(st.end()); this.write(['']); this.stream = null; this.updatePrompt(); this.inp.focus(); return; }
      this.write([l]);
      this.timer = setTimeout(tick, st.every);
    };
    this.timer = setTimeout(tick, 250);
  }
  stopStream() { clearTimeout(this.timer); const st = this.stream; this.stream = null; this.write(st.stop()); this.write(['']); this.updatePrompt(); this.inp.focus(); }
}
export { esc };
