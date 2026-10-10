// Емулятор Windows · іконки: кольорові (файли, папки, диски, застосунки) і контурні (кнопки).
import { extOf, KNOWN, HOME } from './fs.js';

const svg = (s, body, vb = '0 0 48 48') => `<svg class="ico" width="${s}" height="${s}" viewBox="${vb}" aria-hidden="true">${body}</svg>`;

// Папка Windows 11 з необов’язковим значком усередині
const FOLDER = (inner = '') => `<path d="M4 12a4 4 0 0 1 4-4h10.3a4 4 0 0 1 2.8 1.2l2.6 2.6H40a4 4 0 0 1 4 4V36a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#ffb900"/><path d="M4 18a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#ffd75e"/>${inner}`;
const BADGE = {
  Desktop: '<rect x="15" y="21" width="18" height="12" rx="1.5" fill="#2b88d8"/><rect x="21" y="34" width="6" height="2" fill="#2b88d8"/>',
  Documents: '<path d="M17 19h10l4 4v12H17z" fill="#fff" stroke="#6b8db5" stroke-width="1.2"/><path d="M20 26h8M20 29h8M20 32h6" stroke="#6b8db5" stroke-width="1.2"/>',
  Downloads: '<path d="M24 19v12M18.5 26l5.5 5.5 5.5-5.5" fill="none" stroke="#1a7f37" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 35h14" stroke="#1a7f37" stroke-width="2.6" stroke-linecap="round"/>',
  Pictures: '<rect x="15" y="20" width="18" height="15" rx="2" fill="#4cc2ff"/><path d="m15 32 6-6 5 5 3-3 4 4v1a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2z" fill="#0f7b0f"/><circle cx="28.5" cy="24.5" r="2" fill="#fff"/>',
  Music: '<path d="M21 33V22l11-2.5v10" fill="none" stroke="#e3008c" stroke-width="2.4"/><circle cx="19" cy="33" r="2.8" fill="#e3008c"/><circle cx="30" cy="30" r="2.8" fill="#e3008c"/>',
  Videos: '<rect x="15" y="21" width="18" height="13" rx="2" fill="#8764b8"/><path d="m22 24.5 5.5 3-5.5 3z" fill="#fff"/>',
};
export const folderIcon = (s = 48, known = null) => svg(s, FOLDER(known ? BADGE[known] || '' : ''));

// Аркуш паперу із загнутим кутиком і кольоровою позначкою типу
const PAGE = '<path d="M11 4h18l10 10v28a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#fff" stroke="#b6bcc6" stroke-width="1.4"/><path d="M29 4v8a2 2 0 0 0 2 2h8" fill="#e8ebf0" stroke="#b6bcc6" stroke-width="1.4" stroke-linejoin="round"/>';
const tag = (color, letter) => `<rect x="4" y="24" width="20" height="16" rx="2.5" fill="${color}"/><text x="14" y="36" text-anchor="middle" font-family="Segoe UI,Inter,Arial" font-weight="700" font-size="11" fill="#fff">${letter}</text>`;
const FILES = {
  txt: PAGE + '<path d="M15 20h18M15 25h18M15 30h18M15 35h12" stroke="#7a8494" stroke-width="1.8" stroke-linecap="round"/>',
  docx: PAGE + '<path d="M26 22h8M26 27h8M26 32h8" stroke="#9aa6b8" stroke-width="1.6"/>' + tag('#185abd', 'W'),
  xlsx: PAGE + '<path d="M26 22h8M26 27h8M26 32h8" stroke="#9aa6b8" stroke-width="1.6"/>' + tag('#107c41', 'X'),
  pptx: PAGE + '<path d="M26 22h8M26 27h8M26 32h8" stroke="#9aa6b8" stroke-width="1.6"/>' + tag('#c43e1c', 'P'),
  pdf: PAGE + tag('#d13438', 'PDF'),
  img: PAGE + '<rect x="14" y="19" width="20" height="16" rx="2" fill="#4cc2ff"/><path d="m14 32 6-6 4 4 3-3 7 6v1a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2z" fill="#0f7b0f"/><circle cx="29" cy="23.5" r="2.2" fill="#fff"/>',
  audio: PAGE + '<path d="M21 33V22l10-2.5v10" fill="none" stroke="#e3008c" stroke-width="2.2"/><circle cx="19" cy="33" r="2.6" fill="#e3008c"/><circle cx="29" cy="30" r="2.6" fill="#e3008c"/>',
  video: PAGE + '<rect x="14" y="21" width="20" height="14" rx="2" fill="#8764b8"/><path d="m21.5 24.5 6 3.5-6 3.5z" fill="#fff"/>',
  zip: FOLDER('<rect x="21" y="14" width="6" height="26" fill="#8a8a8a"/><path d="M21 17h3M24 20h3M21 23h3M24 26h3M21 29h3" stroke="#cfcfcf" stroke-width="1.6"/><rect x="20" y="31" width="8" height="6" rx="1.5" fill="#5c5c5c"/>'),
  exe: '<rect x="6" y="8" width="36" height="32" rx="4" fill="#eef3fa" stroke="#9aa6b8" stroke-width="1.4"/><rect x="6" y="8" width="36" height="8" rx="4" fill="#2b88d8"/><rect x="6" y="12" width="36" height="4" fill="#2b88d8"/><rect x="12" y="21" width="10" height="13" rx="1.5" fill="#c7d7ee"/><path d="M26 22h10M26 26h10M26 30h7" stroke="#9aa6b8" stroke-width="1.6"/>',
  ini: PAGE + '<circle cx="24" cy="28" r="6" fill="none" stroke="#7a8494" stroke-width="2.4"/><path d="M24 18v3M24 35v3M14 28h3M31 28h3M17 21l2 2M29 33l2 2M17 35l2-2M29 23l2-2" stroke="#7a8494" stroke-width="2.2" stroke-linecap="round"/>',
  file: PAGE,
};
const EXT = { txt: 'txt', md: 'txt', csv: 'txt', log: 'txt', bat: 'ini', docx: 'docx', doc: 'docx', xlsx: 'xlsx', xls: 'xlsx', pptx: 'pptx', ppt: 'pptx', pdf: 'pdf', jpg: 'img', jpeg: 'img', png: 'img', gif: 'img', bmp: 'img', mp3: 'audio', wav: 'audio', mp4: 'video', avi: 'video', zip: 'zip', rar: 'zip', exe: 'exe', ini: 'ini', html: 'txt' };
export const fileIcon = (name, s = 48) => svg(s, FILES[EXT[extOf(name)]] || FILES.file);

// Іконка вузла файлової системи
export function nodeIcon(n, path, s = 48) {
  if (n.type === 'dir') {
    const known = path && path.toLowerCase().startsWith(HOME.toLowerCase() + '\\') && path.split('\\').length === 4 ? Object.keys(KNOWN).find(k => k.toLowerCase() === path.split('\\')[3].toLowerCase()) : null;
    return folderIcon(s, known);
  }
  return fileIcon(n.name, s);
}

export const driveIcon = (letter, s = 48) => svg(s, `<rect x="5" y="15" width="38" height="20" rx="3" fill="#e1e5ea" stroke="#8d96a3" stroke-width="1.4"/><rect x="5" y="27" width="38" height="8" rx="2" fill="#c7cdd5"/><circle cx="36" cy="31" r="1.8" fill="#13a10e"/>${letter === 'C' ? '<g transform="translate(9 17.5)"><rect width="5" height="5" fill="#0078d4"/><rect x="6" width="5" height="5" fill="#0078d4"/><rect y="6" width="5" height="5" fill="#0078d4"/><rect x="6" y="6" width="5" height="5" fill="#0078d4"/></g>' : ''}`);
export const pcIcon = (s = 48) => svg(s, '<rect x="5" y="8" width="38" height="25" rx="2.5" fill="#2b88d8"/><rect x="8" y="11" width="32" height="19" rx="1" fill="#9fd3ff"/><path d="M19 33h10l2 6H17z" fill="#8d96a3"/><rect x="14" y="38.5" width="20" height="2.5" rx="1.2" fill="#6b7480"/>');
export const binIcon = (full, s = 48) => svg(s, `${full ? '<path d="M15 11l6-5 7 3 6-3 2 6" fill="#fff" stroke="#9aa6b8" stroke-width="1.4"/><rect x="18" y="5" width="9" height="8" rx="1" fill="#ffd75e" transform="rotate(-12 22 9)"/>' : ''}<path d="M10 13h28l-3 28a3 3 0 0 1-3 2.7H16a3 3 0 0 1-3-2.7z" fill="#c9e8ff" fill-opacity=".75" stroke="#5b9bd5" stroke-width="1.6"/><path d="M8 13h32" stroke="#5b9bd5" stroke-width="2.4" stroke-linecap="round"/><path d="M19 19l1 19M24 19v19M29 19l-1 19" stroke="#5b9bd5" stroke-width="1.4" opacity=".7"/>`);
export const appIcon = (app, s = 48) => ({
  explorer: svg(s, FOLDER('<rect x="12" y="23" width="24" height="3" rx="1.5" fill="#0078d4"/>')),
  cmd: svg(s, '<rect x="4" y="7" width="40" height="34" rx="4" fill="#1f1f1f"/><rect x="4" y="7" width="40" height="7" rx="4" fill="#3c3c3c"/><rect x="4" y="11" width="40" height="3" fill="#3c3c3c"/><path d="m11 21 6 5-6 5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 32h10" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'),
  notepad: svg(s, '<rect x="9" y="7" width="30" height="36" rx="3" fill="#fff" stroke="#3a96dd" stroke-width="1.6"/><rect x="9" y="7" width="30" height="8" rx="3" fill="#3a96dd"/><rect x="9" y="11" width="30" height="4" fill="#3a96dd"/><path d="M15 21h18M15 26h18M15 31h18M15 36h11" stroke="#9aa6b8" stroke-width="1.8" stroke-linecap="round"/><path d="M15 4v6M21 4v6M27 4v6M33 4v6" stroke="#1f5fa8" stroke-width="2" stroke-linecap="round"/>'),
  bin: binIcon(false, s),
  pc: pcIcon(s),
  security: svg(s, '<path d="M24 4 7 10v12c0 10.5 7.3 18.6 17 22 9.7-3.4 17-11.5 17-22V10z" fill="#0078d4"/><path d="M24 4v40c9.7-3.4 17-11.5 17-22V10z" fill="#005ba1"/><path d="m16.5 24 5.5 5.5 10-11" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  firewall: svg(s, '<rect x="4" y="9" width="40" height="30" rx="2" fill="#c7522a"/><path d="M4 19h40M4 29h40M15 9v10M30 9v10M10 19v10M24 19v10M38 19v10M17 29v10M31 29v10" stroke="#f3c7b4" stroke-width="2"/><circle cx="35" cy="34" r="10" fill="#2b88d8" stroke="#fff" stroke-width="2"/><path d="M25 34h20M35 24c3 3 3 17 0 20M35 24c-3 3-3 17 0 20" fill="none" stroke="#fff" stroke-width="1.6"/>'),
  help: svg(s, '<circle cx="24" cy="24" r="19" fill="#0078d4"/><path d="M19 19a5 5 0 1 1 7.5 4.3c-1.6.9-2.5 2-2.5 3.7v1" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="33.5" r="2" fill="#fff"/>'),
}[app] || folderIcon(s));
export const winLogo = (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20" aria-hidden="true"><rect x="1" y="1" width="8.5" height="8.5" rx="1" fill="#0078d4"/><rect x="10.5" y="1" width="8.5" height="8.5" rx="1" fill="#0078d4"/><rect x="1" y="10.5" width="8.5" height="8.5" rx="1" fill="#0078d4"/><rect x="10.5" y="10.5" width="8.5" height="8.5" rx="1" fill="#0078d4"/></svg>`;

/* ── контурні іконки інтерфейсу ── */
const L = {
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>', forward: '<path d="M5 12h14M12 5l7 7-7 7"/>', up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  cut: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  paste: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  rename: '<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  sort: '<path d="m3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16"/>', view: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>', down: '<path d="m6 9 6 6 6-6"/>', restore: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>', power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>', min: '<path d="M5 12h14"/>', max: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>', unmax: '<rect x="4" y="8" width="12" height="12" rx="1.5"/><path d="M8 8V5.5A1.5 1.5 0 0 1 9.5 4H18.5A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>', folderPlus: '<path d="M12 10v6M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  filePlus: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M9 15h6M12 18v-6"/>',
  open: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>', props: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  wifi2: '<path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  coffee: '<path d="M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2"/>',
  virus: '<path d="m12 3 1.6 2.6L16.5 5l.3 3 2.7 1.4-1.4 2.6 1.4 2.6-2.7 1.4-.3 3-2.9-.6L12 21l-1.6-2.6-2.9.6-.3-3-2.7-1.4L5.9 12 4.5 9.4 7.2 8l.3-3 2.9.6z"/><circle cx="12" cy="12" r="3"/>',
  person: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>', browser: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M2 9h20M6 6.5h.01M9 6.5h.01"/>',
  chip: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>', heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  family: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>', exportI: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>', importI: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  tree: '<path d="M3 3h6v6H3zM15 15h6v6h-6zM6 9v6a3 3 0 0 0 3 3h6"/>', panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>', monitor: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>', lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>', save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"/>',
  wifi: '<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.859a10 10 0 0 1 14 0M8.5 16.429a5 5 0 0 1 7 0"/>', volume: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  question: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>', home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  wrap: '<path d="M3 6h18M3 12h15a3 3 0 1 1 0 6h-4"/><path d="m16 16-2 2 2 2M3 18h7"/>', zoomIn: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>', zoomOut: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
};
export const ui = (n, s = 16) => `<svg class="ui-ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${L[n] || L.info}</svg>`;
