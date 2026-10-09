// Тренажер пера · покрокова підказка, яку програма складає сама з фігури рівня.
// Кожен крок — що зробити пером (клік / тягнути / тягнути з Alt) і текст для учня.
// Ті самі кроки «виконує» браузерний тест — так перевіряємо, що за підказкою рівень справді проходиться.

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const mirror = (a, p) => ({ x: 2 * a.x - p.x, y: 2 * a.y - p.y });
const len = v => Math.hypot(v.x, v.y);
const collinear = (a) => {
  const vi = sub(a.hin, a), vo = sub(a.hout, a);
  return (vi.x * vo.x + vi.y * vo.y) / (len(vi) * len(vo) || 1) < -0.995;
};
const DIRS = ['вправо', 'вправо й униз', 'вниз', 'вліво й униз', 'вліво', 'вліво й угору', 'вгору', 'вправо й угору'];
export function dirWord(from, to) {
  const v = sub(to, from);
  const k = Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4));
  return DIRS[(k + 8) % 8];
}

// Кроки: { i, n, act: 'click' | 'drag', to?, alt?, then?: 'click' | 'drag', thenTo?, text, close? }
export function planSteps(target) {
  const A = target.anchors, N = A.length, closed = target.closed;
  const steps = [];
  A.forEach((a, i) => {
    const n = i + 1;
    const hin = i === 0 ? null : a.hin; // у першої точки задня ручка з'явиться під час замикання
    const hout = !closed && i === N - 1 ? null : a.hout; // в останньої точки відкритого контуру передня не потрібна
    if (!hin && !hout) steps.push({ i, n, act: 'click', text: `Клікніть у точку ${n}.` });
    else if (!hin && hout) {
      if (i === 0) steps.push({ i, n, act: 'drag', to: hout, text: `Натисніть у точці ${n} і тягніть ${dirWord(a, hout)} — до кружечка-ручки.` });
      else steps.push({ i, n, act: 'click', then: 'drag', thenTo: hout, text: `Клікніть у точку ${n}, потім натисніть на неї ще раз і витягніть одну ручку ${dirWord(a, hout)}.` });
    } else if (hin && !hout) {
      const to = mirror(a, hin);
      if (!closed && i === N - 1) steps.push({ i, n, act: 'drag', to, text: `Натисніть у точці ${n} і тягніть ${dirWord(a, to)}.` });
      else steps.push({ i, n, act: 'drag', to, then: 'click', text: `Натисніть у точці ${n} і тягніть ${dirWord(a, to)}, потім клацніть по ній ще раз — далі піде пряма.` });
    } else if (collinear({ ...a, hin, hout })) {
      steps.push({ i, n, act: 'drag', to: hout, text: `Натисніть у точці ${n} і тягніть ${dirWord(a, hout)}.` });
    } else {
      const to = mirror(a, hin);
      steps.push({ i, n, act: 'drag', to, alt: hout, text: `Натисніть у точці ${n}, тягніть ${dirWord(a, to)}, а тоді затисніть Alt і поверніть ручку ${dirWord(a, hout)}.` });
    }
  });
  if (closed) {
    const a = A[0];
    if (!a.hin) steps.push({ i: 0, n: 1, close: true, act: 'click', text: 'Клікніть у точку 1 — контур замкнеться.' });
    else {
      const to = mirror(a, a.hin);
      if (a.hout && collinear(a)) steps.push({ i: 0, n: 1, close: true, act: 'drag', to, text: `Натисніть на точку 1 і тягніть ${dirWord(a, to)} — контур замкнеться.` });
      else steps.push({ i: 0, n: 1, close: true, act: 'drag', to, altHold: true, text: `Затисніть Alt, натисніть на точку 1 і тягніть ${dirWord(a, to)} — контур замкнеться, а ручка, що виходить із неї, лишиться на місці.` });
    }
  }
  return steps;
}

// Який крок зараз: за кількістю поставлених точок і станом контуру
export function currentStep(steps, editorState, target) {
  const placed = editorState.anchors.length;
  if (editorState.closed || (!target.closed && placed >= target.anchors.length && !editorState.drawing)) return { done: true, text: 'Готово! Натисніть «Перевірити» або Enter.' };
  if (placed > target.anchors.length) return { off: true, text: 'Точок уже більше, ніж потрібно. Скасуйте зайві (Ctrl+Z) або перевірте як є.' };
  // друга половина кроку для щойно поставленої точки: прибрати або витягти одну ручку
  const prev = steps[placed - 1], last = editorState.anchors[placed - 1];
  if (prev && prev.then && editorState.drawing) {
    const pending = prev.then === 'click' ? !!last.hout : !last.hout;
    if (pending) return { step: prev, index: placed - 1, total: steps.length, phase: 'then',
      text: prev.then === 'click' ? `Тепер клацніть по точці ${prev.n} ще раз — далі піде пряма.` : `Тепер натисніть на точку ${prev.n} ще раз і витягніть ручку ${dirWord(last, prev.thenTo)}.` };
  }
  if (!target.closed && placed === target.anchors.length) return { done: true, text: 'Останню точку поставлено — натисніть Enter, щоб перевірити.' };
  const s = steps[placed];
  return s ? { step: s, index: placed, total: steps.length } : { done: true, text: 'Готово! Натисніть «Перевірити».' };
}
