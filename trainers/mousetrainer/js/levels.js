// Мишка й точність · рівні. Від великих цілей до дрібних.
// kind: click · dbl · right · drag · marquee · scroll; count — скільки цілей/раундів; size — розмір цілі в px;
// par — час (с), за який дають три зірки. Щоб додати рівень — допишіть об'єкт.

export const CHAPTERS = [
  { id: 'click', name: 'Клацання', desc: 'Наведіть мишку на кульку й клацніть лівою кнопкою.' },
  { id: 'dbl', name: 'Подвійне клацання', desc: 'Два швидкі клацання поспіль, не рухаючи мишку. Так відкривають папки й файли.' },
  { id: 'right', name: 'Права кнопка', desc: 'Права кнопка відкриває меню з додатковими діями.' },
  { id: 'drag', name: 'Перетягування', desc: 'Затисніть кнопку, перенесіть фігуру й відпустіть точно на її місці.' },
  { id: 'marquee', name: 'Виділення рамкою', desc: 'Затисніть кнопку на порожньому місці й тягніть: рамка виділяє все, що всередині.' },
  { id: 'scroll', name: 'Прокручування', desc: 'Коліщатко мишки рухає сторінку вгору й униз. Знайдіть те, чого не видно.' },
];

export const LEVELS = [
  { chapter: 'click', id: 'click-1', name: 'Великі кульки', kind: 'click', count: 6, size: 110, par: 12, hint: 'Клацніть кожну кульку лівою кнопкою. Наступна з’явиться в іншому місці.' },
  { chapter: 'click', id: 'click-2', name: 'Менші кульки', kind: 'click', count: 8, size: 76, par: 14, hint: 'Кульки стали меншими — цільтеся в середину.' },
  { chapter: 'click', id: 'click-3', name: 'Маленькі кульки', kind: 'click', count: 10, size: 48, par: 17, hint: 'Спершу наведіть мишку, потім клацайте. Поспіх — це промахи.' },
  { chapter: 'click', id: 'click-4', name: 'Рухомі кульки', kind: 'click', count: 8, size: 66, par: 18, speed: 110, hint: 'Кульки літають! Наздоженіть кожну й клацніть.' },

  { chapter: 'dbl', id: 'dbl-1', name: 'Двічі по великій', kind: 'dbl', count: 5, size: 110, par: 12, hint: 'Клацніть двічі швидко, не зрушуючи мишку.' },
  { chapter: 'dbl', id: 'dbl-2', name: 'Двічі швидко', kind: 'dbl', count: 6, size: 76, par: 13, hint: 'Між клацаннями — зовсім коротка пауза. Тримайте мишку нерухомо.' },
  { chapter: 'dbl', id: 'dbl-3', name: 'Маленькі цілі', kind: 'dbl', count: 8, size: 52, par: 16, hint: 'Маленька ціль — подвійне клацання має влучити двічі.' },
  { chapter: 'dbl', id: 'dbl-4', name: 'Один чи два?', kind: 'dbl', mix: true, count: 10, size: 62, par: 19, hint: 'Ціль із позначкою «2×» — двічі, без позначки — один раз.' },

  { chapter: 'right', id: 'right-1', name: 'Права кнопка', kind: 'right', count: 5, size: 110, par: 12, hint: 'Клацніть по цілі правою кнопкою мишки.' },
  { chapter: 'right', id: 'right-2', name: 'Менші цілі', kind: 'right', count: 7, size: 70, par: 14, hint: 'Праву кнопку натискають середнім пальцем.' },
  { chapter: 'right', id: 'right-3', name: 'Ліва чи права?', kind: 'right', mix: true, count: 10, size: 64, par: 18, hint: 'Подивіться на значок мишки в цілі: яка кнопка підсвічена — ту й натискайте.' },
  { chapter: 'right', id: 'right-4', name: 'Контекстне меню', kind: 'right', menu: true, count: 5, size: 90, par: 26, hint: 'Права кнопка по цілі відкриє меню. Виберіть у ньому колір, як у рамки цілі.' },

  { chapter: 'drag', id: 'drag-1', name: 'Фігури на місця', kind: 'drag', count: 3, size: 96, tol: 0.5, par: 14, hint: 'Затисніть фігуру лівою кнопкою, перенесіть до такого самого контуру й відпустіть.' },
  { chapter: 'drag', id: 'drag-2', name: 'Більше фігур', kind: 'drag', count: 5, size: 74, tol: 0.45, par: 20, hint: 'Кожна фігура має свій контур — за формою і кольором.' },
  { chapter: 'drag', id: 'drag-3', name: 'Менші фігури', kind: 'drag', count: 6, size: 54, tol: 0.35, par: 24, hint: 'Не відпускайте кнопку, поки фігура не опиниться над контуром.' },
  { chapter: 'drag', id: 'drag-4', name: 'Точно в контур', kind: 'drag', count: 8, size: 42, tol: 0.26, par: 34, hint: 'Тепер треба поцілити майже точно в середину контуру.' },

  { chapter: 'marquee', id: 'mq-1', name: 'Перша рамка', kind: 'marquee', count: 3, goods: 3, bads: 0, size: 60, margin: 60, par: 15, hint: 'Затисніть кнопку на порожньому місці й тягніть рамку навколо всіх зірок.' },
  { chapter: 'marquee', id: 'mq-2', name: 'Обійди камінці', kind: 'marquee', count: 4, goods: 4, bads: 6, size: 50, margin: 70, par: 22, hint: 'Зірки — в рамку, камінці — ні.' },
  { chapter: 'marquee', id: 'mq-3', name: 'Тісно', kind: 'marquee', count: 4, goods: 5, bads: 10, size: 40, margin: 28, par: 28, hint: 'Камінці зовсім поруч. Рамка має бути акуратною.' },
  { chapter: 'marquee', id: 'mq-4', name: 'Дрібні зірки', kind: 'marquee', count: 5, goods: 6, bads: 14, size: 30, margin: 18, par: 34, hint: 'Маленькі зірки, багато камінців. Не поспішайте.' },

  { chapter: 'scroll', id: 'scroll-1', name: 'Вниз до зірки', kind: 'scroll', count: 3, screens: 3, size: 90, arrow: true, par: 18, hint: 'Зірка схована нижче. Покрутіть коліщатко мишки до себе й клацніть зірку.' },
  { chapter: 'scroll', id: 'scroll-2', name: 'Вгору й униз', kind: 'scroll', count: 5, screens: 5, size: 70, arrow: true, par: 28, hint: 'Наступна зірка може бути і вище, і нижче — стрілка підкаже.' },
  { chapter: 'scroll', id: 'scroll-3', name: 'Серед схожих', kind: 'scroll', count: 5, screens: 5, size: 52, decoys: 40, par: 34, hint: 'Підказок більше немає. Шукайте жовту зірку серед інших фігур.' },
  { chapter: 'scroll', id: 'scroll-4', name: 'Будинок за номером', kind: 'scroll', houses: 80, count: 4, par: 40, hint: 'Будинки йдуть по порядку. Прокрутіть до потрібного номера й клацніть його.' },
];
