// Lofi Room: plays YouTube / YouTube Music links through the official IFrame player,
// alongside the pixel room (scene.js), with a rain ambience and a focus timer.
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

  // Built-in stations. Each one was checked to play inside an embedded player (2026-11-18);
  // owners can still turn embedding off later, and the player then skips ahead on its own.
  // 24/7 live radios come first in each group: they never end, so they suit a room left open.
  const yt = (id) => 'https://www.youtube.com/watch?v=' + id;
  const STATIONS = [
    { group: 'Lofi', url: yt('rFZHOHl-L8A'), title: 'Lofi Girl · beats to relax/study', tag: 'ไลฟ์' },
    { group: 'Lofi', url: yt('uWzSqdcfPZw'), title: 'lofi hip hop radio', tag: 'ไลฟ์' },
    { group: 'Lofi', url: yt('5yx6BWlEVcY'), title: 'Chillhop · jazzy lofi', tag: 'ไลฟ์' },
    { group: 'Lofi', url: yt('7NOSDKb0HlU'), title: 'Chillhop · beats to study', tag: 'ไลฟ์' },
    { group: 'Lofi', url: yt('1Tl2FtV06qo'), title: 'Asian lofi radio', tag: 'ไลฟ์' },
    { group: 'Lofi', url: yt('0muHFBSiybw'), title: 'Summer lofi radio', tag: 'ไลฟ์' },
    { group: 'Lofi', url: yt('1Waq8ohWbV4'), title: 'Lofi beats 24/7', tag: 'ยาว' },
    { group: 'Lofi', url: yt('_jH2oTNRe7g'), title: 'Lofi ฤดูใบไม้ร่วง', tag: 'มิกซ์' },
    { group: 'Lofi', url: yt('09K79_bD6w0'), title: 'Japanese lofi ยามดึก', tag: '3 ชม.' },
    { group: 'Lofi', url: yt('d-UbSndUGks'), title: 'Thai lofi mix', tag: 'มิกซ์' },
    { group: 'Lofi', url: yt('5jaT_8hy3Vg'), title: 'Lofi เพลงเกม', tag: '10 ชม.' },
    { group: 'Lofi', url: yt('eEZF9iIv5XM'), title: 'Medieval lofi', tag: 'มิกซ์' },
    { group: 'ฝนและการนอน', url: yt('JD-kMIpDfnY'), title: 'Lofi Girl · beats to sleep', tag: 'ไลฟ์' },
    { group: 'ฝนและการนอน', url: yt('VAlMDl00mYY'), title: 'Sleep lofi radio', tag: 'ไลฟ์' },
    { group: 'ฝนและการนอน', url: yt('CwPCy1GLS38'), title: 'Lofi วันฝนตก', tag: 'ไลฟ์' },
    { group: 'ฝนและการนอน', url: yt('i6WzngxTnBA'), title: 'Late night vibes', tag: 'ไลฟ์' },
    { group: 'ฝนและการนอน', url: yt('q_4KI-ChIIs'), title: 'เสียงเตาผิง', tag: 'ไลฟ์' },
    { group: 'ฝนและการนอน', url: yt('JavK3uFay0I'), title: 'Lofi ฝนตก', tag: 'ฝน' },
    { group: 'ฝนและการนอน', url: yt('DvfSPb8VWC4'), title: 'Tokyo rain lofi', tag: 'ฝน' },
    { group: 'ฝนและการนอน', url: yt('E47fhPV9s2Q'), title: 'เพลงนอนหลับ + เสียงฝน', tag: '8 ชม.' },
    { group: 'แจ๊สและคาเฟ่', url: yt('E2vONfzoyRI'), title: 'Jazz lofi radio', tag: 'ไลฟ์' },
    { group: 'แจ๊สและคาเฟ่', url: yt('A8jDx9TLMQc'), title: 'Relaxing jazz radio', tag: 'ไลฟ์' },
    { group: 'แจ๊สและคาเฟ่', url: yt('Dx5qFachd3A'), title: 'เปียโนแจ๊สช้า ๆ', tag: 'ไลฟ์' },
    { group: 'แจ๊สและคาเฟ่', url: yt('DSGyEsJ17cI'), title: 'แจ๊สวันฝนตก + บอสซาโนวา', tag: 'ไลฟ์' },
    { group: 'แจ๊สและคาเฟ่', url: yt('SORD03t7nlo'), title: 'Smooth jazz คาเฟ่', tag: 'ไลฟ์' },
    { group: 'แจ๊สและคาเฟ่', url: yt('nOa1kTGU5pU'), title: 'Bossa nova ริมทะเล', tag: 'ไลฟ์' },
    { group: 'แจ๊สและคาเฟ่', url: yt('iBeKujv18OI'), title: 'คาเฟ่แจ๊สวันฝนตก', tag: 'แจ๊ส' },
    { group: 'แจ๊สและคาเฟ่', url: yt('MYPVQccHhAQ'), title: 'คาเฟ่เปียโนแจ๊ส', tag: 'แจ๊ส' },
    { group: 'แจ๊สและคาเฟ่', url: yt('S9WXQn2Y4U0'), title: 'Jazz hip hop ยุค 90', tag: '3 ชม.' },
    { group: 'เปียโนและโฟกัส', url: yt('N0snMcR6aaA'), title: 'Relaxing piano radio', tag: 'ไลฟ์' },
    { group: 'เปียโนและโฟกัส', url: yt('jXAEIWcGXwE'), title: 'Classical music radio', tag: 'ไลฟ์' },
    { group: 'เปียโนและโฟกัส', url: yt('GSfT7H87zq4'), title: 'Synth ambient อวกาศ', tag: 'ไลฟ์' },
    { group: 'เปียโนและโฟกัส', url: yt('cYPJaHT5f3E'), title: 'เปียโนสงบ ๆ', tag: 'เปียโน' },
    { group: 'เปียโนและโฟกัส', url: yt('BMuknRb7woc'), title: 'คลาสสิกสำหรับอ่านหนังสือ', tag: 'คลาสสิก' },
    { group: 'เปียโนและโฟกัส', url: yt('gsy_yCG_3cA'), title: 'Ambient สำหรับโฟกัส', tag: 'ยาว' },
    { group: 'อื่น ๆ', url: yt('4xDzrJKXOOY'), title: 'Synthwave radio', tag: 'ไลฟ์' },
    { group: 'อื่น ๆ', url: yt('3PFJ9SETS4M'), title: 'Lofi house radio', tag: 'ไลฟ์' },
    { group: 'อื่น ๆ', url: yt('V0QU80nRWIE'), title: 'Chillout / house radio', tag: 'ไลฟ์' },
    { group: 'อื่น ๆ', url: yt('zXHS92Nirfo'), title: 'City pop ญี่ปุ่นยุค 80', tag: 'มิกซ์' },
    { group: 'อื่น ๆ', url: yt('rhrCG0Vtx3g'), title: 'Neo soul ในเมือง', tag: 'มิกซ์' },
  ];
  let mine = store.get('mine', []); // links the listener opened themselves

  /** Every station in list order: the built-in ones, then the listener's own links. */
  const allStations = () => [...STATIONS, ...mine.map((m) => ({ ...m, group: 'ลิงก์ของฉัน' }))];

  function renderStations(activeUrl) {
    const button = (st) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = st.url;
      const name = document.createElement('span');
      name.textContent = st.title || st.url;
      const tag = document.createElement('small');
      tag.textContent = st.tag || 'ของฉัน';
      b.append(name, tag);
      if (st.url === activeUrl) b.className = 'active';
      b.addEventListener('click', () => open(st.url));
      return b;
    };
    const items = [];
    let group = null;
    for (const st of allStations()) {
      if (st.group !== group) {
        group = st.group;
        const h = document.createElement('p');
        h.className = 'group';
        h.textContent = group;
        items.push(h);
      }
      items.push(button(st));
    }
    $('stations').replaceChildren(...items);
  }

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
  const ERRORS = {
    2: 'ลิงก์นี้ไม่ถูกต้อง',
    5: 'เบราว์เซอร์เล่นวิดีโอนี้ไม่ได้',
    100: 'ไม่พบวิดีโอ หรือวิดีโอเป็นแบบส่วนตัว',
    101: 'เจ้าของวิดีโอไม่อนุญาตให้เล่นนอก YouTube',
    150: 'เจ้าของวิดีโอไม่อนุญาตให้เล่นนอก YouTube',
  };

  function showError(msg, watchUrl) {
    const el = $('error');
    el.textContent = msg || '';
    if (msg && watchUrl) {
      const a = document.createElement('a');
      a.href = watchUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'เปิดบน YouTube';
      el.append(' · ', a);
    }
    el.hidden = !msg;
  }

  function loadApi() {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => showError('โหลดเครื่องเล่น YouTube ไม่ได้ ตรวจการเชื่อมต่ออินเทอร์เน็ต');
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
          const msg = ERRORS[e.data] || 'เล่นวิดีโอนี้ไม่ได้ (รหัส ' + e.data + ')';
          // keep the music going: skip to the next station, unless several have failed in a row
          // (then the problem is more likely the connection than the station)
          if (++misses <= 3 && currentUrl) {
            showError(msg + ' · กำลังข้ามไปสถานีถัดไป', watch);
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
      showError('ลิงก์มิกซ์อัตโนมัติเปิดไม่ได้ ลองเปิดจากเพลงใดเพลงหนึ่งแทน');
    }
  }

  /** Move to the station before or after the current one, wrapping round the list. */
  function stepStation(dir) {
    const list = allStations();
    if (!list.length) return;
    const i = list.findIndex((st) => st.url === currentUrl);
    const next = list[(i + dir + list.length) % list.length];
    open(next.url);
  }

  /** Prev/next: within a playlist while there is room, otherwise to the neighbouring station. */
  function step(dir) {
    if (!ready || !currentUrl) return;
    const list = player.getPlaylist() || [];
    const at = player.getPlaylistIndex();
    if (list.length > 1 && at + dir >= 0 && at + dir < list.length) dir > 0 ? player.nextVideo() : player.previousVideo();
    else stepStation(dir);
  }

  function open(url) {
    clearTimeout(skipTimer);
    const link = parseLink(url);
    if (!link) {
      showError('ใช้ได้เฉพาะลิงก์จาก youtube.com, music.youtube.com หรือ youtu.be');
      return;
    }
    currentUrl = url;
    $('url').value = url;
    store.set('last', url);
    renderStations(url);
    play(link);
  }

  function onState(e) {
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
    btn.setAttribute('aria-label', playing ? 'หยุด' : 'เล่น');
    $('prev').disabled = $('next').disabled = !currentUrl;
    const title = player.getVideoData()?.title;
    if (title) {
      $('title').textContent = title;
      if (e.data === S.PLAYING && currentUrl) {
        const known = mine.find((s) => s.url === currentUrl);
        if (!known || known.title !== title) remember(currentUrl, list.length > 1 ? title + ' · เพลย์ลิสต์' : title);
      }
    }
  }

  $('load-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('url').value.trim()) open($('url').value);
  });
  $('play').addEventListener('click', () => {
    if (!ready) return;
    const s = player.getPlayerState();
    if (s === YT.PlayerState.PLAYING || s === YT.PlayerState.BUFFERING) player.pauseVideo();
    else player.playVideo();
  });
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  $('vol').value = store.get('vol', 60);
  $('vol').addEventListener('input', (e) => {
    store.set('vol', Number(e.target.value));
    if (ready) player.setVolume(Number(e.target.value));
  });

  // ---------------------------------------------------------------- rain ambience

  let audio = null;
  let rainGain = null;

  function startRain() {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      // Two seconds of brown-ish noise, looped, then shaped into a soft rain hiss.
      const len = audio.sampleRate * 2;
      const buf = audio.createBuffer(2, len, audio.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.04 * white) / 1.04;
          d[i] = last * 3 + white * 0.08;
        }
      }
      const src = audio.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const hp = audio.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 250;
      const lp = audio.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      rainGain = audio.createGain();
      rainGain.gain.value = 0;
      src.connect(hp).connect(lp).connect(rainGain).connect(audio.destination);
      src.start();
    }
    audio.resume();
    rainGain.gain.setTargetAtTime(Number($('rain-vol').value) / 100, audio.currentTime, 0.4);
  }

  function stopRain() {
    if (rainGain) rainGain.gain.setTargetAtTime(0, audio.currentTime, 0.3);
  }

  $('rain-vol').value = store.get('rain-vol', 35);
  $('rain-toggle').addEventListener('click', (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    e.currentTarget.title = on ? 'ปิดเสียงฝน' : 'เปิดเสียงฝน';
    on ? startRain() : stopRain();
  });
  $('rain-vol').addEventListener('input', (e) => {
    store.set('rain-vol', Number(e.target.value));
    if ($('rain-toggle').getAttribute('aria-pressed') === 'true' && rainGain) {
      rainGain.gain.setTargetAtTime(Number(e.target.value) / 100, audio.currentTime, 0.1);
    }
  });

  // ---------------------------------------------------------------- clock + focus timer

  const pad = (n) => String(n).padStart(2, '0');
  function tickClock() {
    const now = new Date();
    $('time').textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
    $('date').textContent = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const MODES = { focus: { label: 'โฟกัส', secs: 25 * 60 }, rest: { label: 'พัก', secs: 5 * 60 } };
  let mode = 'focus';
  let left = MODES.focus.secs;
  let endsAt = null; // timestamp while running

  function chime() {
    try {
      const ctx = audio || new (window.AudioContext || window.webkitAudioContext)();
      audio = ctx;
      [660, 880].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        o.type = 'sine';
        const t = ctx.currentTime + i * 0.25;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 1);
      });
    } catch {
      /* no audio available */
    }
  }

  function renderTimer() {
    const secs = endsAt ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : left;
    const text = pad(Math.floor(secs / 60)) + ':' + pad(secs % 60);
    $('focus-time').textContent = text;
    $('focus-mode').textContent = MODES[mode].label;
    document.title = endsAt ? text + ' · ' + MODES[mode].label : 'Lofi Room';
    if (endsAt && secs === 0) {
      chime();
      mode = mode === 'focus' ? 'rest' : 'focus';
      left = MODES[mode].secs;
      endsAt = Date.now() + left * 1000;
    }
  }

  $('focus-start').addEventListener('click', (e) => {
    if (endsAt) {
      left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      endsAt = null;
    } else {
      endsAt = Date.now() + left * 1000;
    }
    e.currentTarget.textContent = endsAt ? 'หยุด' : 'เริ่ม';
    e.currentTarget.classList.toggle('running', !!endsAt);
    renderTimer();
  });
  $('focus-reset').addEventListener('click', () => {
    mode = 'focus';
    left = MODES.focus.secs;
    endsAt = null;
    $('focus-start').textContent = 'เริ่ม';
    $('focus-start').classList.remove('running');
    renderTimer();
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
    store.set('scene', scene.id);
    for (const b of $('scene-picker').children) b.setAttribute('aria-pressed', String(b.dataset.id === scene.id));
  }
  $('scene-picker').replaceChildren(
    ...window.LofiScenes.list.map(({ id, name }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg';
      b.dataset.id = id;
      b.textContent = name;
      b.addEventListener('click', () => pickScene(id));
      return b;
    }),
  );
  pickScene(store.get('scene', 'room'));

  $('hide-ui').addEventListener('click', (e) => {
    const clean = !$('hud').classList.contains('clean');
    $('hud').classList.toggle('clean', clean);
    e.currentTarget.setAttribute('aria-pressed', String(clean));
    const label = clean ? 'แสดงแผง' : 'ซ่อนแผง';
    e.currentTarget.setAttribute('aria-label', label);
    e.currentTarget.title = label;
    e.currentTarget.querySelector('use').setAttribute('href', clean ? '#i-eye' : '#i-eye-off');
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

  renderStations(store.get('last', null));
  loadApi();
  const lastUrl = store.get('last', null);
  if (lastUrl) {
    $('url').value = lastUrl;
    currentUrl = lastUrl;
    // Cue (don't autoplay): browsers block sound until the visitor interacts.
    const link = parseLink(lastUrl);
    if (link) pending = { ...link, cueOnly: true };
  }
})();
