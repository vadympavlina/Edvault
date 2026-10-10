// Симулятор блогера · дані: ніші, сцени для фото й відео, хештеги, тренди, музика, люди, шаблони реакцій.
// Усе вигадане: справжніх людей, сайтів і брендів тут немає.

// Ніші (теми каналу). related — суміжні теми, які аудиторія теж охоче дивиться.
export const NICHES = {
  pets: { t: 'Тварини', icon: 'paw', related: ['travel', 'art'] },
  food: { t: 'Кулінарія', icon: 'chef', related: ['travel', 'science'] },
  games: { t: 'Ігри', icon: 'gamepad', related: ['art', 'science'] },
  art: { t: 'Малювання', icon: 'brush', related: ['games', 'music'] },
  sport: { t: 'Спорт', icon: 'ball', related: ['travel', 'food'] },
  science: { t: 'Наука', icon: 'flask', related: ['games', 'food'] },
  music: { t: 'Музика', icon: 'note', related: ['art', 'travel'] },
  travel: { t: 'Подорожі', icon: 'mountain', related: ['food', 'pets'] },
};
export const nicheOf = k => NICHES[k] || { t: 'Різне', icon: 'star', related: [] };

// Сцени для фото. topic — тема, q — базова якість кадру, risk — що зайвого видно на фото.
// risk: address (номер будинку й вулиця), school (емблема школи), doc (квиток/документ), friend (обличчя друга),
// chat (чужа переписка з номером телефону), copy (кадр із мультфільму — чужий твір)
export const SCENES = {
  cat: { t: 'Кіт на підвіконні', topic: 'pets', q: 0.72 },
  dog: { t: 'Пес із м’ячем', topic: 'pets', q: 0.7 },
  pizza: { t: 'Домашня піца', topic: 'food', q: 0.7 },
  pancakes: { t: 'Млинці з ягодами', topic: 'food', q: 0.74 },
  game: { t: 'Рівень у грі', topic: 'games', q: 0.62 },
  drawing: { t: 'Мій малюнок', topic: 'art', q: 0.7 },
  paints: { t: 'Фарби й пензлі', topic: 'art', q: 0.66 },
  football: { t: 'М’яч на полі', topic: 'sport', q: 0.66 },
  sneakers: { t: 'Кросівки після пробіжки', topic: 'sport', q: 0.6 },
  volcano: { t: 'Дослід «вулкан»', topic: 'science', q: 0.7 },
  planet: { t: 'Модель Сонячної системи', topic: 'science', q: 0.68 },
  guitar: { t: 'Гітара', topic: 'music', q: 0.68 },
  mountains: { t: 'Гори й озеро', topic: 'travel', q: 0.78 },
  sea: { t: 'Захід сонця на морі', topic: 'travel', q: 0.8 },
  selfie: { t: 'Селфі', topic: 'me', q: 0.6 },
  house: { t: 'Біля мого будинку', topic: 'me', q: 0.58, risk: ['address'] },
  uniform: { t: 'Перший день у школі', topic: 'me', q: 0.6, risk: ['school'] },
  ticket: { t: 'Квиток на концерт', topic: 'music', q: 0.55, risk: ['doc'] },
  friends: { t: 'Ми з друзями', topic: 'me', q: 0.66, risk: ['friend'] },
  chat: { t: 'Смішна переписка', topic: 'me', q: 0.45, risk: ['chat'] },
  cartoon: { t: 'Кадр із мультфільму', topic: 'art', q: 0.7, risk: ['copy'] },
};

// Відеокліпи. intro — скільки секунд на початку «нічого не відбувається» (варто обрізати), dur — тривалість.
export const CLIPS = {
  laser: { t: 'Кіт ловить лазер', topic: 'pets', dur: 24, intro: 5, q: 0.74, scene: 'cat' },
  pancakeflip: { t: 'Перевертаю млинець', topic: 'food', dur: 30, intro: 7, q: 0.7, scene: 'pancakes' },
  speedrun: { t: 'Проходжу рівень', topic: 'games', dur: 40, intro: 8, q: 0.64, scene: 'game' },
  timelapse: { t: 'Малюю за 30 секунд', topic: 'art', dur: 32, intro: 4, q: 0.76, scene: 'drawing' },
  juggle: { t: 'Набиваю м’яч', topic: 'sport', dur: 20, intro: 6, q: 0.66, scene: 'football' },
  eruption: { t: 'Вулкан із соди', topic: 'science', dur: 26, intro: 9, q: 0.78, scene: 'volcano' },
  cover: { t: 'Граю мелодію', topic: 'music', dur: 36, intro: 5, q: 0.68, scene: 'guitar' },
  waves: { t: 'Хвилі на морі', topic: 'travel', dur: 18, intro: 3, q: 0.66, scene: 'sea' },
};

// Музика для відео. free — з бібліотеки Лайкера (можна), hit — своя музика з плеєра (чужий твір → скарга правовласника)
export const MUSIC = [
  { id: 'none', t: 'Без музики', mood: null },
  { id: 'guitar', t: 'Весела гітара', by: 'Бібліотека Лайкера', mood: 'fun', free: true },
  { id: 'lofi', t: 'Спокійний біт', by: 'Бібліотека Лайкера', mood: 'calm', free: true },
  { id: 'epic', t: 'Епічний оркестр', by: 'Бібліотека Лайкера', mood: 'epic', free: true },
  { id: 'synth', t: 'Пікселі', by: 'Бібліотека Лайкера', mood: 'game', free: true },
  { id: 'hit', t: 'Хіт тижня (з плеєра)', by: 'Гурт «Нічні вогні»', mood: 'fun', hit: true },
];
// яка музика пасує до теми
export const MOOD_FIT = { pets: 'fun', food: 'fun', games: 'game', art: 'calm', sport: 'epic', science: 'epic', music: 'calm', travel: 'calm' };

// Фільтри фото: CSS-фільтр і як вони впливають на якість (fix — виправляє темний кадр)
export const FILTERS = [
  { id: 'none', t: 'Без фільтра', css: '' },
  { id: 'bright', t: 'Яскраво', css: 'brightness(1.18) contrast(1.05)', fix: true },
  { id: 'warm', t: 'Тепло', css: 'sepia(.25) saturate(1.2) brightness(1.06)' },
  { id: 'cool', t: 'Прохолода', css: 'hue-rotate(-12deg) saturate(1.1) brightness(1.04)' },
  { id: 'vivid', t: 'Соковито', css: 'saturate(1.45) contrast(1.08)' },
  { id: 'mono', t: 'Ч/Б', css: 'grayscale(1) contrast(1.1)' },
  { id: 'heavy', t: 'Неон', css: 'saturate(2.4) hue-rotate(40deg) contrast(1.4)', over: true },
];
export const STICKERS = ['star', 'heart', 'spark', 'arrow', 'smile'];

// Хештеги: size — скільки людей стежить (відносно), topic — тема (null — загальний)
export const TAGS = {
  'котики': { size: 9, topic: 'pets' }, 'тварини': { size: 7, topic: 'pets' }, 'песики': { size: 7, topic: 'pets' }, 'мійкіт': { size: 2, topic: 'pets' },
  'рецепт': { size: 8, topic: 'food' }, 'смачно': { size: 9, topic: 'food' }, 'млинці': { size: 3, topic: 'food' }, 'готуюсам': { size: 2, topic: 'food' },
  'ігри': { size: 9, topic: 'games' }, 'геймер': { size: 6, topic: 'games' }, 'проходження': { size: 4, topic: 'games' }, 'пікселі': { size: 2, topic: 'games' },
  'малюнок': { size: 7, topic: 'art' }, 'творчість': { size: 6, topic: 'art' }, 'скетч': { size: 4, topic: 'art' }, 'акварель': { size: 3, topic: 'art' },
  'спорт': { size: 8, topic: 'sport' }, 'футбол': { size: 8, topic: 'sport' }, 'тренування': { size: 5, topic: 'sport' }, 'біг': { size: 3, topic: 'sport' },
  'наука': { size: 6, topic: 'science' }, 'досліди': { size: 4, topic: 'science' }, 'космос': { size: 6, topic: 'science' }, 'цікаво': { size: 7, topic: null },
  'музика': { size: 9, topic: 'music' }, 'гітара': { size: 4, topic: 'music' }, 'кавер': { size: 4, topic: 'music' }, 'концерт': { size: 4, topic: 'music' },
  'подорожі': { size: 8, topic: 'travel' }, 'природа': { size: 7, topic: 'travel' }, 'гори': { size: 5, topic: 'travel' }, 'море': { size: 6, topic: 'travel' },
  'рекомендації': { size: 10, topic: null, spam: true }, 'лайк': { size: 10, topic: null, spam: true }, 'взаємнапідписка': { size: 6, topic: null, spam: true },
  'школа': { size: 6, topic: 'me' }, 'друзі': { size: 7, topic: 'me' }, 'мійдень': { size: 5, topic: 'me' }, 'осінь': { size: 7, topic: null },
};

// Тренди змінюються щодня. Кожен — хештег і тема; вміст на тему тренду отримує більше показів.
export const TRENDS = [
  { tag: 'осіньвкадрі', t: 'Осінь у кадрі', topics: ['travel', 'pets', 'art'] },
  { tag: 'хвилиначуда', t: 'Хвилина чуда', topics: ['science', 'art'] },
  { tag: 'смачнийранок', t: 'Смачний ранок', topics: ['food'] },
  { tag: 'мійулюбленець', t: 'Мій улюбленець', topics: ['pets'] },
  { tag: 'рекорддня', t: 'Рекорд дня', topics: ['sport', 'games'] },
  { tag: 'звукидому', t: 'Звуки дому', topics: ['music', 'pets'] },
  { tag: 'малюйзімною', t: 'Малюй зі мною', topics: ['art'] },
  { tag: 'маршрутвихідного', t: 'Маршрут вихідного', topics: ['travel', 'sport'] },
];

// Слова-клікбейти в підписі: більше кліків, але глядачі розчаровуються
export const CLICKBAIT = ['шок', 'не повіриш', 'терміново', 'ти впадеш', '100%', 'жесть', 'увага всім', 'ніхто не знав'];
// Грубі слова (для перевірки власних відповідей і фільтра коментарів)
export const RUDE = ['дурн', 'тупи', 'тупо', 'ідіот', 'відчепи', 'замовкни', 'нікчем', 'бездар', 'смітт', 'заткни', 'невдах'];

// Вигадані імена для підписників
const FIRST = ['Соня', 'Максим', 'Олеся', 'Дмитро', 'Настя', 'Тарас', 'Віка', 'Богдан', 'Злата', 'Артем', 'Міла', 'Денис', 'Марта', 'Роман', 'Ліна', 'Олег', 'Яна', 'Іван', 'Софія', 'Назар', 'Катя', 'Андрій', 'Христя', 'Євген', 'Даринка', 'Матвій', 'Вероніка', 'Остап', 'Аліна', 'Кирило'];
const NICK_A = ['sonia', 'max', 'olesia', 'dima', 'nastia', 'taras', 'vika', 'bodia', 'zlata', 'artem', 'mila', 'denys', 'marta', 'roma', 'lina', 'oleh', 'yana', 'vania', 'sofi', 'nazar', 'katia', 'andrii', 'khrystia', 'zhenia', 'daryna', 'matvii', 'nika', 'ostap', 'alina', 'kyrylo'];
const NICK_B = ['_art', '.ua', '_play', '.mur', '_kyiv', '.lviv', '_day', '.go', '_star', '_fox', '.sun', '_rock', '.cook', '_run', '.moon', '_cat', '.pixel'];
export const AV_COLORS = ['#c62828', '#ad1457', '#6a1b9a', '#283593', '#1565c0', '#00838f', '#00695c', '#2e7d32', '#5d4037', '#455a64', '#b23c17', '#4527a0'];
export function makePerson(rnd, kind = 'fan', interests = null) {
  const i = rnd.int(FIRST.length);
  return { name: FIRST[i], nick: NICK_A[i] + NICK_B[rnd.int(NICK_B.length)] + (rnd.chance(0.35) ? rnd.int(90) + 10 : ''), color: rnd.pick(AV_COLORS), kind, interests: interests || [rnd.pick(Object.keys(NICHES))] };
}

// Інші блогери (стрічка, співпраця)
export const CREATORS = [
  { id: 'c1', nick: 'murko.cat', name: 'Мурко й компанія', niche: 'pets', color: '#b23c17', followers: 12400 },
  { id: 'c2', nick: 'kukhnia_dashi', name: 'Кухня Даші', niche: 'food', color: '#ad1457', followers: 8300 },
  { id: 'c3', nick: 'pixel.taras', name: 'Тарас Піксель', niche: 'games', color: '#283593', followers: 21500 },
  { id: 'c4', nick: 'olivets_art', name: 'Олівець', niche: 'art', color: '#00695c', followers: 6100 },
  { id: 'c5', nick: 'run.with.nazar', name: 'Біжи з Назаром', niche: 'sport', color: '#2e7d32', followers: 4700 },
  { id: 'c6', nick: 'naukovets', name: 'Науковець', niche: 'science', color: '#1565c0', followers: 15800 },
  { id: 'c7', nick: 'struna.music', name: 'Струна', niche: 'music', color: '#4527a0', followers: 9900 },
  { id: 'c8', nick: 'dorogy_ua', name: 'Дороги', niche: 'travel', color: '#5d4037', followers: 18200 },
];

// Шаблони коментарів. {t} — назва теми/сцени.
export const COMMENTS = {
  praise: ['Дуже гарно!', 'Клас, мені подобається', 'Супер!', 'Вау, це круто', 'Чекаю ще', 'Лайк однозначно', 'Неймовірно гарно', 'Так тримати!', 'Найкращий допис за сьогодні', 'Красиво вийшло'],
  topic: {
    pets: ['Який пухнастик!', 'Хочу погладити', 'Як його звати?', 'Мій кіт теж так робить', 'Найкращий хвостик'],
    food: ['Виглядає смачно!', 'Дай рецепт, будь ласка', 'Я б з’їв(-ла) прямо зараз', 'Скільки часу готувати?', 'Ммм, апетитно'],
    games: ['Який це рівень?', 'Я теж граю в таке', 'Круто пройшов!', 'Покажи секретну кімнату', 'Ого, швидко'],
    art: ['Ти так гарно малюєш!', 'Якими фарбами малюєш?', 'Навчи мене', 'Скільки часу малював(-ла)?', 'Це шедевр'],
    sport: ['Мотивує!', 'Скільки разів набиваєш?', 'Я теж хочу так', 'Сила!', 'Покажи тренування'],
    science: ['А чому так виходить?', 'Повторю вдома з дорослими', 'Неймовірно цікаво', 'Поясни детальніше', 'Як у підручнику, тільки цікавіше'],
    music: ['Гарно звучить', 'Яка це мелодія?', 'Ти давно граєш?', 'Зіграй ще!', 'Мурашки'],
    travel: ['Де це?', 'Хочу туди', 'Неймовірний краєвид', 'Яке гарне небо', 'Збережу собі'],
    me: ['Гарне фото', 'Класно виглядаєш', 'Привіт!', 'Чудовий день', 'Ви такі веселі'],
  },
  request: {
    pets: ['Зроби відео, як кіт грається', 'Покажи, чим годуєш улюбленця', 'Більше фото тварин!'],
    food: ['Зроби відео з рецептом млинців', 'Покажи простий сніданок', 'Приготуй щось солодке'],
    games: ['Зроби проходження до кінця', 'Покажи свої налаштування', 'Зніми найкращі моменти'],
    art: ['Зроби відео, як ти малюєш', 'Намалюй кота', 'Покажи свої пензлі'],
    sport: ['Покажи розминку', 'Зніми тренування з м’ячем', 'Як правильно бігати?'],
    science: ['Покажи ще один дослід', 'Розкажи про космос', 'Зроби дослід із магнітом'],
    music: ['Зіграй пісню на замовлення', 'Покажи, як настроїти гітару', 'Запиши кавер'],
    travel: ['Покажи весь маршрут', 'Більше фото природи', 'Порадь, куди поїхати'],
    me: ['Покажи свій день', 'Більше фото з друзями', 'Розкажи про себе'],
  },
  critique: {
    dark: ['Темнувато, погано видно', 'Можна трохи яскравіше?', 'Нічого не видно'],
    over: ['Забагато фільтрів', 'Кольори дивні', 'Очі болять від яскравості'],
    intro: ['Початок задовгий, ледве дочекався(-лася)', 'Довго нічого не відбувається', 'Перемотав(-ла) початок'],
    mute: ['Чому пропав звук?', 'Відео без звуку?'],
    long: ['Задовге відео', 'Можна коротше'],
    offtopic: ['Я підписувався(-лася) заради іншого', 'А де звичні дописи?'],
    caption: ['А що тут відбувається?', 'Додай опис'],
    spamtags: ['Навіщо стільки хештегів?', 'Хештеги не про те'],
  },
  clickbait: ['Де обіцяний шок?', 'Клікбейт, розчарування', 'Навіщо обманювати в заголовку?', 'Очікував(-ла) більшого'],
  bot: ['Заробляй від 1000 грн на день! Пиши в Директ', 'Хочеш 10 тисяч підписників? Переходь за посиланням у профілі', 'Взаємна підписка? Підпишись — я теж', 'Отримай безкоштовні монети для гри тут'],
  troll: ['Нудота', 'Хто це взагалі дивиться?', 'Відписуюсь', 'Ти нічого не вмієш', 'Гірше не бачив(-ла)', 'Знову ти'],
  ad_unmarked: ['Це реклама?', 'Чому не позначено, що це реклама?', 'Продався(-лася)…'],
  ad_bad: ['Ти серйозно це рекламуєш?', 'Це ж обман, не вірте', 'Розчарування. Відписуюсь'],
  ad_ok: ['Чесно, що позначив(-ла) рекламу', 'Нормальна реклама, корисна річ'],
  privacy: {
    address: ['О, я знаю цей будинок! Це ж на Шкільній, 12?', 'Ти живеш на Шкільній? Я поруч!'],
    school: ['Ти зі Школи №1? Я теж там поруч', 'Бачу емблему — в якому ти класі?'],
    doc: ['Тут видно штрихкод квитка, його можуть скопіювати', 'Ой, видно твоє прізвище на квитку'],
    friend: ['А друзі не проти, що ти виклав(-ла) їхнє фото?'],
    chat: ['Тут видно чийсь номер телефону', 'Це ж особиста переписка…'],
    copy: ['Це ж кадр із мультфільму, а не твоє', 'Вкажи, звідки це'],
    place: ['Бачу геомітку — ти зараз там?', 'О, ти поруч зі мною'],
  },
  fake: ['Це фейк, уроки ніхто не скасовував', 'Перевір джерело, перш ніж поширювати', 'Ти теж повірив(-ла)?'],
};

// Готові відповіді на коментарі: kind — тон (kind/neutral/rude)
export const REPLIES = {
  praise: [['Дякую! Дуже приємно', 'kind'], ['Дякую', 'neutral'], ['Ну і що', 'rude']],
  topic: [['Дякую! Мені теж дуже подобається', 'kind'], ['Ага', 'neutral'], ['Не твоє діло', 'rude']],
  question: [['Гарне питання! Розповім у наступному дописі', 'kind'], ['Потім розкажу', 'neutral'], ['Сам(-а) шукай', 'rude']],
  request: [['Класна ідея, запишу собі!', 'kind', 'idea'], ['Можливо', 'neutral'], ['Не буду', 'rude']],
  critique: [['Дякую за пораду, наступного разу виправлю', 'kind'], ['Як вийшло, так вийшло', 'neutral'], ['Сам(-а) спробуй краще', 'rude']],
  troll: [['Шкода, що не сподобалось. Гарного дня!', 'kind'], ['Ок', 'neutral'], ['Сам(-а) такий(-а)!', 'rude']],
  bot: [['Ні, дякую', 'neutral']],
  other: [['Дякую за коментар!', 'kind'], ['Зрозумів(-ла)', 'neutral'], ['Відчепись', 'rude']],
};

// Пропозиції від брендів. bad — сумнівний товар (вредить довірі), pay — оплата в гривнях
export const BRANDS = [
  { id: 'olivets', name: 'Канцелярія «Олівець»', niche: ['art', 'science'], item: 'набір олівців', pay: 300 },
  { id: 'murchyk', name: 'Корм «Мурчик»', niche: ['pets'], item: 'корм для котів і собак', pay: 350 },
  { id: 'kolos', name: 'Пекарня «Колосок»', niche: ['food'], item: 'борошно для млинців', pay: 300 },
  { id: 'start', name: 'Спортшкола «Старт»', niche: ['sport', 'travel'], item: 'безкоштовне пробне тренування', pay: 400 },
  { id: 'klik', name: 'Ігровий клуб «Клік»', niche: ['games', 'music'], item: 'знижка на ігрові години', pay: 350 },
  { id: 'fortuna', name: 'Ставки «Фортуна»', niche: null, item: 'ставки на спорт', pay: 2000, bad: 'Ставки й азартні ігри заборонено рекламувати дітям. Підписники втратять довіру, а платформа може заблокувати допис.' },
  { id: 'chai', name: 'Чарівний чай «Стрункість»', niche: null, item: 'чай, що «спалює жир за ніч»', pay: 1500, bad: 'Чаю, що «спалює жир за ніч», не існує. Реклама неперевіреного товару — обман підписників.' },
];

// Кольори й символи для аватара
export const AV_SYMBOLS = ['letter', 'paw', 'star', 'note', 'brush', 'ball', 'gamepad', 'flask', 'mountain', 'chef'];
