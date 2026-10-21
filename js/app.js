/* Bobo's City – main game flow.
   Screens: title → intro → 11 choices (with payoffs) → ending → recap → takeaways.
   Menu tabs: Play, My Games, Achievements, Privacy. */

(() => {
  'use strict';

  const START = { h: 50, t: 1.0 };       // Bobo's happiness + the city's temperature (°C above the old normal)
  const PAYOFF = { h: 6, t: -0.05 };     // reward when a green choice "comes back" 2 turns later
  // A hot city makes everyone grumpy: Bobo loses some happiness with every choice once it's +1.9 °C or more
  const HEAT_PENALTY = [0, 0, 3, 5];
  const PAYOFF_DELAY = 2;
  const TURNS = CHOICES.length;          // 11
  const MIN_T = 1.0;                     // the planet is already about 1 °C warmer today
  const GAMES_PER_PAGE = 4;
  // How Bobo looks when each situation appears
  const REACT = { school: 'think', lights: 'think', bottle: 'hot', toy: 'sad', hot: 'hot', cold: 'cold', shower: 'think',
    party: 'yay', jacket: 'think', trip: 'yay', food: 'yay' };
  // Climate levels: below +1.4 °C, +1.9, +2.4, above
  const levelOf = (temp) => (temp < 1.4 ? 0 : temp < 1.9 ? 1 : temp < 2.4 ? 2 : 3);
  const RAIN_CHANCE = [0.12, 0.2, 0.3, 0.42];   // hotter = wilder weather

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round2 = (v) => Math.round(v * 100) / 100;

  let store = Store.load();
  let lang = I18N[store.settings.lang] ? store.settings.lang : detectLang();
  let rerender = () => {};   // redraws the current screen (used when the language changes)
  let G = null;              // the game in progress
  let scene = null;
  let gamesPage = 0;

  function detectLang() {
    const l = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return I18N[l] ? l : 'en';
  }

  /* ── text helpers ── */
  function fmt(s, vars = {}) {
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }
  const t = (key, vars) => esc(fmt(I18N[lang].ui[key] ?? I18N.en.ui[key] ?? key, vars));
  const L = () => I18N[lang];
  const ct = (idx, key) => esc(L().choices[idx][key]);
  const sayLine = (fn) => scene && scene.say(fn(L().say));  // speech bubble (plain text, no HTML)
  // +1.2 °C (with the right decimal comma for each language)
  const deg = (v, digits = 1) => `+${v.toFixed(digits).replace('.', lang === 'en' ? '.' : ',')} °C`;
  const degDelta = (d) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(2).replace('.', lang === 'en' ? '.' : ',')} °C`;

  /* ── screen + chrome ── */
  function setScreen(html, { tab = null, home = false, brand = true } = {}) {
    document.documentElement.dataset.time = 'day';
    $('#screen').innerHTML = html;
    const tabs = $('#tabs');
    tabs.hidden = !tab;
    if (tab) renderTabs(tab);
    $('#homeBtn').hidden = !home;
    $('#brand').hidden = !brand;
    requestAnimationFrame(syncHorizon);
  }

  /* Line the page's sky/sea background up with the city drawing's horizon,
     so the sea "outside" the game sits at exactly the same level as inside. */
  function syncHorizon() {
    const svg = $('#screen svg.scene-main');
    if (!svg) return; // screens without the city keep the last horizon
    // Where the drawing sits on screen (worked out from its box, so the camera's sideways
    // slide on phones doesn't move the far-away sky: the sun and moon stay put)
    const box = svg.parentElement.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    if (!box.width || !box.height) return;
    const k = Math.min(box.width / vb.width, box.height / vb.height);
    const ctm = { a: k, d: k, e: box.left + (box.width - vb.width * k) / 2 - vb.x * k, f: box.top + (box.height - vb.height * k) / 2 - vb.y * k };
    const y = (v) => Math.round(ctm.f + ctm.d * v) + 'px';
    const root = document.documentElement.style;
    root.setProperty('--sky-top', y(0));
    root.setProperty('--horizon', y(285));
    root.setProperty('--deep', y(500));
    root.setProperty('--abyss', y(900));
    root.setProperty('--cloud-base', y(225));
    // city units -> screen pixels, so HTML layers (sun, moon) line up with the drawing
    root.setProperty('--u', ctm.a.toFixed(4) + 'px');
    root.setProperty('--ox', ctm.e.toFixed(1) + 'px');
    root.setProperty('--oy', ctm.f.toFixed(1) + 'px');
  }
  const horizonWatcher = new ResizeObserver(() => syncHorizon());
  document.addEventListener('scenezoom', () => syncHorizon());
  horizonWatcher.observe(document.getElementById('screen'));
  function watchScene(el) {
    horizonWatcher.disconnect();
    horizonWatcher.observe(document.getElementById('screen'));
    horizonWatcher.observe(el);
    syncHorizon();
  }

  function renderTabs(active) {
    const items = [['title', 'gamepad', 'tabPlay'], ['games', 'scroll', 'tabGames'], ['ach', 'trophy', 'tabAch'], ['privacy', 'lock', 'tabPrivacy']];
    $('#tabs').innerHTML = items.map(([id, emo, key]) =>
      `<button data-action="tab" data-tab="${id}" ${id === active ? 'aria-current="page"' : ''}><span class="ti">${Icon(emo)}</span>${t(key)}</button>`).join('');
  }

  function updateChrome() {
    document.documentElement.lang = lang;
    $('#langSel').value = lang;
    $('#langSel').setAttribute('aria-label', I18N[lang].ui.language);
    $('#langSel').title = I18N[lang].ui.language;
    for (const o of $('#langSel').options) o.title = I18N[o.value].label;
    const music = $('#musicBtn'), sfx = $('#sfxBtn');
    music.setAttribute('aria-pressed', String(store.settings.music));
    music.setAttribute('aria-label', I18N[lang].ui.music); music.title = I18N[lang].ui.music;
    sfx.setAttribute('aria-pressed', String(store.settings.sfx));
    sfx.innerHTML = Icon(store.settings.sfx ? 'sound' : 'mute');
    music.innerHTML = Icon('music');
    $('#homeBtn').innerHTML = Icon('home');
    $('#brand').innerHTML = `${Icon('monkey')} Bobo’s City`;
    sfx.setAttribute('aria-label', I18N[lang].ui.sound); sfx.title = I18N[lang].ui.sound;
    $('#homeBtn').setAttribute('aria-label', I18N[lang].ui.home); $('#homeBtn').title = I18N[lang].ui.home;
  }

  function setLang(l) {
    if (!I18N[l] || l === lang) return;
    lang = l;
    store.settings.lang = l;
    Store.save(store);
    if (G) G.langs.add(l);
    updateChrome();
    rerender();
  }

  /* ── modal + toast ── */
  function modal(html) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-back" data-action="modalBack"><div class="panel" role="dialog" aria-modal="true">${html}</div></div>`;
    m.hidden = false;
    const btn = m.querySelector('button');
    if (btn) btn.focus();
  }
  function closeModal() {
    $('#modal').hidden = true;
    $('#modal').innerHTML = '';
    modalResolve = null;
  }
  let modalResolve = null;
  function confirmBox(text) {
    return new Promise((resolve) => {
      modal(`<p class="intro-text">${text}</p><div class="row">
        <button class="btn ghost" data-action="confirmNo">${t('no')}</button>
        <button class="btn primary" data-action="confirmYes">${t('yes')}</button></div>`);
      modalResolve = resolve;
    });
  }
  function toast(icon, title, sub = '', long = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (long ? ' long' : '');
    el.innerHTML = `<span class="emo">${Icon(icon)}</span><div>${title}${sub ? `<small>${sub}</small>` : ''}</div>`;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), long ? 7300 : 3300);
  }

  /* ── achievements ── */
  function unlock(id) {
    if (store.ach[id]) return false;
    store.ach[id] = Date.now();
    Store.save(store);
    return true;
  }
  const achName = (id) => esc(L().ach[id][0]);
  const achIcon = (id) => ACHIEVEMENTS.find((a) => a.id === id).icon;
  function unlockWithToast(id) {
    if (!unlock(id)) return;
    toast(achIcon(id), t('newAch'), achName(id));
    Sound.play('achieve');
  }

  /* ═════════════════════ MENU SCREENS ═════════════════════ */

  function renderTitle() {
    rerender = renderTitle;
    G = null;
    setScreen(`
      <section class="screen title-screen">
        <h1 class="logo"><span class="w1">Bobo’s</span> <span class="w2">City</span></h1>
        <p class="subtitle">${t('subtitle')}</p>
        <div class="title-scene" id="titleScene" aria-hidden="true"></div>
        <div class="title-actions">
          <button class="btn primary big" data-action="play">${Icon('play')} ${t('play')}</button>
          <div class="lang-chips">${Object.keys(I18N).map((k) =>
            `<button data-action="setLang" data-lang="${k}" aria-pressed="${k === lang}">${I18N[k].label}</button>`).join('')}</div>
          <button class="btn ghost small" data-action="qr">${Icon('phone')} ${t('phone')}</button>
        </div>
        <p class="credits">${t('credits')}</p>
      </section>`, { tab: 'title', brand: false });
    const s = Scene.create($('#titleScene'));
    s.setStats(100, START.t);
    s.showcase();
    s.calm();          // a calm title screen: just a few birds
    watchScene($('#titleScene'));
  }

  function renderGames() {
    rerender = renderGames;
    const games = store.games.slice().reverse();
    const pages = Math.max(1, Math.ceil(games.length / GAMES_PER_PAGE));
    gamesPage = clamp(gamesPage, 0, pages - 1);
    const list = games.slice(gamesPage * GAMES_PER_PAGE, (gamesPage + 1) * GAMES_PER_PAGE);
    const dateFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    setScreen(`
      <section class="screen"><div class="panel wide">
        <h2>${t('gamesTitle')} ${Icon('scroll')}</h2>
        <p class="muted small">${t('played', { n: store.games.length })} · ${Icon('lock')} ${t('savedLocal')}</p>
        ${games.length === 0 ? `<p class="intro-text">${Icon('monkey')} ${t('gamesEmpty')}</p><button class="btn primary" data-action="play">${Icon('play')} ${t('play')}</button>` : `
        <div class="game-list">${list.map((g) => {
          const e = ENDINGS[g.e] ? g.e : 'warming';
          return `<div class="game-row"><span class="emo">${Icon(ENDINGS[e].icon)}</span>
            <div class="info"><b>${esc(L().endings[e][0])}</b><small>${esc(dateFmt.format(new Date(g.d)))}</small></div>
            <div class="mini">${Icon('thermo')} ${deg(g.t)} · ${Icon('monkey')} ${g.h}<br>${Icon('check')} ${g.g}/${TURNS}</div></div>`;
        }).join('')}</div>
        ${pages > 1 ? `<div class="pager"><button class="btn ghost small" data-action="pagePrev" ${gamesPage === 0 ? 'disabled' : ''} aria-label="${t('prev')}">${Icon('back')}</button>
          <span>${gamesPage + 1} / ${pages}</span>
          <button class="btn ghost small" data-action="pageNext" ${gamesPage >= pages - 1 ? 'disabled' : ''} aria-label="${t('next')}">${Icon('next')}</button></div>` : ''}`}
      </div></section>`, { tab: 'games' });
  }

  function renderAch() {
    rerender = renderAch;
    const got = ACHIEVEMENTS.filter((a) => store.ach[a.id]).length;
    setScreen(`
      <section class="screen"><div class="panel wide">
        <h2>${t('achTitle')} ${Icon('trophy')}</h2>
        <p class="muted small">${t('achCount', { a: got, b: ACHIEVEMENTS.length })} · ${Icon('lock')} ${t('savedLocal')}</p>
        <div class="ach-grid">${ACHIEVEMENTS.map((a) => {
          const has = !!store.ach[a.id];
          const desc = esc(L().ach[a.id][1]);
          return `<div class="badge ${has ? 'got' : 'locked'}" title="${desc}">
            <span class="emo">${Icon(a.icon)}</span><b>${has ? '' : Icon('lock') + ' '}${achName(a.id)}</b><small>${desc}</small></div>`;
        }).join('')}</div>
      </div></section>`, { tab: 'ach' });
  }

  function renderPrivacy() {
    rerender = renderPrivacy;
    setScreen(`
      <section class="screen"><div class="panel wide privacy">
        <h2>${t('privTitle')} ${Icon('lock')}</h2>
        <p>${Icon('home')} ${t('priv1')}</p>
        <p>${Icon('no')} ${t('priv2')}</p>
        <p>${Icon('web')} ${t('priv3')}</p>
        <h3>${t('safeTitle')} ${Icon('shield')}</h3>
        <ul>${L().tips.map((tip, k) => `<li>${Icon(['secret', 'mask', 'adult', 'chat'][k])} ${esc(tip)}</li>`).join('')}</ul>
        <div class="row"><button class="btn danger small" data-action="deleteData">${Icon('trash')} ${t('del')}</button></div>
      </div></section>`, { tab: 'privacy' });
  }

  function showQR() {
    const url = location.href.split('#')[0];
    let svg = '';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      svg = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch (e) { svg = ''; }
    const local = /^(file:|https?:\/\/(localhost|127\.|\[::1\]|192\.168\.|10\.))/.test(url);
    modal(`<h2>${Icon('phone')} ${t('phone')}</h2><div class="qr">${svg}</div><p class="intro-text">${t('qrText')}</p>
      ${local ? `<p class="muted small">${t('qrLocal')}</p>` : `<p class="url">${esc(url)}</p>`}
      <button class="btn primary" data-action="closeModal">${t('close')}</button>`);
  }

  /* ═════════════════════ START A GAME ═════════════════════ */

  const shuffle = (arr) => {
    for (let k = arr.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [arr[k], arr[j]] = [arr[j], arr[k]]; }
    return arr;
  };

  function startGame() {
    // Getting to school always comes first and the birthday party comes early (2nd or 3rd);
    // the others come in a random order every game.
    const party = CHOICES.findIndex((c) => c.id === 'party');
    const seq = [0, ...shuffle(CHOICES.map((_, k) => k).filter((k) => k !== 0 && k !== party))];
    seq.splice(1 + Math.floor(Math.random() * 2), 0, party);
    // Time of day only moves forward (morning → day → evening → night), like a real day.
    // When the next situation needs an earlier time (school is in the morning), a new day starts.
    const DAY = ['morning', 'day', 'evening', 'night'];
    let now = 0;
    const times = [], newDay = [];
    seq.forEach((ci, turn) => {
      const ok = CHOICES[ci].times.map((tm) => DAY.indexOf(tm));
      const later = ok.filter((k) => k >= now);
      newDay.push(turn > 0 && !later.length);
      now = turn === 0 ? Math.min(...ok) : later.length ? Math.min(...later) : Math.min(...ok);
      times.push(DAY[now]);
    });
    G = {
      seq, made: [], times, newDay, weather: [],
      // Super rare: a solar eclipse (about 1 game in 15), on a clear day from this turn on
      eclipseTurn: Math.random() < 1 / 15 ? 1 + Math.floor(Math.random() * 9) : -1, eclipseDone: false,
      h: START.h, temp: START.t, turn: 0, picks: [], order: [], payQueue: [],
      next: null, cardView: null, busy: false,
      ending: null, newAch: [], recapIdx: 0, langs: new Set([lang]),
    };
    renderIntro();
  }

  function renderIntro() {
    rerender = renderIntro;
    setScreen(`
      <section class="screen"><div class="panel">
        <div class="big-emoji" aria-hidden="true">${Icon('monkey')}${Icon('city')}</div>
        <h2>${t('introTitle')}</h2>
        <p class="intro-text">${t('introText')}</p>
        <div class="meter-legend">
          <div><span>${Icon('monkey')}</span>${t('monkeyMeter')}</div>
          <div><span>${Icon('thermo')}</span>${t('tempMeter')}</div>
        </div>
        <p class="intro-text">${t('introMeters')}</p>
        <button class="btn primary big" data-action="go">${t('go')} ${Icon('monkey')}</button>
      </div></section>`, { home: true });
  }

  /* ═════════════════════ THE GAME ═════════════════════ */

  function renderGame() {
    setScreen(`
      <section class="screen game" id="game">
        <div class="hud">
          <div class="meter" id="mh"><span class="emo">${Icon('monkey')}</span>
            <div class="mcol"><small data-label="monkeyMeter"></small><div class="bar"><i></i></div></div><b>0</b></div>
          <div class="dots" id="dots" aria-hidden="true">${'<span></span>'.repeat(TURNS)}</div>
          <div class="turn-txt" id="turnTxt"></div>
          <div class="meter thermo" id="mt"><span class="emo">${Icon('thermo')}</span>
            <div class="mcol"><small data-label="tempMeter"></small><div class="bar"><i></i></div></div><b>0</b></div>
        </div>
        <div class="scene-wrap" id="sceneWrap"></div>
        <div class="card" id="card" aria-live="polite"></div>
      </section>`, { home: true });
    scene = Scene.create($('#sceneWrap'));
    watchScene($('#sceneWrap'));
    labelHud();
    updateHud();
    rerender = () => { labelHud(); if (G.cardView) G.cardView(); };
  }

  function labelHud() {
    document.querySelectorAll('[data-label]').forEach((el) => { el.textContent = I18N[lang].ui[el.dataset.label]; });
    $('#mh').title = I18N[lang].ui.monkeyMeter;
    $('#mt').title = I18N[lang].ui.tempMeter;
    $('#mh').setAttribute('aria-label', `${I18N[lang].ui.monkeyMeter}: ${G.h}`);
    $('#mt').setAttribute('aria-label', `${I18N[lang].ui.tempMeter}: ${deg(G.temp)}`);
    $('#mt b').textContent = deg(G.temp).replace(' °C', '°');
  }

  function updateHud() {
    const mh = $('#mh');
    mh.querySelector('.bar i').style.width = G.h + '%';
    mh.querySelector('b').textContent = G.h;
    mh.dataset.level = G.h > 60 ? 'hi' : G.h > 30 ? 'mid' : 'lo';
    // thermometer: +0.8 °C = empty, +3.5 °C = full
    $('#mt .bar i').style.width = clamp((G.temp - 0.8) / 2.7 * 100, 4, 100) + '%';
    const dots = $('#dots').children;
    for (let k = 0; k < TURNS; k++) {
      const pk = G.picks[G.seq[k]];
      dots[k].className = k < G.made.length ? (pk ? 'g' : 'b') : k === G.turn ? 'now' : '';
    }
    $('#turnTxt').textContent = `${Math.min(G.turn + 1, TURNS)}/${TURNS}`;
    scene.setStats(G.h, G.temp);
    labelHud();
  }

  function floatDelta(id, text, good) {
    const el = document.createElement('span');
    el.className = 'delta ' + (good ? 'up' : 'down');
    el.textContent = text;
    $('#' + id).appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  function applyDelta(dh, dt) {
    const oldH = G.h, oldT = G.temp;
    G.h = clamp(G.h + dh, 0, 100);
    G.temp = Math.max(MIN_T, round2(G.temp + dt));
    if (G.h !== oldH) floatDelta('mh', (G.h > oldH ? '+' : '') + (G.h - oldH), G.h > oldH);
    if (G.temp !== oldT) floatDelta('mt', degDelta(G.temp - oldT).replace(' °C', '°'), G.temp < oldT);
    updateHud();
    if (dh > 0) scene.jump(); else if (dh < 0) scene.droop();
    // the city just got warmer (and its weather wilder)
    if (levelOf(G.temp) > levelOf(oldT)) setTimeout(() => { if (G) toast('thermo', t('hotter')); }, 900);
  }

  const deltaChips = (dh, dt, heat = 0) => `<div class="chips">
      <span class="chip ${dh >= 0 ? 'up' : 'down'}">${Icon('monkey')} ${dh > 0 ? '+' : ''}${dh}</span>
      <span class="chip ${dt <= 0 ? 'up' : 'down'}">${Icon('thermo')} ${degDelta(dt)}</span>
      ${heat ? `<span class="chip down">${Icon('hot')} ${t('tooHot')} −${heat}</span>` : ''}</div>`;

  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  // While an animation plays, the card steps aside so the player can just watch.
  function cardWait() { G.cardView = () => {}; $('#card').classList.add('card-wait'); }
  function cardShow(view) { G.cardView = view; $('#card').classList.remove('card-wait'); view(); }

  function card(html) {
    const c = $('#card');
    c.innerHTML = html;
    c.style.animation = 'none';
    void c.offsetWidth;
    c.style.animation = '';
    c.scrollTop = 0;
  }

  /** Decides what happens next: a payoff, the next choice, or the ending. */
  function step() {
    const q = G.payQueue;
    if (q.length && q[0].due <= G.turn) return showPayoff(q.shift());
    if (G.turn < TURNS) return showChoice();
    if (q.length) return showPayoff(q.shift());
    finish();
  }

  async function showChoice() {
    const game = G, turn = G.turn, idx = G.seq[turn], ch = CHOICES[idx];
    if (G.order[idx] === undefined) G.order[idx] = Math.random() < 0.5; // good option first?
    // Weather: the hotter the city, the more rain and (when it's very hot) storms
    const lvl = levelOf(G.temp);
    const wet = turn > 0 && ch.id !== 'hot' && Math.random() < RAIN_CHANCE[lvl];
    G.weather[turn] = wet ? (lvl >= 3 ? 'storm' : 'rain') : 'clear';
    const newSky = turn > 0 && (G.times[turn] !== G.times[turn - 1] || G.weather[turn] !== G.weather[turn - 1]);
    cardWait();
    sayLine(() => '');
    if (G.newDay[turn]) toast('sun', t('newDay'));
    scene.setTime(G.times[turn]);
    scene.setWeather(G.weather[turn]);
    if (G.weather[turn] === 'storm') Sound.play('storm');
    if (newSky) {             // the sky changes first (and finishes) before anything else moves…
      await wait(Perf.tier === 'low' ? 1400 : 3000);
      if (G !== game) return;
    }
    // …then Bobo goes to where the new situation happens…
    await Promise.race([scene.event(ch.id), wait(11000)]);
    if (G !== game) return;
    // …and only then the question appears
    scene.react(REACT[ch.id], 0);
    if (turn === 0) {
      sayLine((sy) => sy.hello);
      setTimeout(() => { if (G === game && G.turn === 0 && !G.made.length) sayLine((sy) => sy.choices[0][0]); }, 2200);
    } else sayLine((sy) => sy.choices[idx][0]);
    if (!G.eclipseDone && G.eclipseTurn >= 0 && turn >= G.eclipseTurn && G.times[turn] === 'day' && G.weather[turn] === 'clear') {
      G.eclipseDone = true;
      setTimeout(() => {
        if (G !== game || G.turn !== turn) return;
        scene.eclipse();
        sayLine((sy) => sy.eclipse);
        toast('moon', t('eclipseTitle'), t('eclipseTip'), true);
      }, 1600);
    }
    updateHud();
    cardShow(() => {
      const opts = [
        { good: true, txt: ct(idx, 'good'), emo: Icon(ch.good.icon) },
        { good: false, txt: ct(idx, 'bad'), emo: Icon(ch.bad.icon) },
      ];
      if (!G.order[idx]) opts.reverse();
      card(`
        <div class="card-head"><span class="pill">${t('turn', { n: turn + 1 })}</span><span class="topic">${ct(idx, 'topic')}</span></div>
        <p class="situation">${ct(idx, 'sit')}</p>
        <div class="choices">${opts.map((o) =>
          `<button class="choice-btn" data-action="pick" data-good="${o.good ? 1 : 0}"><span class="emo" aria-hidden="true">${o.emo}</span><span>${o.txt}</span></button>`).join('')}</div>`);
    });
  }

  async function pick(good) {
    if (G.busy || G.picks[G.seq[G.turn]] !== undefined) return;
    G.busy = true;
    const game = G, turn = G.turn, idx = G.seq[turn], ch = CHOICES[idx], d = good ? ch.good : ch.bad;
    G.picks[idx] = good;
    G.made.push(idx);
    // 1. the decision is made: the card steps aside
    cardWait();
    react0();
    Sound.play(good ? 'good' : 'bad');
    // 2. Bobo does it (bikes to school, takes the train, goes to the thrift store…)
    await Promise.race([scene.outcome(ch.id, good), wait(15000)]);
    if (G !== game) return;   // the player left the game meanwhile
    // 3. then the result: reaction, speech bubble, meters and the text card
    scene.react(good ? 'yay' : 'sad');
    sayLine((sy) => sy.choices[idx][good ? 1 : 2]);
    const heat = HEAT_PENALTY[levelOf(G.temp)];
    applyDelta(d.h - heat, d.t);
    if (good) G.payQueue.push({ idx, due: turn + PAYOFF_DELAY });

    G.next = () => { G.turn++; step(); };
    cardShow(() => card(`
      <div class="card-head"><span class="pill">${t('turn', { n: turn + 1 })}</span><span class="topic">${ct(idx, 'topic')}</span></div>
      <div class="result"><span class="emo">${Icon(d.icon)}</span><p>${ct(idx, good ? 'resGood' : 'resBad')}</p></div>
      ${deltaChips(d.h, d.t, heat)}
      <div class="row end"><button class="btn primary" data-action="cont">${t('cont')} ${Icon('next')}</button></div>`));
    G.busy = false;
  }
  function react0() { sayLine(() => ''); scene.react(null); }

  async function showPayoff({ idx }) {
    const game = G, ch = CHOICES[idx];
    cardWait();
    sayLine(() => '');
    await Promise.race([scene.payoff(ch.id), wait(8000)]);   // (Bobo may come back from a trip first)
    if (G !== game) return;
    Sound.play('payoff');
    await wait(1400);          // let the reward appear in the city first
    if (G !== game) return;
    scene.react('yay');
    sayLine((sy) => sy.choices[idx][3]);
    applyDelta(PAYOFF.h, PAYOFF.t);
    G.next = step;
    cardShow(() => card(`
      <div class="card-head"><span class="pill">${Icon('sparkle')} ${G.turn < TURNS ? t('remember') : t('later')}</span><span class="topic">${ct(idx, 'topic')}</span></div>
      <div class="result"><span class="emo">${Icon(ch.good.icon)}</span><div>
        <p>${ct(idx, 'payoff')}</p>
        <p class="because">${t('because')} ${ct(idx, 'good')}</p></div></div>
      ${deltaChips(PAYOFF.h, PAYOFF.t)}
      <div class="row end"><button class="btn primary" data-action="cont">${t('cont')} ${Icon('next')}</button></div>`));
  }

  /* ═════════════════════ ENDING ═════════════════════ */

  async function finish() {
    const ending = G.temp <= 1.4 ? 'warrior' : G.temp <= 2.2 ? 'warming' : 'hot';
    if (ending === 'warrior' && !G.sawWhale) {
      // the sea is healthy, so a whale comes to say hello (the card waits so everyone can see it)
      const game = G;
      G.sawWhale = true;
      G.next = null;
      cardWait();
      sayLine(() => '');
      scene.setTime('day');
      scene.setWeather('clear');
      await wait(600);
      if (G !== game) return;
      scene.whale();
      Sound.play('payoff');
      await wait(1200);
      if (G !== game) return;
      scene.react('yay');
      sayLine((sy) => sy.whale);
      await wait(2800);
      if (G !== game) return;
      $('#card').classList.remove('card-wait');
    }
    G.ending = ending;
    const greens = G.picks.filter(Boolean).length;
    store.games.push({ d: Date.now(), e: ending, h: G.h, t: G.temp, g: greens, c: G.made.length });
    Store.save(store);

    const earned = [];
    const check = (cond, id) => { if (cond && unlock(id)) earned.push(id); };
    check(true, 'first');
    check(ending === 'warrior', 'warrior');
    check(greens === TURNS, 'perfect');
    CHOICES.forEach((c, k) => check(G.picks[k] === true, CHOICE_ACH[c.id]));
    check(store.games.length >= 3, 'three');
    G.newAch = earned;

    Sound.play(ending === 'warrior' ? 'win' : ending === 'hot' ? 'lose' : 'payoff');
    if (earned.length) setTimeout(() => Sound.play('achieve'), 900);
    $('#game').classList.add('ending');
    scene.setTime('day');
    scene.setWeather(ending === 'hot' ? 'storm' : 'clear');
    sayLine(() => '');
    if (ending !== 'warrior') {
      scene.goHome().then(() => {
        if (!G || G.ending !== ending) return;
        scene.react({ warming: 'think', hot: 'hot' }[ending], 0);
        sayLine((sy) => (ending === 'hot' ? sy.heat : ''));
      });
    } else scene.react('yay', 0);
    G.next = null;
    G.cardView = endingView;
    endingView();
  }

  function endingView() {
    const e = G.ending, [title, text] = L().endings[e];
    const greens = G.picks.filter(Boolean).length;
    card(`
      <div class="end-top"><span class="end-emoji">${Icon(ENDINGS[e].icon)}</span><div>
        <h2>${esc(title)}</h2></div></div>
      <p class="end-text">${esc(fmt(text, { n: deg(G.temp).replace(/^\+| °C$/g, '') }))}</p>
      <p class="note">${Icon('globe')} ${t('tempNote')}</p>
      <div class="chips"><span class="chip">${Icon('thermo')} ${deg(G.temp)}</span><span class="chip">${Icon('monkey')} ${G.h}</span><span class="chip">${Icon('check')} ${t('greenChoices', { n: greens })}</span></div>
      ${G.newAch.length ? `<div class="new-ach"><b>${Icon('trophy')} ${t('newAch')}</b> ${G.newAch.map((id) =>
        G.newAch.length <= 2 ? `<span class="chip ach-chip">${Icon(achIcon(id))} ${achName(id)}</span>`
          : `<span class="ach-mini" title="${achName(id)}" aria-label="${achName(id)}">${Icon(achIcon(id))}</span>`).join('')}</div>` : ''}
      <div class="row">
        <button class="btn primary" data-action="recap">${Icon('book')} ${t('recapBtn')}</button>
        <button class="btn ghost" data-action="takeaways">${t('skip')} ${Icon('skip')}</button>
      </div>`);
  }

  function recapView() {
    const made = G.made.length;
    const pos = G.recapIdx, k = G.made[pos], good = G.picks[k], ch = CHOICES[k];
    card(`
      <div class="recap">
        <div class="card-head"><span class="pill">${pos + 1} / ${made}</span><span class="topic">${ct(k, 'topic')}</span>
          <span class="spacer"></span><button class="link-btn" data-action="takeaways">${t('skip')} ${Icon('skip')}</button></div>
        <p class="verdict ${good ? 'good' : 'bad'}">${good ? Icon('check') + ' ' + t('great') : Icon('think') + ' ' + t('couldBetter')}</p>
        <p>${t('youChose')} ${Icon(good ? ch.good.icon : ch.bad.icon)} ${ct(k, good ? 'good' : 'bad')}</p>
        <p>${ct(k, good ? 'recapGood' : 'recapBad')}</p>
        ${good ? '' : `<p><b>${t('better')}</b> ${Icon(ch.good.icon)} ${ct(k, 'good')}</p>`}
        <div class="fact"><b>${Icon('bulb')} ${t('didYouKnow')}</b>${ct(k, 'fact')}</div>
        <div class="recap-nav">
          <button class="btn ghost small" data-action="recapPrev" ${pos === 0 ? 'disabled' : ''}>${Icon('back')} ${t('prev')}</button>
          <button class="btn primary small" data-action="recapNext">${t('next')} ${Icon('next')}</button>
        </div>
      </div>`);
  }

  function takeawaysView() {
    card(`
      <h2 style="margin:0">${t('takeTitle')} ${Icon('globe')}</h2>
      <ul class="takeaways">${L().takeaways.map((tk, k) => `<li><span>${Icon(TAKEAWAY_ICONS[k])}</span>${esc(tk)}</li>`).join('')}</ul>
      <div class="row">
        <button class="btn primary" data-action="playAgain">${Icon('replay')} ${t('playAgain')}</button>
        <button class="btn ghost" data-action="menu">${Icon('home')} ${t('menu')}</button>
      </div>`);
  }

  /* ═════════════════════ INPUT ═════════════════════ */

  async function onAction(a, el) {
    switch (a) {
      case 'tab':
        ({ title: renderTitle, games: renderGames, ach: renderAch, privacy: renderPrivacy })[el.dataset.tab]();
        break;
      case 'play': startGame(); break;
      case 'setLang': setLang(el.dataset.lang); break;
      case 'qr': showQR(); break;
      case 'closeModal': closeModal(); break;
      case 'confirmYes': case 'confirmNo': {
        const r = modalResolve;
        closeModal();
        if (r) r(a === 'confirmYes');
        break;
      }
      case 'go': renderGame(); step(); break;
      case 'pick': pick(el.dataset.good === '1'); break;
      case 'cont': {
        const next = G && G.next;
        if (next) { G.next = null; next(); }
        break;
      }
      case 'recap': G.recapIdx = 0; G.cardView = recapView; recapView(); break;
      case 'recapPrev': G.recapIdx = Math.max(0, G.recapIdx - 1); recapView(); break;
      case 'recapNext':
        if (G.recapIdx < G.made.length - 1) { G.recapIdx++; recapView(); }
        else {
          unlockWithToast('learner');
          G.cardView = takeawaysView; takeawaysView();
        }
        break;
      case 'takeaways': G.cardView = takeawaysView; takeawaysView(); break;
      case 'playAgain': startGame(); break;
      case 'menu': renderTitle(); break;
      case 'home':
        if (G && !G.ending && $('#game')) {
          if (await confirmBox(t('quit'))) renderTitle();
        } else renderTitle();
        break;
      case 'pagePrev': gamesPage--; renderGames(); break;
      case 'pageNext': gamesPage++; renderGames(); break;
      case 'deleteData':
        if (await confirmBox(t('delConfirm'))) {
          store.games = [];
          // Achievements are only deleted if the player says yes to a second question.
          const alsoAch = Object.keys(store.ach).length > 0 && await confirmBox(t('delAchAsk'));
          if (alsoAch) store.ach = {};
          Store.save(store);
          toast('trash', alsoAch || !Object.keys(store.ach).length ? t('deleted') : t('deletedGames'));
          renderPrivacy();
        }
        break;
      case 'music':
        store.settings.music = !store.settings.music;
        Store.save(store);
        Sound.setMusic(store.settings.music);
        updateChrome();
        break;
      case 'sfx':
        store.settings.sfx = !store.settings.sfx;
        Store.save(store);
        Sound.setSfx(store.settings.sfx);
        updateChrome();
        break;
    }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    if (a === 'modalBack') {
      if (e.target === el && !modalResolve) closeModal();
      return;
    }
    if (a !== 'pick') Sound.play('click');
    onAction(a, el);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden) {
      const r = modalResolve;
      closeModal();
      if (r) r(false);
    }
  });

  $('#langSel').addEventListener('change', (e) => setLang(e.target.value));

  // If nobody taps for a while during a question, Bobo asks if the player is still there
  // and asks for help (a different line each time).
  const IDLE_FIRST = 14000, IDLE_AGAIN = 16000;
  let idleTimer = 0, lastIdle = -1;
  function idleCheck() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const waiting = G && !G.ending && scene && document.querySelector('#card:not(.card-wait) [data-good]');
      if (waiting) {
        const lines = L().say.idle;
        let k;
        do { k = Math.floor(Math.random() * lines.length); } while (lines.length > 1 && k === lastIdle);
        lastIdle = k;
        scene.react('think', 2600);
        scene.jump();
        scene.say(lines[k], 3600);
      }
      idleCheck();
    }, idleTimer ? IDLE_AGAIN : IDLE_FIRST);
  }
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { idleTimer = 0; idleCheck(); }));
  idleCheck();

  // Browsers only allow sound after the first tap/click.
  const firstTouch = () => {
    Sound.unlock();
    if (store.settings.music) Sound.startMusic();
    window.removeEventListener('pointerdown', firstTouch);
    window.removeEventListener('keydown', firstTouch);
  };
  window.addEventListener('pointerdown', firstTouch);
  window.addEventListener('keydown', firstTouch);

  /* ── boot ── */
  Sound.setSfx(store.settings.sfx);
  if (!store.settings.music) Sound.setMusic(false);
  updateChrome();
  renderTitle();
})();
