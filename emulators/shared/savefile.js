// Спільне для збереження симуляторів у файл: контрольна сума, транслітерація назви, завантаження й вибір файлу.

// Контрольна сума (FNV-1a): показує, чи файл змінювали вручну після збереження
export function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Транслітерація за офіційними правилами (постанова КМУ № 55): назва файлу латиницею
// відкривається однаково в усіх браузерах і системах
const TR = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ё: 'io', ъ: '' };
const FIRST = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' };
export function translit(str) {
  return String(str || '').replace(/[зЗ][гГ]/g, m => m[0] === 'З' ? 'Zgh' : 'zgh').replace(/[Ѐ-ӿ]/g, (ch, i, all) => {
    const lo = ch.toLowerCase(), start = i === 0 || !/[Ѐ-ӿ']/.test(all[i - 1]);
    const t = (start && FIRST[lo]) || TR[lo] || '';
    return ch !== lo && t ? t[0].toUpperCase() + t.slice(1) : t;
  }).replace(/['’ʼ`]/g, '');
}
// Частина назви файлу: лише латиниця, цифри й дефіси
export const slug = (x, max = 32) => translit(x).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);

// Віддати файл користувачеві
export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

// Вибрати файл (повертає File або null)
export function pickFile(accept) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.hidden = true;
    i.addEventListener('change', () => { res(i.files[0] || null); i.remove(); });
    i.addEventListener('cancel', () => { res(null); i.remove(); });
    document.body.appendChild(i); i.click();
  });
}
