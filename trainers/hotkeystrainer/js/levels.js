// Гарячі клавіші · рівні.
//   press  — натиснути комбінацію (combo); act — що станеться на макеті (scene рівня: doc, browser, files);
//            sel — яке слово виділити перед завданням (у документі).
//   choice — вибрати відповідь: системні комбінації (Alt+Tab, Win+D, Ctrl+W…), які браузер не дає перехопити.
//            Варіант — { k: 'Win+D' } (покажемо клавішами) або { t: 'текст' }.
// tips — пам’ятка перед рівнем; par — для швидкісних рівнів: секунд на три зірки.

export const CHAPTERS = [
  { id: 'basics', name: 'Основні комбінації', desc: 'Копіювати, вставити, вирізати, скасувати — те, що потрібно щодня.' },
  { id: 'text', name: 'Робота з текстом', desc: 'Жирний шрифт, збереження, пошук і швидке переміщення по тексту.' },
  { id: 'browser', name: 'Браузер', desc: 'Масштаб, оновлення сторінки, вкладки, історія й закладки.' },
  { id: 'windows', name: 'Windows', desc: 'Вікна, знімки екрана, провідник і блокування комп’ютера.' },
  { id: 'master', name: 'Швидкі руки', desc: 'Усе разом і на час. Покажіть, що руки пам’ятають самі.' },
];

const p = (combo, q, act, extra = {}) => ({ kind: 'press', combo, q, act, ...extra });
const k = (combo, ok, why) => ({ k: combo, ok, why });
const t = (text, ok, why) => ({ t: text, ok, why });

export const LEVELS = [
  /* ═══ Основні ═══ */
  { chapter: 'basics', id: 'basics-1', name: 'Копіювати й вставити', scene: 'doc',
    tips: [['ctrl', 'Майже всі комбінації починаються з <b>Ctrl</b> — він ліворуч унизу клавіатури.'], ['copy', '<kbd>Ctrl</kbd> + <kbd>C</kbd> — копіювати (C — від англ. <i>copy</i>).'], ['paste', '<kbd>Ctrl</kbd> + <kbd>V</kbd> — вставити. Спершу затисніть Ctrl, потім натисніть літеру.']],
    tasks: [
      p('Ctrl+C', 'Скопіюйте виділене слово «кіт»', 'copy'),
      p('Ctrl+V', 'Вставте скопійоване слово', 'paste'),
      p('Ctrl+C', 'Скопіюйте слово «сонці»', 'copy', { sel: 'сонці' }),
      p('Ctrl+V', 'Вставте його ще раз', 'paste'),
    ] },
  { chapter: 'basics', id: 'basics-2', name: 'Вирізати й скасувати', scene: 'doc',
    tips: [['cut', '<kbd>Ctrl</kbd> + <kbd>X</kbd> — вирізати: слово зникає, але зберігається, щоб його вставити.'], ['undo', '<kbd>Ctrl</kbd> + <kbd>Z</kbd> — скасувати останню дію. Рятує, якщо щось зіпсували!'], ['paste', 'Вирізали — вставте в потрібне місце через <kbd>Ctrl</kbd> + <kbd>V</kbd>.']],
    tasks: [
      p('Ctrl+X', 'Виріжте слово «кіт»', 'cut'),
      p('Ctrl+V', 'Вставте його в кінець рядка', 'paste', { caret: 'end' }),
      p('Ctrl+Z', 'Ой! Скасуйте вставку', 'undo'),
      p('Ctrl+Z', 'Скасуйте ще раз — слово повернеться на місце', 'undo'),
    ] },
  { chapter: 'basics', id: 'basics-3', name: 'Усе одразу й повтор', scene: 'doc',
    tips: [['all', '<kbd>Ctrl</kbd> + <kbd>A</kbd> — виділити все (A — від <i>all</i>, «усе»).'], ['redo', '<kbd>Ctrl</kbd> + <kbd>Y</kbd> — повторити те, що скасували.'], ['undo', 'Скасувати — <kbd>Ctrl</kbd> + <kbd>Z</kbd>, повторити — <kbd>Ctrl</kbd> + <kbd>Y</kbd>.']],
    tasks: [
      p('Ctrl+A', 'Виділіть увесь текст', 'selectAll'),
      p('Ctrl+C', 'Скопіюйте його', 'copy'),
      p('Ctrl+X', 'Виріжте слово «спати»', 'cut', { sel: 'спати' }),
      p('Ctrl+Z', 'Скасуйте', 'undo'),
      p('Ctrl+Y', 'А тепер поверніть скасоване', 'redo'),
    ] },
  { chapter: 'basics', id: 'basics-4', name: 'Перевірка основ', scene: 'doc',
    tips: [['copy', 'C — копіювати, V — вставити, X — вирізати.'], ['undo', 'Z — скасувати, Y — повторити, A — виділити все.'], ['ctrl', 'Ці шість літер стоять поруч у нижньому лівому кутку клавіатури.']],
    tasks: [
      p('Ctrl+C', 'Скопіюйте «кіт»', 'copy'),
      p('Ctrl+A', 'Виділіть усе', 'selectAll'),
      p('Ctrl+V', 'Вставте скопійоване замість виділеного', 'paste'),
      p('Ctrl+Z', 'Скасуйте', 'undo'),
      { kind: 'choice', q: 'Що робить Ctrl + X?', options: [t('Копіює', false, 'Копіює — Ctrl + C.'), t('Вирізає', true, 'Так: X — як ножиці.'), t('Закриває програму', false, 'Ні, закриває вікно Alt + F4.')] },
    ] },

  /* ═══ Текст ═══ */
  { chapter: 'text', id: 'text-1', name: 'Жирний, курсив, підкреслений', scene: 'doc',
    tips: [['bold', '<kbd>Ctrl</kbd> + <kbd>B</kbd> — <b>жирний</b> (від <i>bold</i>).'], ['italic', '<kbd>Ctrl</kbd> + <kbd>I</kbd> — <i>курсив</i> (від <i>italic</i>).'], ['underline', '<kbd>Ctrl</kbd> + <kbd>U</kbd> — <u>підкреслений</u> (від <i>underline</i>).']],
    tasks: [
      p('Ctrl+B', 'Зробіть «кіт» жирним', 'bold'),
      p('Ctrl+I', 'Зробіть «сонці» курсивом', 'italic', { sel: 'сонці' }),
      p('Ctrl+U', 'Підкресліть «любить»', 'underline', { sel: 'любить' }),
      p('Ctrl+B', 'Зніміть жирний із «кіт» — та сама комбінація ще раз', 'bold', { sel: 'кіт' }),
    ] },
  { chapter: 'text', id: 'text-2', name: 'Зберегти, друк, пошук', scene: 'doc',
    tips: [['save', '<kbd>Ctrl</kbd> + <kbd>S</kbd> — зберегти (від <i>save</i>). Натискайте частіше!'], ['print', '<kbd>Ctrl</kbd> + <kbd>P</kbd> — друк (від <i>print</i>).'], ['find', '<kbd>Ctrl</kbd> + <kbd>F</kbd> — знайти слово на сторінці (від <i>find</i>).']],
    tasks: [
      p('Ctrl+B', 'Зробіть «кіт» жирним', 'bold'),
      p('Ctrl+S', 'Збережіть документ', 'save'),
      p('Ctrl+F', 'Відкрийте пошук по тексту', 'find'),
      p('Ctrl+P', 'Відкрийте друк', 'print'),
    ] },
  { chapter: 'text', id: 'text-3', name: 'Швидко по тексту', scene: 'doc',
    tips: [['home', '<kbd>Home</kbd> — на початок рядка, <kbd>End</kbd> — у кінець.'], ['doc', '<kbd>Ctrl</kbd> + <kbd>Home</kbd> — на початок документа, <kbd>Ctrl</kbd> + <kbd>End</kbd> — у кінець.'], ['word', '<kbd>Ctrl</kbd> + <kbd>←</kbd> — на одне слово ліворуч.']],
    tasks: [
      p('End', 'Перейдіть у кінець рядка', 'end'),
      p('Home', 'Тепер на початок рядка', 'home'),
      p('Ctrl+End', 'Стрибніть у кінець документа', 'docEnd'),
      p('Ctrl+←', 'На одне слово ліворуч', 'wordLeft'),
      p('Ctrl+Home', 'На самий початок документа', 'docStart'),
    ] },
  { chapter: 'text', id: 'text-4', name: 'Виділення й видалення', scene: 'doc',
    tips: [['select', 'Затиснутий <kbd>Shift</kbd> + стрілка — виділяє текст.'], ['select', '<kbd>Shift</kbd> + <kbd>End</kbd> — виділити до кінця рядка.'], ['delete', '<kbd>Ctrl</kbd> + <kbd>Backspace</kbd> — стерти ціле слово, а не одну літеру.']],
    tasks: [
      p('Shift+→', 'Додайте до виділення наступне слово', 'selRight'),
      p('Shift+End', 'Виділіть усе до кінця рядка', 'selEnd'),
      p('Ctrl+B', 'Зробіть виділене жирним', 'bold'),
      p('Ctrl+Backspace', 'Зітріть слово перед курсором', 'delWord', { sel: null }),
    ] },

  /* ═══ Браузер ═══ */
  { chapter: 'browser', id: 'browser-1', name: 'Масштаб сторінки', scene: 'browser',
    tips: [['zoomIn', '<kbd>Ctrl</kbd> + <kbd>+</kbd> — збільшити (клавіша <b>=</b>, на ній намальовано +).'], ['zoomOut', '<kbd>Ctrl</kbd> + <kbd>−</kbd> — зменшити.'], ['zoom0', '<kbd>Ctrl</kbd> + <kbd>0</kbd> — повернути звичайний розмір.']],
    tasks: [
      p('Ctrl+=', 'Дрібно! Збільште сторінку', 'zoomIn'),
      p('Ctrl+=', 'Ще більше', 'zoomIn'),
      p('Ctrl+-', 'Забагато — зменште', 'zoomOut'),
      p('Ctrl+0', 'Поверніть звичайний масштаб', 'zoom0'),
    ] },
  { chapter: 'browser', id: 'browser-2', name: 'Сторінка й адреса', scene: 'browser',
    tips: [['reload', '<kbd>F5</kbd> — оновити сторінку.'], ['address', '<kbd>Ctrl</kbd> + <kbd>L</kbd> — перейти до адресного рядка, щоб надрукувати адресу.'], ['star', '<kbd>Ctrl</kbd> + <kbd>D</kbd> — додати сторінку в закладки.']],
    tasks: [
      p('F5', 'Сторінка не завантажилась. Оновіть її', 'reload'),
      p('Ctrl+L', 'Перейдіть до адресного рядка', 'address'),
      p('Ctrl+D', 'Додайте сторінку в закладки', 'bookmark'),
      p('Ctrl+F', 'Знайдіть слово на сторінці', 'find'),
    ] },
  { chapter: 'browser', id: 'browser-3', name: 'Вкладки', scene: 'browser',
    tips: [['tab', '<kbd>Ctrl</kbd> + <kbd>T</kbd> — нова вкладка, <kbd>Ctrl</kbd> + <kbd>W</kbd> — закрити вкладку.'], ['undo', '<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> — повернути щойно закриту вкладку.'], ['info', 'Ці комбінації браузер не віддає сторінці, тому тут — вибір відповіді.']],
    tasks: [
      { kind: 'choice', q: 'Як відкрити нову вкладку?', options: [k('Ctrl+T', true, 'Так: T — від tab, «вкладка».'), k('Ctrl+N', false, 'Ctrl + N відкриває нове вікно.'), k('Ctrl+W', false, 'Ctrl + W закриває вкладку.')] },
      { kind: 'choice', q: 'Що робить Ctrl + W?', options: [t('Закриває поточну вкладку', true, 'Так. Обережно, щоб не закрити потрібне!'), t('Відкриває нове вікно', false, 'Нове вікно — Ctrl + N.'), t('Зберігає сторінку', false, 'Зберегти — Ctrl + S.')] },
      { kind: 'choice', q: 'Ви випадково закрили вкладку. Як її повернути?', options: [k('Ctrl+Z', false, 'Ctrl + Z скасовує дію в тексті, а не вкладку.'), k('Ctrl+Shift+T', true, 'Так! Можна натискати кілька разів — повернуться кілька вкладок.'), k('F5', false, 'F5 лише оновлює поточну сторінку.')] },
      { kind: 'choice', q: 'Як перейти на наступну вкладку?', options: [k('Ctrl+Tab', true, 'Так. А Ctrl + Shift + Tab — на попередню.'), k('Alt+Tab', false, 'Alt + Tab перемикає програми, а не вкладки.'), k('Tab', false, 'Tab переходить між кнопками на сторінці.')] },
    ] },
  { chapter: 'browser', id: 'browser-4', name: 'Історія й завантаження', scene: 'browser',
    tips: [['history', '<kbd>Ctrl</kbd> + <kbd>H</kbd> — історія відвіданих сторінок (від <i>history</i>).'], ['download', '<kbd>Ctrl</kbd> + <kbd>J</kbd> — завантажені файли.'], ['incognito', '<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd> — приватне вікно, яке не зберігає історію.']],
    tasks: [
      p('Ctrl+H', 'Відкрийте історію', 'history'),
      p('Ctrl+J', 'Відкрийте завантаження', 'downloads'),
      { kind: 'choice', q: 'Як відкрити приватне вікно (без історії)?', options: [k('Ctrl+Shift+N', true, 'Так. Зручно на чужому комп’ютері — історія не залишиться.'), k('Ctrl+H', false, 'Ctrl + H показує історію.'), k('Ctrl+P', false, 'Ctrl + P — друк.')] },
      p('F5', 'Оновіть сторінку', 'reload'),
    ] },

  /* ═══ Windows ═══ */
  { chapter: 'windows', id: 'windows-1', name: 'Вікна', scene: 'desktop',
    tips: [['win', 'Клавіша <kbd>Win</kbd> — з емблемою Windows, між Ctrl і Alt.'], ['switch', '<kbd>Alt</kbd> + <kbd>Tab</kbd> — перемкнутися між відкритими програмами.'], ['desktop', '<kbd>Win</kbd> + <kbd>D</kbd> — згорнути все й показати робочий стіл.']],
    tasks: [
      { kind: 'choice', q: 'Як швидко перемкнутися на іншу відкриту програму?', options: [k('Alt+Tab', true, 'Так. Тримайте Alt і натискайте Tab, щоб вибрати вікно.'), k('Ctrl+Tab', false, 'Ctrl + Tab перемикає вкладки в браузері.'), k('Win+D', false, 'Win + D показує робочий стіл.')] },
      { kind: 'choice', q: 'Що робить Win + D?', options: [t('Показує робочий стіл', true, 'Так. Ще раз Win + D — вікна повернуться.'), t('Видаляє файл', false, 'Видалити — Delete.'), t('Відкриває документи', false, 'Провідник — Win + E.')] },
      { kind: 'choice', q: 'Як закрити програму?', options: [k('Alt+F4', true, 'Так. Але спершу збережіть роботу!'), k('Ctrl+Z', false, 'Ctrl + Z скасовує дію.'), k('Esc', false, 'Esc закриває лише меню чи діалог.')] },
      { kind: 'choice', q: 'Як розгорнути вікно на весь екран?', options: [k('Win+↑', true, 'Так. А Win + ← і Win + → ставлять вікно на половину екрана.'), k('Ctrl+=', false, 'Ctrl + = збільшує масштаб сторінки.'), k('F5', false, 'F5 оновлює сторінку.')] },
    ] },
  { chapter: 'windows', id: 'windows-2', name: 'Знімки екрана', scene: 'desktop',
    tips: [['shot', '<kbd>Win</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> — вибрати частину екрана й сфотографувати.'], ['shot', '<kbd>PrtSc</kbd> — знімок усього екрана.'], ['paste', '<kbd>Win</kbd> + <kbd>V</kbd> — журнал буфера: усе, що ви копіювали.']],
    tasks: [
      { kind: 'choice', q: 'Як зробити знімок частини екрана?', options: [k('Win+Shift+S', true, 'Так. Знімок потрапить у буфер — вставте його через Ctrl + V.'), k('Ctrl+S', false, 'Ctrl + S зберігає документ.'), k('Ctrl+P', false, 'Ctrl + P — друк.')] },
      { kind: 'choice', q: 'Яка клавіша фотографує весь екран?', options: [k('PrtSc', true, 'Так, Print Screen.'), k('F5', false, 'F5 оновлює сторінку.'), k('Home', false, 'Home переносить на початок рядка.')] },
      { kind: 'choice', q: 'Ви скопіювали три речі. Як вставити ту, що копіювали першою?', options: [k('Ctrl+V', false, 'Ctrl + V вставляє лише останнє скопійоване.'), k('Win+V', true, 'Так. Журнал буфера показує все, що ви копіювали.'), k('Ctrl+Y', false, 'Ctrl + Y повторює скасовану дію.')] },
    ] },
  { chapter: 'windows', id: 'windows-3', name: 'Провідник', scene: 'files',
    tips: [['files', '<kbd>Win</kbd> + <kbd>E</kbd> — відкрити провідник із файлами.'], ['rename', '<kbd>F2</kbd> — перейменувати виділений файл.'], ['delete', '<kbd>Delete</kbd> — видалити (файл піде в кошик).']],
    tasks: [
      { kind: 'choice', q: 'Як відкрити провідник?', options: [k('Win+E', true, 'Так: E — від explorer.'), k('Win+D', false, 'Win + D показує робочий стіл.'), k('Ctrl+F', false, 'Ctrl + F — пошук.')] },
      p('F2', 'Перейменуйте файл «Новий документ»', 'rename'),
      p('Delete', 'Видаліть виділений файл «чернетка.txt»', 'delete', { sel: 'чернетка.txt' }),
      p('Ctrl+Z', 'Ой, не той! Скасуйте видалення', 'undo'),
      p('Ctrl+A', 'Виділіть усі файли', 'selectAll'),
    ] },
  { chapter: 'windows', id: 'windows-4', name: 'Безпека комп’ютера', scene: 'desktop',
    tips: [['lock', '<kbd>Win</kbd> + <kbd>L</kbd> — заблокувати комп’ютер, коли відходите (L — від <i>lock</i>).'], ['task', '<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Esc</kbd> — диспетчер завдань, якщо програма «зависла».'], ['info', '<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Delete</kbd> — меню безпеки.']],
    tasks: [
      { kind: 'choice', q: 'Ви відходите від комп’ютера в класі. Як швидко його заблокувати?', options: [k('Win+L', true, 'Так. Ніхто не зайде у ваші акаунти без пароля.'), k('Alt+F4', false, 'Alt + F4 закриє програму, але не заблокує.'), k('Win+D', false, 'Win + D лише згорне вікна.')] },
      { kind: 'choice', q: 'Програма «зависла» й не закривається. Що натиснути?', options: [k('Ctrl+Shift+Esc', true, 'Так. У диспетчері завдань виберіть програму й натисніть «Зняти завдання».'), k('Ctrl+Z', false, 'Ctrl + Z скасовує дію в документі.'), k('F2', false, 'F2 перейменовує файл.')] },
      { kind: 'choice', q: 'Що з цього блокує комп’ютер?', options: [k('Win+L', true, 'Так, Win + L.'), k('Ctrl+L', false, 'Ctrl + L відкриває адресний рядок у браузері.'), k('Alt+L', false, 'Такої комбінації в Windows немає.')] },
    ] },

  /* ═══ Швидкі руки ═══ */
  { chapter: 'master', id: 'master-1', name: 'Швидкі руки', scene: 'doc', par: 14,
    tips: [['clock', 'Тепер на час! Три зірки — без помилок і швидше за <b>14 секунд</b>.'], ['ctrl', 'Тримайте ліву руку на <kbd>Ctrl</kbd>, а пальцями тягніться до літер.'], ['copy', 'C, V, X, Z, A — усі поруч.']],
    tasks: [p('Ctrl+C', 'Копіювати', 'copy'), p('Ctrl+V', 'Вставити', 'paste'), p('Ctrl+Z', 'Скасувати', 'undo'), p('Ctrl+X', 'Вирізати', 'cut', { sel: 'любить' }), p('Ctrl+V', 'Вставити', 'paste'), p('Ctrl+A', 'Виділити все', 'selectAll')] },
  { chapter: 'master', id: 'master-2', name: 'Текст на швидкість', scene: 'doc', par: 16,
    tips: [['clock', 'Три зірки — без помилок і швидше за <b>16 секунд</b>.'], ['bold', 'B — жирний, I — курсив, U — підкреслений.'], ['save', 'S — зберегти, F — знайти, P — друк.']],
    tasks: [p('Ctrl+B', 'Жирний', 'bold'), p('Ctrl+I', 'Курсив', 'italic'), p('Ctrl+U', 'Підкреслити', 'underline'), p('Ctrl+S', 'Зберегти', 'save'), p('End', 'У кінець рядка', 'end'), p('Ctrl+F', 'Знайти', 'find')] },
  { chapter: 'master', id: 'master-3', name: 'Браузер на швидкість', scene: 'browser', par: 14,
    tips: [['clock', 'Три зірки — без помилок і швидше за <b>14 секунд</b>.'], ['zoomIn', 'Масштаб: Ctrl + «+», Ctrl + «−», Ctrl + 0.'], ['reload', 'F5 — оновити, Ctrl + D — закладка, Ctrl + H — історія.']],
    tasks: [p('Ctrl+=', 'Збільшити', 'zoomIn'), p('Ctrl+0', 'Звичайний масштаб', 'zoom0'), p('F5', 'Оновити', 'reload'), p('Ctrl+D', 'Закладка', 'bookmark'), p('Ctrl+H', 'Історія', 'history'), p('Ctrl+L', 'Адресний рядок', 'address')] },
  { chapter: 'master', id: 'master-4', name: 'Великий іспит', scene: 'doc', par: 24,
    tips: [['clock', 'Фінал! Три зірки — без помилок і швидше за <b>24 секунди</b>.'], ['ctrl', 'Усе, що ви вивчили: текст, документ і Windows.'], ['star', 'Удачі!']],
    tasks: [
      p('Ctrl+A', 'Виділити все', 'selectAll'), p('Ctrl+C', 'Копіювати', 'copy'), p('Ctrl+B', 'Жирний', 'bold'), p('Ctrl+Z', 'Скасувати', 'undo'), p('Ctrl+S', 'Зберегти', 'save'),
      { kind: 'choice', q: 'Заблокувати комп’ютер', options: [k('Win+L', true, 'Win + L.'), k('Win+D', false, 'Win + D показує робочий стіл.'), k('Ctrl+L', false, 'Ctrl + L — адресний рядок.')] },
      { kind: 'choice', q: 'Повернути закриту вкладку', options: [k('Ctrl+Z', false, 'Ctrl + Z — для тексту.'), k('Ctrl+Shift+T', true, 'Ctrl + Shift + T.'), k('Ctrl+T', false, 'Ctrl + T відкриває нову порожню вкладку.')] },
    ] },
];
