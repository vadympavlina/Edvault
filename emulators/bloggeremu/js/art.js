// Симулятор блогера · ілюстрації: «фото» й «відео» (SVG), аватари. Усе намальоване кодом, без справжніх фото людей.
import { CLIPS } from './data.js';
import { icon, iconPath } from './icons.js';

let uid = 0;
// лічильник скидається перед кожним перемальовуванням: однаковий вміст дає однакові id
export const resetIds = () => { uid = 0; };
const W = 400, H = 500;
const lin = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = c => Math.max(0, Math.min(255, Math.round(c * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(x => x.toString(16).padStart(2, '0')).join(''); };

// Кожна сцена: (id, v) → SVG-вміст. v — 0..1 для невеликих відмінностей між кадрами.
const S = {
  cat: (id, v) => `<defs>${lin(id + 'w', '#f3e4cf', '#e7cfae')}${lin(id + 's', '#9fd3ff', '#d9f0ff')}</defs>
    <rect width="400" height="500" fill="url(#${id}w)"/><rect x="50" y="40" width="300" height="250" rx="10" fill="url(#${id}s)" stroke="#fff" stroke-width="14"/>
    <path d="M200 40v250M50 165h300" stroke="#fff" stroke-width="10"/><circle cx="${290 + v * 20}" cy="95" r="26" fill="#fff6c9"/>
    <rect x="20" y="300" width="360" height="26" rx="6" fill="#d9b48a"/><rect x="0" y="326" width="400" height="174" fill="#e3c9a3"/>
    <g class="cat"><ellipse cx="200" cy="268" rx="96" ry="46" fill="#f2a64b"/><path d="M290 270q60-10 46-70" stroke="#f2a64b" stroke-width="20" fill="none" stroke-linecap="round"/>
    <circle cx="140" cy="222" r="52" fill="#f6b25d"/><path d="M98 196l-8-50 40 28zM182 196l8-50-40 28z" fill="#f6b25d"/><path d="M104 188l-4-26 20 15zM176 188l4-26-20 15z" fill="#f7c9a3"/>
    <ellipse cx="122" cy="220" rx="8" ry="${v > 0.5 ? 2 : 9}" fill="#3b3024"/><ellipse cx="158" cy="220" rx="8" ry="${v > 0.5 ? 2 : 9}" fill="#3b3024"/><path d="M134 238l6 6 6-6z" fill="#e57373"/>
    <path d="M110 244h-30M110 250l-28 8M170 244h30M170 250l28 8" stroke="#8a5a2b" stroke-width="2"/><path d="M188 255q6 18 30 20" stroke="#d98a2e" stroke-width="5" fill="none"/></g>`,
  dog: (id, v) => `<defs>${lin(id + 'k', '#bfe6ff', '#eaf7ff')}${lin(id + 'g', '#8fd17b', '#5fae4f')}</defs>
    <rect width="400" height="500" fill="url(#${id}k)"/><circle cx="${80 + v * 40}" cy="80" r="34" fill="#ffe082"/><path d="M0 300q100-40 200-10t200-20v230H0z" fill="url(#${id}g)"/>
    <ellipse cx="210" cy="330" rx="100" ry="54" fill="#c8915a"/><rect x="132" y="350" width="26" height="70" rx="12" fill="#b07d4b"/><rect x="250" y="350" width="26" height="70" rx="12" fill="#b07d4b"/>
    <circle cx="140" cy="270" r="56" fill="#d9a46d"/><ellipse cx="96" cy="270" rx="18" ry="40" fill="#8a5a2b" transform="rotate(18 96 270)"/><ellipse cx="184" cy="270" rx="18" ry="40" fill="#8a5a2b" transform="rotate(-18 184 270)"/>
    <circle cx="124" cy="262" r="7" fill="#2b2118"/><circle cx="156" cy="262" r="7" fill="#2b2118"/><ellipse cx="140" cy="290" rx="16" ry="11" fill="#2b2118"/><path d="M132 304q8 14 16 0" fill="#e57373"/>
    <path d="M308 320q40-40 30-80" stroke="#c8915a" stroke-width="18" fill="none" stroke-linecap="round"/><g class="ball"><circle cx="300" cy="430" r="28" fill="#e53935"/><path d="M276 422q24 10 48 0" stroke="#fff" stroke-width="5" fill="none"/></g>`,
  pizza: (id, v) => `<defs>${lin(id + 't', '#b07a4a', '#8a5a33')}</defs><rect width="400" height="500" fill="url(#${id}t)"/>
    <path d="M0 120h400M0 240h400M0 360h400" stroke="#7a4e2c" stroke-width="3" opacity=".5"/><circle cx="200" cy="260" r="160" fill="#f5f5f5"/>
    <circle cx="200" cy="260" r="138" fill="#e0a85b"/><circle cx="200" cy="260" r="118" fill="#e8553a"/><circle cx="200" cy="260" r="112" fill="#ffd66b" opacity=".85"/>
    ${[[160, 210], [240, 220], [200, 290], [150, 300], [250, 310], [205, 190], [120, 250], [280, 260]].map(([x, y], i) => `<circle cx="${x + v * 6}" cy="${y}" r="${13 + (i % 3)}" fill="#c0392b"/>`).join('')}
    ${[[180, 240], [230, 270], [140, 275], [260, 230]].map(([x, y]) => `<path d="M${x} ${y}q10-14 20 0q-10 10-20 0z" fill="#43a047"/>`).join('')}
    <path d="M200 260L200 142M200 260L302 318M200 260L98 318" stroke="#e0a85b" stroke-width="3"/>`,
  pancakes: (id, v) => `<defs>${lin(id + 'b', '#fde7d9', '#f8cfb8')}</defs><rect width="400" height="500" fill="url(#${id}b)"/>
    <ellipse cx="200" cy="400" rx="170" ry="44" fill="#fff"/><ellipse cx="200" cy="400" rx="140" ry="32" fill="#eef1f4"/>
    <g class="stack">${[0, 1, 2, 3, 4].map(i => `<ellipse cx="200" cy="${380 - i * 30}" rx="120" ry="26" fill="#e7a95b"/><ellipse cx="200" cy="${372 - i * 30}" rx="116" ry="22" fill="#f4c27e"/>`).join('')}</g>
    <path d="M110 258q90 30 180 0v20q-20 30-20 60l-8 6-6-50q-60 20-130-6z" fill="#8d4b1f" opacity=".85"/>
    ${[[170, 240], [205, 232], [240, 244], [190, 250]].map(([x, y]) => `<circle cx="${x + v * 4}" cy="${y}" r="13" fill="#5c6bc0"/><circle cx="${x - 4 + v * 4}" cy="${y - 4}" r="3" fill="#9fa8da"/>`).join('')}
    <circle cx="225" cy="228" r="12" fill="#e53935"/><path d="M225 216l-4-8M225 216l6-6" stroke="#43a047" stroke-width="3"/>`,
  game: (id, v) => `<rect width="400" height="500" fill="#1d2140"/><rect x="0" y="0" width="400" height="300" fill="#3b4bb8"/>
    ${[[30, 60], [130, 40], [260, 80], [330, 30]].map(([x, y]) => `<rect x="${x}" y="${y}" width="44" height="14" fill="#fff" opacity=".85"/><rect x="${x + 8}" y="${y - 10}" width="28" height="10" fill="#fff" opacity=".85"/>`).join('')}
    <rect x="0" y="300" width="400" height="200" fill="#6d4c41"/><rect x="0" y="300" width="400" height="20" fill="#7cb342"/>
    <rect x="60" y="220" width="90" height="20" fill="#8d6e63"/><rect x="230" y="170" width="110" height="20" fill="#8d6e63"/>
    ${[[85, 190], [115, 190], [260, 140], [300, 140]].map(([x, y]) => `<rect x="${x}" y="${y}" width="16" height="16" fill="#ffca28" stroke="#ff8f00" stroke-width="3"/>`).join('')}
    <g class="hero"><rect x="${150 + v * 20}" y="252" width="34" height="48" fill="#e53935"/><rect x="${154 + v * 20}" y="256" width="26" height="16" fill="#ffcc80"/><rect x="${158 + v * 20}" y="260" width="6" height="6" fill="#1d2140"/><rect x="${170 + v * 20}" y="260" width="6" height="6" fill="#1d2140"/></g>
    <rect x="300" y="262" width="34" height="38" fill="#43a047"/><rect x="296" y="252" width="42" height="14" fill="#2e7d32"/>
    <text x="16" y="474" fill="#fff" font-family="monospace" font-size="22" font-weight="700">РІВЕНЬ 3   ★ 12</text>`,
  drawing: (id, v) => `<rect width="400" height="500" fill="#d7ccc8"/><rect x="40" y="40" width="320" height="400" rx="6" fill="#fffdf7" transform="rotate(${-2 + v * 3} 200 240)"/>
    <g class="draw" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="290" cy="120" r="36" stroke="#ffb300" stroke-width="8"/><path d="M290 64v-16M290 192v-16M346 120h16M218 120h16M330 80l12-12M250 160l-12 12M330 160l12 12M250 80l-12-12" stroke="#ffb300" stroke-width="6"/>
    <path d="M90 360V250l70-60 70 60v110z" stroke="#e53935" stroke-width="8"/><path d="M140 360v-50h40v50" stroke="#6d4c41" stroke-width="7"/><path d="M106 270h28v24h-28z" stroke="#1e88e5" stroke-width="6"/>
    <path d="M300 360v-80" stroke="#6d4c41" stroke-width="10"/><circle cx="300" cy="250" r="40" stroke="#43a047" stroke-width="8"/><path d="M60 380q140-20 280 0" stroke="#7cb342" stroke-width="8"/></g>
    <rect x="250" y="440" width="120" height="14" rx="7" fill="#1e88e5" transform="rotate(-20 310 447)"/><path d="M362 418l18-10-6 18z" fill="#f5d6a8"/>`,
  paints: (id, v) => `<rect width="400" height="500" fill="#eceff1"/><path d="M60 140q120-90 260-20 40 30 20 90-20 40-70 30-30-6-40 20t-60 60q-80 30-110-40-30-70 0-140z" fill="#f5deb3"/>
    <circle cx="130" cy="330" r="22" fill="#eceff1"/>${[['#e53935', 120, 170], ['#ffb300', 180, 140], ['#43a047', 250, 150], ['#1e88e5', 300, 200], ['#8e24aa', 110, 240]].map(([c, x, y]) => `<circle cx="${x}" cy="${y}" r="${24 + v * 6}" fill="${c}"/>`).join('')}
    <rect x="220" y="300" width="160" height="16" rx="8" fill="#6d4c41" transform="rotate(-35 300 308)"/><path d="M216 360l-16 22 30-8z" fill="#1e88e5"/>`,
  football: (id, v) => `<rect width="400" height="500" fill="#4caf50"/>${[0, 1, 2, 3, 4].map(i => `<rect y="${i * 100}" width="400" height="50" fill="#43a047"/>`).join('')}
    <path d="M60 60h280v120H60z" stroke="#fff" stroke-width="6" fill="none"/><path d="M60 60l20 20h240l20-20M80 80v100M320 80v100" stroke="#fff" stroke-width="2" opacity=".7"/>
    ${[100, 140, 180, 220, 260, 300].map(x => `<path d="M${x} 80v100" stroke="#fff" stroke-width="1.5" opacity=".5"/>`).join('')}
    <g class="ball"><circle cx="${200 + v * 30}" cy="360" r="56" fill="#fff"/><path d="M${200 + v * 30} 330l20 14-8 24h-24l-8-24z" fill="#263238"/><path d="M${200 + v * 30} 304v26M${226 + v * 30} 344l26-8M${188 + v * 30} 368l-20 22M${212 + v * 30} 368l20 22M${174 + v * 30} 344l-26-8" stroke="#263238" stroke-width="3"/></g>
    <ellipse cx="${200 + v * 30}" cy="424" rx="50" ry="8" fill="#2e7d32"/>`,
  sneakers: (id, v) => `<rect width="400" height="500" fill="#d84315"/><path d="M0 330h400v170H0z" fill="#bf360c"/>${[60, 160, 260, 360].map(x => `<path d="M${x} 330v170" stroke="#fff" stroke-width="4" opacity=".6"/>`).join('')}
    ${[[70, 250], [200, 290]].map(([x, y], i) => `<g transform="translate(${x} ${y}) rotate(${i ? 6 : -6})"><path d="M0 60q0-40 30-50l40-10q20 20 50 20l50 10q20 6 20 30H0z" fill="${i ? '#1e88e5' : '#fafafa'}" stroke="#263238" stroke-width="3"/><rect x="-2" y="58" width="194" height="14" rx="6" fill="#263238"/><path d="M50 20l10 16M66 16l10 16M82 16l8 14" stroke="#263238" stroke-width="3"/></g>`).join('')}`,
  volcano: (id, v) => `<defs>${lin(id + 'b', '#e1f5fe', '#b3e5fc')}</defs><rect width="400" height="500" fill="url(#${id}b)"/><rect y="380" width="400" height="120" fill="#a1887f"/>
    <path d="M90 400l80-170h60l80 170z" fill="#8d6e63"/><path d="M170 230h60l-8 18h-44z" fill="#6d4c41"/>
    <g class="foam">${[[200, 200, 34], [176, 214, 22], [226, 212, 24], [190, 170, 20], [214, 176, 22], [200, 150, 16]].map(([x, y, r]) => `<circle cx="${x}" cy="${y - v * 10}" r="${r}" fill="#ff7043"/>`).join('')}<path d="M180 240q-14 60-30 90M222 240q20 50 30 100" stroke="#ff7043" stroke-width="16" stroke-linecap="round"/></g>
    <rect x="310" y="300" width="44" height="100" rx="8" fill="#c5e1a5" opacity=".85"/><rect x="320" y="282" width="24" height="22" fill="#9e9e9e"/><text x="332" y="356" fill="#33691e" font-size="13" font-family="sans-serif" text-anchor="middle" font-weight="700">ОЦЕТ</text>`,
  planet: (id, v) => `<rect width="400" height="500" fill="#0d1033"/>${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % 400}" cy="${(i * 53) % 500}" r="${i % 3 ? 1.2 : 2}" fill="#fff" opacity=".8"/>`).join('')}
    <circle cx="70" cy="250" r="56" fill="#ffb300"/><circle cx="70" cy="250" r="70" fill="#ffb300" opacity=".2"/>
    ${[[150, 8, '#bcaaa4'], [200, 13, '#ffcc80'], [255, 15, '#42a5f5'], [305, 11, '#ef5350']].map(([x, r, c], i) => `<ellipse cx="70" cy="250" rx="${x - 70}" ry="${(x - 70) * 0.35}" stroke="#fff" stroke-width="1" fill="none" opacity=".3"/><circle cx="${x}" cy="${250 + (i % 2 ? 10 : -10) * v}" r="${r}" fill="${c}"/>`).join('')}
    <circle cx="360" cy="190" r="26" fill="#d7a86e"/><ellipse cx="360" cy="190" rx="44" ry="10" stroke="#f0d9a8" stroke-width="5" fill="none"/>`,
  guitar: (id, v) => `<rect width="400" height="500" fill="#4e342e"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${i * 50}" width="48" height="500" fill="#5d4037"/>`).join('')}
    <g transform="rotate(${-24 + v * 6} 200 260)"><path d="M150 300q-70 0-70 70t90 80q40-10 60 0 90 10 90-80t-70-70q-10-50-50-50t-50 50z" fill="#f0a35e"/><circle cx="200" cy="330" r="34" fill="#3e2723"/>
    <rect x="186" y="60" width="28" height="220" fill="#6d4c41"/><rect x="178" y="30" width="44" height="50" rx="6" fill="#3e2723"/>
    <g class="strings">${[190, 196, 202, 208].map(x => `<path d="M${x} 40v380" stroke="#eee" stroke-width="1.5"/>`).join('')}</g><rect x="176" y="404" width="48" height="12" fill="#3e2723"/></g>`,
  mountains: (id, v) => `<defs>${lin(id + 's', '#ffccbc', '#81d4fa')}${lin(id + 'l', '#4fc3f7', '#0277bd')}</defs><rect width="400" height="500" fill="url(#${id}s)"/>
    <path d="M0 300l90-150 70 90 60-130 90 140 90-70v120z" fill="#5c6bc0"/><path d="M220 110l-24 52 24-12 22 12z" fill="#fff"/><path d="M90 150l-20 36 20-8 16 8z" fill="#fff"/>
    <path d="M0 300l120-90 90 70 80-50 110 70z" fill="#3949ab"/><rect y="300" width="400" height="200" fill="url(#${id}l)"/>
    <path d="M0 300l120 60 90-50 80 30 110-40" fill="#3949ab" opacity=".35"/>${[340, 380, 420, 460].map((y, i) => `<path d="M${40 + i * 30 + v * 20} ${y}h${80 - i * 10}" stroke="#fff" stroke-width="3" opacity=".5" class="wave"/>`).join('')}
    <path d="M0 500l40-90 20 40 20-60 30 110z" fill="#2e7d32"/>`,
  sea: (id, v) => `<defs>${lin(id + 's', '#ff8a65', '#ffd54f')}${lin(id + 'w', '#ff7043', '#5e35b1')}</defs><rect width="400" height="300" fill="url(#${id}s)"/>
    <circle cx="200" cy="300" r="${70 + v * 10}" fill="#fff59d"/><rect y="300" width="400" height="200" fill="url(#${id}w)"/>
    <g class="waves">${[320, 350, 385, 425, 470].map((y, i) => `<path d="M${-40 + (i % 2) * 30} ${y}q50-14 100 0t100 0 100 0 100 0 100 0" stroke="#ffe082" stroke-width="${4 - i * 0.5}" fill="none" opacity=".7"/>`).join('')}</g>
    <path d="M300 330l30-60v60zM280 332h70l-10 14h-52z" fill="#3e2723"/>`,
  selfie: (id, v, o = {}) => person(id, o.color || '#ffb74d', `<defs>${lin(id + 'b', '#c8e6c9', '#81c784')}</defs><rect width="400" height="500" fill="url(#${id}b)"/><circle cx="60" cy="90" r="50" fill="#a5d6a7"/><circle cx="350" cy="120" r="70" fill="#a5d6a7"/>`, v),
  house: (id, v) => `<rect width="400" height="500" fill="#b3e5fc"/><rect x="30" y="80" width="340" height="420" fill="#ffcc80"/>
    ${[[70, 130], [170, 130], [270, 130], [70, 250], [270, 250]].map(([x, y]) => `<rect x="${x}" y="${y}" width="60" height="70" fill="#4fc3f7" stroke="#fff" stroke-width="6"/>`).join('')}
    <rect x="160" y="330" width="80" height="170" fill="#6d4c41"/><circle cx="226" cy="420" r="5" fill="#ffd54f"/>
    <rect x="164" y="248" width="72" height="56" rx="6" fill="#1565c0"/><text x="200" y="290" fill="#fff" font-family="sans-serif" font-size="40" font-weight="800" text-anchor="middle">12</text>
    <rect x="250" y="318" width="120" height="34" rx="4" fill="#1565c0"/><text x="310" y="341" fill="#fff" font-family="sans-serif" font-size="16" font-weight="700" text-anchor="middle">вул. Шкільна</text>
    ${person(id + 'p', '#ff8a65', '', v, 0.42, -125, 175)}`,
  uniform: (id, v) => person(id, '#ffb74d', `<rect width="400" height="500" fill="#e3f2fd"/><rect x="0" y="380" width="400" height="120" fill="#90caf9"/><rect x="40" y="40" width="140" height="90" rx="6" fill="#fff" stroke="#90a4ae" stroke-width="4"/><path d="M60 70h100M60 90h80M60 110h90" stroke="#90a4ae" stroke-width="5"/>`, v, 1, 0, 0, '#1a237e', `<g><circle cx="250" cy="420" r="26" fill="#ffd54f" stroke="#f57f17" stroke-width="4"/><text x="250" y="426" font-family="sans-serif" font-size="13" font-weight="800" text-anchor="middle" fill="#1a237e">№1</text><rect x="196" y="456" width="108" height="24" rx="4" fill="#fff"/><text x="250" y="473" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle" fill="#1a237e">Школа №1</text></g>`),
  ticket: (id, v) => `<rect width="400" height="500" fill="#37474f"/><g transform="rotate(${-6 + v * 4} 200 250)"><rect x="40" y="150" width="320" height="190" rx="14" fill="#fff8e1"/>
    <path d="M270 150v190" stroke="#bcaaa4" stroke-width="3" stroke-dasharray="8 6"/><text x="60" y="194" font-family="sans-serif" font-size="22" font-weight="800" fill="#4e342e">КОНЦЕРТ «СТРУНА»</text>
    <text x="60" y="226" font-family="sans-serif" font-size="15" fill="#6d4c41">Ряд 7 · Місце 14 · 20:00</text><text x="60" y="256" font-family="sans-serif" font-size="15" font-weight="700" fill="#6d4c41">Іван Петренко</text>
    ${Array.from({ length: 26 }, (_, i) => `<rect x="${60 + i * 7}" y="276" width="${i % 3 ? 3 : 5}" height="44" fill="#212121"/>`).join('')}
    <text x="315" y="252" font-family="sans-serif" font-size="30" font-weight="800" fill="#e53935" text-anchor="middle" transform="rotate(-90 315 245)">VIP</text></g>`,
  friends: (id, v) => `<rect width="400" height="500" fill="#ffe0b2"/><circle cx="330" cy="70" r="40" fill="#fff3e0"/>${person(id + 'a', '#8d6e63', '', v, 0.62, -110, 120, '#43a047')}${person(id + 'b', '#ffb74d', '', v, 0.66, 0, 100, '#e53935')}${person(id + 'c', '#5d4037', '', v, 0.62, 110, 120, '#1e88e5')}`,
  chat: (id, v) => `<rect width="400" height="500" fill="#eceff1"/><rect x="60" y="10" width="280" height="490" rx="30" fill="#263238"/><rect x="72" y="40" width="256" height="440" rx="14" fill="#fff"/>
    <text x="200" y="70" font-family="sans-serif" font-size="14" font-weight="700" text-anchor="middle" fill="#37474f">Мама</text><text x="200" y="88" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#607d8b">+380 67 123 45 67</text>
    ${[[0, 110, 'Купи хліба, будь ласка'], [1, 160, 'Добре! А можна піцу?'], [0, 210, 'Тільки після уроків :)'], [1, 260, 'Ура!!!'], [0, 310, 'Ключ під килимком']].map(([me, y, t]) => `<rect x="${me ? 150 : 84}" y="${y}" width="${t.length * 7 + 20}" height="34" rx="14" fill="${me ? '#64b5f6' : '#eceff1'}"/><text x="${me ? 160 : 94}" y="${y + 22}" font-family="sans-serif" font-size="13" fill="${me ? '#fff' : '#263238'}">${t}</text>`).join('')}`,
  cartoon: (id, v) => `<rect width="400" height="500" fill="#455a64"/><rect x="30" y="70" width="340" height="250" rx="14" fill="#212121"/><rect x="44" y="84" width="312" height="222" rx="6" fill="#81d4fa"/>
    <path d="M44 260q80-40 160 0t152-10v56H44z" fill="#9ccc65"/><g transform="translate(${200 + v * 20} 210)"><ellipse rx="54" ry="60" fill="#ab47bc"/><circle cx="-18" cy="-14" r="14" fill="#fff"/><circle cx="18" cy="-14" r="14" fill="#fff"/><circle cx="-14" cy="-12" r="6" fill="#212121"/><circle cx="22" cy="-12" r="6" fill="#212121"/><path d="M-20 18q20 18 40 0" stroke="#212121" stroke-width="5" fill="none"/></g>
    <text x="350" y="300" font-family="sans-serif" font-size="12" font-weight="700" text-anchor="end" fill="#fff">© Студія «Мульт»</text><rect x="170" y="320" width="60" height="50" fill="#212121"/><rect x="120" y="370" width="160" height="14" rx="7" fill="#212121"/>`,
};

// Людина (стилізована): колір шкіри, тло, зсув/масштаб; shirt — колір одягу, extra — домальовки поверх
function person(id, skin, bg, v = 0, k = 1, dx = 0, dy = 0, shirt = '#5c6bc0', extra = '') {
  const hair = ['#3e2723', '#6d4c41', '#212121', '#a1887f'][Math.floor(v * 4) % 4];
  return `${bg}<g transform="translate(${200 + dx} ${dy + 250}) scale(${k}) translate(-200 -250)">
    <path d="M70 500q0-150 130-150t130 150z" fill="${shirt}"/><rect x="180" y="300" width="40" height="60" fill="${shade(skin, 0.92)}"/>
    <ellipse cx="200" cy="230" rx="78" ry="90" fill="${skin}"/><path d="M122 220q-6-110 84-110t74 110q-20-50-80-54-56 4-78 54z" fill="${hair}"/>
    <ellipse cx="172" cy="236" rx="9" ry="11" fill="#2b2118"/><ellipse cx="228" cy="236" rx="9" ry="11" fill="#2b2118"/><circle cx="175" cy="232" r="3" fill="#fff"/><circle cx="231" cy="232" r="3" fill="#fff"/>
    <path d="M176 278q24 22 48 0" stroke="#8d3b2b" stroke-width="6" fill="none" stroke-linecap="round"/><ellipse cx="150" cy="268" rx="14" ry="8" fill="#ef9a9a" opacity=".6"/><ellipse cx="250" cy="268" rx="14" ry="8" fill="#ef9a9a" opacity=".6"/>${extra}</g>`;
}

// «Фото» з галереї: { scene, v, dark, blur }, filter — CSS-фільтр, text — напис, sticker — наліпка
export function photo(g, o = {}) {
  const id = 'a' + (++uid), v = Math.abs(g.v || 0) * 10 % 1;
  const body = (S[g.scene] || S.cat)(id, v, o);
  const fx = [o.filter || '', g.blur ? 'blur(3px)' : ''].filter(Boolean).join(' ');
  const txt = o.text ? `<g><rect x="30" y="${o.textY === 'top' ? 30 : 400}" width="340" height="64" rx="14" fill="rgba(0,0,0,.45)"/><text x="200" y="${o.textY === 'top' ? 72 : 442}" fill="#fff" font-family="Inter,sans-serif" font-size="28" font-weight="800" text-anchor="middle">${esc(o.text.slice(0, 22))}</text></g>` : '';
  const st = o.sticker ? `<g transform="translate(300 60) rotate(12)"><circle r="44" fill="#fff"/><g transform="translate(-26 -26) scale(2.2)" fill="#ff3d71" stroke="#ff3d71" stroke-width="1.2" stroke-linejoin="round">${iconPath(o.sticker)}</g></g>` : '';
  return `<svg class="art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g style="filter:${fx || 'none'}">${body}${g.dark ? '<rect width="400" height="500" fill="#000" opacity=".52"/>' : ''}</g>${txt}${st}</svg>`;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// «Відео»: та сама сцена з анімацією. Анімація йде, лише коли контейнер не має класу .paused
const ANIM = {
  laser: `.cat{animation:look 1.6s ease-in-out infinite alternate;transform-origin:150px 260px}.dot{animation:dot 1.6s ease-in-out infinite alternate}@keyframes look{to{transform:rotate(8deg) translateX(30px)}}@keyframes dot{from{transform:translate(0,0)}to{transform:translate(160px,60px)}}`,
  pancakeflip: `.flip{animation:flip 1.4s ease-in-out infinite;transform-origin:200px 230px}@keyframes flip{0%,100%{transform:translateY(0) rotateX(0)}50%{transform:translateY(-150px) rotate(180deg)}}`,
  speedrun: `.hero{animation:run 2s linear infinite}@keyframes run{0%{transform:translate(-120px,0)}25%{transform:translate(-40px,-90px)}50%{transform:translate(40px,-110px)}75%{transform:translate(110px,-60px)}100%{transform:translate(180px,0)}}`,
  timelapse: `.draw *{stroke-dasharray:600;stroke-dashoffset:600;animation:draw 3s ease-out infinite}@keyframes draw{70%,100%{stroke-dashoffset:0}}`,
  juggle: `.ball{animation:bounce .7s cubic-bezier(.3,0,.7,1) infinite alternate}@keyframes bounce{to{transform:translateY(-170px)}}`,
  eruption: `.foam{animation:erupt 1.2s ease-out infinite;transform-origin:200px 240px}@keyframes erupt{0%{transform:scale(.4);opacity:.3}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1);opacity:.9}}`,
  cover: `.strings{animation:vib .08s linear infinite alternate}.note{animation:float 2s ease-out infinite}@keyframes vib{to{transform:translateX(1.5px)}}@keyframes float{from{transform:translate(0,0);opacity:1}to{transform:translate(30px,-140px);opacity:0}}`,
  waves: `.waves{animation:sway 2.4s ease-in-out infinite alternate}@keyframes sway{to{transform:translateX(-40px)}}`,
};
export function video(clipKey, o = {}) {
  const c = CLIPS[clipKey] || CLIPS.laser, id = 'v' + (++uid);
  let body = S[c.scene](id, 0.3);
  if (clipKey === 'laser') body += '<circle class="dot" cx="200" cy="420" r="8" fill="#ff1744"/><circle class="dot" cx="200" cy="420" r="16" fill="#ff1744" opacity=".3"/>';
  if (clipKey === 'pancakeflip') body = body.replace('<g class="stack">', '<g class="stack">') + '<g class="flip"><ellipse cx="200" cy="230" rx="110" ry="22" fill="#f4c27e" stroke="#e7a95b" stroke-width="6"/></g>';
  if (clipKey === 'cover') body += [0, 1, 2].map(i => `<g class="note" style="animation-delay:${i * 0.6}s"><path d="M${240 + i * 30} 300v-40l24-6v40" stroke="#ffe082" stroke-width="5" fill="none"/><circle cx="${234 + i * 30}" cy="300" r="8" fill="#ffe082"/></g>`).join('');
  const css = ANIM[clipKey].replace(/(^|})\s*\./g, `$1 .${id} .`).replace(/@keyframes (\w+)/g, `@keyframes ${id}$1`).replace(/animation:(\w+)/g, `animation:${id}$1`);
  return `<svg class="art vid ${id}${o.paused ? ' paused' : ''}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><style>${css}.${id}.paused *{animation-play-state:paused!important}</style>${body}</svg>`;
}

// Аватар: кольорове коло з першою літерою або значком
export function avatar(p, size = 40) {
  if (!p) return `<span class="av" style="width:${size}px;height:${size}px"></span>`;
  const sym = p.sym || p.avatar?.sym, color = p.color || p.avatar?.color || '#455a64';
  const inner = !sym || sym === 'letter' ? `<b style="font-size:${Math.round(size * 0.42)}px">${esc((p.name || p.nick || '?').trim()[0] || '?').toUpperCase()}</b>` : icon(sym, Math.round(size * 0.5));
  return `<span class="av" style="width:${size}px;height:${size}px;background:${color}">${inner}</span>`;
}
