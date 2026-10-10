// Емулятор Windows · системні процеси, служби й автозавантаження (спільні для Диспетчера завдань і tasklist).

// kind: 'bg' — фоновий процес, 'win' — процес Windows; critical — без нього Windows не працює
export const SYS_PROCS = [
  { name: 'System', title: 'Система', pid: 4, mem: 144, kind: 'win', critical: true, user: 'СИСТЕМА', desc: 'Ядро Windows: керує пам’яттю, дисками й іншими пристроями.' },
  { name: 'Registry', title: 'Реєстр', pid: 92, mem: 8240, kind: 'win', critical: true, user: 'СИСТЕМА', desc: 'Зберігає налаштування Windows і програм.' },
  { name: 'smss.exe', title: 'Диспетчер сеансів Windows', pid: 412, mem: 1080, kind: 'win', critical: true, user: 'СИСТЕМА', desc: 'Запускає сеанс користувача, коли вмикається комп’ютер.' },
  { name: 'csrss.exe', title: 'Клієнтський процес під час виконання', pid: 604, mem: 5120, kind: 'win', critical: true, user: 'СИСТЕМА', desc: 'Відповідає за вікна консолі та завершення роботи.' },
  { name: 'wininit.exe', title: 'Запуск Windows', pid: 688, mem: 6380, kind: 'win', critical: true, user: 'СИСТЕМА', desc: 'Запускає служби під час завантаження Windows.' },
  { name: 'services.exe', title: 'Програма служб і контролера', pid: 760, mem: 9150, kind: 'win', critical: true, user: 'СИСТЕМА', desc: 'Запускає й зупиняє служби Windows.' },
  { name: 'lsass.exe', title: 'Локальний центр безпеки', pid: 776, mem: 14600, kind: 'win', critical: true, user: 'СИСТЕМА', desc: 'Перевіряє паролі, коли ви входите в систему.' },
  { name: 'winlogon.exe', title: 'Програма входу в Windows', pid: 820, mem: 9830, kind: 'win', critical: true, user: 'СИСТЕМА', desc: 'Показує екран входу та блокування.' },
  { name: 'dwm.exe', title: 'Диспетчер вікон робочого стола', pid: 1012, mem: 61440, cpu: 1.2, kind: 'win', critical: true, user: 'DWM-1', desc: 'Малює вікна, тіні й прозорість на екрані.' },
  { name: 'explorer.exe', title: 'Провідник Windows', pid: 1024, mem: 98304, cpu: 0.6, kind: 'win', restart: true, user: 'Учень', desc: 'Робочий стіл, панель завдань і меню «Пуск».' },
  { name: 'svchost.exe', title: 'Хост служби: DNS-клієнт', pid: 1288, mem: 7200, kind: 'win', user: 'МЕРЕЖЕВА СЛУЖБА', desc: 'Запам’ятовує, які IP-адреси мають сайти.' },
  { name: 'svchost.exe', title: 'Хост служби: DHCP-клієнт', pid: 1316, mem: 4210, kind: 'win', user: 'ЛОКАЛЬНА СЛУЖБА', desc: 'Отримує IP-адресу від роутера.' },
  { name: 'svchost.exe', title: 'Хост служби: Брандмауер Захисника Windows', pid: 1432, mem: 11300, kind: 'win', user: 'ЛОКАЛЬНА СЛУЖБА', desc: 'Перевіряє підключення за правилами брандмауера.' },
  { name: 'spoolsv.exe', title: 'Диспетчер черги друку', pid: 2216, mem: 8900, kind: 'bg', user: 'СИСТЕМА', desc: 'Надсилає документи на принтер по черзі.' },
  { name: 'MsMpEng.exe', title: 'Служба антивірусної програми', pid: 2560, mem: 182300, cpu: 0.4, kind: 'bg', user: 'СИСТЕМА', desc: 'Захисник Windows перевіряє файли на віруси.' },
  { name: 'SearchHost.exe', title: 'Пошук', pid: 4120, mem: 72100, kind: 'bg', user: 'Учень', desc: 'Пошук у меню «Пуск».' },
  { name: 'RuntimeBroker.exe', title: 'Посередник середовища виконання', pid: 4388, mem: 6020, kind: 'bg', user: 'Учень', desc: 'Перевіряє, які дозволи мають програми.' },
  { name: 'OneDrive.exe', title: 'Microsoft OneDrive', pid: 5032, mem: 34500, cpu: 0.2, kind: 'bg', user: 'Учень', desc: 'Синхронізує файли з хмарою.', startup: 'onedrive' },
  { name: 'ms-teams.exe', title: 'Microsoft Teams', pid: 5280, mem: 210400, cpu: 0.8, kind: 'bg', user: 'Учень', desc: 'Чат і відеоуроки.', startup: 'teams' },
  { name: 'SecurityHealthSystray.exe', title: 'Значок безпеки Windows', pid: 5616, mem: 2900, kind: 'bg', user: 'Учень', desc: 'Щит у правому куті панелі завдань.', startup: 'security' },
  { name: 'ctfmon.exe', title: 'Завантажувач CTF', pid: 5760, mem: 13800, kind: 'bg', user: 'Учень', desc: 'Перемикає мову введення (УКР/ENG).' },
];

// Програми, які запускаються разом із Windows
export const STARTUP = [
  { key: 'onedrive', name: 'Microsoft OneDrive', pub: 'Microsoft Corporation', impact: 'Високий', on: true },
  { key: 'teams', name: 'Microsoft Teams', pub: 'Microsoft Corporation', impact: 'Високий', on: true },
  { key: 'security', name: 'Значок безпеки Windows', pub: 'Microsoft Corporation', impact: 'Низький', on: true },
  { key: 'minecraft', name: 'Minecraft Launcher', pub: 'Mojang', impact: 'Середній', on: false },
  { key: 'updater', name: 'Програма оновлення драйверів', pub: 'Невідомий видавець', impact: 'Високий', on: true },
];

// Служби: стан змінюється в Диспетчері завдань і командою net start / net stop
export const SERVICES = [
  { name: 'Dnscache', title: 'DNS-клієнт', pid: 1288, group: 'NetworkService', run: true, critical: true },
  { name: 'Dhcp', title: 'DHCP-клієнт', pid: 1316, group: 'LocalServiceNetworkRestricted', run: true, critical: true },
  { name: 'mpssvc', title: 'Брандмауер Захисника Windows', pid: 1432, group: 'LocalServiceNoNetworkFirewall', run: true, critical: true },
  { name: 'Spooler', title: 'Диспетчер черги друку', pid: 2216, group: '', run: true },
  { name: 'WinDefend', title: 'Служба антивірусної програми Microsoft Defender', pid: 2560, group: '', run: true, critical: true },
  { name: 'WSearch', title: 'Пошук Windows', pid: 4120, group: '', run: true },
  { name: 'W32Time', title: 'Служба часу Windows', pid: 0, group: 'LocalService', run: false },
  { name: 'TermService', title: 'Служби віддаленого робочого стола', pid: 0, group: 'NetworkService', run: false },
  { name: 'bthserv', title: 'Служба підтримки Bluetooth', pid: 0, group: 'LocalService', run: false },
  { name: 'wuauserv', title: 'Служба оновлення Windows', pid: 0, group: 'netsvcs', run: false },
  { name: 'Audiosrv', title: 'Аудіо Windows', pid: 1840, group: 'LocalServiceNetworkRestricted', run: true },
  { name: 'Themes', title: 'Теми', pid: 1904, group: 'netsvcs', run: true },
];

// Стан процесів живе в пам’яті (як у справжньому ПК — після перезавантаження все знову запущено)
export function procState() {
  return { killed: new Set(), services: Object.fromEntries(SERVICES.map(s => [s.name, s.run])), startup: Object.fromEntries(STARTUP.map(s => [s.key, s.on])), boot: Date.now() };
}

// як показувати вікна програм у Диспетчері завдань і tasklist: [назва, файл, пам’ять (КБ), типове навантаження ЦП %]
const APP_INFO = {
  explorer: ['Провідник', 'explorer.exe', 26000, 0.3], cmd: ['Обробник команд Windows', 'cmd.exe', 4300, 0.1], notepad: ['Блокнот', 'notepad.exe', 14800, 0.1],
  security: ['Безпека Windows', 'SecHealthUI.exe', 41200, 0.2], firewallcpl: ['Панель керування', 'explorer.exe', 22000, 0.1], wfmsc: ['Консоль керування Microsoft', 'mmc.exe', 38900, 0.3],
  taskmgr: ['Диспетчер завдань', 'Taskmgr.exe', 31200, 1.1], browser: ['Браузер', 'browser.exe', 186000, 1.6], settings: ['Параметри', 'SystemSettings.exe', 52300, 0.2],
};
export const appInfo = a => APP_INFO[a] || [a, a + '.exe', 12000, 0.1];
