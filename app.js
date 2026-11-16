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

  // No built-in stations: many popular lofi streams and label uploads turn embedding off,
  // so the room starts with whatever the listener pastes.
  let stations = store.get('stations', []);

  function renderStations(activeUrl) {
    const box = $('stations');
    box.replaceChildren(
      ...stations.map((st) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = st.title || st.url;
        b.title = st.url;
        if (st.url === activeUrl) b.className = 'active';
        b.addEventListener('click', () => open(st.url));
        return b;
      }),
    );
  }

  function remember(url, title) {
    stations = [{ url, title }, ...stations.filter((s) => s.url !== url)].slice(0, 8);
    store.set('stations', stations);
    renderStations(url);
  }

  // ---------------------------------------------------------------- player

  let player = null;
  let ready = false;
  let pending = null; // link waiting for the API to load
  let currentUrl = null;
  let jumpTo = null; // video to select once a playlist has loaded
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
          showError(ERRORS[e.data] || 'เล่นวิดีโอนี้ไม่ได้ (รหัส ' + e.data + ')', watch);
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

  function open(url) {
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
    const playing = e.data === S.PLAYING || e.data === S.BUFFERING;
    const btn = $('play');
    btn.disabled = false;
    btn.textContent = playing ? '❚❚' : '▶';
    btn.setAttribute('aria-label', playing ? 'หยุด' : 'เล่น');
    $('prev').disabled = $('next').disabled = list.length < 2;
    const title = player.getVideoData()?.title;
    if (title) {
      $('title').textContent = title;
      if (e.data === S.PLAYING && currentUrl) {
        const known = stations.find((s) => s.url === currentUrl);
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
  $('prev').addEventListener('click', () => ready && player.previousVideo());
  $('next').addEventListener('click', () => ready && player.nextVideo());
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
    e.currentTarget.textContent = on ? 'เปิด' : 'ปิด';
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

  // ---------------------------------------------------------------- start

  renderStations(null);
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
