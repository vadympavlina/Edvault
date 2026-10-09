// Каталог Edvault: усі інструменти (/tools/) і тренажери (/trainers/).
// Список захардкоджено тут — без бази. Щоб додати інструмент: поклади сторінку в tools/ або trainers/,
// іконку в icons/ і допиши об'єкт нижче (тест tests/catalog.test.mjs перевірить, що нічого не загубилося).
//
// icon — внутрішність SVG 24×24 (контурна іконка); accent — колір картки.

export const TOOL_CATEGORIES = [
  { id: 'lesson', name: 'На уроці', desc: 'Пояснювати, опитувати й вести клас.', icon: '<path d="M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M7 21l5-5 5 5"/>' },
  { id: 'media', name: 'Фото й відео', desc: 'Записати екран, змонтувати відео, підготувати картинки.', icon: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4V8Z"/>' },
  { id: 'text', name: 'Тексти й код', desc: 'Документи, конспекти й вебсторінки.', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>' },
  { id: 'design', name: 'Дизайн і графіка', desc: 'Кольори, палітри й піксельні спрайти.', icon: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>' },
];

export const TOOLS = [
  { id: 'whiteboard', file: 'whiteboard.html', cat: 'lesson', name: 'Вайтборд', accent: '#0ea5e9',
    desc: 'Дошка для пояснень: олівець, фігури, стікери, нумерація, лазерна указка. Відкриває PDF і має режим презентації.',
    tags: ['PDF', 'Презентація'], icon: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>' },
  { id: 'vote', file: 'vote.html', cat: 'lesson', name: 'Голосування', accent: '#4F6BF4',
    desc: 'Голосування за кращу роботу: картки команд, підрахунок у реальному часі й феєрверки на фіналі.',
    tags: ['Наживо', 'Команди'], icon: '<path d="M12 2l2.5 6.5L21 9l-5 4.5 1.5 7L12 17l-5.5 3.5L8 13.5 3 9l6.5-.5z"/>' },
  { id: 'class-manager', file: 'class-manager.html', cat: 'lesson', name: 'Менеджер класу', accent: '#10b981',
    desc: 'Учні, розклад, відвідуваність і оцінки в одному місці.',
    tags: ['Журнал', 'Розклад'], icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },

  { id: 'screen-recorder', file: 'screen-recorder.html', cat: 'media', name: 'Запис екрану', accent: '#ef4444',
    desc: 'Запис екрана з мікрофоном, звуком і веб-камерою в кутку. MP4 або WebM, без встановлення програм.',
    tags: ['MP4', 'Веб-камера'], icon: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/>' },
  { id: 'videocut', file: 'videocut.html', cat: 'media', name: 'Відеоредактор', accent: '#ec4899',
    desc: 'Монтаж у браузері: різання, текст, стрілки, розмиття, субтитри, музика й прискорення. Швидкий експорт у MP4.',
    tags: ['Субтитри', 'MP4'], icon: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>' },
  { id: 'snap-editor', file: 'snap-editor.html', cat: 'media', name: 'Редактор фото', accent: '#f59e0b',
    desc: 'Скриншоти й фото для навчальних матеріалів: кадрування, стрілки, текст, розмиття, нумерація кроків.',
    tags: ['Скриншоти', 'Стрілки'], icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
  { id: 'image-convert', file: 'image-convert.html', cat: 'media', name: 'Конвертер зображень', accent: '#06b6d4',
    desc: 'Перетворення й стиснення: JPG, PNG, WebP, AVIF, SVG, ICO. Зміна розміру, обрізка, поворот і архів одним кліком.',
    tags: ['WebP', 'Стиснення'], icon: '<path d="M4 9h13l-4-4"/><path d="M20 15H7l4 4"/>' },

  { id: 'text-craft', file: 'text-craft.html', cat: 'text', name: 'Текстовий редактор', accent: '#8b5cf6',
    desc: 'Документи, конспекти й промпти з блоками, заголовками та списками. Готові шапки, автозбереження й експорт.',
    tags: ['Шаблони', 'Експорт'], icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' },
  { id: 'web-editor', file: 'web-editor.html', cat: 'text', name: 'Редактор коду', accent: '#0f766e',
    desc: 'HTML, CSS і JavaScript з живим переглядом, консоллю й режимами телефона та планшета. Проєкти зберігаються й діляться посиланням.',
    tags: ['HTML', 'CSS', 'JS'], icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },

  { id: 'color-tool', file: 'color-tool.html', cat: 'design', name: 'Кольори', accent: '#e11d48',
    desc: 'Палітри, гармонії й перевірка контрасту тексту. Фіксуйте вдалі кольори й копіюйте коди одним клацанням.',
    tags: ['Палітри', 'Контраст'], icon: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>' },
  { id: 'pixel-editor', file: 'pixel-editor.html', cat: 'design', name: 'Спрайт-редактор', accent: '#65a30d',
    desc: 'Піксельна графіка й анімація: кадри, калька, дзеркальне малювання, створення спрайта з картинки.',
    tags: ['Пікселі', 'Анімація'], icon: '<rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/>' },
];

export const TRAINER_CATEGORIES = [
  { id: 'basics', name: 'Комп’ютерна грамотність', desc: 'Мишка, клавіатура й файли — основа роботи за комп’ютером.', icon: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>' },
  { id: 'code', name: 'Програмування', desc: 'Алгоритми, цикли й умови — без жодного рядка коду.', icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },
  { id: 'design', name: 'Дизайн', desc: 'Відчуття кольору й робота з векторним пером.', icon: '<path d="M12 19 19 12l3 3-7 7z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18z"/><path d="m2 2 7.59 7.59"/><circle cx="11" cy="11" r="2"/>' },
];

// progress — ключ у localStorage, де тренажер зберігає зірки; levels — скільки рівнів (перевіряє тест).
export const TRAINERS = [
  { id: 'mouse-trainer', file: 'mouse-trainer.html', cat: 'basics', name: 'Мишка й точність', accent: '#ec4899', grades: '1–4 клас',
    desc: 'Клацання, подвійне клацання, права кнопка, перетягування, виділення рамкою й прокручування. Цілі від великих до дрібних.',
    levels: 24, progress: 'edvault-mouse', icon: '<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/>' },
  { id: 'files-trainer', file: 'files-trainer.html', cat: 'basics', name: 'Файли й папки', accent: '#d97706', grades: '3–7 клас',
    desc: 'Симулятор провідника: папки й шляхи, імена й розширення, переміщення, кошик, пошук і наведення ладу.',
    levels: 24, progress: 'edvault-files', icon: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>' },
  { id: 'safety-trainer', file: 'safety-trainer.html', cat: 'basics', name: 'Безпека в інтернеті', accent: '#0ea5e9', grades: '3–9 клас',
    desc: 'Читаємо адреси сайтів, розпізнаємо фішинг у листах і SMS, придумуємо надійні паролі, бережемо особисті дані й не ведемося на шахраїв.',
    levels: 20, progress: 'edvault-safety', icon: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>' },
  { id: 'hotkeys-trainer', file: 'hotkeys-trainer.html', cat: 'basics', name: 'Гарячі клавіші', accent: '#6366f1', grades: '2–11 клас',
    desc: 'Копіювати, вставити, скасувати, зберегти, виділити й знайти — без мишки. Комбінації для тексту, браузера й Windows, а наприкінці — на швидкість.',
    levels: 20, progress: 'edvault-hotkeys', icon: '<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>' },
  { id: 'typing-trainer', file: 'typing-trainer.html', cat: 'basics', name: 'Сліпий друк', accent: '#10b981', grades: '3–11 клас',
    desc: 'Українська й англійська розкладки: від основного ряду до цілих абзаців. Підказки пальців і тренування слабких клавіш.',
    levels: 51, progress: 'edvault-typing', layouts: true, icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4M7 16h10"/>' },
  { id: 'robot', file: 'robot.html', cat: 'code', name: 'Алгоритми з роботом', accent: '#f59e0b', grades: '3–8 клас',
    desc: 'Програмування блоками-пазлами: команди, цикли, умови й лабіринти. Коротша програма — більше зірок.',
    levels: 24, progress: 'edvault-robot', icon: '<path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>' },
  { id: 'pen-trainer', file: 'pen-trainer.html', cat: 'design', name: 'Тренажер пера', accent: '#8b5cf6', grades: '7–11 клас',
    desc: 'Інструмент «Перо» як в Illustrator і Figma: від прямих ліній до літер, оцінка точності й покрокові підказки.',
    levels: 26, progress: 'edvault-pentrainer', icon: '<path d="M12 19 19 12l3 3-7 7z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18z"/><path d="m2 2 7.59 7.59"/><circle cx="11" cy="11" r="2"/>' },
  { id: 'color-trainer', file: 'color-trainer.html', cat: 'design', name: 'Колір на око', accent: '#db2777', grades: '5–11 клас',
    desc: 'Відтінок, насиченість, RGB і HEX, гармонії й градієнти. Точність рахується за ΔE2000.',
    levels: 28, progress: 'edvault-coloreye', icon: '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>' },
];

// Зірки й пройдені рівні тренажера з його збереженого прогресу (усі тренажери пишуть best[id].stars).
export function trainerProgress(t, storage = globalThis.localStorage) {
  let data = null;
  try { data = JSON.parse(storage.getItem(t.progress)); } catch (e) { /* немає або зіпсовано */ }
  const bests = !data?.best ? [] : t.layouts ? Object.values(data.best).flatMap(o => Object.values(o || {})) : Object.values(data.best);
  const done = bests.filter(b => (b?.stars || 0) > 0);
  return { stars: done.reduce((s, b) => s + Math.min(3, b.stars), 0), max: t.levels * 3, passed: done.length, levels: t.levels };
}
