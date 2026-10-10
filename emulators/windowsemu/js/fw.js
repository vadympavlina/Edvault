// Емулятор Windows · брандмауер Захисника Windows: профілі, правила, перевірка пакетів, журнал. Без DOM.
// Як у справжньому Windows: вимкнений профіль пропускає все; правило «Блокувати» сильніше за «Дозволити»;
// якщо жодне правило не підійшло — діє поведінка за замовчуванням (вхідні — блокувати, вихідні — дозволити).

export const PROFILES = ['domain', 'private', 'public'];
export const PROFILE_NAME = { domain: 'Домен', private: 'Приватний', public: 'Загальнодоступний' };
export const PROFILE_NET = { domain: 'Мережа домену', private: 'Приватна мережа', public: 'Загальнодоступна мережа' };
// Поточна мережа навчального комп’ютера
export const NET = { name: 'SCHOOL-NET', profile: 'private', adapter: 'Ethernet', ip: '192.168.1.27', subnet: '192.168.1.0/24', gateway: '192.168.1.1', dns: '192.168.1.10' };
export const SYS = 'C:\\Windows\\System32\\';
export const PROGRAMS = { ping: SYS + 'PING.EXE', curl: SYS + 'curl.exe', svchost: SYS + 'svchost.exe', system: 'System', edge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', teams: 'C:\\Program Files\\Microsoft Teams\\ms-teams.exe', minecraft: 'C:\\Program Files\\Minecraft Launcher\\MinecraftLauncher.exe', mstsc: SYS + 'mstsc.exe' };
export const PROTOCOLS = ['any', 'TCP', 'UDP', 'ICMPv4', 'ICMPv6', 'IGMP', 'GRE'];
export const PROTO_NUM = { any: '', TCP: 6, UDP: 17, ICMPv4: 1, ICMPv6: 58, IGMP: 2, GRE: 47 };
export const ICMP_TYPES = [[0, 'Луна-відповідь'], [3, 'Пункт призначення недосяжний'], [5, 'Перенаправлення'], [8, 'Луна-запит'], [11, 'Перевищено час'], [13, 'Запит позначки часу']];
export const LOG_PATH = '%systemroot%\\system32\\LogFiles\\Firewall\\pfirewall.log';
export const LOG_FILE = 'C:\\Windows\\System32\\LogFiles\\Firewall\\pfirewall.log';

const lc = s => String(s).toLocaleLowerCase('uk');
const profileDefaults = () => ({ on: true, inbound: 'block', outbound: 'allow', notify: true, unicast: true, localRules: true, ifaces: ['Ethernet', 'Wi-Fi'], log: { path: LOG_PATH, size: 4096, dropped: false, success: false } });

// Стандартні правила (скорочений, але справжній за змістом набір Windows 11)
const R = (o) => ({ desc: '', group: '', dir: 'in', enabled: true, action: 'allow', profiles: 'any', program: 'any', service: 'any', protocol: 'any', localPorts: 'any', remotePorts: 'any', icmp: 'any', localAddr: 'any', remoteAddr: 'any', edge: 'block', iface: 'all', predefined: true, ...o });
const FPS = 'Спільний доступ до файлів і принтерів', CORE = 'Основні мережеві засоби', ND = 'Виявлення мережі', RDP = 'Віддалений робочий стіл', RA = 'Віддалений помічник';
export function defaultRules() {
  return [
    R({ name: `${CORE} — DHCP (DHCP — вхідний)`, group: CORE, protocol: 'UDP', localPorts: '68', remotePorts: '67', program: PROGRAMS.svchost, service: 'Dhcp', desc: 'Дозволяє отримати IP-адресу автоматично від DHCP-сервера.' }),
    R({ name: `${CORE} — Луна-запит ICMPv6 (вхідний)`, group: CORE, protocol: 'ICMPv6', icmp: [128], program: PROGRAMS.system, desc: 'Повідомлення луна-запиту ICMPv6.' }),
    R({ name: `${FPS} (луна-запит — ICMPv4-вхідний)`, group: FPS, enabled: false, protocol: 'ICMPv4', icmp: [8], profiles: ['private', 'public'], program: PROGRAMS.system, desc: 'Повідомлення луна-запиту надсилає команда ping. Увімкніть, щоб цей комп’ютер відповідав на ping.' }),
    R({ name: `${FPS} (луна-запит — ICMPv4-вхідний) `, group: FPS, enabled: false, protocol: 'ICMPv4', icmp: [8], profiles: ['domain'], program: PROGRAMS.system, desc: 'Те саме для мережі домену.' }),
    R({ name: `${FPS} (SMB — вхідний)`, group: FPS, enabled: false, protocol: 'TCP', localPorts: '445', profiles: ['private', 'public'], program: PROGRAMS.system, desc: 'Спільні папки й принтери (протокол SMB, порт 445).' }),
    R({ name: `${FPS} (NB-сеанс — вхідний)`, group: FPS, enabled: false, protocol: 'TCP', localPorts: '139', profiles: ['private', 'public'], program: PROGRAMS.system }),
    R({ name: `${ND} (NB-Name — вхідний)`, group: ND, protocol: 'UDP', localPorts: '137', profiles: ['private'], program: PROGRAMS.system, desc: 'Щоб інші комп’ютери бачили цей у «Мережі».' }),
    R({ name: `${ND} (LLMNR-UDP — вхідний)`, group: ND, protocol: 'UDP', localPorts: '5355', profiles: ['private'], program: PROGRAMS.svchost, remoteAddr: ['LocalSubnet'] }),
    R({ name: `${RDP} — користувацький режим (TCP — вхідний)`, group: RDP, enabled: false, protocol: 'TCP', localPorts: '3389', program: PROGRAMS.svchost, service: 'TermService', desc: 'Підключення до цього комп’ютера через «Підключення до віддаленого робочого стола» (порт 3389).' }),
    R({ name: `${RDP} — користувацький режим (UDP — вхідний)`, group: RDP, enabled: false, protocol: 'UDP', localPorts: '3389', program: PROGRAMS.svchost, service: 'TermService' }),
    R({ name: `${RA} (TCP — вхідний)`, group: RA, protocol: 'TCP', profiles: ['domain', 'private'], program: SYS + 'msra.exe', edge: 'defer-app' }),
    R({ name: 'Microsoft Edge (mDNS — вхідний)', group: 'Microsoft Edge', protocol: 'UDP', localPorts: '5353', program: PROGRAMS.edge }),
    R({ name: 'Microsoft Teams', group: '', protocol: 'any', program: PROGRAMS.teams, profiles: ['private'], predefined: false, desc: 'Додано під час встановлення Microsoft Teams.' }),
    R({ name: 'Minecraft Launcher', group: '', protocol: 'TCP', program: PROGRAMS.minecraft, profiles: ['private'], predefined: false, desc: 'Додано, коли ви вперше запустили гру по мережі.' }),
    R({ name: 'Minecraft Launcher ', group: '', protocol: 'TCP', action: 'block', program: PROGRAMS.minecraft, profiles: ['public'], predefined: false }),
    // вихідні
    R({ name: `${CORE} — DNS (UDP — вихідний)`, group: CORE, dir: 'out', protocol: 'UDP', remotePorts: '53', program: PROGRAMS.svchost, service: 'Dnscache', desc: 'Запити до DNS-сервера: ім’я сайту → IP-адреса.' }),
    R({ name: `${CORE} — DHCP (DHCP — вихідний)`, group: CORE, dir: 'out', protocol: 'UDP', localPorts: '68', remotePorts: '67', program: PROGRAMS.svchost, service: 'Dhcp' }),
    R({ name: `${CORE} — Луна-запит ICMPv6 (вихідний)`, group: CORE, dir: 'out', protocol: 'ICMPv6', icmp: [128] }),
    R({ name: `${FPS} (луна-запит — ICMPv4-вихідний)`, group: FPS, dir: 'out', enabled: false, protocol: 'ICMPv4', icmp: [8], profiles: ['private', 'public'], desc: 'Дозволяє надсилати ping, якщо вихідні підключення за замовчуванням заблоковано.' }),
    R({ name: `${FPS} (SMB — вихідний)`, group: FPS, dir: 'out', enabled: false, protocol: 'TCP', remotePorts: '445', profiles: ['private', 'public'], program: PROGRAMS.system }),
    R({ name: 'Microsoft Edge (mDNS — вихідний)', group: 'Microsoft Edge', dir: 'out', protocol: 'UDP', remotePorts: '5353', program: PROGRAMS.edge }),
    R({ name: `${RDP} (TCP — вихідний)`, group: RDP, dir: 'out', enabled: true, protocol: 'TCP', remotePorts: '3389', program: PROGRAMS.mstsc }),
  ];
}
export function defaults() {
  const rules = defaultRules().map((r, i) => ({ id: 'r' + (i + 1), ...r }));
  return { profiles: { domain: profileDefaults(), private: profileDefaults(), public: profileDefaults() }, rules, csr: [], seq: rules.length + 1, ipsecIcmp: false, events: [] };
}
// Стан брандмауера живе разом із файловою системою (і скидається разом із нею)
export function fwOf(fs) { if (!fs.s.fw) fs.s.fw = defaults(); return fs.s.fw; }
export const newId = fw => 'r' + (fw.seq++);

/* ── адреси й порти ── */
const ipNum = s => { const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim()); if (!m || m.slice(1).some(x => +x > 255)) return null; return ((+m[1] << 24) >>> 0) + (+m[2] << 16) + (+m[3] << 8) + +m[4]; };
export const KEYWORDS = { LocalSubnet: 'Локальна підмережа', DNS: 'DNS-сервери', DHCP: 'DHCP-сервери', DefaultGateway: 'Основний шлюз', Internet: 'Інтернет', Intranet: 'Інтрамережа' };
// Адреса: 1.2.3.4, 1.2.3.0/24, 1.2.3.4-1.2.3.9 або ключове слово
export function validAddr(s) {
  const t = String(s).trim();
  if (Object.keys(KEYWORDS).some(k => lc(k) === lc(t))) return true;
  if (ipNum(t) != null) return true;
  let m = /^(.+)\/(\d{1,2})$/.exec(t); if (m) return ipNum(m[1]) != null && +m[2] <= 32;
  m = /^(.+)-(.+)$/.exec(t); if (m) return ipNum(m[1]) != null && ipNum(m[2]) != null && ipNum(m[1]) <= ipNum(m[2]);
  return false;
}
function addrMatch(list, ip) {
  if (list === 'any' || !list?.length) return true;
  const n = ipNum(ip); if (n == null) return false;
  const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  return list.some(a => {
    const k = lc(a.trim());
    if (k === 'localsubnet' || k === 'intranet') return ip.startsWith('192.168.1.');
    if (k === 'internet') return !priv;
    if (k === 'dns') return ip === NET.dns;
    if (k === 'dhcp' || k === 'defaultgateway') return ip === NET.gateway;
    if (ipNum(a) != null) return ipNum(a) === n;
    let m = /^(.+)\/(\d{1,2})$/.exec(a); if (m) { const bits = +m[2], mask = bits ? (0xffffffff << (32 - bits)) >>> 0 : 0; return ((ipNum(m[1]) & mask) >>> 0) === ((n & mask) >>> 0); }
    m = /^(.+)-(.+)$/.exec(a); if (m) return n >= ipNum(m[1]) && n <= ipNum(m[2]);
    return false;
  });
}
// Порти: 80, 80,443, 8000-8080 (від 1 до 65535)
export function validPorts(s) {
  const t = String(s).trim(); if (!t) return false;
  return t.split(',').every(p => { const m = /^\s*(\d{1,5})(?:\s*-\s*(\d{1,5}))?\s*$/.exec(p); return m && +m[1] >= 1 && +m[1] <= 65535 && (!m[2] || (+m[2] >= +m[1] && +m[2] <= 65535)); });
}
function portMatch(spec, port) {
  if (spec === 'any' || spec == null) return true;
  if (port == null) return false;
  return String(spec).split(',').some(p => { const [a, b] = p.split('-').map(x => +x.trim()); return b ? port >= a && port <= b : port === a; });
}

/* ── перевірка пакета ── */
export const profilesOf = r => r.profiles === 'any' ? PROFILES : r.profiles;
export function matches(r, pkt, profile) {
  if (!r.enabled || r.dir !== pkt.dir) return false;
  if (!profilesOf(r).includes(profile)) return false;
  if (r.program !== 'any' && lc(r.program) !== lc(pkt.program || '')) return false;
  if (r.protocol !== 'any' && r.protocol !== pkt.protocol) return false;
  if (r.protocol === 'TCP' || r.protocol === 'UDP') { if (!portMatch(r.localPorts, pkt.localPort) || !portMatch(r.remotePorts, pkt.remotePort)) return false; }
  if ((r.protocol === 'ICMPv4' || r.protocol === 'ICMPv6') && r.icmp !== 'any' && !r.icmp.includes(pkt.icmpType)) return false;
  if (!addrMatch(r.remoteAddr, pkt.remoteIp)) return false;
  if (!addrMatch(r.localAddr, NET.ip)) return false;
  return true;
}
// pkt: { dir: 'in'|'out', protocol, localPort, remotePort, remoteIp, program, icmpType }
// → { allow, rule, why: 'off' | 'rule' | 'default' | 'blockall' }
export function evaluate(fw, pkt, profile = NET.profile) {
  const p = fw.profiles[profile];
  if (!p.on) return { allow: true, why: 'off' };
  const hits = fw.rules.filter(r => matches(r, pkt, profile));
  if (pkt.dir === 'in' && p.inbound === 'blockall') return { allow: false, why: 'blockall' };
  const block = hits.find(r => r.action === 'block');
  if (block) return { allow: false, rule: block, why: 'rule' };
  const allow = hits.find(r => r.action !== 'block');
  if (allow) return { allow: true, rule: allow, why: 'rule' };
  const def = pkt.dir === 'in' ? p.inbound === 'allow' : p.outbound === 'allow';
  return { allow: def, why: 'default' };
}
// Запис у журнал pfirewall.log (якщо ввімкнено в профілі)
export function logLine(pkt, res) {
  const d = new Date(), z = n => String(n).padStart(2, '0');
  const src = pkt.dir === 'in' ? pkt.remoteIp : NET.ip, dst = pkt.dir === 'in' ? NET.ip : pkt.remoteIp;
  const sp = pkt.dir === 'in' ? pkt.remotePort : pkt.localPort, dp = pkt.dir === 'in' ? pkt.localPort : pkt.remotePort;
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())} ${res.allow ? 'ALLOW' : 'DROP'} ${pkt.protocol === 'ICMPv4' ? 'ICMP' : pkt.protocol} ${src} ${dst} ${sp ?? '-'} ${dp ?? '-'} 0 - - - - ${pkt.protocol === 'ICMPv4' ? pkt.icmpType : '-'} - - ${pkt.dir === 'in' ? 'RECEIVE' : 'SEND'} ${pkt.dir === 'in' ? 1 : 2}`;
}
export const LOG_HEAD = '#Version: 1.5\r\n#Software: Microsoft Windows Firewall\r\n#Time Format: Local\r\n#Fields: date time action protocol src-ip dst-ip src-port dst-port size tcpflags tcpsyn tcpack tcpwin icmptype icmpcode info path pid\r\n\r\n';

/* ── підписи для таблиць ── */
export const actionText = a => ({ allow: 'Дозволити', block: 'Блокувати', secure: 'Дозволити (захищене)' }[a]);
export const profilesText = r => r.profiles === 'any' || r.profiles.length === 3 ? 'Усі' : r.profiles.map(p => PROFILE_NAME[p]).join(', ');
export const protoText = p => p === 'any' ? 'Будь-який' : p;
export const portsText = s => s === 'any' ? 'Будь-який' : s;
export const addrText = a => a === 'any' ? 'Будь-яка' : a.map(x => KEYWORDS[Object.keys(KEYWORDS).find(k => lc(k) === lc(x))] || x).join(', ');
export const programText = p => p === 'any' ? 'Будь-яка' : p;
export const edgeText = e => ({ block: 'Блокувати обхід через межу', allow: 'Дозволити обхід через межу', 'defer-app': 'Відкласти до програми', 'defer-user': 'Відкласти до користувача' }[e]);
export const inboundText = v => ({ block: 'Блокувати (за замовчуванням)', blockall: 'Блокувати всі підключення', allow: 'Дозволити' }[v]);
export const outboundText = v => ({ allow: 'Дозволити (за замовчуванням)', block: 'Блокувати' }[v]);
export const groupsOf = fw => [...new Set(fw.rules.map(r => r.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));

// Список «Дозволені програми» в Панелі керування: групи й окремі програми з вхідними правилами «Дозволити»
export function allowedApps(fw) {
  const out = new Map();
  for (const r of fw.rules) {
    if (r.dir !== 'in' || r.action === 'block') continue;
    const key = r.group || r.name.trim();
    if (!out.has(key)) out.set(key, { key, name: key, rules: [], custom: !r.predefined });
    out.get(key).rules.push(r);
  }
  return [...out.values()].map(a => ({ ...a, on: a.rules.some(r => r.enabled), domain: a.rules.some(r => r.enabled && profilesOf(r).includes('domain')), private: a.rules.some(r => r.enabled && profilesOf(r).includes('private')), public: a.rules.some(r => r.enabled && profilesOf(r).includes('public')) })).sort((a, b) => a.name.localeCompare(b.name, 'uk'));
}
// Поставити або зняти позначку «Приватна» / «Загальнодоступна» для програми зі списку
export function setAppProfile(fw, key, profile, on) {
  for (const r of fw.rules) {
    if (r.dir !== 'in' || r.action === 'block' || (r.group || r.name.trim()) !== key) continue;
    let ps = profilesOf(r).slice();
    if (!r.enabled) ps = [];
    if (on && !ps.includes(profile)) ps.push(profile);
    if (!on) ps = ps.filter(p => p !== profile);
    r.enabled = ps.length > 0;
    if (ps.length) r.profiles = ps.length === 3 ? 'any' : PROFILES.filter(p => ps.includes(p));
  }
}

// Записати подію в журнал (якщо в активному профілі ввімкнено запис) і в список останніх подій
export function record(fs, pkt, res) {
  const fw = fwOf(fs), lg = fw.profiles[NET.profile].log;
  fw.events.unshift({ at: Date.now(), ...pkt, allow: res.allow, rule: res.rule?.name || null, why: res.why });
  fw.events.length = Math.min(fw.events.length, 60);
  if ((res.allow && lg.success) || (!res.allow && lg.dropped)) {
    if (!fs.node(LOG_FILE)) fs.sysWrite(LOG_FILE, LOG_HEAD);
    fs.sysWrite(LOG_FILE, logLine(pkt, res) + '\r\n', true);
  }
  fs.emit('fwlog');
}
