/* Climate Island – main game flow.
   Screens: title → name → intro → 10 choices (with payoffs) → ending → recap → takeaways.
   Menu tabs: Play, My Games, Achievements, Privacy. */

(() => {
  'use strict';

  const START = { h: 50, i: 50 };      // starting meters
  const PAYOFF = { h: 12, i: 3 };      // reward when a green choice "comes back" 2 turns later
  const PAYOFF_DELAY = 2;
  const GAMES_PER_PAGE = 4;
  // How the monkey looks when each situation appears
  const REACT = { shelter: 'think', plastic: 'sad', food: 'yay', banana: 'yay', fishing: 'think', compost: 'sad', fire: 'scared', firewood: 'cold', water: 'hot', turtles: 'yay' };
  const RANDOM_NAMES = ['Coco', 'Mango', 'Kiki', 'Bobo', 'Zuzu', 'Lulu', 'Pippa', 'Tiki', 'Banjo', 'Momo', 'Suki', 'Bongo', 'Kiwi', 'Papaya', 'Juju', 'Pico'];

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let store = Store.load();
  let lang = I18N[store.settings.lang] ? store.settings.lang : detectLang();
  let rerender = () => {};   // redraws the current screen (used when the language changes)
  let G = null;              // the game in progress
  let scene = null;
  let nameDraft = '';
  let gamesPage = 0;

  function detectLang() {
    const l = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return I18N[l] ? l : 'en';
  }

  /* ── text helpers ── */
  function fmt(s, vars = {}) {
    const all = { name: G ? G.name : '', ...vars };
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in all ? all[k] : m));
  }
  const t = (key, vars) => esc(fmt(I18N[lang].ui[key] ?? I18N.en.ui[key] ?? key, vars));
  const L = () => I18N[lang];
  const ct = (idx, key) => esc(fmt(L().choices[idx][key]));
  const sayLine = (fn) => scene && scene.say(fmt(fn(L().say)));  // speech bubble (plain text, no HTML)

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

  /* Line the page's sky/sea background up with the island drawing's horizon,
     so the sea "outside" the game sits at exactly the same level as inside. */
  function syncHorizon() {
    const svg = $('#screen svg');
    const ctm = svg && svg.getScreenCTM();
    if (!ctm) return; // screens without an island keep the last horizon
    const y = (v) => Math.round(ctm.f + ctm.d * v) + 'px';
    const root = document.documentElement.style;
    root.setProperty('--sky-top', y(0));
    root.setProperty('--horizon', y(285));
    root.setProperty('--deep', y(500));
  }
  const horizonWatcher = new ResizeObserver(() => syncHorizon());
  horizonWatcher.observe(document.getElementById('screen'));
  function watchScene(el) {
    horizonWatcher.disconnect();
    horizonWatcher.observe(document.getElementById('screen'));
    horizonWatcher.observe(el);
    syncHorizon();
  }

  function renderTabs(active) {
    const items = [['title', '🎮', 'tabPlay'], ['games', '📜', 'tabGames'], ['ach', '🏆', 'tabAch'], ['privacy', '🔒', 'tabPrivacy']];
    $('#tabs').innerHTML = items.map(([id, emo, key]) =>
      `<button data-action="tab" data-tab="${id}" ${id === active ? 'aria-current="page"' : ''}><span class="ti" aria-hidden="true">${emo}</span>${t(key)}</button>`).join('');
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
    sfx.textContent = store.settings.sfx ? '🔊' : '🔇';
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
  function toast(emoji, title, sub = '') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="emo">${emoji}</span><div>${title}${sub ? `<small>${sub}</small>` : ''}</div>`;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3300);
  }

  /* ── achievements ── */
  function unlock(id) {
    if (store.ach[id]) return false;
    store.ach[id] = Date.now();
    Store.save(store);
    return true;
  }
  const achName = (id) => esc(L().ach[id][0]);
  const achEmoji = (id) => ACHIEVEMENTS.find((a) => a.id === id).emoji;
  function unlockWithToast(id) {
    if (!unlock(id)) return;
    toast(achEmoji(id), t('newAch'), achName(id));
    Sound.play('achieve');
  }

  /* ═════════════════════ MENU SCREENS ═════════════════════ */

  function renderTitle() {
    rerender = renderTitle;
    G = null;
    setScreen(`
      <section class="screen title-screen">
        <h1 class="logo"><span class="w1">Climate</span> <span class="w2">Island</span></h1>
        <p class="subtitle">${t('subtitle')}</p>
        <div class="title-scene" id="titleScene" aria-hidden="true"></div>
        <div class="title-actions">
          <button class="btn primary big" data-action="play">▶ ${t('play')}</button>
          <div class="lang-chips">${Object.keys(I18N).map((k) =>
            `<button data-action="setLang" data-lang="${k}" aria-pressed="${k === lang}">${I18N[k].label}</button>`).join('')}</div>
          <button class="btn ghost small" data-action="qr">${t('phone')}</button>
        </div>
        <p class="credits">${t('credits')}</p>
      </section>`, { tab: 'title', brand: false });
    const s = Scene.create($('#titleScene'));
    s.setStats(100, 100);
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
        <h2>${t('gamesTitle')}</h2>
        <p class="muted small">${t('played', { n: store.games.length })} · ${t('savedLocal')}</p>
        ${games.length === 0 ? `<p class="intro-text">🐒 ${t('gamesEmpty')}</p><button class="btn primary" data-action="play">▶ ${t('play')}</button>` : `
        <div class="game-list">${list.map((g) => {
          const e = ENDINGS[g.e] ? g.e : 'okay';
          return `<div class="game-row"><span class="emo">${ENDINGS[e].emoji}</span>
            <div class="info"><b>${esc(g.n)} · ${esc(L().endings[e][0])}</b><small>${esc(dateFmt.format(new Date(g.d)))}</small></div>
            <div class="mini">🐒 ${g.h} · 🏝️ ${g.i}<br>✅ ${g.g}/10</div></div>`;
        }).join('')}</div>
        ${pages > 1 ? `<div class="pager"><button class="btn ghost small" data-action="pagePrev" ${gamesPage === 0 ? 'disabled' : ''} aria-label="⬅">⬅</button>
          <span>${gamesPage + 1} / ${pages}</span>
          <button class="btn ghost small" data-action="pageNext" ${gamesPage >= pages - 1 ? 'disabled' : ''} aria-label="➜">➜</button></div>` : ''}`}
      </div></section>`, { tab: 'games' });
  }

  function renderAch() {
    rerender = renderAch;
    const got = ACHIEVEMENTS.filter((a) => store.ach[a.id]).length;
    setScreen(`
      <section class="screen"><div class="panel wide">
        <h2>${t('achTitle')}</h2>
        <p class="muted small">${t('achCount', { a: got, b: ACHIEVEMENTS.length })} · ${t('savedLocal')}</p>
        <div class="ach-grid">${ACHIEVEMENTS.map((a) => {
          const has = !!store.ach[a.id];
          const secret = a.mystery && !has;
          const name = secret ? t('mystery') : achName(a.id);
          const desc = secret ? '???' : esc(L().ach[a.id][1]);
          return `<div class="badge ${has ? 'got' : 'locked'} ${a.mystery ? 'mystery' : ''}" title="${desc}">
            <span class="emo">${secret ? '❓' : a.emoji}</span><b>${has ? '' : '🔒 '}${name}</b><small>${desc}</small></div>`;
        }).join('')}</div>
      </div></section>`, { tab: 'ach' });
  }

  function renderPrivacy() {
    rerender = renderPrivacy;
    setScreen(`
      <section class="screen"><div class="panel wide privacy">
        <h2>${t('privTitle')}</h2>
        <p>🏠 ${t('priv1')}</p>
        <p>🙅 ${t('priv2')}</p>
        <p>🌐 ${t('priv3')}</p>
        <h3>${t('safeTitle')}</h3>
        <ul>${L().tips.map((tip, k) => `<li>${['🙊', '🦸', '🧑‍🏫', '💬'][k]} ${esc(tip)}</li>`).join('')}</ul>
        <div class="row"><button class="btn danger small" data-action="deleteData">${t('del')}</button></div>
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
    modal(`<h2>${t('phone')}</h2><div class="qr">${svg}</div><p class="intro-text">${t('qrText')}</p>
      ${local ? `<p class="muted small">${t('qrLocal')}</p>` : `<p class="url">${esc(url)}</p>`}
      <button class="btn primary" data-action="closeModal">${t('close')}</button>`);
  }

  /* ═════════════════════ START A GAME ═════════════════════ */

  function renderName() {
    rerender = renderName;
    G = null;
    setScreen(`
      <section class="screen"><div class="panel">
        <div class="big-emoji" aria-hidden="true">🐒</div>
        <h2>${t('nameTitle')}</h2>
        <form id="nameForm" autocomplete="off" novalidate>
          <input id="nameInput" class="name-input" maxlength="12" placeholder="${t('namePh')}" aria-label="${t('namePh')}"
            autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" value="${esc(nameDraft)}">
          <p class="err" id="nameErr" role="alert"></p>
          <div class="row">
            <button type="button" class="btn ghost" data-action="randomName">${t('random')}</button>
            <button type="submit" class="btn primary">${t('start')}</button>
          </div>
        </form>
        <p class="tip">${t('nameTip')}</p>
      </div></section>`, { home: true });
    const input = $('#nameInput');
    input.addEventListener('input', () => { nameDraft = input.value; $('#nameErr').textContent = ''; });
    $('#nameForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = NameFilter.check(input.value);
      if (!r.ok) {
        $('#nameErr').textContent = I18N[lang].ui['err' + r.reason.charAt(0).toUpperCase() + r.reason.slice(1)];
        Sound.play('bad');
        input.focus();
        return;
      }
      nameDraft = r.name;
      startGame(r.name);
    });
    if (matchMedia('(pointer: fine)').matches) input.focus();
  }

  function startGame(name) {
    G = {
      name, h: START.h, i: START.i, turn: 0, picks: [], order: [], payQueue: [],
      next: null, cardView: null, busy: false, disaster: null, cause: null,
      ending: null, newAch: [], recapIdx: 0, langs: new Set([lang]), sawWhale: false,
      // Super rare: about 1 game in 50 has a solar eclipse during one of the daytime choices
      eclipseAt: Math.random() < 0.02 ? [1, 2, 3, 6, 8][Math.floor(Math.random() * 5)] : -1,
    };
    renderIntro();
  }

  function renderIntro() {
    rerender = renderIntro;
    setScreen(`
      <section class="screen"><div class="panel">
        <div class="big-emoji" aria-hidden="true">🏝️</div>
        <h2>${t('introTitle')}</h2>
        <p class="intro-text">${t('introText')}</p>
        <div class="meter-legend">
          <div><span aria-hidden="true">🐒</span>${t('monkeyMeter')}</div>
          <div><span aria-hidden="true">🏝️</span>${t('islandMeter')}</div>
        </div>
        <p class="intro-text">${t('introMeters')}</p>
        <button class="btn primary big" data-action="go">${t('go')}</button>
      </div></section>`, { home: true });
  }

  /* ═════════════════════ THE GAME ═════════════════════ */

  function renderGame() {
    setScreen(`
      <section class="screen game" id="game">
        <div class="hud">
          <div class="meter" id="mh"><span class="emo" aria-hidden="true">🐒</span>
            <div class="mcol"><small data-label="monkeyMeter"></small><div class="bar"><i></i></div></div><b>0</b></div>
          <div class="dots" id="dots" aria-hidden="true">${'<span></span>'.repeat(10)}</div>
          <div class="turn-txt" id="turnTxt"></div>
          <div class="meter" id="mi"><span class="emo" aria-hidden="true">🏝️</span>
            <div class="mcol"><small data-label="islandMeter"></small><div class="bar"><i></i></div></div><b>0</b></div>
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
    $('#mi').title = I18N[lang].ui.islandMeter;
    $('#mh').setAttribute('aria-label', `${I18N[lang].ui.monkeyMeter}: ${G.h}`);
    $('#mi').setAttribute('aria-label', `${I18N[lang].ui.islandMeter}: ${G.i}`);
  }

  function setMeter(id, v) {
    const m = $('#' + id);
    m.querySelector('.bar i').style.width = v + '%';
    m.querySelector('b').textContent = v;
    m.dataset.level = v > 60 ? 'hi' : v > 30 ? 'mid' : 'lo';
  }

  function updateHud() {
    setMeter('mh', G.h);
    setMeter('mi', G.i);
    const dots = $('#dots').children;
    for (let k = 0; k < 10; k++) {
      dots[k].className = G.picks[k] === true ? 'g' : G.picks[k] === false ? 'b' : k === G.turn ? 'now' : '';
    }
    $('#turnTxt').textContent = `${Math.min(G.turn + 1, 10)}/10`;
    scene.setStats(G.h, G.i);
    labelHud();
  }

  function floatDelta(id, d) {
    if (!d) return;
    const el = document.createElement('span');
    el.className = 'delta ' + (d > 0 ? 'up' : 'down');
    el.textContent = (d > 0 ? '+' : '') + d;
    $('#' + id).appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  function applyDelta(dh, di) {
    const oldH = G.h, oldI = G.i;
    G.h = clamp(G.h + dh, 0, 100);
    G.i = clamp(G.i + di, 0, 100);
    floatDelta('mh', G.h - oldH);
    floatDelta('mi', G.i - oldI);
    updateHud();
    if (dh > 0) scene.jump(); else if (dh < 0) scene.droop();
    // a really healthy island gets a visit from a whale
    if (G.i >= 85 && !G.sawWhale) {
      G.sawWhale = true;
      setTimeout(() => { if (G && !G.disaster) { sayLine((sy) => sy.whale); unlockWithToast('whale'); } }, 3200);
    }
  }

  const deltaChips = (dh, di) => {
    const chip = (emo, d) => `<span class="chip ${d >= 0 ? 'up' : 'down'}">${emo} ${d > 0 ? '+' : ''}${d}</span>`;
    return `<div class="chips">${chip('🐒', dh)}${chip('🏝️', di)}</div>`;
  };

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
    if (G.turn < 10) return showChoice();
    if (q.length) return showPayoff(q.shift());
    finish();
  }

  function showChoice() {
    const idx = G.turn, ch = CHOICES[idx];
    if (G.order[idx] === undefined) G.order[idx] = Math.random() < 0.5; // good option first?
    scene.event(ch.id);
    scene.setTime(ch.time);
    scene.setWeather(ch.rain ? 'rain' : 'clear');
    scene.react(REACT[ch.id], 0);
    if (idx === 0) {
      sayLine((sy) => sy.hello);
      setTimeout(() => { if (G && G.turn === 0) sayLine((sy) => sy.choices[0][0]); }, 2200);
    } else sayLine((sy) => sy.choices[idx][0]);
    if (idx === G.eclipseAt) {
      setTimeout(() => {
        if (!G || G.turn !== idx) return;
        scene.eclipse();
        scene.react('scared', 4000);  // wide-eyed amazement
        sayLine((sy) => sy.eclipse);
        unlockWithToast('eclipse');
      }, 1800);
    }
    updateHud();
    G.cardView = () => {
      const opts = [
        { good: true, txt: ct(idx, 'good'), emo: ch.good.emoji },
        { good: false, txt: ct(idx, 'bad'), emo: ch.bad.emoji },
      ];
      if (!G.order[idx]) opts.reverse();
      card(`
        <div class="card-head"><span class="pill">${t('turn', { n: idx + 1 })}</span><span class="topic">${ct(idx, 'topic')}</span></div>
        <p class="situation">${ct(idx, 'sit')}</p>
        <div class="choices">${opts.map((o) =>
          `<button class="choice-btn" data-action="pick" data-good="${o.good ? 1 : 0}"><span class="emo" aria-hidden="true">${o.emo}</span><span>${o.txt}</span></button>`).join('')}</div>`);
    };
    G.cardView();
  }

  function pick(good) {
    if (G.busy || G.picks[G.turn] !== undefined) return;
    G.busy = true;
    const idx = G.turn, ch = CHOICES[idx], d = good ? ch.good : ch.bad;
    G.picks[idx] = good;
    G.last = idx;
    scene.outcome(ch.id, good);
    scene.react(good ? 'yay' : 'sad');
    sayLine((sy) => sy.choices[idx][good ? 1 : 2]);
    Sound.play(good ? 'good' : 'bad');
    if (!good && (ch.id === 'plastic' || ch.id === 'fishing')) setTimeout(() => Sound.play('splash'), 250);
    applyDelta(d.h, d.i);
    if (good) G.payQueue.push({ idx, due: idx + PAYOFF_DELAY });

    G.next = () => {
      G.turn++;
      if (G.h <= 0 || G.i <= 0) doDisaster();
      else step();
    };
    G.cardView = () => card(`
      <div class="card-head"><span class="pill">${t('turn', { n: idx + 1 })}</span><span class="topic">${ct(idx, 'topic')}</span></div>
      <div class="result"><span class="emo" aria-hidden="true">${d.emoji}</span><p>${ct(idx, good ? 'resGood' : 'resBad')}</p></div>
      ${deltaChips(d.h, d.i)}
      <div class="row end"><button class="btn primary" data-action="cont">${t('cont')}</button></div>`);
    G.cardView();
    G.busy = false;
  }

  function showPayoff({ idx }) {
    const ch = CHOICES[idx];
    scene.payoff(ch.id);
    scene.react('yay');
    sayLine((sy) => sy.choices[idx][3]);
    Sound.play('payoff');
    applyDelta(PAYOFF.h, PAYOFF.i);
    G.next = step;
    G.cardView = () => card(`
      <div class="card-head"><span class="pill">✨ ${G.turn < 10 ? t('remember') : t('later')}</span><span class="topic">${ct(idx, 'topic')}</span></div>
      <div class="result"><span class="emo" aria-hidden="true">${ch.good.emoji}</span><div>
        <p>${ct(idx, 'payoff')}</p>
        <p class="because">${t('because')} ${ct(idx, 'good')}</p></div></div>
      ${deltaChips(PAYOFF.h, PAYOFF.i)}
      <div class="row end"><button class="btn primary" data-action="cont">${t('cont')}</button></div>`);
    G.cardView();
  }

  async function doDisaster() {
    G.disaster = CHOICES[G.last].disaster;
    G.cause = G.i <= 0 ? 'island' : 'monkey';
    G.cardView = () => card(`<div class="result"><span class="emo">${ENDINGS[G.disaster].emoji}</span><p>${esc(L().endings[G.disaster][0])}</p></div>`);
    G.cardView();
    Sound.duck(4);
    Sound.play(G.disaster);
    sayLine((sy) => sy[G.disaster]);
    await scene.disaster(G.disaster);
    if (!G) return;
    finish();
    sayLine((sy) => sy.safe);
  }

  /* ═════════════════════ ENDING ═════════════════════ */

  function finish() {
    const ending = G.disaster || (G.i >= 90 && G.h >= 70 ? 'hero' : G.i >= 70 ? 'friend' : G.i >= 40 ? 'okay' : 'struggle');
    G.ending = ending;
    const greens = G.picks.filter(Boolean).length;
    store.games.push({ d: Date.now(), n: G.name, e: ending, h: G.h, i: G.i, g: greens, c: G.picks.length });
    Store.save(store);

    const earned = [];
    const check = (cond, id) => { if (cond && unlock(id)) earned.push(id); };
    check(true, 'first');
    check(ending === 'hero', 'hero');
    check(greens === 10, 'perfect');
    check(G.picks[0] === true, 'tree');
    check(G.picks[1] === true, 'ocean');
    check(G.picks[3] === true, 'planter');
    check(G.picks[4] === true, 'fisher');
    check(G.picks[6] === true, 'firefighter');
    check(G.picks[9] === true, 'turtle');
    check(!!G.disaster, 'survivor');
    check(store.games.length >= 3, 'three');
    if (G.disaster) {
      store.stats.disasters[G.disaster] = true;
      Store.save(store);
    }
    check(['flood', 'heat', 'storm'].every((d) => store.stats.disasters[d]), 'stormchaser');
    G.newAch = earned;

    Sound.play(G.disaster ? 'lose' : ending === 'hero' ? 'win' : 'payoff');
    if (earned.length) setTimeout(() => Sound.play('achieve'), 900);
    $('#game').classList.add('ending');
    if (!G.disaster) {
      scene.setTime('day');
      scene.setWeather('clear');
      scene.react({ hero: 'yay', friend: 'yay', okay: 'think', struggle: 'sad' }[ending], 0);
      if (ending === 'hero') setTimeout(() => sayLine((sy) => sy.hero), 400);
    }
    G.next = null;
    G.cardView = endingView;
    endingView();
  }

  function endingView() {
    const e = G.ending, [title, text] = L().endings[e], dis = ENDINGS[e].disaster;
    const greens = G.picks.filter(Boolean).length;
    card(`
      <div class="end-top"><span class="end-emoji" aria-hidden="true">${ENDINGS[e].emoji}</span><div>
        ${dis ? `<p class="cause">${t('gameOver')} ${G.cause === 'island' ? t('causeIsland') : t('causeMonkey')}</p>` : ''}
        <h2>${esc(fmt(title))}</h2></div></div>
      <p class="end-text">${esc(fmt(text))}</p>
      ${dis ? `<p class="note">🌍 ${t('disasterNote')}</p>` : ''}
      <div class="chips"><span class="chip">🐒 ${G.h}</span><span class="chip">🏝️ ${G.i}</span><span class="chip">✅ ${t('greenChoices', { n: greens })}</span></div>
      ${G.newAch.length ? `<div class="new-ach"><b>🏆 ${t('newAch')}</b> ${G.newAch.map((id) =>
        G.newAch.length <= 2 ? `<span class="chip ach-chip">${achEmoji(id)} ${achName(id)}</span>`
          : `<span class="ach-mini" title="${achName(id)}" aria-label="${achName(id)}">${achEmoji(id)}</span>`).join('')}</div>` : ''}
      <div class="row">
        <button class="btn primary" data-action="recap">${t('recapBtn')}</button>
        <button class="btn ghost" data-action="takeaways">${t('skip')}</button>
      </div>`);
  }

  function recapView() {
    const made = G.picks.length;
    const k = G.recapIdx, good = G.picks[k], ch = CHOICES[k];
    card(`
      <div class="recap">
        <div class="card-head"><span class="pill">${k + 1} / ${made}</span><span class="topic">${ct(k, 'topic')}</span>
          <span class="spacer"></span><button class="link-btn" data-action="takeaways">${t('skip')}</button></div>
        <p class="verdict ${good ? 'good' : 'bad'}">${good ? t('great') : t('couldBetter')}</p>
        <p>${t('youChose')} ${good ? ch.good.emoji : ch.bad.emoji} ${ct(k, good ? 'good' : 'bad')}</p>
        <p>${ct(k, good ? 'recapGood' : 'recapBad')}</p>
        ${good ? '' : `<p><b>${t('better')}</b> ${ch.good.emoji} ${ct(k, 'good')}</p>`}
        <div class="fact"><b>${t('didYouKnow')}</b>${ct(k, 'fact')}</div>
        <div class="recap-nav">
          <button class="btn ghost small" data-action="recapPrev" ${k === 0 ? 'disabled' : ''}>${t('prev')}</button>
          <button class="btn primary small" data-action="recapNext">${t('next')}</button>
        </div>
      </div>`);
  }

  function takeawaysView() {
    card(`
      <h2 style="margin:0">${t('takeTitle')}</h2>
      <ul class="takeaways">${L().takeaways.map((tk, k) => `<li><span aria-hidden="true">${TAKEAWAY_EMOJI[k]}</span>${esc(tk)}</li>`).join('')}</ul>
      <div class="row">
        <button class="btn primary" data-action="playAgain">${t('playAgain')}</button>
        <button class="btn ghost" data-action="menu">${t('menu')}</button>
      </div>`);
  }

  /* ═════════════════════ INPUT ═════════════════════ */

  async function onAction(a, el) {
    switch (a) {
      case 'tab':
        ({ title: renderTitle, games: renderGames, ach: renderAch, privacy: renderPrivacy })[el.dataset.tab]();
        break;
      case 'play': renderName(); break;
      case 'setLang': setLang(el.dataset.lang); break;
      case 'qr': showQR(); break;
      case 'closeModal': closeModal(); break;
      case 'confirmYes': case 'confirmNo': {
        const r = modalResolve;
        closeModal();
        if (r) r(a === 'confirmYes');
        break;
      }
      case 'randomName': {
        nameDraft = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
        $('#nameInput').value = nameDraft;
        $('#nameErr').textContent = '';
        Sound.play('pop');
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
        if (G.recapIdx < G.picks.length - 1) { G.recapIdx++; recapView(); }
        else {
          if (unlock('learner')) { toast('📚', t('newAch'), achName('learner')); Sound.play('achieve'); }
          G.cardView = takeawaysView; takeawaysView();
        }
        break;
      case 'takeaways': G.cardView = takeawaysView; takeawaysView(); break;
      case 'playAgain': nameDraft = G ? G.name : nameDraft; renderName(); break;
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
          toast('🗑️', alsoAch || !Object.keys(store.ach).length ? t('deleted') : t('deletedGames'));
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
    if (a !== 'pick' && a !== 'randomName') Sound.play('click');
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
