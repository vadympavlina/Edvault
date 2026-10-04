// TextCraft · Edvault — захист від редагування одного документа у двох вкладках.
// Файли підключаються звичайними <script> по черзі й мають спільну глобальну область видимості.
'use strict';

/* ═══════════════════════════ ВКЛАДКИ ═══════════════════════════
   Документ одночасно редагує лише одна вкладка. Інші вкладки з тим самим документом
   переходять у «лише перегляд», показують свіжий текст після кожного збереження
   і можуть забрати редагування собі кнопкою «Редагувати тут».
   Вкладки домовляються через BroadcastChannel; старша (раніше відкрита) має перевагу. */
const Tabs = {
  id: uid('t'), ch: null, docId: null, since: 0, readOnly: false, silent: false, takeTimer: 0, bar: null,
  init() {
    if (!('BroadcastChannel' in window)) return;
    this.ch = new BroadcastChannel('edvault-textcraft');
    this.ch.onmessage = e => this.onMsg(e.data);
    addEventListener('pagehide', () => { if (this.docId && !this.readOnly) this.post({ t: 'leave', doc: this.docId }); });
  },
  post(m) { if (this.ch) this.ch.postMessage(Object.assign({ from: this.id }, m)); },
  // викликається після кожного відкриття документа в цій вкладці
  claim(docId) {
    if (this.silent) return;
    if (this.docId && this.docId !== docId && !this.readOnly) this.post({ t: 'leave', doc: this.docId });
    this.docId = docId;
    this.since = Date.now();
    this.setReadOnly(false);
    this.post({ t: 'hello', doc: docId, since: this.since });
  },
  onMsg(m) {
    if (!m || m.from === this.id || m.doc !== this.docId) return;
    switch (m.t) {
      case 'hello':
        if (this.readOnly) return;
        // старша вкладка лишає редагування собі, новіша переходить у перегляд
        if (this.since < m.since || (this.since === m.since && this.id < m.from)) this.post({ t: 'busy', doc: m.doc, to: m.from });
        else this.setReadOnly(true, 'other');
        break;
      case 'busy': if (m.to === this.id) this.setReadOnly(true, 'other'); break;
      case 'take':
        if (this.readOnly) return;
        flushSave().then(() => { this.setReadOnly(true, 'taken'); this.post({ t: 'released', doc: m.doc, to: m.from }); });
        break;
      case 'released': if (m.to === this.id) this.becomeWriter(); break;
      case 'saved': if (this.readOnly) this.reloadFromStore(); break;
      case 'leave': if (this.readOnly) this.setReadOnly(true, 'free'); break;
    }
  },
  saved() { if (!this.readOnly && this.docId) this.post({ t: 'saved', doc: this.docId }); },
  takeOver() {
    this.post({ t: 'take', doc: this.docId });
    // інша вкладка не відповіла (закрита чи «заснула») — беремо редагування самі
    clearTimeout(this.takeTimer);
    this.takeTimer = setTimeout(() => this.becomeWriter(), 1500);
  },
  async becomeWriter() {
    clearTimeout(this.takeTimer);
    if (!this.readOnly) return;
    await this.reloadFromStore();
    this.since = Date.now();
    this.setReadOnly(false);
    toast('Тепер документ редагується в цій вкладці', 'ok');
  },
  // показати збережену версію (без захоплення редагування)
  async reloadFromStore() {
    const rec = await Store.get(this.docId).catch(() => null);
    if (!rec) {
      toast('Документ видалено в іншій вкладці', 'err');
      const list = await Store.list().catch(() => []);
      const next = list.length ? await Store.get(list[0].id) : await createDoc({});
      loadDoc(next);
      return;
    }
    const top = scrollArea.scrollTop;
    this.silent = true;
    try { loadDoc(rec); } finally { this.silent = false; }
    scrollArea.scrollTop = top;
  },
  setReadOnly(on, why) {
    this.readOnly = !!on;
    document.body.classList.toggle('tc-readonly', this.readOnly);
    editor.contentEditable = this.readOnly ? 'false' : 'true';
    $('#docTitle').readOnly = this.readOnly;
    if (this.readOnly) { UI.hideTransient(); this.showBar(why); setSaveState('readonly'); }
    else { this.hideBar(); setSaveState(state.version === state.savedVersion ? 'saved' : 'dirty'); }
  },
  showBar(why) {
    if (!this.bar) {
      this.bar = document.createElement('div');
      this.bar.className = 'tc-lockbar';
      this.bar.setAttribute('role', 'status');
      this.bar.innerHTML = '<span class="tc-lockbar-ic">' + icon('view') + '</span><span class="tc-lockbar-t"></span><button type="button" class="tc-lockbar-btn"></button>';
      this.bar.querySelector('button').addEventListener('click', () => this.takeOver());
      document.body.appendChild(this.bar);
    }
    const text = why === 'free' ? 'Інша вкладка з цим документом закрилась — можна редагувати тут.'
      : why === 'taken' ? 'Документ тепер редагується в іншій вкладці. Тут — лише перегляд, текст оновлюється сам.'
        : 'Цей документ уже відкрито в іншій вкладці. Тут — лише перегляд, щоб зміни не перезаписали одна одну.';
    this.bar.querySelector('.tc-lockbar-t').textContent = text;
    this.bar.querySelector('button').textContent = 'Редагувати тут';
    this.bar.hidden = false;
  },
  hideBar() { if (this.bar) this.bar.hidden = true; },
};
