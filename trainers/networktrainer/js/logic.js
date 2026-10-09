// Мережі · модель мережі без DOM: кабелі, IP-адреси, маски, шлюз, роутер, DHCP, DNS і ping.
// Перевіряється тестами (tests/network.test.mjs).
//
// Мережа: { devices: [...], links: [[a, b], ...] }
//   пристрій: { id, type: 'pc'|'laptop'|'server'|'printer'|'switch'|'router'|'cloud', name,
//               ip, mask, gw, dns, auto (адреса від DHCP), dnsRecords (для сервера) }
//   роутер:   { ports: { lan1: { ip, mask, dhcp }, lan2: …, wan: {} }, dns (що роздає DHCP) }
//   кінець кабелю — id пристрою або «id:порт» для роутера.

export const MASKS = ['255.255.255.0', '255.255.0.0', '255.0.0.0'];

// Сайти й DNS-сервери «в інтернеті»
export const INTERNET = {
  dns: ['8.8.8.8', '1.1.1.1'],
  names: { 'edvault.online': '185.199.108.153', 'google.com': '142.250.74.110', 'wikipedia.org': '185.15.59.224', 'youtube.com': '142.250.74.46' },
};
const internetIps = () => new Set([...INTERNET.dns, ...Object.values(INTERNET.names)]);

/* ── адреси ── */
export function parseIp(s) {
  const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*$/.exec(String(s ?? ''));
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some(x => x > 255) || m.slice(1).some(x => x.length > 1 && x[0] === '0')) return null;
  return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
}
export const ipStr = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
export function maskBits(s) {
  const n = parseIp(s); if (n == null) return null;
  const bits = n.toString(2).padStart(32, '0');
  return /^1+0*$/.test(bits) ? bits.indexOf('0') < 0 ? 32 : bits.indexOf('0') : null;
}
const maskInt = bits => bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
export const netOf = (ip, mask) => ((parseIp(ip) & maskInt(maskBits(mask))) >>> 0);
export const sameNet = (a, b, mask) => parseIp(a) != null && parseIp(b) != null && maskBits(mask) != null && netOf(a, mask) === netOf(b, mask);
// Адреса підходить пристрою: не адреса мережі й не широкомовна
export function hostOk(ip, mask) {
  const n = parseIp(ip), bits = maskBits(mask);
  if (n == null || bits == null) return false;
  const hm = ~maskInt(bits) >>> 0, host = (n & hm) >>> 0;
  return host !== 0 && host !== hm;
}

/* ── будова мережі ── */
export const HOSTS = ['pc', 'laptop', 'server', 'printer'];
export const isHost = d => HOSTS.includes(d.type);
export const devOf = ep => ep.split(':')[0];
export const portOf = ep => ep.split(':')[1] || null;
export function nameOf(net, ep) {
  const d = net.devices.find(x => x.id === devOf(ep));
  return d ? d.name + (portOf(ep) ? ' (' + portOf(ep).toUpperCase() + ')' : '') : ep;
}
// Скільки кабелів можна підключити до пристрою/порту
export const capacity = (d, port) => d.type === 'switch' ? 8 : d.type === 'cloud' ? 4 : d.type === 'router' ? (port ? 1 : 0) : 1;
export const usedBy = (net, ep) => net.links.filter(l => l.includes(ep)).length;

// Чи можна з’єднати два кінці кабелю; повертає текст помилки або null
export function canLink(net, a, b) {
  if (devOf(a) === devOf(b)) return 'Не можна з’єднати пристрій сам із собою.';
  if (net.links.some(l => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a))) return 'Ці пристрої вже з’єднані.';
  for (const ep of [a, b]) {
    const d = net.devices.find(x => x.id === devOf(ep));
    if (!d) return 'Немає такого пристрою.';
    if (usedBy(net, ep) >= capacity(d, portOf(ep))) return d.type === 'router' ? `Порт ${portOf(ep).toUpperCase()} на роутері вже зайнятий.` : d.type === 'switch' ? 'У комутатора закінчилися гнізда.' : `У пристрою «${d.name}» лише одне гніздо для кабелю — і воно вже зайняте.`;
  }
  return null;
}

// Частини мережі, з’єднані кабелями (комутатор з’єднує все, що до нього підключено; роутер — ні)
export function segments(net) {
  const parent = {};
  const find = x => { parent[x] ??= x; return parent[x] === x ? x : (parent[x] = find(parent[x])); };
  for (const [a, b] of net.links) parent[find(a)] = find(b);
  return find;
}
// Усі кінці кабелю в мережі (пристрої та порти роутерів)
function endpoints(net) {
  const out = [];
  for (const d of net.devices) {
    if (d.type === 'router') for (const p of Object.keys(d.ports)) out.push(d.id + ':' + p);
    else out.push(d.id);
  }
  return out;
}

// Справжні налаштування хостів — з урахуванням DHCP
export function effective(net) {
  const find = segments(net), res = {}, given = {};
  for (const d of net.devices) {
    if (!isHost(d)) continue;
    if (!d.auto) { res[d.id] = { ip: d.ip || '', mask: d.mask || '', gw: d.gw || '', dns: d.dns || '', auto: false }; continue; }
    const seg = find(d.id);
    let lease = null;
    for (const r of net.devices.filter(x => x.type === 'router')) for (const [p, cfg] of Object.entries(r.ports)) {
      if (lease || !cfg.dhcp || find(r.id + ':' + p) !== seg || !hostOk(cfg.ip, cfg.mask)) continue;
      const k = r.id + ':' + p; given[k] = (given[k] || 0) + 1;
      lease = { ip: ipStr((netOf(cfg.ip, cfg.mask) + 99 + given[k]) >>> 0), mask: cfg.mask, gw: cfg.ip, dns: r.dns || cfg.ip, auto: true };
    }
    res[d.id] = lease || { ip: '', mask: '', gw: '', dns: '', auto: true, noDhcp: true };
  }
  return res;
}

// Хто має цю IP-адресу: [{ ep, dev }]
function owners(net, eff, ip) {
  const n = parseIp(ip), out = [];
  if (n == null) return out;
  for (const d of net.devices) {
    if (isHost(d) && parseIp(eff[d.id]?.ip) === n) out.push({ ep: d.id, dev: d });
    if (d.type === 'router') for (const [p, c] of Object.entries(d.ports)) if (parseIp(c.ip) === n) out.push({ ep: d.id + ':' + p, dev: d, port: p });
  }
  return out;
}

// Шлях кабелями між двома кінцями (для анімації пакета): список кінців
export function cablePath(net, from, to) {
  const adj = {};
  for (const [a, b] of net.links) { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); }
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const x = q.shift();
    if (x === to) break;
    // пакет іде лише через комутатори, а не крізь інші комп’ютери чи роутери
    if (x !== from && net.devices.find(d => d.id === devOf(x))?.type !== 'switch') continue;
    for (const y of adj[x] || []) if (!(y in prev)) { prev[y] = x; q.push(y); }
  }
  if (!(to in prev)) return null;
  const path = []; for (let x = to; x != null; x = prev[x]) path.unshift(x);
  return path;
}

/* ── ping ── */
// Результат: { ok, reason, path: [кінці кабелю], ip }
export function ping(net, fromId, target, depth = 0) {
  const eff = effective(net), find = segments(net);
  const src = net.devices.find(d => d.id === fromId);
  const S = eff[fromId], sn = src?.name;
  const fail = (reason, path = [fromId]) => ({ ok: false, reason, path });
  if (!src || !S) return fail('Перевіряти зв’язок можна з комп’ютера, ноутбука, сервера чи принтера.');
  if (!usedBy(net, fromId)) return fail(`${sn} не підключено кабелем.`);
  if (S.noDhcp) return fail(`${sn} чекає адресу автоматично, але в його мережі ніхто її не роздає. Увімкніть DHCP на роутері або впишіть адресу вручну.`);
  if (!S.ip) return fail(`${sn} не має IP-адреси.`);
  if (parseIp(S.ip) == null) return fail(`${sn}: «${S.ip}» — неправильна IP-адреса. Вона складається з чотирьох чисел від 0 до 255 через крапку.`);
  if (maskBits(S.mask) == null) return fail(`${sn} не має маски мережі.`);
  if (!hostOk(S.ip, S.mask)) return fail(`Адресу ${S.ip} не можна дати пристрою: числа 0 і 255 в кінці зарезервовані.`);
  const twins = owners(net, eff, S.ip);
  if (twins.length > 1) return fail(`Однакова адреса ${S.ip} у двох пристроїв: ${twins.map(t => nameOf(net, t.ep)).join(' і ')}. Адреса має бути єдиною в мережі — як номер телефону.`);

  // ім’я сайту → адреса через DNS
  let dstIp = target, dstName = null;
  const tdev = net.devices.find(d => d.id === target);
  if (tdev) { dstIp = isHost(tdev) ? eff[tdev.id]?.ip : null; dstName = tdev.name; if (!dstIp) return fail(`${tdev.name} не має IP-адреси.`); }
  else if (parseIp(target) == null) {
    const name = String(target).trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(name)) return fail(`«${target}» — не схоже ні на IP-адресу, ні на назву сайту.`);
    if (!S.dns) return fail(`Щоб знайти адресу ${name}, потрібен DNS-сервер, а ${sn} його не має.`);
    if (parseIp(S.dns) == null) return fail(`«${S.dns}» — неправильна адреса DNS-сервера.`);
    if (depth > 1) return fail('DNS-сервер не відповідає.');
    const q = ping(net, fromId, S.dns, depth + 1);
    if (!q.ok) return { ...q, reason: `DNS-сервер ${S.dns} недоступний. ${q.reason}` };
    const local = net.devices.find(d => isHost(d) && eff[d.id]?.ip === S.dns);
    const isInetDns = INTERNET.dns.includes(S.dns);
    if (!local && !isInetDns) return fail(`За адресою ${S.dns} немає DNS-сервера.`);
    let ip = null;
    if (local) {
      if (!local.dnsRecords) return fail(`${local.name} — не DNS-сервер, він не знає адрес сайтів.`);
      ip = local.dnsRecords[name] ?? null;
      // шкільний DNS не знає імені — питає інтернет-DNS (якщо сам має інтернет)
      if (!ip && INTERNET.names[name] && ping(net, local.id, INTERNET.dns[0], depth + 1).ok) ip = INTERNET.names[name];
    } else ip = INTERNET.names[name] ?? null;
    if (!ip) return fail(`DNS-сервер ${S.dns} не знає сайту ${name}.${isInetDns ? ' Інтернет-DNS не знає шкільних імен — їх знає шкільний сервер.' : ''}`);
    dstIp = ip; dstName = name;
  }
  if (parseIp(dstIp) == null) return fail(`«${dstIp}» — неправильна IP-адреса.`);
  const label = dstName && dstName !== dstIp ? `${dstName} (${dstIp})` : dstIp;
  if (dstIp === S.ip) return { ok: true, path: [fromId], ip: dstIp, reason: 'Це адреса самого пристрою.' };

  // доставка в межах однієї частини мережі
  const deliver = (fromEp, ip, who) => {
    const seg = find(fromEp);
    const here = owners(net, eff, ip).filter(o => find(o.ep) === seg);
    if (here.length > 1) return { err: `Однакова адреса ${ip} у двох пристроїв: ${here.map(o => nameOf(net, o.ep)).join(' і ')}. Пакет не знає, кому з них іти.` };
    if (!here.length) {
      const far = owners(net, eff, ip)[0];
      return { err: far ? (usedBy(net, far.ep) ? `${nameOf(net, far.ep)} і ${who} не з’єднані кабелем.` : `${nameOf(net, far.ep)} не підключено кабелем.`) : `Немає пристрою з адресою ${ip} — перевірте адресу й кабелі.` };
    }
    return { ep: here[0].ep, dev: here[0].dev, path: cablePath(net, fromEp, here[0].ep) };
  };
  // чи знає одержувач, як відповісти назад
  const replyOk = (dst, backIp, viaPortIp) => {
    if (dst.type === 'router') return null;
    const D = eff[dst.id];
    if (sameNet(D.ip, backIp, D.mask)) return null;
    if (!D.gw) return `${dst.name} отримав пакет, але не може відповісти: у нього не вказано шлюз, а ${backIp} — в іншій мережі.`;
    if (viaPortIp && D.gw !== viaPortIp) return `${dst.name} отримав пакет, але відповідь пішла не туди: його шлюз ${D.gw}, а роутер у цій мережі — ${viaPortIp}.`;
    return null;
  };

  if (sameNet(S.ip, dstIp, S.mask)) {
    const r = deliver(fromId, dstIp, sn);
    if (r.err) return fail(r.err);
    if (r.dev.type !== 'router' && !sameNet(eff[r.dev.id].ip, S.ip, eff[r.dev.id].mask)) return fail(`${r.dev.name} має іншу маску й вважає, що ${sn} в іншій мережі.`, r.path);
    return { ok: true, path: r.path, ip: dstIp, reason: `Відповідь від ${label}.` };
  }
  // інша мережа — через шлюз
  const near = owners(net, eff, dstIp).find(o => find(o.ep) === find(fromId));
  if (!S.gw && near && near.dev.type !== 'router') return fail(`${near.dev.name} поруч, але в іншій мережі: ${sn} — ${S.ip}, ${near.dev.name} — ${dstIp}. Перші три числа мають збігатися.`);
  if (!S.gw) return fail(`${label} — в іншій мережі (адреса починається інакше). Щоб туди потрапити, потрібен шлюз — роутер, а ${sn} не має шлюзу.`);
  if (parseIp(S.gw) == null) return fail(`«${S.gw}» — неправильна адреса шлюзу.`);
  if (!sameNet(S.ip, S.gw, S.mask)) return fail(`Шлюз ${S.gw} не з тієї ж мережі, що й ${sn} (${S.ip}). Шлюз — це роутер поруч, його адреса починається так само.`);
  const g = deliver(fromId, S.gw, sn);
  if (g.err) return fail(g.err.startsWith('Немає пристрою') ? `Немає роутера з адресою шлюзу ${S.gw}. Шлюз — це адреса роутера у вашій мережі.` : g.err);
  if (g.dev.type !== 'router') return fail(`За адресою шлюзу ${S.gw} — ${g.dev.name}, а не роутер.`, g.path);
  const R = g.dev, inPort = g.ep;
  let path = g.path;
  // адреса самого роутера
  if (owners(net, eff, dstIp).some(o => o.dev === R)) return { ok: true, path, ip: dstIp, reason: `Відповідь від роутера ${label}.` };
  // мережа за іншим портом роутера
  for (const [p, c] of Object.entries(R.ports)) {
    if (p === 'wan' || !c.ip || !sameNet(c.ip, dstIp, c.mask)) continue;
    const out = R.id + ':' + p;
    if (!usedBy(net, out)) return fail(`Роутер знає мережу ${ipStr(netOf(dstIp, c.mask))}, але до його порту ${p.toUpperCase()} не підключено кабель.`, path);
    const r = deliver(out, dstIp, `порт ${p.toUpperCase()} роутера`);
    if (r.err) return fail(r.err, path);
    path = [...path, ...r.path];
    const back = replyOk(r.dev, S.ip, c.ip);
    if (back) return fail(back, path);
    return { ok: true, path, ip: dstIp, reason: `Відповідь від ${label} через роутер.` };
  }
  if (internetIps().has(dstIp) || !/^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(dstIp)) {
    const wan = R.id + ':wan';
    if (!R.ports.wan) return fail('У роутера немає порту для інтернету.', path);
    const cloud = net.devices.find(d => d.type === 'cloud' && find(d.id) === find(wan));
    if (!cloud) return fail('Роутер не підключено до інтернету: з’єднайте його порт WAN із хмаркою «Інтернет».', path);
    path = [...path, ...cablePath(net, wan, cloud.id)];
    if (!internetIps().has(dstIp)) return fail(`В інтернеті немає сервера з адресою ${dstIp}.`, path);
    return { ok: true, path, ip: dstIp, reason: `Відповідь від ${label} з інтернету.` };
  }
  return fail(`Роутер не знає, де мережа з адресою ${dstIp}: жоден його порт не має адреси з цієї мережі.`, path);
}

/* ── завдання рівня ── */
export function goalLabel(net, g) {
  const n = id => net.devices.find(d => d.id === id)?.name || id;
  return `${n(g.from)} → ${n(g.to)}`;
}
export const checkGoals = (net, goals) => goals.map(g => ({ ...ping(net, g.from, g.to), goal: g }));

// Зірки рівня з мережею: невдалі перевірки й підказка
export function netStars(fails, hint) {
  const s = fails <= 1 ? 3 : fails <= 3 ? 2 : 1;
  return hint ? Math.min(s, 2) : s;
}
export const starsFor = avg => avg >= 0.9 ? 3 : avg >= 0.7 ? 2 : 1;

// Глибока копія мережі рівня — щоб гра не змінювала опис рівня
export const cloneNet = n => JSON.parse(JSON.stringify({ devices: n.devices, links: n.links || [] }));

// Крок розв’язку (для тестів): ['link', a, b] · ['set', id, поле, значення] · ['port', id, порт, поле, значення]
export function applyOp(net, [op, ...a]) {
  const d = id => { const x = net.devices.find(v => v.id === id); if (!x) throw new Error('немає пристрою ' + id); return x; };
  if (op === 'link') { const e = canLink(net, a[0], a[1]); if (e) throw new Error(e); net.links.push([a[0], a[1]]); }
  else if (op === 'unlink') net.links = net.links.filter(l => !(l.includes(a[0]) && l.includes(a[1])));
  else if (op === 'set') d(a[0])[a[1]] = a[2];
  else if (op === 'port') d(a[0]).ports[a[1]][a[2]] = a[3];
  else throw new Error('невідомий крок ' + op);
  return net;
}
