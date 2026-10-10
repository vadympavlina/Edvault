// Емулятор Windows · мережа: адаптери Ethernet і Wi‑Fi, DHCP або IP вручну, шлюз, DNS, Wi‑Fi‑мережі.
// Без DOM — перевіряється тестами. Від налаштувань залежать ping, tracert, nslookup, curl і браузер:
// неправильна IP-адреса, шлюз чи DNS справді «ламають» інтернет, як на справжньому комп’ютері.
import { NET } from './fw.js';

const n4 = s => { const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s ?? '').trim()); if (!m || m.slice(1).some(x => +x > 255)) return null; return ((+m[1] << 24) >>> 0) + (+m[2] << 16) + (+m[3] << 8) + +m[4]; };
export const ipOk = s => n4(s) != null;
export function maskOk(s) { const n = n4(s); if (n == null || n === 0) return false; const inv = (~n) >>> 0; return ((inv + 1) & inv) === 0; }
export const sameNet = (a, b, m) => { const x = n4(a), y = n4(b), k = n4(m); return x != null && y != null && k != null && ((x & k) >>> 0) === ((y & k) >>> 0); };
export const prefixOf = m => { let n = n4(m), c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };

// Мережі, до яких можна підключитися
export const NETWORKS = {
  school: { name: 'SCHOOL-NET', subnet: '192.168.1.0', mask: '255.255.255.0', router: '192.168.1.1', dns: '192.168.1.10', profile: 'private', suffix: 'school.local',
    hosts: { '192.168.1.1': ['Роутер', '3c-52-82-1a-7f-08'], '192.168.1.10': ['DNS-сервер школи', '00-15-5d-0a-01-10'], '192.168.1.15': ['Комп’ютер учителя', 'a8-a1-59-3e-11-15'], '192.168.1.22': ['Комп’ютер 22', 'a8-a1-59-3e-11-22'], '192.168.1.31': ['Комп’ютер 31', 'a8-a1-59-3e-11-31'], '192.168.1.40': ['Комп’ютер 40', 'a8-a1-59-3e-11-40'], '192.168.1.104': ['Принтер', '00-80-77-4d-aa-10'] },
    lease: { eth: '192.168.1.27', wifi: '192.168.1.58' } },
  cafe: { name: 'Kavyarnya_Free', subnet: '10.0.0.0', mask: '255.255.255.0', router: '10.0.0.1', dns: '10.0.0.1', profile: 'public', suffix: 'lan',
    hosts: { '10.0.0.1': ['Роутер кав’ярні', 'e4-8d-8c-20-00-01'] }, lease: { wifi: '10.0.0.37' } },
};
// Wi‑Fi поруч: ssid → мережа, захист, пароль (навчальні), сила сигналу 1–4
export const WIFI = [
  { ssid: 'SCHOOL-WIFI', net: 'school', sec: 'WPA2-Personal', pass: 'Shkola2026', signal: 4 },
  { ssid: 'Kavyarnya_Free', net: 'cafe', sec: 'Відкрита', pass: '', signal: 3 },
  { ssid: 'Sused_5G', net: null, sec: 'WPA3-Personal', pass: null, signal: 2 },
  { ssid: 'DIRECT-PRINTER-104', net: null, sec: 'WPA2-Personal', pass: null, signal: 1 },
];
export const MAC = { eth: '3C-52-82-1A-7F-09', wifi: '3C-52-82-1A-7F-0A' };
export const ADAPTER = { eth: 'Ethernet', wifi: 'Бездротова мережа' };
export const DESC = { eth: 'Realtek PCIe GbE Family Controller', wifi: 'Intel(R) Wi-Fi 6 AX201 160MHz' };
// публічні DNS-сервери, що є «в інтернеті»
export const PUBLIC_DNS = ['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1', '9.9.9.9'];

const adapterDefaults = () => ({ on: true, dhcp: true, ip: '', mask: '255.255.255.0', gw: '', dnsAuto: true, dns1: '', dns2: '', released: false });
export function netDefaults() {
  return { eth: { ...adapterDefaults(), cable: true }, wifi: { ...adapterDefaults(), ssid: null, saved: {} }, dnsCache: {}, arp: {}, bytes: { sent: 1843211, recv: 25339184 } };
}
export const netOf = fs => fs.s.net ||= netDefaults();

// Підсумковий стан одного адаптера
function adapterState(fs, id) {
  const S = netOf(fs), a = S[id];
  const net = id === 'eth' ? (a.cable ? NETWORKS.school : null) : (a.ssid ? NETWORKS[WIFI.find(w => w.ssid === a.ssid)?.net] : null);
  const base = { id, name: ADAPTER[id], desc: DESC[id], mac: MAC[id], dhcp: a.dhcp, on: a.on };
  if (!a.on) return { ...base, status: 'disabled' };
  if (!net) return { ...base, status: 'disconnected' };
  const ssid = id === 'wifi' ? a.ssid : null;
  if (a.dhcp) {
    if (a.released) return { ...base, status: 'noip', net, ssid, ip: null, mask: null, gw: null, dns: [] };
    const dns = a.dnsAuto ? [net.dns] : [a.dns1, a.dns2].filter(ipOk);
    return { ...base, status: 'connected', net, ssid, ip: net.lease[id], mask: net.mask, gw: net.router, dns, suffix: net.suffix };
  }
  const ip = ipOk(a.ip) ? a.ip : null, mask = maskOk(a.mask) ? a.mask : null;
  return { ...base, status: ip && mask ? 'connected' : 'noip', net, ssid, ip, mask, gw: ipOk(a.gw) ? a.gw : null, dns: [a.dns1, a.dns2].filter(ipOk), manual: true };
}
export function adapters(fs) { return ['eth', 'wifi'].map(id => adapterState(fs, id)); }
// активне підключення: Ethernet має перевагу над Wi‑Fi (як у Windows — менша метрика)
export function primary(fs) { return adapters(fs).find(a => a.status === 'connected') || null; }
// чи є ця адреса вже в мережі (конфлікт IP)
const conflict = a => !!(a.manual && a.net.hosts[a.ip]);

// Чи дійде пакет до адреси dst. → { ok, err: 'general'|'unreach'|'timeout', via: адаптер, hops }
export function reach(fs, dst) {
  if (dst === '127.0.0.1') return { ok: true, local: true };
  const a = primary(fs);
  if (!a) return { ok: false, err: 'general' };
  if (dst === a.ip) return { ok: true, local: true, via: a };
  if (conflict(a)) return { ok: false, err: 'general', conflict: true, via: a };
  const inReal = sameNet(a.ip, a.net.subnet, a.net.mask) && n4(a.ip) !== n4(a.net.subnet);
  if (sameNet(a.ip, dst, a.mask)) {
    // сусід у тій самій підмережі — відповідає, лише якщо справді існує
    return inReal && a.net.hosts[dst] ? { ok: true, lan: true, via: a, hops: [dst] } : { ok: false, err: 'timeout', via: a };
  }
  if (!a.gw || !sameNet(a.ip, a.gw, a.mask)) return { ok: false, err: 'general', via: a };
  if (a.gw !== a.net.router || !inReal) return { ok: false, err: 'unreach', via: a };
  // інша приватна мережа через інтернет не досяжна
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(dst)) return { ok: false, err: 'timeout', via: a, hops: [a.gw] };
  return { ok: true, via: a, hops: [a.gw, '100.64.0.1', '10.20.0.1', '193.25.180.1', dst] };
}

// DNS: ім’я → IP. lookup(name) → IP або null (база сайтів знаходиться в cmd.js / sites.js)
export function resolveName(fs, name, lookup) {
  const S = netOf(fs), h = String(name).toLocaleLowerCase('uk').replace(/\.$/, '');
  const a = primary(fs);
  if (!a) return { ok: false, err: 'nonet' };
  const servers = a.dns.length ? a.dns : [];
  if (!servers.length) return { ok: false, err: 'noserver', via: a };
  // знаходимо перший сервер, який відповідає: досяжний і справді є DNS-сервером
  const isDns = ip => ip === a.net.dns || ip === a.net.router || PUBLIC_DNS.includes(ip);
  const server = servers.find(s => reach(fs, s).ok && isDns(s));
  if (!server) return { ok: false, err: 'timeout', server: servers[0], via: a };
  const cached = S.dnsCache[h];
  const ip = cached?.ip ?? lookup(h);
  if (!ip) return { ok: false, err: 'nx', server, via: a };
  S.dnsCache[h] = { ip, at: Date.now() };
  const keys = Object.keys(S.dnsCache); if (keys.length > 40) delete S.dnsCache[keys[0]];
  return { ok: true, ip, server, via: a, cached: !!cached };
}

// Записати сусіда в ARP-кеш (після ping чи звернення до шлюзу)
export function arpNote(fs, ip) {
  const a = primary(fs); if (!a) return;
  const host = a.net.hosts[ip]; if (!host || !sameNet(a.ip, ip, a.mask)) return;
  netOf(fs).arp[ip] = host[1];
}

// Синхронізувати живий об’єкт NET (його читають брандмауер, Диспетчер завдань тощо)
export function syncNET(fs) {
  const a = primary(fs);
  Object.assign(NET, a
    ? { name: a.ssid || a.net.name, adapter: a.name, ip: a.ip, gateway: a.gw || '', dns: a.dns[0] || '', subnet: a.net.subnet + '/' + prefixOf(a.mask), profile: a.net.profile, online: true }
    : { name: 'Немає підключення', adapter: '', ip: '0.0.0.0', gateway: '', dns: '', subnet: '', online: false });
}

// Wi‑Fi
export function wifiConnect(fs, ssid, pass, auto = true) {
  const S = netOf(fs), w = WIFI.find(x => x.ssid === ssid);
  if (!w) return { ok: false, err: 'Мережу не знайдено.' };
  if (!S.wifi.on) return { ok: false, err: 'Wi‑Fi вимкнено.' };
  if (!w.net) return { ok: false, err: 'Не вдається підключитися до цієї мережі.' };
  const p = pass ?? S.wifi.saved[ssid];
  if (w.pass && p !== w.pass) return { ok: false, err: 'Неправильний ключ безпеки мережі. Повторіть спробу.', badPass: true };
  S.wifi.ssid = ssid; S.wifi.released = false;
  if (auto) S.wifi.saved[ssid] = w.pass; else delete S.wifi.saved[ssid];
  S.dnsCache = {};
  return { ok: true };
}
export function wifiDisconnect(fs) { const S = netOf(fs); S.wifi.ssid = null; S.dnsCache = {}; }
export function wifiForget(fs, ssid) { const S = netOf(fs); delete S.wifi.saved[ssid]; if (S.wifi.ssid === ssid) S.wifi.ssid = null; }

// Перевірити поля IPv4 «вручну». → { field: текст помилки }
export function checkIPv4({ ip, mask, gw, dns1, dns2 }) {
  const er = {};
  if (!ipOk(ip)) er.ip = 'Неправильна IP-адреса. Приклад: 192.168.1.50';
  else if (/^(0|127|22[4-9]|23\d|24\d|25[0-5])\./.test(ip)) er.ip = 'Цю адресу не можна призначити комп’ютеру.';
  if (!maskOk(mask)) er.mask = 'Неправильна маска підмережі. Приклад: 255.255.255.0';
  if (!er.ip && !er.mask) {
    const net = (n4(ip) & n4(mask)) >>> 0, bc = (net | (~n4(mask) >>> 0)) >>> 0;
    if (n4(ip) === net) er.ip = 'Це адреса самої мережі, а не комп’ютера (остання цифра не може бути 0).';
    else if (n4(ip) === bc) er.ip = 'Це широкомовна адреса мережі (для всіх одразу), її не можна призначити комп’ютеру.';
  }
  if (gw && !ipOk(gw)) er.gw = 'Неправильна адреса шлюзу.';
  else if (gw && !er.ip && !er.mask && !sameNet(ip, gw, mask)) er.gw = 'Шлюз має бути в тій самій підмережі, що й IP-адреса.';
  else if (gw && gw === ip) er.gw = 'Шлюз не може збігатися з IP-адресою комп’ютера.';
  if (dns1 && !ipOk(dns1)) er.dns1 = 'Неправильна адреса DNS-сервера.';
  if (dns2 && !ipOk(dns2)) er.dns2 = 'Неправильна адреса DNS-сервера.';
  return er;
}
// Пояснення для учня: чому немає інтернету
export function diagnose(fs) {
  const S = netOf(fs), out = [];
  const eth = adapterState(fs, 'eth'), wifi = adapterState(fs, 'wifi'), a = primary(fs);
  if (!a) {
    if (eth.status === 'disabled' && (wifi.status !== 'connected')) out.push(['bad', 'Адаптер Ethernet вимкнено. Увімкніть його в «Мережевих підключеннях».']);
    else if (eth.status === 'noip') out.push(['bad', S.eth.dhcp ? 'Ethernet не має IP-адреси (її звільнено командою ipconfig /release). Виконайте ipconfig /renew.' : 'Ethernet не має правильної IP-адреси. Перевірте властивості IPv4.']);
    if (wifi.status === 'disconnected' && S.wifi.on) out.push(['bad', 'Wi‑Fi не підключено до жодної мережі.']);
    if (!S.wifi.on) out.push(['bad', 'Wi‑Fi вимкнено.']);
    if (!out.length) out.push(['bad', 'Немає жодного активного мережевого підключення.']);
    return out;
  }
  out.push(['ok', `Підключено: ${a.ssid || a.net.name} (${a.name}), IP-адреса ${a.ip}.`]);
  if (conflict(a)) { out.push(['bad', `Конфлікт IP-адрес: ${a.ip} уже використовує інший пристрій (${a.net.hosts[a.ip][0]}). Виберіть іншу адресу або «Автоматично».`]); return out; }
  if (!sameNet(a.ip, a.net.subnet, a.net.mask)) { out.push(['bad', `IP-адреса ${a.ip} не з цієї мережі (${a.net.subnet}/${prefixOf(a.net.mask)}). Комп’ютер не «бачить» роутер.`]); return out; }
  if (!a.gw) { out.push(['bad', 'Не вказано основний шлюз — комп’ютер не знає, куди надсилати пакети в інтернет.']); return out; }
  if (a.gw !== a.net.router) { out.push(['bad', `Основний шлюз ${a.gw} — це не роутер. Правильна адреса роутера: ${a.net.router}.`]); return out; }
  out.push(['ok', `Роутер (основний шлюз ${a.gw}) відповідає.`]);
  if (!a.dns.length) out.push(['bad', 'Не вказано DNS-сервер — імена сайтів не перетворяться на IP-адреси.']);
  else { const r = resolveName(fs, 'poshuk.edvault', () => '185.199.110.20'); out.push(r.ok ? ['ok', `DNS-сервер ${r.server} відповідає.`] : ['bad', `DNS-сервер ${a.dns.join(', ')} не відповідає. Сайти за назвою не відкриються, хоча ping за IP-адресою працює.`]); }
  return out;
}
