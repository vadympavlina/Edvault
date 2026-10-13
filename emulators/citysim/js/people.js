// Симулятор міста · жителі «як у Sims»: родини з іменами, роботою, улюбленцями й думками.
// Думки беруться з реальних умов біля дому: дим від заводу, затор на вулиці, школа поруч…
import { N, Z, FIRST_M, FIRST_F, KIDS_M, KIDS_F, LAST, JOBS, STREETS, THOUGHTS, PET, HOBBY } from './data.js';
import { hash } from './maps.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];

// Назва вулиці для клітинки: найближча дорога, горизонтальна чи вертикальна
export function streetOf(c, i) {
  const s = c.s, M = c.m, r = M?.nearRoad?.[i] ?? -1; if (r < 0) return 'околиця';
  const x = r % N, y = (r / N) | 0, horiz = (x > 0 && s.road[r - 1]) || (x < N - 1 && s.road[r + 1]);
  const k = horiz ? Math.floor(hash(y, 11) * STREETS.length) : Math.floor(hash(x, 23) * STREETS.length);
  return `вул. ${STREETS[k]}`;
}

// Що зараз найбільше турбує або радує родину
export function concerns(c, i, fam) {
  const s = c.s, M = c.m, kids = fam ? fam.members.some(m => m.age < 18) : true, out = [];
  if (!M.powered[i]) out.push(['blackout', 40]);
  if (M.poll[i] > 42) out.push(['smog', M.poll[i] * 0.7]);
  if (M.commute[i] > 42) out.push(['jam', (M.commute[i] - 30) * 0.8]);
  if (fam && fam.members.some(m => m.age >= 18 && m.age < 65 && !m.job)) out.push(['noJob', 28 + M.unemp * 40]);
  if (kids && M.cov.school[i] < 0.3) out.push(['noSchool', 26]);
  if (M.cov.health[i] < 0.2) out.push(['noHealth', 16]);
  if (M.crime[i] > 42) out.push(['crime', M.crime[i] * 0.5]);
  if (s.taxes.r >= 13) out.push(['taxes', (s.taxes.r - 10) * 6]);
  if (s.flags.garbage) out.push(['garbage', 20 * s.flags.garbage]);
  if (M.cov.park[i] < 0.08 && M.lv[i] < 45) out.push(['noPark', 10]);
  const good = [];
  if (M.cov.park[i] > 0.45) good.push('park');
  if (M.transit[i] > 0.25) good.push('bus');
  if (M.poll[i] < 8) good.push('cleanAir');
  if (kids && M.cov.school[i] > 0.6) good.push('school');
  if (s.flags.uniOk && fam?.members.some(m => m.edu === 'uni')) good.push('uni');
  if (M.cov.health[i] > 0.6) good.push('health');
  if (M.crime[i] < 12) good.push('safe');
  if (s.taxes.r <= 7) good.push('lowTax');
  if (M.lv[i] > 75) good.push('rent');
  if (M.happy[i] > 72) good.push('happy');
  if (fam?.members.some(m => m.job && m.near)) good.push('goodJob');
  return { bad: out.sort((a, b) => b[1] - a[1]), good };
}

export function thought(c, i, fam, r) {
  const { bad, good } = concerns(c, i, fam), happy = c.m.happy[i];
  const key = bad.length && (happy < 60 || bad[0][1] > 30) ? bad[0][0] : good.length ? pick(r, good) : 'happy';
  const text = pick(r, THOUGHTS[key]).replace('{street}', streetOf(c, i));
  return { key, text, bad: !!(bad.length && key === bad[0][0]) };
}

function newFamily(c, i) {
  const r = c.r, last = pick(r, LAST), n = 1 + Math.floor(r() * 4), members = [];
  const fem = r() < 0.5, age0 = 24 + Math.floor(r() * 30);
  members.push({ n: pick(r, fem ? FIRST_F : FIRST_M), f: fem, age: age0 });
  if (n > 1 && r() < 0.8) members.push({ n: pick(r, fem ? FIRST_M : FIRST_F), f: !fem, age: age0 + Math.floor(r() * 7) - 3 });
  while (members.length < n) { const f = r() < 0.5; members.push({ n: pick(r, f ? KIDS_F : KIDS_M), f, age: Math.max(1, age0 - 20 - Math.floor(r() * 12)) }); }
  if (r() < 0.12) members.push({ n: pick(r, r() < 0.5 ? FIRST_F : FIRST_M), f: r() < 0.5, age: 66 + Math.floor(r() * 18), grand: true });
  const fam = { id: c.id('f'), i, last, members, pet: r() < 0.45 ? pick(r, PET) : null, hobby: pick(r, HOBBY), since: c.s.month, mood: 60, hue: Math.floor(r() * 360) };
  assignJobs(c, fam);
  return fam;
}
// Робота для дорослих: якщо в місті є вільні місця
function assignJobs(c, fam) {
  const M = c.m, r = c.r;
  for (const m of fam.members) {
    if (m.age < 18 || m.age >= 65) { m.job = null; continue; }
    if (r() < M.unemp * 1.1) { m.job = null; continue; }
    const roll = r(), ht = M.htJobs / Math.max(1, M.jobs), ind = (M.iJobs - M.htJobs) / Math.max(1, M.jobs), svc = M.svcJobs / Math.max(1, M.jobs);
    const cat = roll < ht ? 'ht' : roll < ht + ind ? 'i' : roll < ht + ind + svc ? 'svc' : 'c';
    m.job = pick(r, JOBS[cat]); m.jc = cat; m.near = M.commute[fam.i] < 22;
    m.edu = cat === 'ht' ? 'uni' : r() < (c.s.edu?.high || 0) ? 'uni' : 'school';
  }
}

// Щомісяця: хтось переїжджає, хтось виїжджає, змінюється настрій
export function syncFamilies(c) {
  const s = c.s, M = c.m, r = c.r;
  s.families ||= [];
  const keep = [];
  for (const f of s.families) {
    if (s.zone[f.i] !== Z.R || !s.lvl[f.i] || s.aban[f.i]) {
      const why = !s.lvl[f.i] || s.zone[f.i] !== Z.R ? 'будинок знесли' : thought(c, f.i, f, r).text;
      c.news({ kind: 'leave', fam: f.id, who: `Родина ${f.last}`, text: `Ми виїжджаємо з міста. ${why.endsWith('.') || why.endsWith('!') ? why : why + '.'}`, bad: true, i: f.i, snap: famSnap(f) });
      continue;
    }
    f.mood = Math.round(f.mood * 0.6 + M.happy[f.i] * 0.4);
    for (const m of f.members) if (s.month % 12 === (f.since % 12)) m.age++;
    if (s.month % 6 === 0) assignJobs(c, f);
    keep.push(f);
  }
  s.families = keep;
  const target = Math.min(90, Math.round(M.P / 45));
  if (s.families.length < target) {
    const used = new Set(s.families.map(f => f.i)), cand = [];
    for (let i = 0; i < N * N; i++) if (s.zone[i] === Z.R && s.lvl[i] && !s.aban[i] && !used.has(i)) cand.push(i);
    for (let k = 0; k < Math.min(4, target - s.families.length) && cand.length; k++) {
      const i = cand.splice(Math.floor(r() * cand.length), 1)[0];
      const f = newFamily(c, i); s.families.push(f);
      if (r() < 0.5) c.news({ kind: 'arrive', fam: f.id, who: `Родина ${f.last}`, text: `Переїхали на ${streetOf(c, i)}! ${pick(r, ['Подобається, що поруч є все потрібне.', 'Шукали місто, де можна знайти роботу.', 'Тут гарно й недорого.', 'Діти вже знайшли нових друзів.'])}`, i });
    }
  }
}
export const famSnap = f => ({ last: f.last, n: f.members.length });

// Щомісячні голоси жителів: що кажуть у міській стрічці
export function monthlyVoices(c, n = 3) {
  const s = c.s, r = c.r;
  if (!s.families?.length) return;
  for (let k = 0; k < n; k++) {
    const f = s.families[Math.floor(r() * s.families.length)];
    const adult = f.members.find(m => m.age >= 18) || f.members[0];
    const t = thought(c, f.i, f, r);
    c.news({ kind: 'voice', fam: f.id, who: `${adult.n} ${f.last}`, f: adult.f, text: t.text, key: t.key, bad: t.bad, i: f.i, street: streetOf(c, f.i) });
  }
}
