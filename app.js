// Lofi Room: plays YouTube / YouTube Music links through the official IFrame player,
// alongside the pixel scenes (scenes/), with ambient sound for each scene, the time of day, and a focus timer.
import { t, lang, setLang, applyStatic, group as groupName, tag as tagName, named } from './i18n.js';
import { createAmbience, audioContext } from './ambience.js';
import { createMusic } from './music.js';

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('lofi-room:' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('lofi-room:' + key, JSON.stringify(value));
      } catch {
        /* storage blocked: the room still works, it just won't remember */
      }
    },
  };

  // ---------------------------------------------------------------- links

  /** Turn a YouTube / YouTube Music URL (or a bare video id) into { videoId, listId, index }. */
  function parseLink(text) {
    const s = text.trim();
    if (/^[\w-]{11}$/.test(s)) return { videoId: s };
    let url;
    try {
      url = new URL(s);
    } catch {
      return null;
    }
    const host = url.hostname.replace(/^www\.|^m\./, '');
    if (!['youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null;
    let videoId = url.searchParams.get('v');
    if (host === 'youtu.be') videoId = url.pathname.slice(1, 12);
    const path = url.pathname.match(/^\/(?:live|shorts|embed)\/([\w-]{11})/);
    if (path) videoId = path[1];
    const listId = url.searchParams.get('list');
    const index = Number(url.searchParams.get('index')) || 0;
    if (videoId && !/^[\w-]{11}$/.test(videoId)) videoId = null;
    if (!videoId && !listId) return null;
    return { videoId, listId, index };
  }

  // Built-in stations. Each one was checked to play inside an embedded player (2026-11-18, 56 stations);
  // owners can still turn embedding off later, and the player then skips ahead on its own.
  // Group and tag names are in Thai (i18n.js translates them); titles with Thai in them carry an `en` one too.
  // 24/7 live radios come first in each group: they never end, so they suit a room left open.
  const yt = (id) => 'https://www.youtube.com/watch?v=' + id;
  const STATIONS = [
    // Lofi Room radio: made in the browser as it plays (music.js), no YouTube, works offline
    { group: 'วิทยุ Lofi Room', url: 'lofi:auto', title: 'Lofi Room · เพลงตามฉาก', en: 'Lofi Room · follows the scene', tag: 'สร้างสด' },
    { group: 'วิทยุ Lofi Room', url: 'lofi:room', title: 'คืนฝนตก', en: 'Rainy night', tag: 'สร้างสด' },
    { group: 'วิทยุ Lofi Room', url: 'lofi:cafe', title: 'เช้าที่คาเฟ่', en: 'Café morning', tag: 'สร้างสด' },
    { group: 'วิทยุ Lofi Room', url: 'lofi:city', title: 'นีออนยามดึก', en: 'Neon late night', tag: 'สร้างสด' },
    { group: 'วิทยุ Lofi Room', url: 'lofi:camp', title: 'ข้างกองไฟ', en: 'By the campfire', tag: 'สร้างสด' },
    { group: 'วิทยุ Lofi Room', url: 'lofi:snow', title: 'หิมะเงียบ', en: 'Quiet snow', tag: 'สร้างสด' },
    { group: 'Lofi', url: yt('rFZHOHl-L8A'), title: 'Lofi Girl · beats to relax/study', tag: 'ไลฟ์' },
    { group: 'Lofi', url: yt('uWzSqdcfPZw'), title: 'lofi hip hop radio', tag: 'ไลฟ์' },
    { group: 'Lofi', url: yt('FWjZ0x2M8og'), title: 'the bootleg boy · sad & sleepy', tag: 'ไลฟ์' },
    { group: 'Lofi', url: yt('0muHFBSiybw'), title: 'Summer lofi radio', tag: 'ไลฟ์' },
    { group: 'Lofi', url: yt('1Waq8ohWbV4'), title: 'Lofi beats 24/7', tag: 'ยาว' },
    { group: 'Lofi', url: yt('_jH2oTNRe7g'), title: 'Lofi ฤดูใบไม้ร่วง', tag: 'มิกซ์', en: 'Autumn lofi' },
    { group: 'Lofi', url: yt('09K79_bD6w0'), title: 'Japanese lofi ยามดึก', tag: '3 ชม.', en: 'Late-night Japanese lofi' },
    { group: 'Chillhop และ jazzy beats', url: yt('5yx6BWlEVcY'), title: 'Chillhop · jazzy lofi', tag: 'ไลฟ์' },
    { group: 'Chillhop และ jazzy beats', url: yt('7NOSDKb0HlU'), title: 'Chillhop · beats to study', tag: 'ไลฟ์' },
    { group: 'Chillhop และ jazzy beats', url: yt('i6WzngxTnBA'), title: 'Late night vibes', tag: 'ไลฟ์' },
    { group: 'Chillhop และ jazzy beats', url: yt('E2vONfzoyRI'), title: 'Jazz lofi radio', tag: 'ไลฟ์' },
    { group: 'Chillhop และ jazzy beats', url: yt('3PFJ9SETS4M'), title: 'Lofi house radio', tag: 'ไลฟ์' },
    { group: 'Chillhop และ jazzy beats', url: yt('S9WXQn2Y4U0'), title: 'Jazz hip hop ยุค 90', tag: '3 ชม.', en: '90s jazz hip hop' },
    { group: 'Chillhop และ jazzy beats', url: yt('rhrCG0Vtx3g'), title: 'Neo soul ในเมือง', tag: 'มิกซ์', en: 'City neo soul' },
    { group: 'ฝนและการนอน', url: yt('JD-kMIpDfnY'), title: 'Lofi Girl · beats to sleep', tag: 'ไลฟ์' },
    { group: 'ฝนและการนอน', url: yt('VAlMDl00mYY'), title: 'Sleep lofi radio', tag: 'ไลฟ์' },
    { group: 'ฝนและการนอน', url: yt('CwPCy1GLS38'), title: 'Lofi วันฝนตก', tag: 'ไลฟ์', en: 'Rainy day lofi' },
    { group: 'ฝนและการนอน', url: yt('-OekvEFm1lo'), title: 'เสียงฝนเบา ๆ', tag: 'ไลฟ์', en: 'Gentle rain' },
    { group: 'ฝนและการนอน', url: yt('JavK3uFay0I'), title: 'Lofi ฝนตก', tag: 'ฝน', en: 'Lofi with rain' },
    { group: 'ฝนและการนอน', url: yt('DvfSPb8VWC4'), title: 'Tokyo rain lofi', tag: 'ฝน' },
    { group: 'ฝนและการนอน', url: yt('E47fhPV9s2Q'), title: 'เพลงนอนหลับ + เสียงฝน', tag: '8 ชม.', en: 'Sleep music + rain' },
    { group: 'แจ๊สและคาเฟ่', url: yt('A8jDx9TLMQc'), title: 'Relaxing jazz radio', tag: 'ไลฟ์' },
    { group: 'แจ๊สและคาเฟ่', url: yt('Dx5qFachd3A'), title: 'เปียโนแจ๊สช้า ๆ', tag: 'ไลฟ์', en: 'Slow jazz piano' },
    { group: 'แจ๊สและคาเฟ่', url: yt('DSGyEsJ17cI'), title: 'แจ๊สวันฝนตก + บอสซาโนวา', tag: 'ไลฟ์', en: 'Rainy day jazz + bossa nova' },
    { group: 'แจ๊สและคาเฟ่', url: yt('SORD03t7nlo'), title: 'Smooth jazz คาเฟ่', tag: 'ไลฟ์', en: 'Smooth café jazz' },
    { group: 'แจ๊สและคาเฟ่', url: yt('nOa1kTGU5pU'), title: 'Bossa nova ริมทะเล', tag: 'ไลฟ์', en: 'Seaside bossa nova' },
    { group: 'แจ๊สและคาเฟ่', url: yt('iBeKujv18OI'), title: 'คาเฟ่แจ๊สวันฝนตก', tag: 'แจ๊ส', en: 'Rainy day jazz café' },
    { group: 'แจ๊สและคาเฟ่', url: yt('MYPVQccHhAQ'), title: 'คาเฟ่เปียโนแจ๊ส', tag: 'แจ๊ส', en: 'Jazz piano café' },
    { group: 'เปียโนและคลาสสิก', url: yt('N0snMcR6aaA'), title: 'Relaxing piano radio', tag: 'ไลฟ์' },
    { group: 'เปียโนและคลาสสิก', url: yt('jXAEIWcGXwE'), title: 'Classical music radio', tag: 'ไลฟ์' },
    { group: 'เปียโนและคลาสสิก', url: yt('E_XmwjgRLz8'), title: 'กีตาร์ชิล ๆ', tag: 'ไลฟ์', en: 'Chill guitar radio' },
    { group: 'เปียโนและคลาสสิก', url: yt('cYPJaHT5f3E'), title: 'เปียโนสงบ ๆ', tag: 'เปียโน', en: 'Calm piano' },
    { group: 'เปียโนและคลาสสิก', url: yt('BMuknRb7woc'), title: 'คลาสสิกสำหรับอ่านหนังสือ', tag: 'คลาสสิก', en: 'Classical for studying' },
    { group: 'Ambient และโฟกัส', url: yt('GSfT7H87zq4'), title: 'Synth ambient อวกาศ', tag: 'ไลฟ์', en: 'Space synth ambient' },
    { group: 'Ambient และโฟกัส', url: yt('xORCbIptqcc'), title: 'Ambient ก่อนนอน', tag: 'ไลฟ์', en: 'Sleep ambient' },
    { group: 'Ambient และโฟกัส', url: yt('S_MOd40zlYU'), title: 'Dark ambient ยามค่ำ', tag: 'ไลฟ์', en: 'Night dark ambient' },
    { group: 'Ambient และโฟกัส', url: yt('q_4KI-ChIIs'), title: 'เสียงเตาผิง', tag: 'ไลฟ์', en: 'Crackling fireplace' },
    { group: 'Ambient และโฟกัส', url: yt('gsy_yCG_3cA'), title: 'Ambient สำหรับโฟกัส', tag: 'ยาว', en: 'Ambient for focus' },
    { group: 'City pop และ Synthwave', url: yt('vZ-Q7lM5Sv8'), title: 'City pop ดิสโก้ยุค 80', tag: 'ไลฟ์', en: '80s city pop disco' },
    { group: 'City pop และ Synthwave', url: yt('OB6MrueZIPY'), title: 'City pop radio โตเกียว', tag: 'ไลฟ์', en: 'Tokyo city pop radio' },
    { group: 'City pop และ Synthwave', url: yt('4xDzrJKXOOY'), title: 'Synthwave radio', tag: 'ไลฟ์' },
    { group: 'City pop และ Synthwave', url: yt('UFHYMtqlWJE'), title: 'Synthwave ทำงานดึก', tag: 'ไลฟ์', en: 'Late-night synthwave' },
    { group: 'City pop และ Synthwave', url: yt('V0QU80nRWIE'), title: 'Chillout / house radio', tag: 'ไลฟ์' },
    { group: 'City pop และ Synthwave', url: yt('zXHS92Nirfo'), title: 'City pop ญี่ปุ่นยุค 80', tag: 'มิกซ์', en: '80s Japanese city pop' },
    { group: 'เพลงเกมและอนิเมะ', url: yt('h3AMUun9tHk'), title: 'GameChops · VGM study lounge', tag: 'ไลฟ์' },
    { group: 'เพลงเกมและอนิเมะ', url: yt('-GAr6XkB35k'), title: 'เพลงเกมเวอร์ชันเปียโน', tag: 'ไลฟ์', en: 'Video game piano' },
    { group: 'เพลงเกมและอนิเมะ', url: yt('5jaT_8hy3Vg'), title: 'Lofi เพลงเกม', tag: '10 ชม.', en: 'Video game lofi' },
    { group: 'เพลงเกมและอนิเมะ', url: yt('leg3dJ4Xl_Q'), title: 'เพลงเปิดอนิเมะแบบ lofi', tag: '24 ชม.', en: 'Anime openings, lofi' },
    { group: 'เพลงเกมและอนิเมะ', url: yt('zhDwjnYZiCo'), title: 'คาเฟ่ Ghibli', tag: '4 ชม.', en: 'Ghibli coffee shop' },
    { group: 'เพลงเกมและอนิเมะ', url: yt('eEZF9iIv5XM'), title: 'Medieval lofi', tag: 'มิกซ์' },
    { group: 'ไทยและเอเชีย', url: yt('1Tl2FtV06qo'), title: 'Asian lofi radio', tag: 'ไลฟ์' },
    { group: 'ไทยและเอเชีย', url: yt('d-UbSndUGks'), title: 'Thai lofi mix', tag: 'มิกซ์' },
    { group: 'ไทยและเอเชีย', url: yt('b0NX3qfdJiQ'), title: 'เพลงไทยยุคเก่า mix', tag: '1 ชม.', en: 'Thai nostalgia mix' },
    { group: 'ไทยและเอเชีย', url: yt('JtRBIDKR2-I'), title: 'กรุงเทพฯ คืนฝนตก', tag: '1 ชม.', en: 'Bangkok rainy night' },
    { group: 'ไทยและเอเชีย', url: yt('n_rAsI6CvGs'), title: 'เย็นสงบที่เชียงใหม่', tag: '2 ชม.', en: 'Quiet evening in Chiang Mai' },
    { group: 'ไทยและเอเชีย', url: yt('-Vc5kHjdFvA'), title: 'เพลงไทยฟังสบาย', tag: 'มิกซ์', en: 'Easy Thai pop' },
  ];
  let mine = store.get('mine', []); // links the listener opened themselves

  /** Every station in list order: the built-in ones, then the listener's own links. */
  const allStations = () => [...STATIONS, ...mine.map((m) => ({ ...m, group: 'mine' }))];

  // Category chips ("all", one per group, and "mine" once there are own links) and a search box
  // narrow the list. The category is remembered; the search is not.
  const GROUPS = [...new Set(STATIONS.map((s) => s.group))];
  let category = store.get('cat', 'all');
  let query = '';
  const chipLabel = (c) => (c === 'all' ? t('allStations') : c === 'mine' ? t('myLinks') : groupName(c));
  const inCategory = (st) => category === 'all' || st.group === category;

  function matches(st, q) {
    if (!q) return true;
    const words = [st.title, st.en, st.tag, st.tag && tagName(st.tag), st.group, st.group === 'mine' ? t('myLinks') : groupName(st.group)];
    return words.some((w) => w && w.toLowerCase().includes(q));
  }

  function renderChips() {
    const cats = ['all', ...GROUPS, ...(mine.length ? ['mine'] : [])];
    if (!cats.includes(category)) category = 'all';
    const box = $('station-cats');
    // same chips as before: relabel in place, so a chip pressed from the keyboard keeps focus
    if (box.children.length !== cats.length || [...box.children].some((b, i) => b.dataset.cat !== cats[i])) {
      box.replaceChildren(
        ...cats.map((c) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'chip';
          b.dataset.cat = c;
          b.addEventListener('click', () => {
            category = c;
            store.set('cat', c);
            renderStations(currentUrl);
          });
          return b;
        }),
      );
    }
    for (const b of box.children) {
      b.textContent = chipLabel(b.dataset.cat);
      b.setAttribute('aria-pressed', String(b.dataset.cat === category));
    }
  }

  function renderStations(activeUrl) {
    renderChips();
    const button = (st) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = st.url;
      const name = document.createElement('span');
      name.textContent = named(st) || st.url;
      const tag = document.createElement('small');
      tag.textContent = st.tag ? tagName(st.tag) : t('mine');
      b.append(name, tag);
      if (st.url === activeUrl) b.className = 'active';
      b.addEventListener('click', () => open(st.url));
      return b;
    };
    const q = query.trim().toLowerCase();
    const shown = allStations().filter((st) => inCategory(st) && matches(st, q));
    const items = [];
    let group = null;
    for (const st of shown) {
      if (st.group !== group) {
        group = st.group;
        const h = document.createElement('p');
        h.className = 'group';
        h.textContent = group === 'mine' ? t('myLinks') : groupName(group);
        items.push(h);
      }
      items.push(button(st));
    }
    if (!shown.length) {
      const p = document.createElement('p');
      p.className = 'none';
      p.textContent = t('noMatch', query.trim());
      items.push(p);
    }
    $('stations').replaceChildren(...items);
    $('station-count').textContent = t('count', shown.length);
  }

  $('station-q').addEventListener('input', (e) => {
    query = e.target.value;
    renderStations(currentUrl);
  });

  function remember(url, title) {
    if (STATIONS.some((s) => s.url === url)) return;
    mine = [{ url, title }, ...mine.filter((s) => s.url !== url)].slice(0, 6);
    store.set('mine', mine);
    renderStations(url);
  }

  // ---------------------------------------------------------------- player

  let player = null;
  let ready = false;
  let pending = null; // link waiting for the API to load
  let currentUrl = null;
  let jumpTo = null; // video to select once a playlist has loaded
  let skipTimer = null;
  let misses = 0; // stations in a row that failed to play; stop skipping after a few
  const ERRORS = { 2: 'err2', 5: 'err5', 100: 'err100', 101: 'err101', 150: 'err101' };

  function showError(msg, watchUrl) {
    const el = $('error');
    el.textContent = msg || '';
    if (msg && watchUrl) {
      const a = document.createElement('a');
      a.href = watchUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = t('openOnYouTube');
      el.append(' · ', a);
    }
    el.hidden = !msg;
  }

  function loadApi() {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => !gen && showError(t('apiFail')); // offline, the radio still plays
    document.head.append(tag);
  }

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          ready = true;
          player.setVolume(Number($('vol').value));
          if (pending) play(pending);
        },
        onStateChange: onState,
        onError: (e) => {
          const id = player.getVideoData()?.video_id;
          const watch = id ? 'https://www.youtube.com/watch?v=' + id : currentUrl;
          const msg = ERRORS[e.data] ? t(ERRORS[e.data]) : t('errCode', e.data);
          // keep the music going: skip to the next station, unless several have failed in a row
          // (then the problem is more likely the connection than the station)
          if (++misses <= 3 && currentUrl) {
            showError(msg + ' · ' + t('skipping'), watch);
            clearTimeout(skipTimer);
            skipTimer = setTimeout(() => stepStation(1), 3000);
          } else showError(msg, watch);
        },
      },
    });
  };

  function play(link) {
    if (!ready) {
      pending = link;
      return;
    }
    pending = null;
    showError('');
    $('screen-empty').hidden = true;
    // YouTube Music "mixes" (RD…) are personal radios that the embedded player often can't load,
    // so for those we play the song itself.
    const usableList = link.listId && !link.listId.startsWith('RD') ? link.listId : null;
    if (usableList) {
      jumpTo = link.index ? null : link.videoId;
      const opts = { list: usableList, listType: 'playlist', index: Math.max(0, link.index - 1) };
      link.cueOnly ? player.cuePlaylist(opts) : player.loadPlaylist(opts);
    } else if (link.videoId) {
      jumpTo = null;
      link.cueOnly ? player.cueVideoById(link.videoId) : player.loadVideoById(link.videoId);
    } else {
      showError(t('mixFail'));
    }
  }

  /**
   * Move to the station before or after the current one, wrapping round the list. With a category
   * chosen, stay inside it (as long as the current station belongs to it); the search box doesn't
   * limit this, since it is only for finding a station.
   */
  function stepStation(dir) {
    const all = allStations();
    const picked = all.filter(inCategory);
    const list = picked.some((st) => st.url === currentUrl) ? picked : all;
    if (!list.length) return;
    const i = list.findIndex((st) => st.url === currentUrl);
    const next = list[(i + dir + list.length) % list.length];
    open(next.url);
  }

  /** Prev/next: within a playlist while there is room, otherwise to the neighbouring station. */
  function step(dir) {
    if (gen) return stepStation(dir);
    if (!ready || !currentUrl) return;
    const list = player.getPlaylist() || [];
    const at = player.getPlaylistIndex();
    if (list.length > 1 && at + dir >= 0 && at + dir < list.length) dir > 0 ? player.nextVideo() : player.previousVideo();
    else stepStation(dir);
  }

  // ---------------------------------------------------------------- Lofi Room radio

  const music = createMusic();
  let gen = null; // the lofi: station playing (or cued), instead of YouTube
  const isGen = (url) => typeof url === 'string' && url.startsWith('lofi:');
  const genStation = (url) => STATIONS.find((st) => st.url === url);

  function openGen(url, cueOnly) {
    gen = url;
    currentUrl = url;
    store.set('last', url);
    $('url').value = '';
    renderStations(url);
    showError('');
    if (ready && player.getPlayerState?.() === YT.PlayerState.PLAYING) player.pauseVideo();
    $('screen-empty').hidden = true;
    $('screen').classList.add('gen');
    $('title').textContent = named(genStation(url));
    $('play').disabled = false;
    $('prev').disabled = $('next').disabled = false;
    if (!cueOnly) music.play(url.slice(5));
    else labelGen(music.info());
  }
  function leaveGen() {
    if (!gen) return;
    gen = null;
    music.pause();
    $('screen').classList.remove('gen', 'spinning');
  }
  /** The cassette on the screen: the chord now, the key and tempo, the reels turning while it plays. */
  function labelGen(info) {
    if (!gen) return;
    $('play').dataset.playing = String(!!info.playing);
    labelPlay();
    if (info.chord) $('gen-chord').textContent = info.chord;
    $('gen-meta').textContent = info.track ? t('genMeta', info.track, info.key, info.bpm) : t('genReady');
    $('screen').classList.toggle('spinning', !!info.playing);
    if ('mediaSession' in navigator && info.playing) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: named(genStation(gen)), artist: 'Lofi Room', album: info.key ? info.key + ' · ' + info.bpm + ' BPM' : '' });
      navigator.mediaSession.setActionHandler('play', () => music.play(gen.slice(5)));
      navigator.mediaSession.setActionHandler('pause', () => music.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => music.next());
    }
  }
  music.onChange(labelGen);
  window.LofiMusic = music;
  music.setVolume(Number($('vol').value || 60) / 100);

  function open(url) {
    clearTimeout(skipTimer);
    if (isGen(url)) {
      openGen(url);
      return;
    }
    leaveGen();
    const link = parseLink(url);
    if (!link) {
      showError(t('badLink'));
      return;
    }
    currentUrl = url;
    $('url').value = url;
    store.set('last', url);
    renderStations(url);
    play(link);
  }

  function onState(e) {
    if (gen) return; // the radio has the deck; YouTube is only pausing
    const S = YT.PlayerState;
    const list = player.getPlaylist() || [];
    if (jumpTo && list.length) {
      const i = list.indexOf(jumpTo);
      jumpTo = null;
      if (i > 0) {
        player.playVideoAt(i);
        return;
      }
    }
    if (e.data === S.PLAYING) misses = 0;
    // a video, a mix or the last song of a playlist has finished: carry on with the next station
    if (e.data === S.ENDED) {
      const at = player.getPlaylistIndex();
      if (list.length < 2 || at >= list.length - 1) {
        stepStation(1);
        return;
      }
    }
    const playing = e.data === S.PLAYING || e.data === S.BUFFERING;
    const btn = $('play');
    btn.disabled = false;
    btn.dataset.playing = String(playing);
    labelPlay();
    $('prev').disabled = $('next').disabled = !currentUrl;
    const title = player.getVideoData()?.title;
    if (title) {
      $('title').textContent = title;
      if (e.data === S.PLAYING && currentUrl) {
        const known = mine.find((s) => s.url === currentUrl);
        if (!known || known.title !== title) remember(currentUrl, list.length > 1 ? title + ' · ' + t('playlist') : title);
      }
    }
  }

  function labelPlay() {
    $('play').setAttribute('aria-label', t($('play').dataset.playing === 'true' ? 'pause' : 'play'));
  }

  $('load-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('url').value.trim()) open($('url').value);
  });
  $('play').addEventListener('click', () => {
    if (gen) {
      music.playing ? music.pause() : music.play(gen.slice(5));
      return;
    }
    if (!ready) return;
    const s = player.getPlayerState();
    if (s === YT.PlayerState.PLAYING || s === YT.PlayerState.BUFFERING) player.pauseVideo();
    else player.playVideo();
  });
  $('prev').addEventListener('click', () => (gen ? stepStation(-1) : step(-1)));
  $('next').addEventListener('click', () => (gen && music.playing ? music.next() : step(1))); // on the radio: a new track
  $('vol').value = store.get('vol', 60);
  $('vol').addEventListener('input', (e) => {
    store.set('vol', Number(e.target.value));
    if (ready) player.setVolume(Number(e.target.value));
    music.setVolume(Number(e.target.value) / 100);
  });

  // ---------------------------------------------------------------- ambience + time of day

  // The scene's own sound (ambience.js): rain in the room, waves at the sea, the fire at camp…
  const amb = createAmbience({
    levels: () => {
      const { scene, state } = window.LofiScenes.peek();
      return scene?.sound?.(state);
    },
    weather: () => window.LofiScenes.weatherSound(),
  });
  $('amb-vol').value = store.get('amb-vol', store.get('rain-vol', 35));
  amb.setVolume(Number($('amb-vol').value) / 100);
  $('amb-toggle').addEventListener('click', (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    labelAmb();
    amb.setOn(on);
  });
  function labelAmb() {
    const on = $('amb-toggle').getAttribute('aria-pressed') === 'true';
    $('amb-toggle').title = t(on ? 'ambOff' : 'ambOn');
  }
  $('amb-vol').addEventListener('input', (e) => {
    store.set('amb-vol', Number(e.target.value));
    amb.setVolume(Number(e.target.value) / 100);
  });
  addEventListener('lofi:phase', (e) => amb.setPhase(e.detail.phase));
  amb.setPhase(window.LofiScenes.phase());

  // Time of day: 'auto' follows the clock; a click steps through dawn, day, dusk and night.
  const TIMES = ['auto', ...window.LofiScenes.phases];
  let timeMode = store.get('time', 'auto');
  if (!TIMES.includes(timeMode)) timeMode = 'auto';
  window.LofiScenes.time(timeMode);
  $('time-mode').addEventListener('click', () => {
    timeMode = TIMES[(TIMES.indexOf(timeMode) + 1) % TIMES.length];
    store.set('time', timeMode);
    window.LofiScenes.time(timeMode);
    labelTime();
  });
  function labelTime() {
    const b = $('time-mode');
    const now = t('time_' + window.LofiScenes.phase());
    $('time-label').textContent = timeMode === 'auto' ? t('timeAuto') : now;
    b.querySelector('use').setAttribute('href', '#i-' + (window.LofiScenes.phase() === 'night' ? 'moon' : 'sun'));
    b.title = (timeMode === 'auto' ? t('timeAutoHint') + ' (' + now + ')' : t('timeFixedHint')) + ' · ' + t('timeNext');
  }
  addEventListener('lofi:phase', labelTime);

  // Weather: 'auto' comes and goes by itself; a click steps through what this scene can have.
  const WX_ICON = { rain: 'rain', storm: 'storm', fog: 'fog', snow: 'snow' };
  let wxMode = store.get('weather', 'auto');
  window.LofiScenes.weather(wxMode);
  $('weather-mode').addEventListener('click', () => {
    const { kinds } = window.LofiScenes.weatherNow();
    const steps = ['auto', ...kinds];
    // a held kind this scene can't have counts as auto
    wxMode = steps[(Math.max(0, steps.indexOf(wxMode)) + 1) % steps.length];
    store.set('weather', wxMode);
    window.LofiScenes.weather(wxMode);
  });
  function labelWeather() {
    let { mode, kind, kinds } = window.LofiScenes.weatherNow();
    const held = mode !== 'auto' && kinds.includes(mode);
    if (held) kind = mode; // a held one shows at once, before the old weather has finished clearing
    const now = t('wx_' + kind);
    const b = $('weather-mode');
    $('weather-label').textContent = held ? now : t('wxAuto');
    const clear = window.LofiScenes.phase() === 'night' ? 'moon' : 'sun';
    b.querySelector('use').setAttribute('href', '#i-' + (kind === 'clear' ? clear : WX_ICON[kind]));
    b.title = (held ? t('wxFixedHint') : t('wxAutoHint') + ' (' + now + ')') + ' · ' + t('timeNext');
  }
  addEventListener('lofi:weather', labelWeather);
  addEventListener('lofi:weather', () => music.setWeather(window.LofiScenes.weatherNow().kind));
  music.setWeather(window.LofiScenes.weatherNow().kind);
  addEventListener('lofi:phase', labelWeather);
  labelWeather();

  // ---------------------------------------------------------------- clock + focus timer

  const pad = (n) => String(n).padStart(2, '0');
  function tickClock() {
    const now = new Date();
    $('time').textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
    $('date').textContent = now.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const MODES = {
    focus: { label: 'focus', secs: 25 * 60, done: 'focusDone', next: 'focusNext' },
    rest: { label: 'rest', secs: 5 * 60, done: 'restDone', next: 'restNext' },
  };
  let mode = 'focus';
  let left = MODES.focus.secs;
  let endsAt = null; // timestamp of the end of this phase, while running
  let phaseTimer = null;
  let armed = []; // chime notes already scheduled on the audio clock for the end of this phase

  // Browsers slow a background tab's timers down, to once a minute after a while, so the timer
  // can't rely on them to be on time. Two things keep it honest:
  //  - the chime is scheduled ahead on the Web Audio clock, which keeps exact time in the
  //    background, so it sounds right when the phase ends;
  //  - phases are counted from when each one should have ended, never from when a late timer
  //    finally noticed, so the schedule doesn't drift.

  const audioCtx = audioContext;

  /** Play the two-note chime `delay` seconds from now; returns the notes so they can be cancelled. */
  function chime(delay = 0) {
    const ctx = audioCtx();
    if (!ctx) return [];
    return [660, 880].map((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      const t = ctx.currentTime + Math.max(0, delay) + i * 0.25;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1);
      return o;
    });
  }

  function disarm() {
    clearTimeout(phaseTimer);
    for (const o of armed) {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    }
    armed = [];
  }

  /** Get ready for the end of the current phase: the chime on the audio clock, plus a timer. */
  function arm() {
    disarm();
    const ms = endsAt - Date.now();
    const audio = audioContext();
    if (audio && audio.state === 'running') armed = chime(ms / 1000);
    phaseTimer = setTimeout(endPhase, ms);
  }

  function endPhase() {
    if (!endsAt || Date.now() < endsAt - 250) return;
    const finished = mode;
    const heard = armed.length > 0;
    armed = [];
    // if the tab slept through several phases, catch up on all of them
    while (Date.now() >= endsAt - 250) {
      mode = mode === 'focus' ? 'rest' : 'focus';
      endsAt += MODES[mode].secs * 1000;
    }
    if (!heard) chime();
    notify(finished);
    arm();
    renderTimer();
  }

  function renderTimer() {
    if (endsAt && Date.now() >= endsAt - 250) endPhase();
    const secs = endsAt ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : left;
    const text = pad(Math.floor(secs / 60)) + ':' + pad(secs % 60);
    $('focus-time').textContent = text;
    $('focus-mode').textContent = t(MODES[mode].label);
    document.title = endsAt ? text + ' · ' + t(MODES[mode].label) : 'Lofi Room';
  }

  // ---- optional desktop notifications, for when the room is in a background tab
  const canNotify = 'Notification' in window;
  let notifyOn = canNotify && Notification.permission === 'granted' && store.get('notify', false);

  function showNotifyState() {
    const b = $('focus-notify');
    b.hidden = !canNotify;
    b.setAttribute('aria-pressed', String(notifyOn));
    const denied = canNotify && Notification.permission === 'denied';
    const label = t(denied ? 'notifyBlocked' : notifyOn ? 'notifyOff' : 'notify');
    b.title = label;
    b.setAttribute('aria-label', label);
  }

  function notify(finished) {
    if (!notifyOn || !document.hidden || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(t(MODES[finished].done), { body: t(MODES[finished].next), tag: 'lofi-room-timer', silent: true });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* some mobile browsers only allow notifications from a service worker */
    }
  }

  $('focus-notify').addEventListener('click', async () => {
    if (!canNotify) return;
    if (!notifyOn && Notification.permission === 'default') await Notification.requestPermission();
    notifyOn = Notification.permission === 'granted' && !notifyOn;
    store.set('notify', notifyOn);
    showNotifyState();
  });
  showNotifyState();

  function setRunning(on) {
    $('focus-start').textContent = t(on ? 'stop' : 'start');
    $('focus-start').classList.toggle('running', on);
  }

  $('focus-start').addEventListener('click', () => {
    if (endsAt) {
      left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      endsAt = null;
      disarm();
    } else {
      audioCtx(); // a click is the moment browsers allow sound to start
      endsAt = Date.now() + left * 1000;
      arm();
    }
    setRunning(!!endsAt);
    renderTimer();
  });
  $('focus-reset').addEventListener('click', () => {
    disarm();
    mode = 'focus';
    left = MODES.focus.secs;
    endsAt = null;
    setRunning(false);
    renderTimer();
  });
  // coming back to the tab: catch up at once rather than on the next (possibly slow) tick
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      tickClock();
      renderTimer();
    }
  });

  tickClock();
  renderTimer();
  setInterval(() => {
    tickClock();
    renderTimer();
  }, 1000);

  // ---------------------------------------------------------------- scenes + clean view

  function pickScene(id) {
    const scene = window.LofiScenes.set(id);
    amb.setScene(scene.id);
    music.setScene(scene.id);
    store.set('scene', scene.id);
    for (const b of $('scene-picker').children) b.setAttribute('aria-pressed', String(b.dataset.id === scene.id));
  }
  $('scene-picker').replaceChildren(
    ...window.LofiScenes.list.map((scene) => {
      const { id } = scene;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg';
      b.dataset.id = id;
      b.textContent = named(scene, 'name');
      b.addEventListener('click', () => pickScene(id));
      return b;
    }),
  );
  pickScene(store.get('scene', 'room'));

  $('hide-ui').addEventListener('click', (e) => {
    const clean = !$('hud').classList.contains('clean');
    $('hud').classList.toggle('clean', clean);
    e.currentTarget.setAttribute('aria-pressed', String(clean));
    e.currentTarget.querySelector('use').setAttribute('href', clean ? '#i-eye' : '#i-eye-off');
    labelHide();
  });
  function labelHide() {
    const label = t($('hud').classList.contains('clean') ? 'show' : 'hide');
    $('hide-ui').setAttribute('aria-label', label);
    $('hide-ui').title = label;
  }

  // ---------------------------------------------------------------- language

  /** Put every piece of text on the page into the current language, keeping all state. */
  function relabel() {
    if (gen) {
      $('title').textContent = named(genStation(gen));
      labelGen(music.info());
    }
    applyStatic();
    const b = $('lang');
    b.textContent = t('switchTo');
    b.lang = lang === 'th' ? 'en' : 'th';
    b.title = t('switchLabel');
    b.setAttribute('aria-label', b.title);
    for (const s of $('scene-picker').children) s.textContent = named(window.LofiScenes.list.find((x) => x.id === s.dataset.id), 'name');
    renderStations(currentUrl);
    if (!player?.getVideoData?.()?.title) $('title').textContent = t('noStation');
    labelPlay();
    labelAmb();
    labelTime();
    labelWeather();
    labelHide();
    showNotifyState();
    setRunning(!!endsAt);
    tickClock();
    renderTimer();
  }
  $('lang').addEventListener('click', () => {
    setLang(lang === 'th' ? 'en' : 'th');
    relabel();
  });

  // After a few quiet seconds the panels fade out so the scene can breathe; any mouse move,
  // key or touch brings them back. The clock and the video stay on screen.
  const IDLE_MS = 5000;
  let idleTimer = null;
  function wake() {
    $('hud').classList.remove('idle');
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // stay awake while the pointer rests on a panel or something in it has focus
      if ($('hud').querySelector('.glass:hover, :focus-visible, details[open]')) return wake();
      $('hud').classList.add('idle');
      document.body.classList.add('idle');
    }, IDLE_MS);
  }
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel']) addEventListener(type, wake, { passive: true });
  wake();

  // ---------------------------------------------------------------- start

  // Offline support and "install as an app" (sw.js). Not on file://, where it can't register.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  const lastUrl = store.get('last', null);
  if (lastUrl) currentUrl = lastUrl;
  relabel();
  loadApi();
  if (isGen(lastUrl)) openGen(lastUrl, true);
  else if (lastUrl) {
    $('url').value = lastUrl;
    // Cue (don't autoplay): browsers block sound until the visitor interacts.
    const link = parseLink(lastUrl);
    if (link) pending = { ...link, cueOnly: true };
  }
})();
