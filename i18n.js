// UI text in Thai and English. The language starts from the browser's (Thai if it prefers Thai,
// English otherwise), and the toggle in the top bar remembers the choice.
//
// Static text in index.html is marked up with data attributes and filled in by applyStatic():
//   data-i18n="key"        the element's text
//   data-i18n-aria="key"   its aria-label
//   data-i18n-title="key"  its tooltip (and aria-label, unless data-i18n-aria is set too)
//   data-i18n-placeholder="key"  an input's placeholder

const STRINGS = {
  th: {
    switchTo: 'EN',
    switchLabel: 'Switch to English',
    scenes: 'เลือกฉาก',
    amb: 'เสียงรอบตัว',
    ambVol: 'ความดังเสียงรอบตัว',
    ambOn: 'เปิดเสียงของฉากนี้ (ฝน คลื่น ลม กองไฟ ผู้คน)',
    ambOff: 'ปิดเสียงรอบตัว',
    timeAuto: 'ตามเวลาจริง',
    time_dawn: 'เช้ามืด',
    time_day: 'กลางวัน',
    time_dusk: 'พลบค่ำ',
    time_night: 'กลางคืน',
    timeAutoHint: 'ฉากเปลี่ยนตามเวลาในเครื่อง',
    timeFixedHint: 'ล็อกช่วงเวลาไว้',
    timeNext: 'คลิกเพื่อเปลี่ยน',
    focus: 'โฟกัส',
    rest: 'พัก',
    start: 'เริ่ม',
    stop: 'หยุด',
    reset: 'รีเซ็ตเวลา',
    notify: 'แจ้งเตือนเมื่อหมดรอบ',
    notifyOff: 'ปิดการแจ้งเตือน',
    notifyBlocked: 'เบราว์เซอร์บล็อกการแจ้งเตือนของเว็บนี้ไว้',
    focusDone: 'หมดเวลาโฟกัสแล้ว',
    focusNext: 'พักสัก 5 นาที',
    restDone: 'หมดเวลาพักแล้ว',
    restNext: 'กลับมาโฟกัสอีก 25 นาที',
    hide: 'ซ่อนแผง',
    show: 'แสดงแผง',
    player: 'เครื่องเล่น',
    empty: 'เลือกสถานีเพื่อเริ่มฟัง',
    nowPlaying: 'กำลังเล่น',
    noStation: 'ยังไม่ได้เลือกสถานี',
    prev: 'เพลงก่อนหน้า',
    next: 'เพลงถัดไป',
    play: 'เล่น',
    pause: 'หยุด',
    vol: 'ความดังเพลง',
    stations: 'สถานี',
    own: 'เปิดลิงก์ของตัวเอง',
    urlLabel: 'ลิงก์ YouTube หรือ YouTube Music',
    open: 'เปิด',
    myLinks: 'ลิงก์ของฉัน',
    allStations: 'ทั้งหมด',
    categories: 'หมวดสถานี',
    search: 'ค้นหาสถานี',
    searchHint: 'ค้นหา เช่น ฝน, แจ๊ส, ไลฟ์',
    count: (n) => `${n} สถานี`,
    noMatch: (q) => `ไม่พบสถานีที่ตรงกับ “${q}”`,
    mine: 'ของฉัน',
    playlist: 'เพลย์ลิสต์',
    err2: 'ลิงก์นี้ไม่ถูกต้อง',
    err5: 'เบราว์เซอร์เล่นวิดีโอนี้ไม่ได้',
    err100: 'ไม่พบวิดีโอ หรือวิดีโอเป็นแบบส่วนตัว',
    err101: 'เจ้าของวิดีโอไม่อนุญาตให้เล่นนอก YouTube',
    errCode: (n) => `เล่นวิดีโอนี้ไม่ได้ (รหัส ${n})`,
    skipping: 'กำลังข้ามไปสถานีถัดไป',
    openOnYouTube: 'เปิดบน YouTube',
    apiFail: 'โหลดเครื่องเล่น YouTube ไม่ได้ ตรวจการเชื่อมต่ออินเทอร์เน็ต',
    mixFail: 'ลิงก์มิกซ์อัตโนมัติเปิดไม่ได้ ลองเปิดจากเพลงใดเพลงหนึ่งแทน',
    badLink: 'ใช้ได้เฉพาะลิงก์จาก youtube.com, music.youtube.com หรือ youtu.be',
  },
  en: {
    switchTo: 'ไทย',
    switchLabel: 'เปลี่ยนเป็นภาษาไทย',
    scenes: 'Choose a scene',
    amb: 'Ambience',
    ambVol: 'Ambience volume',
    ambOn: "Turn on this scene's sound (rain, waves, wind, fire, people)",
    ambOff: 'Turn the ambience off',
    timeAuto: 'Live time',
    time_dawn: 'Dawn',
    time_day: 'Day',
    time_dusk: 'Dusk',
    time_night: 'Night',
    timeAutoHint: 'The scene follows your clock',
    timeFixedHint: 'Time of day held',
    timeNext: 'click to change',
    focus: 'Focus',
    rest: 'Break',
    start: 'Start',
    stop: 'Pause',
    reset: 'Reset the timer',
    notify: 'Notify me when a round ends',
    notifyOff: 'Turn notifications off',
    notifyBlocked: 'Your browser blocks notifications from this site',
    focusDone: 'Focus time is up',
    focusNext: 'Take a 5-minute break',
    restDone: 'Break is over',
    restNext: 'Back to 25 minutes of focus',
    hide: 'Hide panels',
    show: 'Show panels',
    player: 'Player',
    empty: 'Pick a station to start listening',
    nowPlaying: 'Now playing',
    noStation: 'No station yet',
    prev: 'Previous',
    next: 'Next',
    play: 'Play',
    pause: 'Pause',
    vol: 'Music volume',
    stations: 'Stations',
    own: 'Open your own link',
    urlLabel: 'A YouTube or YouTube Music link',
    open: 'Open',
    myLinks: 'My links',
    allStations: 'All',
    categories: 'Station categories',
    search: 'Search stations',
    searchHint: 'Search, e.g. rain, jazz, live',
    count: (n) => `${n} ${n === 1 ? 'station' : 'stations'}`,
    noMatch: (q) => `No stations match “${q}”`,
    mine: 'Mine',
    playlist: 'playlist',
    err2: "This link isn't valid",
    err5: "Your browser can't play this video",
    err100: 'Video not found, or it is private',
    err101: "The owner doesn't allow this video to play outside YouTube",
    errCode: (n) => `Can't play this video (code ${n})`,
    skipping: 'skipping to the next station',
    openOnYouTube: 'Open on YouTube',
    apiFail: "Couldn't load the YouTube player. Check your internet connection.",
    mixFail: "Auto-generated mix links can't be opened. Try opening one of its songs instead.",
    badLink: 'Only links from youtube.com, music.youtube.com or youtu.be work here',
  },
};

// Station groups and tags are written in Thai in app.js; these are their English names.
const GROUPS_EN = {
  'Chillhop และ jazzy beats': 'Chillhop and jazzy beats',
  'ฝนและการนอน': 'Rain and sleep',
  'แจ๊สและคาเฟ่': 'Jazz and café',
  'เปียโนและคลาสสิก': 'Piano and classical',
  'Ambient และโฟกัส': 'Ambient and focus',
  'City pop และ Synthwave': 'City pop and synthwave',
  'เพลงเกมและอนิเมะ': 'Game and anime',
  'ไทยและเอเชีย': 'Thai and Asian',
};
const TAGS_EN = { 'ไลฟ์': 'Live', 'ยาว': 'Long', 'มิกซ์': 'Mix', 'ฝน': 'Rain', 'แจ๊ส': 'Jazz', 'เปียโน': 'Piano', 'คลาสสิก': 'Classical' };

function initial() {
  try {
    const saved = JSON.parse(localStorage.getItem('lofi-room:lang'));
    if (saved === 'th' || saved === 'en') return saved;
  } catch {
    /* storage blocked: fall back to the browser's language */
  }
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  return prefs.some((l) => /^th\b/i.test(l)) ? 'th' : 'en';
}

export let lang = initial();

/** The text for `key` in the current language; keys with a parameter are functions. */
export function t(key, ...args) {
  const v = STRINGS[lang][key] ?? STRINGS.th[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}

export const group = (g) => (lang === 'en' ? GROUPS_EN[g] || g : g);
export const tag = (s) => (lang === 'en' ? TAGS_EN[s] || s.replace(/^(\d+) ชม\.$/, '$1 hr') : s);
/** A station's or scene's name: its `en` name in English when it has one. */
export const named = (thing, key = 'title') => (lang === 'en' && thing.en) || thing[key];

export function setLang(next) {
  lang = next;
  try {
    localStorage.setItem('lofi-room:lang', JSON.stringify(next));
  } catch {
    /* not remembered, still switched */
  }
  applyStatic();
}

export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
    if (!el.dataset.i18nAria) el.setAttribute('aria-label', el.title);
  }
}
