/* Bobo's City – main game flow.
   Screens: title → intro → 11 choices (with payoffs) → ending → recap → takeaways.
   Menu tabs: Play, My Games, Achievements, Privacy. */

(() => {
  'use strict';

  const START_T = 1.0;                   // the city's temperature (°C above the old normal)
  const PAYOFF_T = -0.03;                // reward when a green choice "comes back" 2 turns later
  const LOSE_T = 2.5;                    // this hot = the island overheated (game over, even before the last choice)
  const PAYOFF_DELAY = 2;
  // It's never too late: after a lot of warming (over +1.5 °C), 3 or more green choices in a row
  // cool the city down a little (but only back to +1.5 °C: the rest is up to the rewards)
  const STREAK_T = -0.05, STREAK_FROM = 1.5;
  // Every extra car trip (after choosing the car for school) warms the city a tiny bit, but never
  // enough to make the player lose: at most +0.15 °C per game, and never close to the overheat line
  const CAR_T = 0.03, CAR_MAX = 0.15;
  const TURNS = CHOICES.length;          // 11
  const MIN_T = 1.0;                     // the planet is already about 1 °C warmer today
  const GAMES_PER_PAGE = 4;
  // How Bobo looks when each situation appears
  const REACT = { school: 'think', lights: 'think', bottle: 'hot', toy: 'sad', hot: 'hot', cold: 'cold', shower: 'think',
    party: 'yay', jacket: 'think', trip: 'yay', food: 'yay', litter: 'scared' };
  // Climate levels: below +1.3 °C, +1.7, +2.2, above
  const levelOf = (temp) => (temp < 1.3 ? 0 : temp < 1.7 ? 1 : temp < 2.2 ? 2 : 3);
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
    // (zoomed in, the drawing is bigger than the screen: data-view is the part the camera shows when at rest)
    const view = svg.dataset.view && svg.dataset.view.split(' ').map(Number);
    const box = svg.parentElement.getBoundingClientRect();
    const vb = view ? { x: view[0], y: view[1], width: view[2], height: view[3] } : svg.viewBox.baseVal;
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
    root.setProperty('--view-top', y(vb.y));   // (the top of what the camera shows: the sun and moon sit just below it)
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

  let titleScene = null, starting = false;
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
    s.setStats(START_T);
    s.showcase();
    s.calm();          // a calm title screen: just a few birds
    s.titleShow();     // …and Bobo playing around town (the camera follows him)
    titleScene = s;
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
            <div class="mini">${Icon('thermo')} ${deg(g.t)}<br>${Icon('check')} ${g.g}/${TURNS}</div></div>`;
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
    // Getting to school always comes first and the birthday party comes later on (6th, 7th or 8th);
    // the others come in a random order every game.
    const party = CHOICES.findIndex((c) => c.id === 'party');
    const seq = [0, ...shuffle(CHOICES.map((_, k) => k).filter((k) => k !== 0 && k !== party))];
    seq.splice(5 + Math.floor(Math.random() * 3), 0, party);
    // Time of day only moves forward (morning → day → evening → night), like a real day.
    // When the next situation needs an earlier time (school is in the morning), a new day starts.
    const DAY = ['morning', 'day', 'evening', 'night'];
    let now = 0, days = 0;
    const times = [], newDay = [];
    seq.forEach((ci, turn) => {
      const ok = CHOICES[ci].times.map((tm) => DAY.indexOf(tm));
      const later = ok.filter((k) => k >= now);
      // (lunch is always on another day than school: if it would still be the first day, a new day starts)
      const fresh = turn > 0 && (!later.length || (CHOICES[ci].id === 'food' && days === 0));
      newDay.push(fresh);
      if (fresh) days++;
      now = turn === 0 ? Math.min(...ok) : !fresh ? Math.min(...later) : Math.min(...ok);
      times.push(DAY[now]);
      if (turn === 0) now = Math.max(now, 1);   // (school takes the morning: what comes next happens later in the day)
    });
    G = {
      seq, made: [], times, newDay, weather: [],
      // Super rare: a solar eclipse (about 1 game in 15), on a clear day from this turn on
      eclipseTurn: Math.random() < 1 / 15 ? 1 + Math.floor(Math.random() * 9) : -1, eclipseDone: false,
      temp: START_T, turn: 0, picks: [], order: [], payQueue: [],
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
          <div class="dots" id="dots" aria-hidden="true">${'<span></span>'.repeat(TURNS)}</div>
          <div class="turn-txt" id="turnTxt"></div>
          <div class="meter thermo" id="mt"><span class="emo">${Icon('thermo')}</span>
            <div class="mcol"><small data-label="tempMeter"></small><div class="bar"><i></i></div></div><b>0</b></div>
        </div>
        <div class="scene-wrap" id="sceneWrap"></div>
        <div class="card" id="card" aria-live="polite"></div>
      </section>`, { home: true });
    scene = Scene.create($('#sceneWrap'));
    scene.setLines((key) => L().say[key] || '');
    scene.onCarTrip(carTrip);
    watchScene($('#sceneWrap'));
    labelHud();
    updateHud();
    rerender = () => { labelHud(); if (G.cardView) G.cardView(); };
  }

  function labelHud() {
    document.querySelectorAll('[data-label]').forEach((el) => { el.textContent = I18N[lang].ui[el.dataset.label]; });
    $('#mt').title = I18N[lang].ui.tempMeter;
    $('#mt').setAttribute('aria-label', `${I18N[lang].ui.tempMeter}: ${deg(G.temp)}`);
    $('#mt b').textContent = deg(G.temp).replace(' °C', '°');
  }

  // The thermometer is one colour that warms up step by step: cool blue → yellow → hot red (at the overheat line)
  const THERMO = [[1.0, [79, 195, 247]], [1.75, [255, 182, 39]], [LOSE_T, [255, 91, 74]]];
  function thermoColor(temp) {
    let k = 0;
    while (k < THERMO.length - 2 && temp > THERMO[k + 1][0]) k++;
    const [t0, c0] = THERMO[k], [t1, c1] = THERMO[k + 1];
    const f = clamp((temp - t0) / (t1 - t0), 0, 1);
    return `rgb(${c0.map((v, n) => Math.round(v + (c1[n] - v) * f)).join(', ')})`;
  }

  function updateHud() {
    // thermometer: +0.8 °C = empty, +2.5 °C (the island overheats) = full
    $('#mt .bar i').style.width = clamp((G.temp - 0.8) / (LOSE_T - 0.8) * 100, 4, 100) + '%';
    $('#mt .bar i').style.backgroundColor = thermoColor(G.temp);
    const dots = $('#dots').children;
    for (let k = 0; k < TURNS; k++) {
      const pk = G.picks[G.seq[k]];
      dots[k].className = k < G.made.length ? (pk ? 'g' : 'b') : k === G.turn ? 'now' : '';
    }
    $('#turnTxt').textContent = `${Math.min(G.turn + 1, TURNS)}/${TURNS}`;
    scene.setStats(G.temp);
    labelHud();
  }

  function floatDelta(id, text, good) {
    const el = document.createElement('span');
    el.className = 'delta ' + (good ? 'up' : 'down');
    el.textContent = text;
    $('#' + id).appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  function applyDelta(dt) {
    const oldT = G.temp;
    G.temp = Math.max(MIN_T, round2(G.temp + dt));
    if (G.temp !== oldT) floatDelta('mt', degDelta(G.temp - oldT).replace(' °C', '°'), G.temp < oldT);
    updateHud();
    if (dt > 0) scene.droop(); else scene.jump();
    // the city just got warmer (and its weather wilder)
    if (levelOf(G.temp) > levelOf(oldT)) setTimeout(() => { if (G) toast('thermo', t('hotter')); }, 900);
  }

  const deltaChips = (dt) => `<div class="chips">
      <span class="chip ${dt <= 0 ? 'up' : 'down'}">${Icon('thermo')} ${degDelta(dt)}</span></div>`;

  // Bobo got into the car again: a little more CO₂ (see CAR_T)
  function carTrip() {
    if (!G || G.ending) return;
    const add = round2(Math.max(0, Math.min(CAR_T, CAR_MAX - (G.carHeat || 0), LOSE_T - 0.2 - G.temp)));
    if (add > 0) { G.carHeat = (G.carHeat || 0) + add; applyDelta(add); }
    toast('car', t('carTrip'), add > 0 ? degDelta(add) : '');
  }

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
    if (turn === 1 && scene.atSchool()) {
      // the school day goes by first: Bobo goes in, the sun moves on, and school's out in the afternoon
      // (never at night). Bobo goes home right away (still in the afternoon: by bike, or dad picks him up),
      // and only then, if the next thing happens later (or on another day), time moves on again.
      await scene.schoolDay('day');
      if (G !== game) return;
      await scene.goHome();
      if (G !== game) return;
      if (G.newDay[turn] || G.times[turn] !== 'day') {
        if (G.newDay[turn]) toast('sun', t('newDay'));
        scene.setTime(G.times[turn]);
        await wait(Perf.tier === 'low' ? 1400 : 3000);
        if (G !== game) return;
      }
      scene.setWeather(G.weather[turn]);
      if (G.weather[turn] === 'storm') Sound.play('storm');
    } else {
      if (G.newDay[turn]) toast('sun', t('newDay'));
      scene.setTime(G.times[turn]);
      scene.setWeather(G.weather[turn]);
      if (G.weather[turn] === 'storm') Sound.play('storm');
      if (newSky) {             // the sky changes first (and finishes) before anything else moves…
        await wait(Perf.tier === 'low' ? 1400 : 3000);
        if (G !== game) return;
      }
    }
    // …then Bobo goes to where the new situation happens…
    await Promise.race([scene.event(ch.id), wait(30000)]);
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
        scene.eclipse();   // (Bobo: "Whoa!"… and then the glasses go on)
        setTimeout(() => { if (G === game && G.turn === turn) sayLine((sy) => sy.eclipse); }, 2000);
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
    await Promise.race([scene.outcome(ch.id, good), wait(25000)]);
    if (G !== game) return;   // the player left the game meanwhile
    // the first choice decides how Bobo gets around town for the rest of the game
    if (ch.id === 'school') scene.setMode(good ? 'bike' : 'car');
    // 3. then the result: reaction, speech bubble, meters and the text card
    scene.react(good ? 'yay' : 'sad');
    sayLine((sy) => sy.choices[idx][good ? 1 : 2]);
    // a green streak (3 in a row) after a lot of warming cools the city down a little
    const n = G.made.length, prevGood = n > 2 && G.picks[G.made[n - 2]] && G.picks[G.made[n - 3]];
    const streak = good && prevGood && G.temp > STREAK_FROM;
    const dt = streak ? Math.max(STREAK_T, round2(STREAK_FROM - G.temp)) : d.t;
    applyDelta(dt);
    if (good) G.payQueue.push({ idx, due: turn + PAYOFF_DELAY });

    // too hot before the end: the island overheated and the game is over
    G.next = G.temp >= LOSE_T ? () => { G.turn++; finish(true); } : () => { G.turn++; step(); };
    cardShow(() => card(`
      <div class="card-head"><span class="pill">${t('turn', { n: turn + 1 })}</span><span class="topic">${ct(idx, 'topic')}</span></div>
      <div class="result"><span class="emo">${Icon(d.icon)}</span><p>${ct(idx, good ? 'resGood' : 'resBad')}</p></div>
      ${streak ? `<p class="note streak">${Icon('sparkle')} ${t('streak')}</p>` : ''}
      ${deltaChips(dt)}
      <div class="row end"><button class="btn primary" data-action="cont">${t('cont')} ${Icon('next')}</button></div>`));
    G.busy = false;
  }
  function react0() { sayLine(() => ''); scene.react(null); }

  async function showPayoff({ idx }) {
    const game = G, ch = CHOICES[idx];
    cardWait();
    sayLine(() => '');
    await Promise.race([scene.payoff(ch.id), wait(25000)]);   // (Bobo may come back from a trip first)
    if (G !== game) return;
    Sound.play('payoff');
    await wait(1400);          // let the reward appear in the city first
    if (G !== game) return;
    scene.react('yay');
    sayLine((sy) => sy.choices[idx][3]);
    applyDelta(PAYOFF_T);
    G.next = step;
    cardShow(() => card(`
      <div class="card-head"><span class="pill">${Icon('sparkle')} ${G.turn < TURNS ? t('remember') : t('later')}</span><span class="topic">${ct(idx, 'topic')}</span></div>
      <div class="result"><span class="emo">${Icon(ch.good.icon)}</span><div>
        <p>${ct(idx, 'payoff')}</p>
        <p class="because">${t('because')} ${ct(idx, 'good')}</p></div></div>
      ${deltaChips(PAYOFF_T)}
      <div class="row end"><button class="btn primary" data-action="cont">${t('cont')} ${Icon('next')}</button></div>`));
  }

  /* ═════════════════════ ENDING ═════════════════════ */

  async function finish(early = false) {
    const ending = early || G.temp >= LOSE_T ? 'overheated' : G.temp <= 1.3 ? 'warrior' : G.temp <= 2.0 ? 'warming' : 'hot';
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
    store.games.push({ d: Date.now(), e: ending, t: G.temp, g: greens, c: G.made.length });
    Store.save(store);

    const earned = [];
    const check = (cond, id) => { if (cond && unlock(id)) earned.push(id); };
    check(true, 'first');
    check(ending === 'warrior', 'warrior');
    check(greens === TURNS, 'perfect');
    CHOICES.forEach((c, k) => check(G.picks[k] === true, CHOICE_ACH[c.id]));
    check(store.games.length >= 3, 'three');
    G.newAch = earned;

    Sound.play(ending === 'warrior' ? 'win' : ending === 'warming' ? 'payoff' : 'lose');
    if (earned.length) setTimeout(() => Sound.play('achieve'), 900);
    $('#game').classList.add('ending');
    scene.setTime('day');
    scene.setWeather(ending === 'hot' || ending === 'overheated' ? 'storm' : 'clear');
    sayLine(() => '');
    if (ending !== 'warrior') {
      scene.goHome().then(() => {
        if (!G || G.ending !== ending) return;
        scene.react({ warming: 'think', hot: 'hot', overheated: 'hot' }[ending], 0);
        sayLine((sy) => (ending === 'warming' ? '' : sy.heat));
      });
    } else scene.react('yay', 0);
    G.next = null;
    G.cardView = endingView;
    endingView();
  }

  // The recap ("what did you learn") must be read once, card by card; after that it can be skipped
  const readOnce = () => !!store.ach.learner;

  function endingView() {
    const e = G.ending, [title, text] = L().endings[e];
    const greens = G.picks.filter(Boolean).length;
    card(`
      <div class="end-top"><span class="end-emoji">${Icon(ENDINGS[e].icon)}</span><div>
        <h2>${esc(title)}</h2></div></div>
      <p class="end-text">${esc(fmt(text, { n: deg(G.temp).replace(/^\+| °C$/g, '') }))}</p>
      <p class="note">${Icon('globe')} ${t('tempNote')}</p>
      <div class="chips"><span class="chip">${Icon('thermo')} ${deg(G.temp)}</span><span class="chip">${Icon('check')} ${t('greenChoices', { n: greens })}</span></div>
      ${G.newAch.length ? `<div class="new-ach"><b>${Icon('trophy')} ${t('newAch')}</b> ${G.newAch.map((id) =>
        G.newAch.length <= 2 ? `<span class="chip ach-chip">${Icon(achIcon(id))} ${achName(id)}</span>`
          : `<span class="ach-mini" title="${achName(id)}" aria-label="${achName(id)}">${Icon(achIcon(id))}</span>`).join('')}</div>` : ''}
      <div class="row">
        <button class="btn primary" data-action="recap">${Icon('book')} ${t('recapBtn')}</button>
        ${readOnce() ? `<button class="btn ghost" data-action="takeaways">${t('skip')} ${Icon('skip')}</button>` : ''}
      </div>`);
  }

  function recapView() {
    const made = G.made.length;
    const pos = G.recapIdx, k = G.made[pos], good = G.picks[k], ch = CHOICES[k], read = G.readSet.has(pos);
    card(`
      <div class="recap">
        <div class="card-head"><span class="pill">${pos + 1} / ${made}</span><span class="topic">${ct(k, 'topic')}</span>
          <span class="spacer"></span>${readOnce() ? `<button class="link-btn" data-action="takeaways">${t('skip')} ${Icon('skip')}</button>` : ''}</div>
        <p class="verdict ${good ? 'good' : 'bad'}">${good ? Icon('check') + ' ' + t('great') : Icon('think') + ' ' + t('couldBetter')}</p>
        <p>${t('youChose')} ${Icon(good ? ch.good.icon : ch.bad.icon)} ${ct(k, good ? 'good' : 'bad')}</p>
        <p>${ct(k, good ? 'recapGood' : 'recapBad')}</p>
        ${good ? '' : `<p><b>${t('better')}</b> ${Icon(ch.good.icon)} ${ct(k, 'good')}</p>`}
        <div class="fact"><b>${Icon('bulb')} ${t('didYouKnow')}</b>${ct(k, 'fact')}</div>
        <div class="recap-nav">
          <button class="btn ghost small" data-action="recapPrev" ${pos === 0 ? 'disabled' : ''}>${Icon('back')} ${t('prev')}</button>
          <button class="read-check ${read ? 'on' : ''}" data-action="readIt" aria-pressed="${read}">${Icon(read ? 'check' : 'book')} ${t('readIt')}</button>
          <button class="btn primary small" data-action="recapNext" ${read || readOnce() ? '' : 'disabled'}>${t('next')} ${Icon('next')}</button>
        </div>
        ${read || readOnce() ? '' : `<p class="read-hint">${t('readHint')}</p>`}
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

  /* ═════════════════════ SCREEN CHANGES ═════════════════════ */
  /* Like at the end of a cartoon: a dark circle closes in on Bobo (it pauses around him for a moment), the next
     screen is put in place in the dark, and the circle opens up again (on Bobo, if he's on the new screen).
     from / to: [x, y, size] on the screen (or a function giving that once the new screen is there); none = the middle. */
  // (drawn on a canvas: the graphics chip fills it almost for free, so the circle stays smooth on phones too)
  const irisEl = document.createElement('canvas');
  irisEl.className = 'iris';
  irisEl.hidden = true;
  document.body.appendChild(irisEl);
  const irisCtx = irisEl.getContext('2d');
  const IRIS_C = '#121826';
  let irisK = 1;
  function irisSize() {
    irisK = Math.min(devicePixelRatio || 1, 1.5);   // (a soft dark edge doesn't need every pixel)
    irisEl.width = Math.round(innerWidth * irisK);
    irisEl.height = Math.round(innerHeight * irisK);
  }
  function irisDraw(x, y, r) {
    irisCtx.globalCompositeOperation = 'source-over';
    irisCtx.fillStyle = IRIS_C;
    irisCtx.fillRect(0, 0, irisEl.width, irisEl.height);
    if (r <= 0) return;
    irisCtx.globalCompositeOperation = 'destination-out';
    irisCtx.beginPath();
    irisCtx.arc(x * irisK, y * irisK, r * irisK, 0, Math.PI * 2);
    irisCtx.fill();
  }
  function irisTo(x, y, r0, r1, ms) {
    return new Promise((done) => {
      const t0 = performance.now();
      const frame = (now) => {
        const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) ** 2;
        irisDraw(x, y, r0 + (r1 - r0) * e);
        if (k < 1) requestAnimationFrame(frame); else done();
      };
      requestAnimationFrame(frame);
    });
  }
  const frames = (n) => new Promise((done) => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : done()); f(); });
  let irisBusy = false;
  async function iris(render, from = null, to = null) {
    if (irisBusy) return;
    irisBusy = true;
    irisSize();
    irisDraw(0, 0, 1e5);     // (fully open to start with)
    irisEl.hidden = false;   // (it also catches taps, so nothing gets pressed twice)
    try {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { render(); return; }
      const mid = () => [innerWidth / 2, innerHeight / 2, 0];
      const far = (x, y) => Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 4;
      const [x0, y0, h0] = from || mid();
      const ring = Math.max(56, (h0 || 0) * 1.1);              // (just around Bobo)
      await irisTo(x0, y0, far(x0, y0), ring, 800);
      await wait(from ? 450 : 120);
      await irisTo(x0, y0, ring, 0, 280);
      irisDraw(0, 0, 0);
      render();
      await frames(2);                                         // (the new screen gets drawn in the dark…)
      await wait(300);                                         // (…and settles)
      const [x1, y1, h1] = (typeof to === 'function' ? to() : to) || mid();
      const ring1 = Math.max(56, (h1 || 0) * 1.1);
      await irisTo(x1, y1, 0, ring1, 280);
      await wait(to ? 300 : 80);
      await irisTo(x1, y1, ring1, far(x1, y1), 800);
    } finally {
      irisEl.hidden = true;
      irisBusy = false;
    }
  }

  /* ═════════════════════ INPUT ═════════════════════ */

  async function onAction(a, el) {
    switch (a) {
      case 'tab':
        ({ title: renderTitle, games: renderGames, ach: renderAch, privacy: renderPrivacy })[el.dataset.tab]();
        break;
      case 'play': {
        // Bobo hurries home and says "Let's go!", the circle closes in on him, and the game starts
        if (starting) break;
        starting = true;
        const ts = titleScene;
        if (ts) await Promise.race([ts.titleGo(L().say.letsGo), wait(4500)]);
        await iris(startGame, ts && ts.boboScreen());
        starting = false;
        break;
      }
      case 'setLang': setLang(el.dataset.lang); break;
      case 'qr': showQR(); break;
      case 'closeModal': closeModal(); break;
      case 'confirmYes': case 'confirmNo': {
        const r = modalResolve;
        closeModal();
        if (r) r(a === 'confirmYes');
        break;
      }
      case 'go': iris(() => { renderGame(); step(); }, null, () => scene && scene.boboScreen()); break;
      case 'pick': pick(el.dataset.good === '1'); break;
      case 'cont': {
        const next = G && G.next;
        if (next) { G.next = null; next(); }
        break;
      }
      case 'recap': G.recapIdx = 0; G.readSet = G.readSet || new Set(); G.cardView = recapView; recapView(); break;
      case 'readIt': G.readSet.add(G.recapIdx); recapView(); break;
      case 'recapPrev': G.recapIdx = Math.max(0, G.recapIdx - 1); recapView(); break;
      case 'recapNext':
        if (!G.readSet.has(G.recapIdx) && !readOnce()) break;   // (read it first: tick "I read this")
        if (G.recapIdx < G.made.length - 1) { G.recapIdx++; recapView(); }
        else {
          unlockWithToast('learner');
          G.cardView = takeawaysView; takeawaysView();
        }
        break;
      case 'takeaways': G.cardView = takeawaysView; takeawaysView(); break;
      case 'playAgain': iris(startGame, scene && $('#game') && scene.boboScreen()); break;
      case 'menu': iris(renderTitle, scene && $('#game') && scene.boboScreen(), () => titleScene && titleScene.boboScreen()); break;
      case 'home':
        if (G && !G.ending && $('#game')) {
          if (await confirmBox(t('quit'))) iris(renderTitle, scene.boboScreen(), () => titleScene && titleScene.boboScreen());
        } else iris(renderTitle, null, () => titleScene && titleScene.boboScreen());
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
  // and asks for help (a different line each time). Between two reminders there's always a little pause
  // (3–5 s after the last bubble is gone), and a reminder never talks over another bubble.
  const IDLE_FIRST = 14000;
  const readMs = (text) => clamp(1500 + text.length * 80, 3000, 7000);   // (as long as the bubble stays, see scene.say)
  let idleTimer = 0, lastIdle = -1, idleNext = IDLE_FIRST;
  function idleCheck() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const waiting = G && !G.ending && scene && document.querySelector('#card:not(.card-wait) [data-good]');
      if (waiting && scene.speaking()) idleNext = 3000 + Math.random() * 2000;   // (someone's talking: try a bit later)
      else if (waiting) {
        const lines = L().say.idle;
        let k;
        do { k = Math.floor(Math.random() * lines.length); } while (lines.length > 1 && k === lastIdle);
        lastIdle = k;
        scene.react('think', 2600);
        scene.jump();
        scene.say(lines[k]);
        idleNext = readMs(lines[k]) + 3000 + Math.random() * 2000;
      } else idleNext = IDLE_FIRST;
      idleCheck();
    }, idleNext);
  }
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { idleNext = IDLE_FIRST; idleCheck(); }));
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
