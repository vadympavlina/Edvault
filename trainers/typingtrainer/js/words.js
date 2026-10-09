// Сліпий друк · слова й речення для вправ. Слова фільтруються за вже вивченими літерами.
// Щоб додати слова — допишіть їх через пробіл.

export const WORDS = {
  uk: `а або аж але ані він вона вони воно все всі вже від вид вода вода вік він вітер віра віл вал вага ваза валіза вата
вдала вдало лава лад ладо лапа лапи лід ліра ліва ліво ліпа лави папа пора поле пола поля поділ подія порада порода порив
дав дало дар дари дід діло дівоче дошка дід долар доля доля дорога дерево день дві два де діти дім друг думка думки
жар жало жаба жовта жовтий жіночий жив життя жити жодна жах фаза фарба фото фрази фраза фрукт фіалка
рад рада радо рало рама рамка рів рій рівно рідна рідний рік ріка роса рот робота робити ранок рука руки ручка рис
о об обід оладка олівець око очі оце осінь острів отже око орел ось оса овочі
кіт кава кавун калина каша квітка квіти кожен коло колір кому коли книга книжка кінь кіно клас клей клітина корова
небо нова новий ніч ніс ніжно ніхто немає нога ноги ну нам нас наш наша наче народ нитка ніби
гора гори голова голос гарно гарний гра грати гусак година годинник гілка
ера еліта екран епоха етап
уже ус уроки урок учень учні учитель уява усмішка уміти улюблений
шапка шар шафа школа шум шлях шия шість шкода шоколад
щастя щука щока щодня щось ще щоб щиро щедро щит
цукор ціна ціль цирк цвіт ця це ці цибуля цікаво цілий
йде йти йог йогурт
заєць зима земля зірка зелений зошит знову знати звук зуб зуби зараз завжди захід
хата хліб хмара хвіст хлопчик хороший хочу хто хвилина холод
їжак їжа їхати їде їсти їх їхній
мама море мова місто мир миша мед метро малий мало мрія мрії може можна мене моя мій міст мітла
тато тут там те то тобі тиша трава тепло темно тигр тінь тільки треба три тисяча
сад сонце сова сестра село син сир сік сніг слово смак стіл стілець сумно свято світ сім сто
будинок брат біля білий батько було бути буква березень бджола банан біг бігти
чай час читати чорний червоний чотири чисто чому чудово чарівний чекати
юнак юрба юшка
яблуко ягода ялинка явище якось який яка яке як ясно язик яскравий
пісня пісок пташка птах полум'я подвір'я м'яч сім'я об'єм зав'язати п'ять дев'ять м'ята`,
  en: `a an and are as at be but by can come day did do down each find first for from get go good had has have he her
here him his how if in into is it its just know like little long look made make many may more most my new no not now
of old on one only or other our out over people said see she so some take than that the their them then there these
they this time to two up use very was water way we well were what when where which who will with word work would year you your
add all ask fall half hall glad flag sad dad lad salad flash glass gas lake leaf deal real read lead dear red rest test
fast last past just jump jet kid kill kiss hike like life fire hire wire tire tree free green great street sea see seed
apple about after again air also always animal another answer around away back ball bear because bed been before begin
best big bird black blue boat body book both box boy bring brother brown build call car cat change city class close cold
color country cut dark dog door dream drink drive early earth easy eat egg end enough even every eye face family far farm
father feel few fish five fly food foot four friend fun game garden girl give happy hard head hear help high hill hold home
horse hot house hour idea important king kind land large laugh learn left letter light line listen live love low man mean
milk mind moon morning mother mountain move music name near need never next nice night north number open order page paper
part place plan plant play point picture question quick quiet rain river road rock room round run school second
show side sing sister sit sky sleep small snow song soon sound south space speak spring stand star start stay stop story
strong study summer sun sure table talk teacher tell thing think three today together top town toy train travel try turn
under until walk want warm wash watch week white why wind window winter wish woman world write yellow young zero zoo`,
};

export const SENTENCES = {
  uk: [
    'Сонце світить яскраво.', 'Діти грають у дворі.', 'Мама варить смачний борщ.', 'Восени листя жовтіє.', 'Кіт спить на теплому вікні.',
    'Учні пишуть диктант.', 'Ми йдемо до парку.', 'Тато читає газету.', 'На небі пливуть хмари.', 'Взимку падає білий сніг.',
    'Бабуся пече пиріжки з вишнями.', 'Хлопчик малює зелене дерево.', 'У саду співають пташки.', 'Брат грає на гітарі.', 'Сестра вчить вірш напам\'ять.',
    'Завтра ми поїдемо на екскурсію.', 'Їжак шукає грибочки в лісі.', 'Вечір тихий і теплий.', 'Книга - найкращий друг.', 'Ранок починається з усмішки.',
  ],
  en: [
    'The sun is shining.', 'Children play in the yard.', 'My cat sleeps on the window.', 'We are going to the park.', 'Birds sing in the garden.',
    'The quick brown fox jumps over the lazy dog.', 'It is raining today.', 'I like to read books.', 'My brother plays the guitar.', 'Snow is white and cold.',
    'She writes a letter to her friend.', 'We have a lesson at nine.', 'The river flows to the sea.', 'Practice makes perfect.', 'Have a nice day!',
  ],
};
export const PROVERBS = {
  uk: [
    'Без труда нема плода.', 'Вода камінь точить.', 'Діло майстра величає.', 'Знання — сила.', 'Хто рано встає, тому Бог дає.',
    'Не кажи гоп, поки не перескочиш.', 'Що посієш, те й пожнеш.', 'Вік живи — вік учись.', 'Повторення — мати навчання.', 'Краще пізно, ніж ніколи.',
    'Тиха вода греблю рве.', 'Добре там, де нас нема.', 'Слово — срібло, мовчання — золото.', 'Сім разів відміряй, а раз відріж.', 'Друзі пізнаються в біді.',
  ],
  en: [
    'Better late than never.', 'Knowledge is power.', 'Time is money.', 'Actions speak louder than words.', 'Every cloud has a silver lining.',
    'Where there is a will, there is a way.', 'An apple a day keeps the doctor away.', 'Easy come, easy go.', 'No pain, no gain.', 'Look before you leap.',
  ],
};
export const TEXTS = {
  uk: [
    'Україна має чудову природу. Карпатські гори вкриті смереками, а степи влітку стають золотими від пшениці. Дніпро несе свої води до Чорного моря. Кожна пора року тут має свою красу.',
    'Комп\'ютер допомагає нам вчитися, працювати й спілкуватися. Але щоб друкувати швидко, треба знати, де розташована кожна клавіша. Пальці самі знаходять потрібну літеру, коли ми тренуємося щодня.',
  ],
  en: [
    'Typing without looking at the keyboard is a useful skill. Keep your fingers on the home row and let each finger press its own keys. Speed will come with practice, so focus on accuracy first.',
  ],
};
// частота: щоб у випадкових «словах» частіше траплялися звичні поєднання
export const VOWELS = { uk: 'аеиіоуяюєї', en: 'aeiouy' };
