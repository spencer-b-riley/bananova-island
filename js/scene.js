/* Bobo's City: a cartoon SVG city on an island that changes with every choice.
   Scene.create(container) returns an object with:
     setStats(temp)        – the climate look and Bobo's face (temperature in °C above normal)
     event(id)             – Bobo goes to where the situation happens (returns a Promise)
     outcome(id, good)     – plays what the choice does (returns a Promise)
     payoff(id)            – a reward 2 turns later (solar panels, wind turbines, a bike gang…)
     setTime(t)            – 'morning' | 'day' | 'evening' | 'night'
     setWeather(w)         – 'clear' | 'rain' | 'storm'
     react(kind, ms)       – Bobo's face: 'yay' | 'scared' | 'cold' | 'hot' | 'sad' | 'think'
     say(text, ms)         – speech bubble above Bobo
   Every part of the drawing has a data-k="name" so it can be shown/hidden.

   The city has three rows (back to front): the school + shops, the houses, and the road.
   Bobo walks between the back and the front through the little side street (x = 232), and is
   drawn behind the houses while in the back row, so nothing ever overlaps the wrong way. */

const Scene = (() => {
  let uid = 0;
  const NS = 'http://www.w3.org/2000/svg';
  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sfx = (name) => { if (typeof Sound !== 'undefined') Sound.play(name); };
  // Further back in the city = smaller (y is where the feet are)
  const depthK = (y) => clamp(1 - (468 - y) * 0.0028, 0.55, 1.05);

  /* ── little drawing helpers ── */
  const item = (k, x, y, inner, cls = 'pop', hidden = true) =>
    `<g transform="translate(${x} ${y})"><g data-k="${k}" class="${cls}${hidden ? ' hide' : ''}">${inner}</g></g>`;

  const fish = (color = '#ff8c42') => `
    <ellipse cx="0" cy="0" rx="14" ry="8" fill="${color}"/>
    <path d="M-12 0 L-24 -8 L-22 0 L-24 8Z" fill="${color}"/>
    <path d="M-2 -7 Q2 -13 6 -7" fill="${color}" stroke="#00000022"/>
    <circle cx="7" cy="-2" r="2.6" fill="#fff"/><circle cx="7.6" cy="-2" r="1.4" fill="#23313f"/>`;

  const bottle = (x, y, r, sc = 1) => `
    <g transform="translate(${x} ${y}) rotate(${r}) scale(${sc})">
      <rect x="-5" y="-16" width="10" height="16" rx="3" fill="#a8e0f5" stroke="#4fb0d8" stroke-width="1.5"/>
      <rect x="-2.5" y="-21" width="5" height="5" rx="1" fill="#2f80ed"/>
      <rect x="-5" y="-11" width="10" height="4" fill="#ff6fa8" opacity=".8"/></g>`;

  const turtle = (x, y, s = 1) => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="-11" cy="5" rx="5" ry="3" fill="#8fd16a"/><ellipse cx="9" cy="6" rx="5" ry="3" fill="#8fd16a"/>
      <ellipse cx="17" cy="-2" rx="6" ry="5" fill="#8fd16a"/><circle cx="19" cy="-3" r="1.3" fill="#23313f"/>
      <ellipse cx="0" cy="0" rx="16" ry="10" fill="#4f9a3a"/>
      <path d="M-8 -4 l5 -4 h6 l5 4 l-5 4 h-6Z M-14 2 h6 M8 2 h6" stroke="#3d7a2c" stroke-width="1.6" fill="none"/></g>`;

  const flower = (x, y, c) => `
    <g transform="translate(${x} ${y})"><path d="M0 0 V-10" stroke="#3d9a2e" stroke-width="2"/>
      <circle cx="-3" cy="-12" r="3" fill="${c}"/><circle cx="3" cy="-12" r="3" fill="${c}"/>
      <circle cx="0" cy="-15" r="3" fill="${c}"/><circle cx="0" cy="-9.5" r="3" fill="${c}"/>
      <circle cx="0" cy="-12" r="2" fill="#ffd23f"/></g>`;

  const flies = (x, y) => `<g class="flies" transform="translate(${x} ${y})">
      <circle cx="0" cy="0" r="1.8"/><circle cx="10" cy="-6" r="1.8" style="animation-delay:-.3s"/><circle cx="-8" cy="-10" r="1.8" style="animation-delay:-.6s"/><circle cx="4" cy="-14" r="1.6" style="animation-delay:-.45s"/></g>`;

  // simple repeatable "random" so every screen draws the same stars
  const rnd = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const STARS = `<svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">${Array.from({ length: 70 }, (_, k) =>
    `<circle cx="${(rnd(k + 1) * 1200).toFixed(0)}" cy="${(rnd(k + 99) * 290).toFixed(0)}" r="${k % 3 ? 1.6 : 2.4}" fill="#fffbe8"/>`).join('')}</svg>`;

  // Seagull with flapping wings (faces right)
  /* Flapping wings: each wing is one shape that bends at the wrist. We morph it smoothly between
     a few poses (up, glide, down) with SVG <animate>, so the wing really flaps instead of just tilting. */
  const f1 = (v) => Math.round(v * 10) / 10;
  const wingD = ([wx, wy], [tx, ty], back = 6, tipBack = 4) => {
    const len = Math.hypot(tx - wx, ty - wy) || 1, dx = (tx - wx) / len, dy = (ty - wy) / len;
    const nx = dy, ny = -dx;   // the side the feathers trail to
    return `M2 -1 Q${f1(wx)} ${f1(wy)} ${f1(tx)} ${f1(ty)} L${f1(tx + nx * tipBack - dx * 2)} ${f1(ty + ny * tipBack - dy * 2)} Q${f1(wx + nx * back * 1.6)} ${f1(wy + ny * back * 1.6)} -5 2Z`;
  };
  const tipD = ([wx, wy], [tx, ty]) => {
    const len = Math.hypot(tx - wx, ty - wy) || 1, dx = (tx - wx) / len, dy = (ty - wy) / len, nx = dy, ny = -dx;
    return `M${f1(tx)} ${f1(ty)} L${f1(tx - dx * 7)} ${f1(ty - dy * 7)} L${f1(tx - dx * 6 + nx * 3)} ${f1(ty - dy * 6 + ny * 3)} L${f1(tx + nx * 3 - dx * 2)} ${f1(ty + ny * 3 - dy * 2)}Z`;
  };
  const morph = (fn, poses, seq, dur, times) => `<animate attributeName="d" dur="${dur}s" repeatCount="indefinite" calcMode="spline"
      values="${seq.map((k) => fn(...poses[k])).join(';')}" keyTimes="${times}" keySplines="${seq.slice(1).map(() => '.45 0 .55 1').join(';')}"/>`;
  // seagull wing poses: [wrist, tip]
  const GULL_NEAR = { up: [[-5, -14], [-16, -27]], mid: [[-10, -7], [-30, -6]], down: [[-7, 3], [-17, 15]] };
  const GULL_FAR = { up: [[-3, -14], [-12, -25]], mid: [[-8, -8], [-25, -8]], down: [[-5, 1], [-13, 11]] };
  const GULL_SEQ = ['mid', 'up', 'down', 'up', 'down', 'mid', 'mid'], GULL_T = '0;.09;.2;.31;.42;.55;1';
  const gullWing = (poses, fill, tipFill, stroke) => `<path d="${wingD(...poses.mid)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width=".7"` : ''}>${morph(wingD, poses, GULL_SEQ, 2.4, GULL_T)}</path>
      <path d="${tipD(...poses.mid)}" fill="${tipFill}">${morph(tipD, poses, GULL_SEQ, 2.4, GULL_T)}</path>`;
  const gull = `<g class="gull">
      ${gullWing(GULL_FAR, '#b9c2ca', '#3a3f47')}
      <path d="M-15 1 C-11 -3 2 -4.5 9 -2 C13 -0.5 14 1.5 11 2.6 C3 4.8 -8 4.2 -15 2.6 L-21 2Z" fill="#fff"/><path d="M-15 1.4 L-21 2 L-15 2.8Z" fill="#9aa3ad"/>
      <circle cx="10" cy="-2" r="3.4" fill="#fff"/><path d="M13 -2.4 L18.5 -1.2 L13 0Z" fill="#f2c94c"/><circle cx="17" cy="-1" r=".7" fill="#e63946"/><circle cx="11" cy="-2.8" r=".8" fill="#23313f"/>
      ${gullWing(GULL_NEAR, '#eef1f4', '#2b2f36', '#9aa3ad')}</g>`;
  const gullFlight = (k, y, sc, dur, delay, left = false) =>
    `<g data-k="birds${k}" class="fade"><g class="fly${left ? ' left' : ''}" style="animation-duration:${dur}s;animation-delay:${delay}s"><g transform="translate(0 ${y}) scale(${left ? -sc : sc} ${sc})"><g class="soar">${gull.replace(/<animate /g, `<animate begin="${delay}s" `)}</g></g></g></g>`;

  const tree = (x, y, sc = 1) => `<g transform="translate(${x} ${y}) scale(${sc})"><g class="tree">
      <path d="M-4 0 L-3 -30 L3 -30 L4 0Z" fill="#9b6a3c"/>
      <g class="crown"><circle cx="0" cy="-44" r="18" class="leaf"/><circle cx="-13" cy="-33" r="12" class="leaf dark"/><circle cx="13" cy="-34" r="13" class="leaf dark"/>
      <circle cx="-6" cy="-50" r="6" fill="#fff" opacity=".2"/></g></g></g>`;
  const bush = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})">
      <circle cx="-12" cy="-8" r="11" class="bush-d"/><circle cx="11" cy="-9" r="12" class="bush-d"/><circle cx="0" cy="-16" r="13" class="bush-l"/>
      <circle cx="-10" cy="-12" r="2" class="berry"/><circle cx="8" cy="-17" r="2" class="berry"/></g>`;
  // street lamp; flip = the arm points left
  const lamp = (x, y, flip) => `<g transform="translate(${x} ${y}) scale(${flip ? -1 : 1} 1)"><path d="M0 0 V-44 Q0 -52 8 -52 H11" stroke="#4a5563" stroke-width="3" fill="none"/>
      <rect x="8" y="-55" width="11" height="5" rx="2" fill="#4a5563"/><rect x="9.5" y="-51" width="8" height="3" rx="1" class="lampbulb"/></g>`;

  // Coral reef in the sea in front of the city; it bleaches when the sea gets too warm
  const CORAL = {
    staghorn: `<path d="M0 0 C-1 -10 -9 -15 -13 -27 M0 0 C1 -12 4 -21 2 -35 M0 -5 C6 -11 12 -16 16 -27 M2 -22 C-2 -26 -5 -31 -6 -37 M-7 -17 C-13 -19 -17 -21 -21 -23 M15 -24 C19 -27 21 -30 22 -34"
        stroke="currentColor" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      <g fill="#ffffff" opacity=".35"><circle cx="-13" cy="-27" r="2.6"/><circle cx="2" cy="-35" r="2.6"/><circle cx="16" cy="-27" r="2.6"/><circle cx="-6" cy="-37" r="2.3"/></g>`,
    brain: `<path d="M-19 0 Q-20 -21 0 -22 Q20 -21 19 0Z" fill="currentColor"/>
      <path d="M-14 -3 q3 -7 6 -2 t6 -3 t6 1 t5 -2 M-11 -10 q3 -5 6 -1 t6 -2 t6 0 M-6 -16 q3 -3 6 0 t5 -1" stroke="#00000030" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    fan: `<path d="M-1 0 L0 -7 C-20 -9 -24 -28 -12 -38 C-4 -44 6 -44 13 -38 C24 -28 20 -9 1 -7 L1 0Z" fill="currentColor" opacity=".9"/>
      <path d="M0 -7 C-6 -18 -12 -26 -12 -36 M0 -7 C0 -20 0 -30 1 -42 M0 -7 C6 -18 12 -26 13 -36" stroke="#00000028" stroke-width="1.3" fill="none"/>`,
    tube: `<rect x="-14" y="-18" width="8" height="18" rx="3" fill="currentColor"/><rect x="-4" y="-28" width="8" height="28" rx="3" fill="currentColor"/><rect x="6" y="-14" width="8" height="14" rx="3" fill="currentColor"/>`,
    anemone: `<ellipse cx="0" cy="-3" rx="9" ry="4" fill="currentColor"/>
      <g class="sway-soft" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"><path d="M-7 -4 q-6 -8 -4 -15 M-3 -5 q-3 -9 0 -17 M2 -5 q3 -9 1 -17 M6 -4 q6 -8 4 -15"/></g>`,
  };
  const coral = (x, y, type, col, sc = 1) => `<g transform="translate(${x} ${y}) scale(${sc})"><g class="coral c-${col}">${CORAL[type]}</g></g>`;
  const kelp = (x, y, h, d) => `<g transform="translate(${x} ${y})"><g class="kelp" style="animation-delay:${d}s">
      <path d="M0 0 C-6 ${-h * 0.3} 6 ${-h * 0.6} 0 ${-h} M4 0 C10 ${-h * 0.3} -2 ${-h * 0.55} 6 ${-h * 0.8}" stroke="#3f9b5f" stroke-width="4" fill="none" stroke-linecap="round"/></g></g>`;
  const rock = (x, y, w) => `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${w * 0.32}" fill="#5b6470" opacity=".85"/>`;
  const reef = (x, y, sc, a, b, c, ca, cb, cc) => `<g transform="translate(${x} ${y}) scale(${sc})">${rock(0, 2, 34)}
      ${kelp(-30, 4, 46, (x % 7) * -0.3)}${coral(-14, 0, a, ca)}${coral(14, 2, b, cb, 0.9)}${coral(0, 4, c, cc, 0.75)}</g>`;

  // Critters
  const butterfly = (x, y, col, d) => `<g transform="translate(${x} ${y}) scale(.6)"><g class="flutter" style="animation-delay:${d}s"><g class="bfly">
      <ellipse class="bwing" cx="-5" cy="-3" rx="6" ry="4.5" fill="${col}"/><ellipse class="bwing" cx="5" cy="-3" rx="6" ry="4.5" fill="${col}"/>
      <ellipse class="bwing" cx="-4" cy="3" rx="4" ry="3" fill="${col}"/><ellipse class="bwing" cx="4" cy="3" rx="4" ry="3" fill="${col}"/>
      <rect x="-1" y="-6" width="2" height="11" rx="1" fill="#23313f"/></g></g></g>`;
  const bee = (x, y, d) => `<g transform="translate(${x} ${y}) scale(.55)"><g class="beefly" style="animation-delay:${d}s">
      <ellipse class="bwing" cx="-1" cy="-5" rx="3.5" ry="2.4" fill="#e8f7ff" opacity=".9"/>
      <ellipse cx="0" cy="0" rx="5.5" ry="3.8" fill="#ffd23f"/><path d="M-1.6 -3.6 v7.2 M1.8 -3.6 v7.2" stroke="#23313f" stroke-width="1.5"/><circle cx="5" cy="-0.5" r="1.4" fill="#23313f"/></g></g>`;
  const crab = (x, y, d) => `<g transform="translate(${x} ${y}) scale(.55)"><g class="scuttle" style="animation-delay:${d}s">
      <path d="M-7 2 l-5 4 M-4 3 l-3 5 M7 2 l5 4 M4 3 l3 5" stroke="#e8573f" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="0" cy="0" rx="9" ry="5.5" fill="#ff6b4a"/><path d="M-4 -4 v-5 M4 -4 v-5" stroke="#e8573f" stroke-width="1.6"/><circle cx="-4" cy="-9" r="1.8" fill="#23313f"/><circle cx="4" cy="-9" r="1.8" fill="#23313f"/>
      <circle cx="-12" cy="-3" r="3.5" fill="#ff6b4a"/><circle cx="12" cy="-3" r="3.5" fill="#ff6b4a"/></g></g>`;
  // A hawk/eagle gliding high above the city: broad wings with spread "finger" feathers at the tips,
  // a few slow, deep flaps and then a long glide
  const hawkWingD = ([wx, wy], [tx, ty]) => {
    const len = Math.hypot(tx - wx, ty - wy) || 1, dx = (tx - wx) / len, dy = (ty - wy) / len, nx = dy, ny = -dx;
    const p = (a, b) => `${f1(tx - dx * a + nx * b)} ${f1(ty - dy * a + ny * b)}`;
    return `M3 -2 Q${f1(wx)} ${f1(wy)} ${f1(tx)} ${f1(ty)} L${p(4, 1.5)} L${p(1, 3.5)} L${p(5, 4.5)} L${p(2, 6.5)} L${p(7, 7.5)} L${p(4, 10)} L${p(11, 10)} Q${f1(wx + nx * 12)} ${f1(wy + ny * 12)} -6 4Z`;
  };
  const HAWK_NEAR = { up: [[-8, -16], [-24, -30]], mid: [[-13, -7], [-38, -8]], down: [[-9, 5], [-22, 20]] };
  const HAWK_FAR = { up: [[-6, -16], [-19, -28]], mid: [[-11, -9], [-32, -11]], down: [[-7, 3], [-17, 15]] };
  const HAWK_SEQ = ['mid', 'up', 'down', 'up', 'down', 'mid', 'mid'], HAWK_T = '0;.08;.18;.28;.38;.5;1';
  const HAWK = `<g class="hawk-side">
      <path d="${hawkWingD(...HAWK_FAR.mid)}" fill="#5a3a1e">${morph(hawkWingD, HAWK_FAR, HAWK_SEQ, 6, HAWK_T)}</path>
      <path d="M-16 1 L-29 -2.5 L-30 2 L-28 6 L-16 3.5Z" fill="#a0673a"/><path d="M-27 -1.5 L-27.5 4.5 M-23 -0.5 L-23.5 4.5" stroke="#5a3a1e" stroke-width="1.2"/>
      <path d="M-17 1 C-11 -4.5 4 -6 12 -3.5 C16 -2 18 0.5 15.5 2.5 C8 5.5 -6 5 -16 3.5Z" fill="#7a4e2a"/>
      <path d="M1 2.2 C7 3.8 12 2.8 15 1.2 C12 -1 6 -1 1 2.2Z" fill="#ead8b8"/>
      <circle cx="14" cy="-3.6" r="4.2" fill="#f4f1ea"/><path d="M17.6 -4.8 Q21.6 -4.2 20.4 -1.2 L17.8 -1.8Z" fill="#f2c94c" stroke="#8a6a1e" stroke-width=".5"/>
      <circle cx="15.4" cy="-4.4" r="1.1" fill="#ffd23f"/><circle cx="15.6" cy="-4.4" r=".55" fill="#23313f"/><path d="M13 -6.4 L17 -5.6" stroke="#6b5a4a" stroke-width="1"/>
      <path d="${hawkWingD(...HAWK_NEAR.mid)}" fill="#8a5a33" stroke="#4a2e16" stroke-width=".7">${morph(hawkWingD, HAWK_NEAR, HAWK_SEQ, 6, HAWK_T)}</path></g>`;
  // A pigeon on the pavement that pecks at the ground (faces left; feet at 0,0)
  const pigeon = (x, y, flip, d) => `<g transform="translate(${x} ${y}) scale(${flip ? -0.6 : 0.6} .6)"><g class="pigeon-walk" style="animation-delay:${d}s"><g class="peck" style="animation-delay:${d * 0.7}s">
      <path d="M-1.5 -1 v1.6 M1.6 -1 v1.6" stroke="#e8573f" stroke-width="1"/>
      <path d="M-5 -6 Q-5 -10 0 -10 Q6 -10 9 -7 L11 -5 Q6 -1 0 -1 Q-4 -1 -5 -6Z" fill="#9aa5b1"/>
      <path d="M0 -9 Q6 -9 9 -6.5 L7 -4 Q3 -6 0 -6Z" fill="#7d8691"/><path d="M5 -8 l2 1 M6 -7 l2 1" stroke="#4a5563" stroke-width=".7"/>
      <path d="M-3 -7 Q-6 -12 -4 -13.5 Q-1 -12 -1 -8Z" fill="#6aa58f"/><circle cx="-4.5" cy="-13" r="2.6" fill="#8a93a0"/>
      <path d="M-7 -13 l-2 .7 l2 .5Z" fill="#4a5563"/><circle cx="-5" cy="-13.4" r=".55" fill="#ff8c42"/></g></g></g>`;
  // A nest in a tree with two hungry chicks (and mom bringing food)
  const NEST = `<g class="nest">
      <path d="M-9 0 Q-9 6 0 6 Q9 6 9 0Z" fill="#8b5a2b"/><path d="M-9 0 Q0 3 9 0 M-8 2 L7 4 M-6 4 L8 1" stroke="#c98f4f" stroke-width="1" fill="none"/>
      <g data-k="nestLife" class="fade"><g class="chick" style="animation-delay:-.3s"><circle cx="-3.5" cy="-1" r="2.6" fill="#ffd23f"/><path d="M-3.5 -2.4 l-1.3 -2 l2.6 0Z" fill="#ff8c42"/></g>
      <g class="chick"><circle cx="2.5" cy="-1.2" r="2.6" fill="#ffd23f"/><path d="M2.5 -2.6 l-1.3 -2 l2.6 0Z" fill="#ff8c42"/></g>
      <g transform="translate(11 -1) scale(.8)">MOM</g></g></g>`;
  const songbird = (x, y, c, d) => `<g transform="translate(${x} ${y}) scale(.7)"><g class="hop" style="animation-delay:${d}s">
      <ellipse cx="0" cy="-5" rx="6" ry="4.6" fill="${c}"/><circle cx="5" cy="-9" r="3.4" fill="${c}"/><path d="M8 -9.5 l3.5 1 l-3.5 1Z" fill="#ffb627"/>
      <circle cx="6" cy="-10" r=".9" fill="#23313f"/><path d="M-5 -6 l-6 -3 l1 5Z" fill="${c}"/><path d="M-1 -1 v2 M2 -1 v2" stroke="#8b5a2b" stroke-width="1"/></g></g>`;
  const cow = (x, y, flip) => `<g transform="translate(${x} ${y}) scale(${flip ? -1 : 1} 1)">
      <rect x="-16" y="-24" width="30" height="16" rx="7" fill="#fff" stroke="#23313f" stroke-width="1.5"/>
      <path d="M-8 -24 q4 6 -2 10 q-6 -2 -4 -10Z M6 -21 q5 2 3 8 q-6 0 -3 -8Z" fill="#23313f"/>
      <path d="M-12 -9 v9 M-6 -9 v9 M6 -9 v9 M11 -9 v9" stroke="#23313f" stroke-width="2.6"/>
      <rect x="11" y="-31" width="13" height="13" rx="4" fill="#fff" stroke="#23313f" stroke-width="1.5"/><ellipse cx="21" cy="-21" rx="5" ry="3.6" fill="#ffb3c7"/>
      <circle cx="16" cy="-27" r="1.4" fill="#23313f"/><path d="M13 -31 l-3 -4 M22 -31 l3 -4" stroke="#c9a227" stroke-width="2"/>
      <path d="M-16 -20 q-6 2 -5 10" stroke="#23313f" stroke-width="1.5" fill="none"/></g>`;

  const solar = (w, n) => `<g class="solar">${Array.from({ length: n }, (_, k) =>
    `<rect x="${k * (w + 2)}" y="0" width="${w}" height="10" rx="1" fill="#2f5d9e" stroke="#9cc3ff" stroke-width="1"/><path d="M${k * (w + 2) + w / 2} 0 V10 M${k * (w + 2)} 5 H${k * (w + 2) + w}" stroke="#9cc3ff" stroke-width=".8"/>`).join('')}</g>`;

  const turbine = (x, y, sc, d) => `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M-3 0 L-1.5 -64 L1.5 -64 L3 0Z" fill="#eef2f5" stroke="#c8d0d8" stroke-width="1"/>
      <g transform="translate(0 -64)"><g class="spin" style="animation-delay:${d}s">${[0, 120, 240].map((a) =>
        `<path transform="rotate(${a})" d="M-2.5 0 Q-4.5 -16 0 -32 Q3.5 -16 2.5 0Z" fill="#fff" stroke="#c8d0d8" stroke-width="1"/>`).join('')}</g><circle r="3.6" fill="#dfe5ea"/></g></g>`;

  // a puff of smoke that rises and fades (used by cars, chimneys and the power plant)
  const puffs = (x, y, n, r, col, dur = 4) => Array.from({ length: n }, (_, k) =>
    `<circle class="smoke" cx="${x}" cy="${y}" r="${r}" fill="${col}" style="animation-duration:${dur}s;animation-delay:${(-k * dur / n).toFixed(2)}s"/>`).join('');
  // the volcano island far away (small and a bit hazy, so it feels far)
  const vtree = (x, y, sc = 1) => `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M0 0 V-5" stroke="#7a5a3a" stroke-width="1.4"/><circle cx="0" cy="-7.5" r="3.8" class="vleaf"/></g>`;
  const vgoat = (x, y, flip) => `<g transform="translate(${x} ${y}) scale(${flip ? -0.9 : 0.9} .9)"><ellipse cx="0" cy="-3" rx="3.4" ry="2" fill="#fff"/><circle cx="3.4" cy="-4.6" r="1.4" fill="#fff"/><path d="M-2 -1.5 v2 M2 -1.5 v2" stroke="#6b5a4a" stroke-width=".8"/></g>`;
  const VOLCANO = `<g class="volcano" transform="translate(616 291) scale(1.15)">
      <ellipse cx="0" cy="0" rx="100" ry="6" fill="#efe0b0"/>
      <path class="v-land" d="M-94 0 C-72 -9 -54 -20 -36 -42 C-27 -54 -20 -61 -13 -64 L12 -64 C20 -60 28 -50 38 -36 C53 -18 72 -8 94 0Z"/>
      <path class="v-rock" d="M-13 -64 L12 -64 C10 -56 6 -50 2 -44 C-2 -50 -8 -56 -13 -64Z"/><path d="M-12 -64 L11 -64 L7 -61 L-9 -61Z" fill="#6b5448"/>
      <g class="v-steam">${puffs(0, -66, 3, 5, '#f4f6f8', 6)}</g>
      <g data-k="vt1" class="fade">${vtree(-74, -4)}${vtree(-62, -7)}${vtree(66, -5)}${vtree(78, -2)}${vtree(-46, -14, .9)}</g>
      <g data-k="vt2" class="fade">${vtree(-36, -24, .9)}${vtree(40, -20, .9)}${vtree(52, -12)}${vtree(-54, -12)}${vtree(-26, -34, .8)}</g>
      <g data-k="vt3" class="fade">${vtree(28, -34, .8)}${vtree(-18, -42, .75)}${vtree(18, -44, .75)}${vtree(-84, -2)}${vtree(86, -1)}${vtree(-8, -6)}${vtree(10, -8)}</g>
      <g data-k="vAnimals" class="fade">${vgoat(-30, -14)}${vgoat(-22, -16, true)}${vgoat(34, -12, true)}</g>
      <g data-k="vBirds" class="fade"><g transform="translate(0 -84)">
        <g class="oval" style="animation-duration:11s"><path class="vwing" d="M-3 0 q1.5 -1.6 3 0 q1.5 -1.6 3 0" stroke="#4a5563" stroke-width="1" fill="none"/></g>
        <g class="oval" style="animation-duration:14s;animation-delay:-6s"><path class="vwing" d="M-2.5 0 q1.25 -1.4 2.5 0 q1.25 -1.4 2.5 0" stroke="#4a5563" stroke-width=".9" fill="none"/></g></g></g>
      <ellipse cx="0" cy="-30" rx="96" ry="40" fill="#d8eefc" opacity=".18"/>
    </g>`;

  /* ── vehicles (side view, facing right; the origin is where the wheels touch the ground) ── */
  const exhaust = (x) => `<g class="exhaust"><circle cx="${x}" cy="-7" r="5"/><circle cx="${x - 8}" cy="-13" r="7" style="animation-delay:-.27s"/><circle cx="${x - 18}" cy="-19" r="9" style="animation-delay:-.54s"/></g>`;
  const wheel = (x, r = 7) => `<circle cx="${x}" cy="${-r + 2}" r="${r}" fill="#2b2f36"/><circle cx="${x}" cy="${-r + 2}" r="${r * 0.42}" fill="#b8c0c8"/>`;
  // a little monkey head looking out of a window (faces right)
  const monkeyHead = (x, y, fur, cls = '') => `<g class="${cls}" transform="translate(${x} ${y})"><circle cx="-4.6" cy="-.5" r="2.4" fill="${fur}"/><circle r="5.2" fill="${fur}"/>
      <ellipse cx="2.2" cy="1" rx="3.4" ry="3" fill="#e8c39e"/><circle cx="1.6" cy="-1.5" r=".95" fill="#23313f"/><path d="M1.2 2.4 q1.6 1.3 3.2 -.2" stroke="#5a2d0c" stroke-width=".8" fill="none"/></g>`;
  const car = (c, fur = '#7a4a24', back = monkeyHead(-3, -23, '#8b5a2b'), driver = true) => `${exhaust(-38)}
      <path d="M-32 -8 Q-32 -19 -24 -19 L-16 -19 L-8 -31 L12 -31 L22 -19 L28 -19 Q34 -19 34 -11 L34 -6 L-32 -6Z" fill="${c}"/>
      <path d="M-5 -28 L3 -28 L3 -20 L-11 -20Z M7 -28 L11 -28 L18 -20 L7 -20Z" fill="#cfefff"/>
      ${driver ? monkeyHead(11, -23, fur) : ''}<g class="passenger">${back}</g>
      <rect x="27" y="-16" width="6" height="4" rx="1" fill="#fff3a8"/><rect x="-32" y="-16" width="4" height="4" fill="#ff5b4a"/>
      ${wheel(-17)}${wheel(17)}`;
  // the family car: dad drives; mom, Bobo and the little sister sit in the back
  const BACK_FAMILY = `<g transform="translate(-8.6 -22.5) scale(.62)">${monkeyHead(0, 0, '#a0703f')}</g><g transform="translate(-3.6 -22.5) scale(.66)">${monkeyHead(0, 0, '#8b5a2b')}</g><g transform="translate(1 -21.5) scale(.5)">${monkeyHead(0, 0, '#b07a44')}</g>`;
  const familyCar = (c, back = BACK_FAMILY) => car(c, '#6b4423', back);
  // a car seen from behind (driving up a driveway or the little street); heads = who's inside
  const headBack = (x, fur, sc = 1) => `<g transform="translate(${x} -27) scale(${sc})"><circle cx="-3.6" cy="0" r="1.6" fill="${fur}"/><circle cx="3.6" cy="0" r="1.6" fill="${fur}"/><circle r="3.6" fill="${fur}"/></g>`;
  const carRear = (c, heads = '') => `${exhaust(-8).replace('class="exhaust"', 'class="exhaust" transform="translate(0 2)"')}
      <path d="M-12 -24 Q-11 -34 0 -34 Q11 -34 12 -24Z" fill="${c}"/><path d="M-9 -24.5 Q-8.5 -31.5 0 -31.5 Q8.5 -31.5 9 -24.5Z" fill="#cfefff"/>
      <g class="passenger">${heads}</g>
      <rect x="-17" y="-25" width="34" height="19" rx="6" fill="${c}"/><rect x="-15" y="-20" width="6" height="3.4" rx="1" fill="#ff5b4a"/><rect x="9" y="-20" width="6" height="3.4" rx="1" fill="#ff5b4a"/>
      <rect x="-5" y="-15" width="10" height="4.4" rx="1" fill="#fff" stroke="#9aa5b1" stroke-width=".6"/><rect x="-17" y="-9" width="34" height="3" fill="#23313f" opacity=".28"/>
      <rect x="-15.5" y="-7" width="7" height="7" rx="2" fill="#2b2f36"/><rect x="8.5" y="-7" width="7" height="7" rx="2" fill="#2b2f36"/>`;
  const carFront = (c, fur = '#7a4a24') => `
      <path d="M-12 -24 Q-11 -34 0 -34 Q11 -34 12 -24Z" fill="${c}"/><path d="M-9 -24.5 Q-8.5 -31.5 0 -31.5 Q8.5 -31.5 9 -24.5Z" fill="#cfefff"/>
      <g transform="translate(-4 -27)"><circle r="3.6" fill="${fur}"/><ellipse cx="0" cy="1" rx="2.4" ry="2" fill="#e8c39e"/><circle cx="-1" cy="-.6" r=".6" fill="#23313f"/><circle cx="1" cy="-.6" r=".6" fill="#23313f"/></g>
      <rect x="-17" y="-25" width="34" height="19" rx="6" fill="${c}"/><circle cx="-11" cy="-17" r="3" fill="#fff3a8"/><circle cx="11" cy="-17" r="3" fill="#fff3a8"/>
      <rect x="-6" y="-16" width="12" height="5" rx="1.5" fill="#23313f" opacity=".45"/><rect x="-17" y="-9" width="34" height="3" fill="#23313f" opacity=".28"/>
      <rect x="-15.5" y="-7" width="7" height="7" rx="2" fill="#2b2f36"/><rect x="8.5" y="-7" width="7" height="7" rx="2" fill="#2b2f36"/>`;
  const truck = `${exhaust(-52)}
      <rect x="-48" y="-50" width="64" height="42" rx="3" fill="#f7f7f7" stroke="#c8cdd3" stroke-width="2"/>
      <path d="M-38 -36 h44 M-38 -26 h44" stroke="#ffb627" stroke-width="5"/>
      <path d="M17 -38 L34 -38 L45 -23 L45 -8 L17 -8Z" fill="#2f80ed"/><path d="M22 -34 L32 -34 L40 -23 L22 -23Z" fill="#cfefff"/>${monkeyHead(29, -28, '#a0673a')}
      ${wheel(-32, 8)}${wheel(-12, 8)}${wheel(30, 8)}`;
  const carriage = (x) => `<rect x="${x}" y="-40" width="62" height="34" rx="6" fill="#f4f6f8" stroke="#c8cdd3" stroke-width="1.5"/>
      <rect x="${x}" y="-17" width="62" height="5" fill="#2f80ed"/>
      <rect class="win" x="${x + 6}" y="-34" width="14" height="11" rx="2"/><rect class="win" x="${x + 42}" y="-34" width="14" height="11" rx="2"/>
      <rect x="${x + 25}" y="-36" width="12" height="28" rx="2" fill="#9aa5b1"/>${wheel(x + 12, 5)}${wheel(x + 50, 5)}`;
  // little rocks and pebbles on the beach (always in the same spots: a fixed pseudo-random sequence)
  const PEBBLES = (() => {
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const tones = ['#b9ad9c', '#9c9284', '#cfc3b0', '#8a8279', '#d8cbb6'];
    let out = '';
    for (let k = 0; k < 70; k++) {
      const x = 40 + rnd() * 650, y = 471 + rnd() * 30, r = 0.8 + rnd() * 1.6;
      if (x > 690) continue;
      out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(r * 1.4).toFixed(1)}" ry="${r.toFixed(1)}" fill="${tones[k % 5]}"/>`;
    }
    // a few bigger rocks with a light top
    [[96, 494], [258, 498], [402, 489], [548, 497], [664, 487]].forEach(([x, y], k) => {
      const w = 4 + (k % 3) * 1.5;
      out += `<path d="M${x - w} ${y} Q${x - w * 0.8} ${y - w * 0.9} ${x} ${y - w} Q${x + w * 0.9} ${y - w * 0.8} ${x + w} ${y}Z" fill="#8f877c"/><path d="M${x - w * 0.5} ${y - w * 0.6} Q${x} ${y - w * 0.95} ${x + w * 0.5} ${y - w * 0.7}" stroke="#c9c0b2" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    });
    return out;
  })();
  // front of the train at x = 0; a carriage door is at x = -98
  const TRAIN = `${carriage(-194)}${carriage(-129)}
      <path d="M-64 -42 H-12 Q6 -42 8 -24 L8 -6 H-64Z" fill="#e63946"/><path d="M-64 -17 H8" stroke="#fff" stroke-width="4"/>
      <path d="M-16 -36 H-4 Q3 -36 4 -26 H-16Z" fill="#cfefff"/><rect class="win" x="-56" y="-35" width="12" height="11" rx="2"/><rect class="win" x="-38" y="-35" width="12" height="11" rx="2"/>
      <circle cx="6" cy="-12" r="2.6" fill="#fff3a8"/>${wheel(-50, 5)}${wheel(-26, 5)}${wheel(-6, 5)}`;
  const SHIP = `<g transform="scale(.8)">${puffs(-36, -60, 3, 7, '#8a8f98', 3.5)}
      <path d="M-70 -14 H64 L52 4 H-62Z" fill="#c0392b"/><path d="M-70 -14 H64 L62 -8 H-68Z" fill="#23313f"/>
      <rect x="-60" y="-30" width="22" height="16" fill="#2f80ed"/><rect x="-36" y="-30" width="22" height="16" fill="#ffb627"/><rect x="-12" y="-30" width="22" height="16" fill="#2fb35a"/><rect x="12" y="-30" width="22" height="16" fill="#e63946"/>
      <rect x="-48" y="-46" width="22" height="16" fill="#e63946"/><rect x="-24" y="-46" width="22" height="16" fill="#2f80ed"/><rect x="0" y="-46" width="22" height="16" fill="#ffb627"/>
      <rect x="38" y="-38" width="18" height="24" fill="#f4f6f8"/><rect x="-40" y="-60" width="8" height="14" fill="#555b63"/></g>`;

  const sailboat = (c, fur) => `<g class="boat-rock"><path d="M-26 -6 H26 L18 6 H-20Z" fill="${c}"/><path d="M-26 -6 H26" stroke="#fff" stroke-width="2"/>
      <path d="M-2 -6 V-52" stroke="#6b5a4a" stroke-width="2.5"/><path d="M0 -50 L22 -10 H0Z" fill="#fff"/><path d="M-4 -46 L-22 -10 H-4Z" fill="#f4f6f8"/><path d="M-2 -52 l10 3 l-10 3Z" fill="#ffd23f"/>
      ${monkeyHead(12, -11, fur)}</g>`;
  const WHALE = `<g class="whale-bob"><path d="M-34 0 L-50 -16 L-45 0 L-52 10Z" fill="#4a6fa5"/>
      <path d="M-36 6 Q-32 -18 0 -20 Q30 -20 36 2 Q20 10 -36 6Z" fill="#4a6fa5"/><path d="M-26 4 Q0 10 32 2" stroke="#9cc0ea" stroke-width="3" fill="none"/>
      <circle cx="20" cy="-7" r="2.3" fill="#23313f"/><circle cx="20.8" cy="-7.7" r=".8" fill="#fff"/><path d="M24 -1 q6 3 10 -1" stroke="#23313f" stroke-width="1.6" fill="none"/>
      <circle cx="14" cy="-2" r="3" fill="#ff9aa2" opacity=".6"/>
      <g class="spout"><path d="M6 -20 q-6 -14 -14 -16 M6 -20 v-20 M6 -20 q6 -14 14 -16" stroke="#dff4ff" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <circle cx="-9" cy="-37" r="3.2" fill="#dff4ff"/><circle cx="21" cy="-37" r="3.2" fill="#dff4ff"/><circle cx="6" cy="-44" r="3.2" fill="#dff4ff"/></g>
      <ellipse cx="0" cy="8" rx="46" ry="4.5" fill="#e6f9ff" opacity=".75"/></g>`;

  // A friend monkey (different fur and shirt). hat = party hat.
  const BOW = '<path d="M14 -24 l11 -7 v14Z M14 -24 l-10 -8 v15Z" fill="#ff5b7a" stroke="#c9304f" stroke-width="1.5"/><circle cx="14" cy="-24" r="3.4" fill="#ff8fa3"/>';
  const TIE = '<path d="M0 -21 l-4 4 l4 21 l4 -21Z" fill="#e63946"/><path d="M-5 -24 h10 l-5 4Z" fill="#c0392b"/>';
  const buddy = (fur, shirt, hat, face = '#f2d4b5', extra = '') => `<g class="bd-bob">
      <path d="M16 12 C46 14 52 -18 34 -26 C26 -28 24 -18 32 -16" stroke="${fur}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <ellipse cx="-11" cy="24" rx="9" ry="6" fill="${fur}"/><ellipse cx="11" cy="24" rx="9" ry="6" fill="${fur}"/>
      <ellipse cx="0" cy="0" rx="22" ry="26" fill="${shirt}"/><path d="M-12 -18 Q0 -10 12 -18" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>
      <path d="M-18 -8 Q-34 6 -24 20 M18 -8 Q34 6 24 20" stroke="${shirt}" stroke-width="9" fill="none" stroke-linecap="round"/>
      <circle cx="-24" cy="21" r="5" fill="${fur}"/><circle cx="24" cy="21" r="5" fill="${fur}"/>
      ${extra === 'tie' ? TIE : ''}
      <g class="umbrella"><path d="M14 18 L4 -86" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/><path d="M-44 -78 Q2 -118 48 -78 Q36 -85 25 -78 Q14 -85 2 -78 Q-10 -85 -21 -78 Q-32 -85 -44 -78Z" fill="#ff5b4a" stroke="#c0392b" stroke-width="2.5" stroke-linejoin="round"/><path d="M2 -78 Q4 -100 2 -112 M-21 -78 Q-14 -98 0 -110 M25 -78 Q18 -98 4 -110" stroke="#c0392b" stroke-width="1.6" fill="none"/></g>
      <g transform="translate(0 -40)">
        <circle cx="-26" cy="0" r="10" fill="${fur}"/><circle cx="-26" cy="0" r="6" fill="${face}"/><circle cx="26" cy="0" r="10" fill="${fur}"/><circle cx="26" cy="0" r="6" fill="${face}"/>
        <circle cx="0" cy="0" r="26" fill="${fur}"/><ellipse cx="0" cy="8" rx="18" ry="14" fill="${face}"/>
        <circle cx="-8" cy="-4" r="9" fill="${face}"/><circle cx="8" cy="-4" r="9" fill="${face}"/>
        <circle cx="-7" cy="-4" r="3.6" fill="#23313f"/><circle cx="7" cy="-4" r="3.6" fill="#23313f"/><circle cx="-6" cy="-5.5" r="1.2" fill="#fff"/><circle cx="8" cy="-5.5" r="1.2" fill="#fff"/>
        <path d="M-9 10 Q0 21 9 10 Z" fill="#5a2d0c"/><circle cx="-15" cy="6" r="4" fill="#ff9aa2" opacity=".6"/><circle cx="15" cy="6" r="4" fill="#ff9aa2" opacity=".6"/>
        ${SHADES}
        ${extra === 'bow' ? BOW : ''}
        ${hat ? `<path d="M-15 -20 L5 -66 L17 -16Z" fill="${hat}"/><path d="M-9 -32 L13 -28 M-3 -46 L10 -43" stroke="#fff" stroke-width="3"/><circle cx="5" cy="-66" r="5" fill="#ffd23f"/>` : ''}
      </g></g>`;
  // Eclipse glasses (dark lenses), shown only during a solar eclipse
  const SHADES = `<g class="shades"><path d="M-18 -9 h14 v7 q-7 6 -14 0Z M4 -9 h14 v7 q-7 6 -14 0Z" fill="#14171c" stroke="#ffd23f" stroke-width="1.6"/>
      <path d="M-4 -7 h8 M-18 -8 l-8 -3 M18 -8 l8 -3" stroke="#ffd23f" stroke-width="2"/></g>`;
  const MONKEY_FIT = 'translate(0 -18.6) scale(.62)';    // Bobo-sized, standing on the origin
  // A monkey riding a bike, seen from the side (faces right; the wheels touch the ground at y = 0).
  // shirt = null: just fur with a light belly (Bobo). The legs pedal and the wheels turn.
  const sideWheel = (x) => `<g transform="translate(${x} -15)"><circle r="15" fill="none" stroke="#23313f" stroke-width="4"/>
      <g class="wheelspin"><path d="M-13 0 H13 M0 -13 V13 M-9 -9 L9 9 M9 -9 L-9 9" stroke="#9aa5b1" stroke-width="1.3"/></g><circle r="2.6" fill="#555b63"/></g>`;
  const sideRider = (fur, shirt, pack = false) => `<g class="rider">
      <path d="M-12 -50 C-30 -48 -36 -64 -28 -75" stroke="${fur}" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${pack ? '<rect x="-28" y="-77" width="15" height="25" rx="5" fill="#ff6b4a"/><rect x="-28" y="-62" width="6" height="7" rx="2" fill="#e04f30"/>' : ''}
      <g transform="translate(-6 -44)"><g class="leg-b"><path d="M0 0 L12 12 L8 27" stroke="${fur}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/><ellipse cx="10" cy="28" rx="5" ry="3" fill="${fur}" opacity=".75"/></g></g>
      ${sideWheel(-27)}${sideWheel(27)}
      <path d="M-27 -15 L0 -15 L-8 -38 Z M0 -15 L19 -38 L-8 -38 M27 -15 L19 -38 L17 -48 M12 -49 H23" stroke="#ff5b4a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-15 -40 H-2" stroke="#23313f" stroke-width="4.5" stroke-linecap="round"/><circle cx="0" cy="-15" r="4" fill="#555b63"/>
      <ellipse cx="-5" cy="-55" rx="11" ry="15" transform="rotate(22 -5 -55)" fill="${shirt || fur}"/>
      ${shirt ? '' : '<ellipse cx="-1" cy="-54" rx="5.5" ry="10" transform="rotate(22 -1 -54)" fill="#e8c39e"/>'}
      ${pack ? '<path d="M-14 -66 Q-6 -60 -2 -48" stroke="#e04f30" stroke-width="3.5" fill="none" stroke-linecap="round"/>' : ''}
      <g transform="translate(-6 -44)"><g class="leg-a"><path d="M0 0 L12 12 L8 27" stroke="${fur}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="10" cy="28" rx="5" ry="3" fill="${fur}"/></g></g>
      <path d="M0 -63 Q10 -57 17 -48" stroke="${shirt || fur}" stroke-width="6" stroke-linecap="round" fill="none"/><circle cx="17" cy="-48" r="3.5" fill="${fur}"/>
      <g transform="translate(6 -76)">
        <circle cx="-9" cy="-2" r="6" fill="${fur}"/><circle cx="-9" cy="-2" r="3.5" fill="#e8c39e"/><circle r="13" fill="${fur}"/>
        <ellipse cx="5" cy="1" rx="8" ry="8.5" fill="#e8c39e"/><ellipse cx="11" cy="5" rx="6" ry="4.5" fill="#e8c39e"/>
        <circle cx="6" cy="-2" r="2.3" fill="#23313f"/><circle cx="6.8" cy="-2.8" r=".8" fill="#fff"/><circle cx="15.5" cy="3.6" r=".9" fill="#5a2d0c"/>
        <path d="M9 8 q4 3 8 -1" stroke="#5a2d0c" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="2.5" cy="5" r="2.6" fill="#ff9aa2" opacity=".55"/>
      </g></g>`;
  // Friends come in different shades: golden, dark brown, red-brown, grey…
  const FRIENDS = { golden: ['#d4a24c', '#f6e2c4'], dark: ['#4a3426', '#d9b38c'], red: ['#b0602e', '#f2d4b5'], grey: ['#8d8f94', '#ece2d6'], tan: ['#c98a5a', '#f6dcc0'],
    // Bobo's family: dad, mom and little sister
    dad: ['#6b4423', '#e3bb94'], mom: ['#a0703f', '#f2d4b5'], sister: ['#b07a44', '#f6dcc0'] };
  const backRider = (fur) => `<g class="rider back-rider">
      <ellipse cx="22" cy="-12" rx="5" ry="11.5" fill="none" stroke="#23313f" stroke-width="3.5"/>
      <path d="M22 -12 L15 -40 M8 -42 H23" stroke="#ff5b4a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <g class="pedal-l"><path d="M-3 -40 Q-10 -29 -6 -19" stroke="${fur}" stroke-width="6.5" fill="none" stroke-linecap="round" opacity=".8"/><ellipse cx="-6" cy="-17" rx="4" ry="2.6" fill="${fur}" opacity=".8"/></g>
      <ellipse cx="2" cy="-14" rx="6.5" ry="14" fill="none" stroke="#23313f" stroke-width="4"/><ellipse cx="2" cy="-14" rx="2" ry="4" fill="#555b63"/>
      <path d="M2 -14 L2 -37 M-5 -39 H9" stroke="#ff5b4a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g class="pedal-r"><path d="M8 -40 Q15 -29 11 -19" stroke="${fur}" stroke-width="6.5" fill="none" stroke-linecap="round"/><ellipse cx="11" cy="-17" rx="4" ry="2.6" fill="${fur}"/></g>
      <path d="M-6 -42 C-18 -40 -22 -52 -15 -58" stroke="${fur}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <ellipse cx="3" cy="-55" rx="13" ry="16" fill="${fur}"/>
      <path d="M-8 -62 Q-3 -51 7 -43 M14 -62 Q19 -52 16 -44" stroke="${fur}" stroke-width="5.5" fill="none" stroke-linecap="round"/>
      <path d="M-4 -70 Q-7 -75 -3 -78 M11 -70 Q14 -75 10 -78" stroke="#e04f30" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="-7" y="-71" width="20" height="25" rx="6" fill="#ff6b4a"/><rect x="-4" y="-58" width="14" height="9" rx="2.5" fill="#e04f30"/><path d="M-4 -64 H10" stroke="#ffd23f" stroke-width="1.6"/>
      <circle cx="-10" cy="-82" r="5" fill="${fur}"/><circle cx="-10" cy="-82" r="2.8" fill="#e8c39e"/><circle cx="16" cy="-82" r="5" fill="${fur}"/><circle cx="16" cy="-82" r="2.8" fill="#e8c39e"/>
      <circle cx="3" cy="-82" r="13" fill="${fur}"/><path d="M-2 -91 Q3 -95 8 -91" stroke="#6b4423" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
  const frontRider = (fur, shirt, pack = false) => `<g class="rider front-rider">
      <g class="pedal-l"><path d="M-6 -40 Q-12 -29 -8 -19" stroke="${fur}" stroke-width="6.5" fill="none" stroke-linecap="round"/><ellipse cx="-8" cy="-17" rx="4" ry="2.6" fill="${fur}"/></g>
      <g class="pedal-r"><path d="M6 -40 Q12 -29 8 -19" stroke="${fur}" stroke-width="6.5" fill="none" stroke-linecap="round"/><ellipse cx="8" cy="-17" rx="4" ry="2.6" fill="${fur}"/></g>
      <ellipse cx="0" cy="-14" rx="6.5" ry="14" fill="none" stroke="#23313f" stroke-width="4"/><ellipse cx="0" cy="-14" rx="2" ry="4" fill="#555b63"/>
      <path d="M0 -14 V-40 M-15 -45 H15" stroke="#ff5b4a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="0" cy="-55" rx="13" ry="16" fill="${shirt || fur}"/>${shirt ? '' : '<ellipse cx="0" cy="-52" rx="7.5" ry="10" fill="#e8c39e"/>'}
      ${pack ? '<path d="M-9 -68 V-50 M9 -68 V-50" stroke="#e04f30" stroke-width="3.4" stroke-linecap="round"/>' : ''}
      <path d="M-10 -63 Q-16 -54 -14 -45 M10 -63 Q16 -54 14 -45" stroke="${shirt || fur}" stroke-width="5.5" fill="none" stroke-linecap="round"/>
      <g transform="translate(0 -82)"><circle cx="-13" cy="0" r="5" fill="${fur}"/><circle cx="-13" cy="0" r="2.8" fill="#e8c39e"/><circle cx="13" cy="0" r="5" fill="${fur}"/><circle cx="13" cy="0" r="2.8" fill="#e8c39e"/>
        <circle r="13" fill="${fur}"/><ellipse cx="0" cy="4" rx="9" ry="7" fill="#e8c39e"/><circle cx="-4" cy="-2" r="4.4" fill="#e8c39e"/><circle cx="4" cy="-2" r="4.4" fill="#e8c39e"/>
        <circle cx="-3.6" cy="-2" r="1.8" fill="#23313f"/><circle cx="3.6" cy="-2" r="1.8" fill="#23313f"/><path d="M-4.5 5 Q0 9.5 4.5 5" stroke="#5a2d0c" stroke-width="1.6" fill="none" stroke-linecap="round"/></g></g>`;
  // a small parked bike (side view) for the bike racks
  const PARKED_BIKE = '<g transform="scale(.36)"><circle cx="-26" cy="-14" r="14" fill="none" stroke="#23313f" stroke-width="4"/><circle cx="26" cy="-14" r="14" fill="none" stroke="#23313f" stroke-width="4"/><path d="M-26 -14 L0 -14 L-8 -36 Z M0 -14 L18 -36 L-8 -36 M26 -14 L18 -36 L16 -44 M11 -45 H22 M-14 -38 H-2" stroke="#ff5b4a" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>';
  const rack = (x, y, k) => `<g transform="translate(${x} ${y})"><path d="M0 0 v-7 q0 -4 4 -4 q4 0 4 4 v7 M10 0 v-7 q0 -4 4 -4 q4 0 4 4 v7 M20 0 v-7 q0 -4 4 -4 q4 0 4 4 v7" stroke="#8a939d" stroke-width="1.6" fill="none"/>
      <g data-k="bikes_${k}" class="fade hide"><g transform="translate(7 0)">${PARKED_BIKE}</g><g data-k="bikes2_${k}" class="fade hide" transform="translate(17 0)">${PARKED_BIKE}</g><g data-k="bikes3_${k}" class="fade hide" transform="translate(27 0)">${PARKED_BIKE}</g></g></g>`;
  const rider = (fur, shirt, d, dur) => `<g class="ride" style="animation-duration:${dur}s;animation-delay:${d}s"><g transform="translate(0 466.5) scale(.38)">${sideRider(fur, shirt)}</g></g>`;

  // cars looping along the road (lane A goes left, lane B goes right), each with a happy monkey driver
  const LANE_A = 468, LANE_B = 477;
  const laneCar = (lane, c, dur, d, fur) => lane === 'A'
    ? `<g class="driveL" style="animation-duration:${dur}s;animation-delay:${d}s"><g transform="translate(0 ${LANE_A - 20}) scale(-.92 .92)">${car(c, fur)}</g></g>`
    : `<g class="driveR" style="animation-duration:${dur}s;animation-delay:${d}s"><g transform="translate(0 ${LANE_B - 20}) scale(.96)">${car(c, fur)}</g></g>`;

  function buildSVG(u) {
    const piers = (y, h) => [-300, -200, -100, -10, 870, 960, 1060, 1160].map((x) =>
      `<rect x="${x}" y="${y}" width="12" height="${h}" fill="#9aa5b1"/>`).join('');
    return `
<svg class="scene-main" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Bobo's City" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="${u}tufts" width="26" height="17" patternUnits="userSpaceOnUse"><path d="M3 13 l1.4 -4 l1.4 4 M7 13 l.8 -3 M15 6 l1.2 -3.6 l1.2 3.6 M21 15 l1 -3 l1 3 M11 16 l.7 -2.5" stroke="#2e6b2a" stroke-width=".9" fill="none" opacity=".5"/></pattern>
    <linearGradient id="${u}sea" gradientUnits="userSpaceOnUse" x1="0" y1="285" x2="0" y2="900"><stop offset="0" class="st-sea-top"/><stop offset=".35" class="st-sea-bot"/><stop offset="1" class="st-sea-deep"/></linearGradient>
  </defs>
  <g class="camera">

  <g data-k="skyClouds"></g>
  ${gullFlight(1, 150, 0.5, 30, -4)}${gullFlight(2, 250, 0.28, 40, -20, true)}${gullFlight(3, 548, 0.6, 26, -11)}
  <!-- one hawk circling high above the city -->
  <g data-k="hawk" class="fade"><g class="hawk-fly"><g transform="translate(0 130) scale(-0.55 0.55)"><g class="soar">${HAWK}</g></g></g></g>

  <g class="waves"><path d="M-260 320 q15 -8 30 0 q15 8 30 0 M900 318 q15 -8 30 0 q15 8 30 0 M-120 480 q15 -8 30 0 q15 8 30 0 M960 490 q15 -8 30 0 q15 8 30 0 M120 560 q15 -8 30 0 q15 8 30 0 M560 580 q15 -8 30 0 q15 8 30 0"/></g>
  <g data-k="seaFx"></g>

  <!-- offshore wind turbines (a reward) -->
  ${item('turbines', 0, 0, `${turbine(36, 300, 1, 0)}${turbine(82, 296, 0.85, -0.7)}${turbine(122, 293, 0.7, -1.3)}`, 'fade')}

  <!-- far away: a volcano island; its trees and animals come and go with the climate -->
  ${VOLCANO}
  <ellipse class="lagoon" cx="400" cy="446" rx="560" ry="140"/>
  <g data-k="farFish" class="fade"><g class="swim" style="animation-duration:60s;animation-delay:-10s"><g transform="translate(0 312) scale(.3)">${fish('#ffd23f')}</g></g>
    <g class="swim" style="animation-duration:66s;animation-delay:-25s"><g transform="translate(0 326) scale(.34)">${fish('#7ad3ff')}</g></g></g>

  <!-- bridges: the train and the road go across the sea to the other towns -->
  ${piers(320, 50)}${piers(478, 70)}

  <!-- the island -->
  <path class="foam" d="M30 298 C160 284 640 284 770 298 C808 304 814 360 812 432 C810 508 790 538 744 538 L56 538 C10 538 -10 508 -12 432 C-14 360 -6 304 30 298Z" fill="none" stroke="#e6f9ff" stroke-width="5" opacity=".7"/>
  <path d="M34 296 C160 282 640 282 766 296 C800 302 808 360 806 430 C804 502 786 534 744 534 L56 534 C14 534 -4 502 -6 430 C-8 360 0 302 34 296Z" fill="#fbe3a2"/>
  <path data-k="seaRise" class="sea-rise" d="M34 296 C160 282 640 282 766 296 C800 302 808 360 806 430 C804 502 786 534 744 534 L56 534 C14 534 -4 502 -6 430 C-8 360 0 302 34 296Z" fill="none" stroke="url(#${u}sea)"/>
  <path class="grass" d="M44 304 C170 292 630 292 756 304 C786 310 792 360 790 430 C788 478 770 490 738 490 L62 490 C30 490 12 478 10 430 C8 360 14 310 44 304Z"/>
  <path class="grass light" d="M60 310 C180 300 620 300 740 310 C766 316 770 340 760 352 L40 352 C30 340 34 316 60 310Z"/>
  <path d="M44 304 C170 292 630 292 756 304 C786 310 792 360 790 430 C788 478 770 490 738 490 L62 490 C30 490 12 478 10 430 C8 360 14 310 44 304Z" fill="url(#${u}tufts)"/>

  <!-- far back: skyscrapers and the power plant -->
  <g class="towers">
    <rect x="286" y="190" width="40" height="124" fill="#8fb3d9"/><rect x="286" y="190" width="40" height="8" fill="#6f93b9"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((r) => `<rect class="win" x="292" y="${204 + r * 13}" width="10" height="7"/><rect class="win" x="310" y="${204 + r * 13}" width="10" height="7"/>`).join('')}
    <rect x="332" y="140" width="52" height="174" fill="#f2c94c"/><path d="M332 140 L358 118 L384 140Z" fill="#e0a92f"/><path d="M358 118 V100" stroke="#e0a92f" stroke-width="3"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => `<rect class="win" x="339" y="${152 + r * 14}" width="10" height="8"/><rect class="win" x="353" y="${152 + r * 14}" width="10" height="8"/><rect class="win" x="367" y="${152 + r * 14}" width="10" height="8"/>`).join('')}
    <rect x="390" y="172" width="46" height="142" fill="#ff9f80"/><rect x="390" y="172" width="46" height="6" fill="#e9805e"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => `<rect class="win" x="397" y="${186 + r * 14}" width="12" height="8"/><rect class="win" x="417" y="${186 + r * 14}" width="12" height="8"/>`).join('')}
    <rect x="442" y="222" width="34" height="92" fill="#9fd8c9"/>
    ${[0, 1, 2, 3, 4, 5].map((r) => `<rect class="win" x="448" y="${232 + r * 13}" width="9" height="7"/><rect class="win" x="462" y="${232 + r * 13}" width="9" height="7"/>`).join('')}
    ${item('solarTowers', 0, 0, `<g transform="translate(334 132) scale(.5)">${solar(14, 6)}</g><g transform="translate(392 164)">${solar(9, 4)}</g>`, 'fade')}
  </g>
  <!-- energy: electricity flows from the power plant to the city along the wire -->
  <g class="powerline"><path d="M490 262 V318 M560 262 V318 M626 262 V318" stroke="#6b5a4a" stroke-width="3"/><path d="M484 262 H632 M484 262 L490 256 L496 262" stroke="#6b5a4a" stroke-width="2" fill="none"/>
    <path d="M478 266 Q522 274 560 266 Q596 274 652 270" stroke="#3a3f47" stroke-width="1.6" fill="none"/>
    <g data-k="energy" class="energy">${[0, 1, 2, 3].map((k) => `<circle cx="652" cy="269" r="3.4" style="animation-delay:${-k * 0.75}s"/>`).join('')}</g></g>
  <g class="plant">
    <g data-k="plantSmoke" class="plant-smoke">
      <g data-k="ps1" class="fade">${puffs(744, 214, 4, 9, '#9aa3ad', 5)}</g>
      <g data-k="ps2" class="fade hide">${puffs(744, 214, 4, 14, '#7f8893', 4.4)}</g>
      <g data-k="ps3" class="fade hide">${puffs(744, 214, 5, 20, '#6b737d', 4)}</g>
      <g data-k="ps4" class="fade hide">${puffs(744, 214, 5, 27, '#555c66', 3.6)}</g>
    </g>
    ${item('plantBurst', 0, 0, puffs(744, 214, 6, 24, '#4b525c', 2.2), 'fade')}
    <rect x="650" y="276" width="86" height="58" rx="3" fill="#a9b2bc"/><rect x="650" y="270" width="86" height="8" fill="#8a939d"/>
    <path d="M660 300 h24 v34 h-24Z" fill="#7d8691"/><rect class="win" x="694" y="288" width="12" height="10"/><rect class="win" x="712" y="288" width="12" height="10"/>
    <path d="M734 334 L738 216 L750 216 L754 334Z" fill="#f4f6f8"/><path d="M737 236 h14 M736 260 h16 M735 284 h18" stroke="#e63946" stroke-width="9"/>
    <path d="M668 288 l6 -9 l-2 6 h6 l-7 10 l2 -7Z" fill="#ffd23f"/>
  </g>

  <!-- the railway -->
  <rect x="-800" y="316" width="2600" height="6" fill="#8b7a68"/><path d="M-800 316 H1800" stroke="#4a5563" stroke-width="2"/>
  <g data-k="trains"><g class="trainrun" style="animation-duration:26s;animation-delay:-6s"><g transform="translate(0 316) scale(.95)">${TRAIN}</g></g>
    <g data-k="train2" class="fade hide"><g class="trainrun back" style="animation-duration:26s;animation-delay:-19s"><g transform="translate(0 316) scale(-.95 .95)">${TRAIN}</g></g></g></g>
  <g data-k="trainFx"></g>
  <g class="station">
    <rect x="188" y="321" width="90" height="9" fill="#c9c2b0"/><path d="M188 321 H278" stroke="#fff" stroke-width="2" opacity=".6"/>
    <path d="M196 321 V292 M270 321 V292" stroke="#6b5a4a" stroke-width="3"/><path d="M182 292 H284 L278 284 H188Z" fill="#e63946"/>
    <rect x="220" y="294" width="26" height="9" rx="2" fill="#2f80ed"/><path d="M226 300 h14" stroke="#fff" stroke-width="2"/>
  </g>

  <!-- trees in the background -->
  ${tree(22, 340, 0.62)}${tree(412, 336, 0.62)}${tree(508, 330, 0.55)}${tree(622, 338, 0.6)}${tree(782, 338, 0.62)}

  <!-- back row: the friend's house, thrift store, mall (and the paths in front of them) -->
  <!-- the streets up to the school, the station and the shops: asphalt, just like the main road -->
  <rect x="26" y="362" width="612" height="4" class="pave"/>
  <rect x="26" y="366" width="612" height="11" class="road"/><path d="M30 371.5 H214 M250 371.5 H634" stroke="#fff" stroke-width="1.1" stroke-dasharray="8 7" opacity=".8"/>
  <rect x="218" y="324" width="28" height="134" class="road"/><path d="M232 328 V364 M232 380 V440" stroke="#fff" stroke-width="1.1" stroke-dasharray="7 6" opacity=".8"/>
  <!-- parking bays on the street (school, station, shops) and bike racks -->
  <g class="bays" stroke="#fff" stroke-width="1.2" opacity=".85"><path d="M138 373.5 v4 M200 373.5 v4 M262 373.5 v4 M318 373.5 v4 M568 373.5 v4 M632 373.5 v4"/></g>
  <g fill="#fff" opacity=".8" font-size="6" font-weight="900" font-family="Arial, sans-serif"><text x="166" y="377">P</text><text x="287" y="377">P</text><text x="597" y="377">P</text></g>
  ${rack(126, 362, 'school')}${rack(252, 340, 'station')}${rack(596, 365, 'mall')}
  <!-- road signs: school crossing, which way to the station, parking at the mall -->
  <g class="signs">
    <path d="M196 362 V340" stroke="#6b7280" stroke-width="1.8"/><path d="M196 330 L204 338 L196 346 L188 338Z" fill="#ffd23f" stroke="#23313f" stroke-width="1"/><circle cx="194" cy="335.5" r="1.4" fill="#23313f"/><circle cx="198.5" cy="336.5" r="1.2" fill="#23313f"/><path d="M194 337 v4 M198.5 338 v3.4" stroke="#23313f" stroke-width="1.4"/>
    <path d="M642 362 V342" stroke="#6b7280" stroke-width="1.8"/><rect x="636" y="330" width="12" height="12" rx="2" fill="#2f80ed"/><text x="642" y="339.5" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Arial, sans-serif">P</text>
  </g>
  <!-- the recycling center (a reward) behind Bobo's house -->
  ${item('recycling', 322, 362, `<rect x="-24" y="-34" width="48" height="34" rx="3" fill="#2fb35a"/><path d="M-28 -34 H28 L24 -41 H-24Z" fill="#23863e"/>
      <g transform="translate(0 -18)" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"><path d="M-7 5 A8 8 0 0 1 -5 -7"/><path d="M5 -7 A8 8 0 0 1 8 4"/><path d="M4 8 A8 8 0 0 1 -7 7"/></g>
      <rect x="-22" y="-7" width="11" height="7" fill="#2f80ed"/><rect x="-6" y="-7" width="11" height="7" fill="#ffd23f"/><rect x="10" y="-7" width="11" height="7" fill="#9aa5b1"/>`)}
  <g class="school">
    <rect x="40" y="312" width="136" height="50" fill="#ffcf5a"/><rect x="36" y="306" width="144" height="7" rx="2" fill="#c98f4f"/>
    <path d="M90 306 V290 L108 276 L126 290 V306Z" fill="#ffcf5a" stroke="#c98f4f" stroke-width="3"/><circle cx="108" cy="292" r="7" fill="#fff" stroke="#23313f" stroke-width="1.5"/><path d="M108 292 V287 M108 292 h4" stroke="#23313f" stroke-width="1.5"/>
    ${[50, 70, 136, 156].map((x) => `<rect class="win" x="${x}" y="320" width="13" height="12" rx="1"/><rect class="win" x="${x}" y="340" width="13" height="12" rx="1"/>`).join('')}
    <rect x="98" y="336" width="20" height="26" fill="#2f80ed"/><path d="M108 336 V362" stroke="#1d5fae" stroke-width="2"/>
    <text x="108" y="328" text-anchor="middle" font-size="9" font-weight="900" fill="#c0392b">A B C</text>
    <path d="M108 276 V264" stroke="#9aa5b1" stroke-width="2"/><path d="M109 264 l12 4 l-12 4Z" fill="#ff6fa8" class="flag"/>
    ${item('solarSchool', 46, 296, solar(10, 3), 'fade')}
    ${item('swapBox', 74, 362, `<rect x="-12" y="-14" width="24" height="14" rx="2" fill="#c98f4f" stroke="#8b5a2b" stroke-width="1.5"/><circle cx="-5" cy="-17" r="4" fill="#ff5b4a"/><rect x="0" y="-22" width="8" height="8" fill="#2f80ed"/><path d="M-9 -7 h18" stroke="#fff" stroke-width="2"/>`)}
  </g>
  <g class="thrift">
    <rect x="424" y="324" width="76" height="38" fill="#b388ff"/><rect x="420" y="308" width="84" height="15" rx="3" fill="#7e57c2"/>
    <path d="M454 320 q8 -9 16 0 M462 311 v4" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M450 320 h24" stroke="#fff" stroke-width="2.2"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((k) => `<path d="M${422 + k * 12} 323 h12 v6 q-6 5 -12 0Z" fill="${k % 2 ? '#fff' : '#ff6fa8'}"/>`).join('')}
    <rect class="win" x="430" y="336" width="20" height="18" rx="2"/><path d="M434 340 l3 -2 h6 l3 2 l-2 3 v8 h-8 v-8Z" fill="#2fb35a"/>
    <rect x="455" y="338" width="16" height="24" fill="#5e35b1"/><rect class="win" x="476" y="336" width="18" height="18" rx="2"/>
    ${item('clothesRack', 505, 362, `<path d="M-14 0 V-24 H14 V0" stroke="#6b5a4a" stroke-width="2" fill="none"/><path d="M-11 -24 l-2 4 v12 h8 v-12 l-2 -4Z" fill="#ff6fa8"/><path d="M-1 -24 l-2 4 v12 h8 v-12 l-2 -4Z" fill="#ffd23f"/><path d="M8 -24 l-2 4 v12 h7 v-12 l-2 -4Z" fill="#2f80ed"/>`)}
  </g>
  <g class="mall">
    <rect x="514" y="300" width="120" height="62" fill="#8fb3d9"/><rect x="510" y="294" width="128" height="8" rx="2" fill="#6f93b9"/>
    <rect x="548" y="304" width="52" height="15" rx="4" fill="#ff5b4a"/><path d="M566 309 h16 l-2 8 h-12Z M569 309 q5 -7 10 0" fill="none" stroke="#fff" stroke-width="2"/>
    ${[520, 538, 600, 618].map((x) => `<rect class="win" x="${x}" y="324" width="12" height="14" rx="1"/>`).join('')}
    <rect x="560" y="330" width="28" height="32" fill="#cfefff" stroke="#6f93b9" stroke-width="2"/><path d="M574 330 V362" stroke="#6f93b9" stroke-width="2"/>
    <text x="609" y="355" font-size="9" font-weight="900" fill="#fff">SALE</text>
  </g>
  ${tree(640, 340, 0.75)}
  <!-- a nest at the top of the tree; the chicks are gone when it gets too hot -->
  <g transform="translate(636 296)">${NEST.replace('MOM', songbird(0, 0, '#ff5b4a', 0))}</g>
  ${item('cows', 0, 0, `<path d="M652 362 V348 M752 362 V348 M652 351 H752 M652 357 H752" stroke="#a0673a" stroke-width="2"/>
      <g transform="translate(676 362) scale(.8)">${cow(0, 0, false)}</g><g transform="translate(718 360) scale(.8)">${cow(0, 0, true)}</g>
      <g class="cow-gas">${puffs(660, 340, 3, 5, '#a6b48a', 3)}</g>`)}

  <!-- the bike group (a reward): Bobo's two friends ride to school together -->
  <g data-k="bikeFriends" class="fade hide"><g class="to-school"><g transform="translate(0 376) scale(-.27 .27)">${sideRider('#d4a24c', '#ffd23f')}</g>
    <g transform="translate(26 377) scale(-.27 .27)">${sideRider('#b0602e', '#2fb35a')}</g></g></g>
  <g data-k="backFx"></g>
  <!-- Bobo walks here while in the back row (so the houses stay in front of Bobo) -->
  <g data-k="backLayer"></g>

  <!-- front row: the houses, the garden, the park (drawn 20 lower than the numbers inside) -->
  <g transform="translate(0 20)">
  <!-- Bobo's driveway, to the right of the house (the family car parks at the top) -->
  <path d="M416 438 V392 Q416 388 420 388 H448 Q452 388 452 392 V438Z" class="road"/>
  <rect x="14" y="426" width="772" height="12" class="pave"/>
  <!-- a zebra crossing where the little street meets the main road -->
  <path d="M221 428 v8 M226 428 v8 M231 428 v8 M236 428 v8 M241 428 v8" stroke="#fff" stroke-width="3" opacity=".85"/>
  ${item('parkedCar', 434, 422, `<g transform="scale(.94)">${carRear('#e63946')}</g>`, 'fade', false)}
  <!-- a second friend's house, on the far left -->
  <g class="friend-house">
    <rect x="30" y="392" width="64" height="34" fill="#bde3a0"/><path d="M22 394 L62 362 L102 394Z" fill="#3fa08f"/>
    <rect class="win" x="37" y="401" width="15" height="12" rx="1"/><rect class="win" x="74" y="401" width="14" height="12" rx="1"/><rect x="56" y="404" width="12" height="22" fill="#8b5a2b"/>
  </g>
  <g class="friend-house">
    <rect x="132" y="388" width="68" height="38" fill="#ffb3c7"/><path d="M124 390 L166 356 L208 390Z" fill="#c94f6d"/>
    <rect class="win" x="139" y="398" width="16" height="13" rx="1"/><rect class="win" x="178" y="398" width="15" height="13" rx="1"/><rect x="160" y="402" width="13" height="24" fill="#8b5a2b"/>
    ${item('solarHeater', 172, 371, `<g transform="rotate(39)"><rect x="-4" y="-6" width="22" height="9" rx="1" fill="#2f5d9e" stroke="#9cc3ff"/><rect x="2" y="-13" width="12" height="7" rx="3" fill="#dfe5ea"/></g>`)}
  </g>
  ${lamp(212, 432, true)}
  <g data-k="boboHouse" class="bobo-house">
    <rect x="290" y="374" width="120" height="52" fill="#7fd3f7"/><path d="M290 374 H410" stroke="#5fb3d7" stroke-width="3"/>
    <rect x="386" y="340" width="13" height="26" fill="#c0392b"/>
    <path d="M280 377 L350 334 L420 377Z" fill="#ff8c42"/><path d="M280 377 L350 334 L420 377" stroke="#e06b28" stroke-width="3" fill="none"/>
    ${item('houseSmoke', 0, 0, puffs(392, 334, 4, 9, '#8a8f98', 4), 'fade')}
    <rect class="win hw" x="300" y="386" width="28" height="20" rx="2"/><rect class="win hw" x="372" y="386" width="28" height="20" rx="2"/>
    ${item('houseLit', 0, 0, `<rect x="300" y="386" width="28" height="20" rx="2" fill="#ffe27a"/><rect x="372" y="386" width="28" height="20" rx="2" fill="#ffe27a"/>`, 'fade')}
    <path d="M314 386 V406 M300 396 H328 M386 386 V406 M372 396 H400" stroke="#fff" stroke-width="2"/>
    ${item('tv', 0, 0, `<rect x="303" y="390" width="14" height="9" rx="1" fill="#6fd0ff" class="tv-flicker"/>`, 'fade')}
    <rect x="341" y="396" width="18" height="30" rx="2" fill="#8b5a2b"/><circle cx="355" cy="412" r="1.6" fill="#ffd23f"/>
    ${item('solarRoof', 0, 0, `<g transform="translate(356 341) rotate(31.5)">${solar(11, 4)}</g><g transform="translate(296 368) rotate(-31.5)">${solar(11, 3)}</g>`, 'fade')}
    ${item('acUnit', 0, 0, `<rect x="276" y="400" width="18" height="14" rx="2" fill="#dfe5ea" stroke="#9aa5b1" stroke-width="1.5"/><path d="M279 404 h12 M279 408 h12" stroke="#9aa5b1" stroke-width="1.5"/>`, 'fade')}
    ${item('acAir', 0, 0, `<g class="ac-air" transform="translate(696 0) scale(-1 1)"><path d="M426 404 q8 -3 16 0 M426 410 q9 -3 18 0"/></g>`, 'fade')}
    ${item('fan', 384, 426, `<path d="M0 0 V-18" stroke="#4a5563" stroke-width="2.5"/><ellipse cx="0" cy="0" rx="7" ry="2" fill="#4a5563"/><circle cx="0" cy="-24" r="9" fill="none" stroke="#4a5563" stroke-width="1.5"/>
      <g transform="translate(0 -24)"><g class="spin fast-spin"><path d="M0 0 L-3 -8 L3 -8Z M0 0 L-3 8 L3 8Z M0 0 L-8 -3 L-8 3Z M0 0 L8 -3 L8 3Z" fill="#7fd3f7"/></g></g>`)}
    ${item('steam', 0, 0, puffs(386, 388, 4, 8, '#ffffff', 2), 'fade')}
    ${item('bathBubbles', 0, 0, `<g class="bubbles-up">${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<circle cx="${376 + (k % 4) * 9}" cy="392" r="${4 + (k % 3) * 2}" fill="#ffffffcc" stroke="#4fb0d8" stroke-width="1.5" style="animation-delay:${-k * 0.3}s"/>`).join('')}</g>`, 'fade')}
    ${item('boxClosed', 400, 436, `<path d="M-13 0 V-17 H13 V0Z" fill="#c98f4f" stroke="#8b5a2b" stroke-width="1.5"/><path d="M-13 -17 H13 L10 -21 H-10Z" fill="#d9a36a" stroke="#8b5a2b" stroke-width="1.5"/><path d="M0 -21 V0" stroke="#e6c27a" stroke-width="3"/><path d="M-9 -8 h6" stroke="#8b5a2b" stroke-width="1.2"/>`)}
    ${item('boxPile', 400, 436, `<path d="M-13 0 V-17 H13 V0Z" fill="#c98f4f" stroke="#8b5a2b" stroke-width="1.5"/><path d="M-13 -17 L-21 -24 L-12 -22Z M13 -17 L21 -24 L12 -22Z" fill="#d9a36a" stroke="#8b5a2b" stroke-width="1.5"/>
      <circle cx="-6" cy="-18" r="2.2" fill="#fff"/><circle cx="-1" cy="-19.5" r="2.2" fill="#f4f6f8"/><circle cx="5" cy="-18" r="2.2" fill="#fff"/><path d="M-26 0 q4 -6 9 -2 q3 2 6 0" stroke="#dfe5ea" stroke-width="3" fill="none" stroke-linecap="round"/>`)}
  </g>
  ${item('shadeTrees', 0, 0, `${tree(270, 434, 0.95)}${tree(608, 434, 0.9)}`)}
  <g class="garden">
    <path d="M466 420 H544 M472 420 L466 434 M538 420 L544 434 M476 420 V434 M534 420 V434" stroke="#8b5a2b" stroke-width="3.5"/>
    ${item('balloons', 0, 0, `<g class="balloon"><path d="M464 418 Q452 400 446 382" stroke="#fff" stroke-width="1.2" fill="none"/><ellipse cx="445" cy="373" rx="9" ry="11" fill="#ff5b4a"/></g>
      <g class="balloon" style="animation-delay:-1s"><path d="M464 418 Q444 406 432 394" stroke="#fff" stroke-width="1.2" fill="none"/><ellipse cx="430" cy="386" rx="8" ry="10" fill="#ffd23f"/></g>
      <g class="balloon" style="animation-delay:-2s"><path d="M546 418 Q560 400 566 382" stroke="#fff" stroke-width="1.2" fill="none"/><ellipse cx="567" cy="373" rx="9" ry="11" fill="#2f80ed"/></g>`)}
    ${item('sortBins', 0, 0, `<rect x="560" y="420" width="10" height="14" rx="1.5" fill="#2fb35a"/><rect x="573" y="420" width="10" height="14" rx="1.5" fill="#2f80ed"/><rect x="586" y="420" width="10" height="14" rx="1.5" fill="#ffd23f"/>
      <path d="M559 420 h12 M572 420 h12 M585 420 h12" stroke="#23313f" stroke-width="2"/>`)}
    ${item('trashBag', 572, 436, `<path d="M-10 0 Q-14 -14 -4 -18 L-2 -22 L4 -22 L5 -18 Q14 -14 10 0Z" fill="#3a3f47"/><path d="M-2 -22 l-3 -4 M4 -22 l3 -4" stroke="#3a3f47" stroke-width="2"/>`)}
    ${item('trashPile', 0, 0, `<path d="M560 436 Q556 420 566 418 L568 414 L573 414 L574 418 Q584 422 580 436Z" fill="#3a3f47"/><path d="M576 436 Q574 424 584 422 L586 418 L591 418 L592 422 Q600 426 596 436Z" fill="#4a5060"/>
      <rect x="586" y="428" width="8" height="5" fill="#ff5b4a" transform="rotate(-20 590 430)"/><g class="trash-flies">${flies(578, 410)}</g>`, 'fade')}
  </g>
  ${lamp(462, 432)}
  <g class="park">
    <rect x="618" y="392" width="22" height="40" rx="3" fill="#e63946"/><rect x="622" y="397" width="14" height="20" rx="1" fill="#cfefff"/>
    ${[0, 1, 2].map((r) => `<rect x="624" y="${399 + r * 6}" width="4" height="4" fill="#2f80ed"/><rect x="630" y="${399 + r * 6}" width="4" height="4" fill="#ff6fa8"/>`).join('')}
    <rect x="625" y="421" width="8" height="4" fill="#23313f"/>
    <path d="M692 432 V414" stroke="#9aa5b1" stroke-width="5"/><path d="M682 414 H702 Q702 420 692 420 Q682 420 682 414Z" fill="#9aa5b1"/><path d="M692 414 Q694 404 699 410" stroke="#7fd3f7" stroke-width="2" fill="none"/>
    ${bush(722, 432, 0.8)}<ellipse cx="760" cy="437" rx="24" ry="4.5" fill="#23313f" opacity=".16"/>${tree(770, 436, 0.85)}
  </g>
  ${item('veggieGarden', 0, 0, `<rect x="708" y="440" width="78" height="10" rx="3" fill="#8b5a2b"/>${[714, 730, 746, 762, 778].map((x, k) =>
    `<g transform="translate(${x} 441)"><path d="M0 0 q-6 -8 -2 -14 M0 0 q6 -8 2 -14 M0 0 V-12" stroke="#3d9a2e" stroke-width="2.4" fill="none"/>${k % 2 ? '<circle cx="0" cy="-2" r="3" fill="#ff8c42"/>' : '<circle cx="0" cy="-6" r="5" fill="#7fe06a"/>'}</g>`).join('')}
      ${flower(704, 438, '#ff6fa8')}${bee(728, 416, 0)}${bee(760, 420, -1.4)}`)}

  ${rack(288, 426, 'home')}
  <!-- pigeons pecking on the pavement (behind the road, so the cars drive in front of them) -->
  <g data-k="pigeons" class="fade">${pigeon(234, 435, false, 0)}${pigeon(596, 436, true, -1.1)}</g>
  <!-- the toy in front of Bobo's house -->
  ${item('toyBroken', 384, 436, `<g transform="rotate(-14)"><path d="M-14 -10 h28 v8 h-28Z" fill="#ff5b4a"/><circle cx="-8" cy="0" r="4" fill="#23313f"/></g><circle cx="12" cy="0" r="4" fill="#23313f"/><path d="M2 -14 l3 -4 l2 4" stroke="#23313f" stroke-width="1.5" fill="none"/>`)}
      ${item('toyFixed', 384, 436, `<path d="M-14 -10 h28 v8 h-28Z" fill="#ff5b4a"/><path d="M-6 -16 h12 v6 h-12Z" fill="#cfefff"/><circle cx="-8" cy="0" r="4" fill="#23313f"/><circle cx="8" cy="0" r="4" fill="#23313f"/><path d="M-2 -6 h4" stroke="#ffd23f" stroke-width="3"/>`)}
      ${item('toyNew', 384, 436, `<path d="M-14 -10 h28 v8 h-28Z" fill="#2f80ed"/><path d="M-6 -16 h12 v6 h-12Z" fill="#cfefff"/><circle cx="-8" cy="0" r="4" fill="#23313f"/><circle cx="8" cy="0" r="4" fill="#23313f"/>`)}
  </g>

  <!-- Bobo -->
  <g data-k="midLayer"><g data-k="walkerWrap" transform="translate(400 400)"><g class="walker"><g transform="${MONKEY_FIT}"><g data-k="monkey"><g class="mjump"><g class="bob">
    <path d="M16 12 C46 14 52 -18 34 -26 C26 -28 24 -18 32 -16" stroke="#7a4a24" stroke-width="6" fill="none" stroke-linecap="round"/>
    <g data-k="mPack" class="fade hide"><rect x="-29" y="-20" width="58" height="38" rx="10" fill="#ff6b4a"/><rect x="-29" y="2" width="10" height="10" rx="2" fill="#e04f30"/><rect x="19" y="2" width="10" height="10" rx="2" fill="#e04f30"/></g>
    <ellipse cx="-11" cy="24" rx="9" ry="6" fill="#7a4a24"/><ellipse cx="11" cy="24" rx="9" ry="6" fill="#7a4a24"/>
    <ellipse cx="0" cy="0" rx="22" ry="26" fill="#8b5a2b"/>
    <ellipse cx="0" cy="6" rx="13" ry="16" fill="#e8c39e"/>
    <g data-k="mMud" class="fade hide"><circle cx="-8" cy="8" r="5" fill="#6b4423"/><circle cx="7" cy="-6" r="4" fill="#6b4423"/><circle cx="4" cy="16" r="3.5" fill="#6b4423"/><circle cx="-14" cy="-10" r="3" fill="#6b4423"/></g>
    <g data-k="mStraps" class="fade hide"><path d="M-13 -22 V10 M13 -22 V10" stroke="#e04f30" stroke-width="5" stroke-linecap="round"/></g>
    <path d="M-18 -8 Q-34 6 -24 20" stroke="#8b5a2b" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M18 -8 Q34 6 24 20" stroke="#8b5a2b" stroke-width="9" fill="none" stroke-linecap="round"/>
    <g data-k="mSweater" class="fade hide"><ellipse cx="0" cy="2" rx="23.5" ry="26" fill="#4f8fd6"/><path d="M-21 -4 H21 M-23 6 H23" stroke="#fff" stroke-width="3" opacity=".85"/><path d="M-10 -24 Q0 -16 10 -24" stroke="#2f6fb5" stroke-width="4" fill="none"/>
      <path d="M-18 -8 Q-32 4 -25 16 M18 -8 Q32 4 25 16" stroke="#4f8fd6" stroke-width="10.5" fill="none" stroke-linecap="round"/></g>
    <g data-k="mJacketCool" class="fade hide"><ellipse cx="0" cy="2" rx="23.5" ry="26" fill="#2fb35a"/><path d="M0 -24 V26" stroke="#ffd23f" stroke-width="2.5"/><circle cx="-11" cy="8" r="4.5" fill="#ff6fa8"/><path d="M8 -6 l6 0 l-3 6Z" fill="#ffd23f"/>
      <path d="M-18 -8 Q-32 4 -25 16 M18 -8 Q32 4 25 16" stroke="#2fb35a" stroke-width="10.5" fill="none" stroke-linecap="round"/><path d="M-10 -24 L0 -14 L10 -24" stroke="#23863e" stroke-width="3.5" fill="none"/></g>
    <g data-k="mJacketPlain" class="fade hide"><ellipse cx="0" cy="2" rx="23.5" ry="26" fill="#a3adb8"/><path d="M0 -24 V26" stroke="#7d8691" stroke-width="2"/>
      <path d="M-18 -8 Q-32 4 -25 16 M18 -8 Q32 4 25 16" stroke="#a3adb8" stroke-width="10.5" fill="none" stroke-linecap="round"/></g>
    <g data-k="mBottle" class="fade hide"><g transform="translate(26 14) rotate(-10)"><rect x="-5" y="-18" width="10" height="20" rx="4" fill="#2fb35a"/><rect x="-3" y="-23" width="6" height="5" rx="1" fill="#1d8f43"/><circle cx="0" cy="-8" r="2.5" fill="#ffd23f"/></g></g>
    <g data-k="mPlastic" class="fade hide"><g transform="translate(26 14) rotate(-10)">${bottle(0, 2, 0, 1.1)}</g></g>
    <g data-k="mGlass" class="fade hide"><g transform="translate(26 12)"><path d="M-5 -14 h10 l-1.5 15 h-7Z" fill="#cfefff" stroke="#7fd3f7" stroke-width="1.5"/><rect x="-4" y="-8" width="8" height="8" fill="#7fd3f7" opacity=".6"/></g></g>
    <g data-k="mCarry" class="fade hide"><g transform="translate(-26 10) rotate(8)"><path d="M-10 -12 h20 l3 22 h-26Z" fill="#2fb35a" stroke="#1d8f43" stroke-width="2"/><circle cx="-3" cy="2" r="3.6" fill="#ff6fa8"/><path d="M4 -6 l5 0 l-2.5 5Z" fill="#ffd23f"/></g></g>
    <g class="umbrella"><path d="M14 18 L4 -86" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/><path d="M-44 -78 Q2 -118 48 -78 Q36 -85 25 -78 Q14 -85 2 -78 Q-10 -85 -21 -78 Q-32 -85 -44 -78Z" fill="#ff5b4a" stroke="#c0392b" stroke-width="2.5" stroke-linejoin="round"/><path d="M2 -78 Q4 -100 2 -112 M-21 -78 Q-14 -98 0 -110 M25 -78 Q18 -98 4 -110" stroke="#c0392b" stroke-width="1.6" fill="none"/></g>
    <g data-k="mBag" class="fade hide"><g transform="translate(-27 16)"><rect x="-8" y="-8" width="16" height="16" rx="1.5" fill="#ff5b4a"/><path d="M-4 -8 q4 -7 8 0" stroke="#c0392b" stroke-width="2" fill="none"/></g></g>
    <g transform="translate(0 -40)">
      <circle cx="-26" cy="0" r="10" fill="#8b5a2b"/><circle cx="-26" cy="0" r="6" fill="#e8c39e"/>
      <circle cx="26" cy="0" r="10" fill="#8b5a2b"/><circle cx="26" cy="0" r="6" fill="#e8c39e"/>
      <circle cx="0" cy="0" r="26" fill="#8b5a2b"/>
      <ellipse cx="0" cy="8" rx="18" ry="14" fill="#e8c39e"/>
      <circle cx="-8" cy="-4" r="9" fill="#e8c39e"/><circle cx="8" cy="-4" r="9" fill="#e8c39e"/>
      <g class="eyes"><circle cx="-7" cy="-4" r="3.6" fill="#23313f"/><circle cx="7" cy="-4" r="3.6" fill="#23313f"/>
      <circle cx="-6" cy="-5.5" r="1.2" fill="#fff"/><circle cx="8" cy="-5.5" r="1.2" fill="#fff"/></g>
      ${SHADES}
      <circle cx="-2.5" cy="5" r="1.4" fill="#5a2d0c"/><circle cx="2.5" cy="5" r="1.4" fill="#5a2d0c"/>
      <g data-k="mHappy" class="fade mood"><path d="M-9 10 Q0 21 9 10 Z" fill="#5a2d0c"/><path d="M-5 14 Q0 18 5 14" fill="#ff8fa3"/><circle cx="-15" cy="6" r="4" fill="#ff9aa2" opacity=".6"/><circle cx="15" cy="6" r="4" fill="#ff9aa2" opacity=".6"/></g>
      <g data-k="mMeh" class="fade hide mood"><path d="M-7 13 Q0 15 7 13" stroke="#5a2d0c" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>
      <g data-k="mSad" class="fade hide mood"><path d="M-8 16 Q0 8 8 16" stroke="#5a2d0c" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M-12 2 q-3 6 0 8 q3 -2 0 -8Z" fill="#7cc9ef"/></g>
      <g data-k="mMudFace" class="fade hide"><circle cx="14" cy="-14" r="4" fill="#6b4423"/><circle cx="-16" cy="8" r="3" fill="#6b4423"/></g>
      <g data-k="mHat" class="fade hide"><path d="M-15 -20 L5 -66 L17 -16Z" fill="#ff6fa8"/><path d="M-9 -32 L13 -28 M-3 -46 L10 -43" stroke="#fff" stroke-width="3"/><circle cx="5" cy="-66" r="5" fill="#ffd23f"/></g>
      <!-- reactions (shown by Scene.react) -->
      <g class="r r-yay"><path d="M-11 -3 q4 -6 8 0 M3 -3 q4 -6 8 0" stroke="#23313f" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M-10 9 Q0 25 10 9Z" fill="#5a2d0c"/><path d="M-5 15 Q0 20 5 15" fill="#ff8fa3"/>
        <path class="heart" d="M32 -30 c-3 -6 -11 -2 -6 4 l6 6 l6 -6 c5 -6 -3 -10 -6 -4Z" fill="#ff5a7a"/><path class="heart" style="animation-delay:-.4s" d="M-34 -24 c-2 -4 -8 -1 -4 3 l4 4 l4 -4 c4 -4 -2 -7 -4 -3Z" fill="#ff5a7a"/></g>
      <g class="r r-scared"><circle cx="-8" cy="-4" r="7" fill="#fff" stroke="#23313f" stroke-width="1.5"/><circle cx="8" cy="-4" r="7" fill="#fff" stroke="#23313f" stroke-width="1.5"/>
        <circle cx="-8" cy="-4" r="2.6" fill="#23313f"/><circle cx="8" cy="-4" r="2.6" fill="#23313f"/><ellipse cx="0" cy="14" rx="5" ry="6" fill="#5a2d0c"/>
        <text x="30" y="-22" font-size="24" font-weight="900" fill="#ff5b4a">!</text></g>
      <g class="r r-cold"><rect x="-8" y="10" width="16" height="7" rx="2" fill="#fff" stroke="#5a2d0c" stroke-width="1.5"/><path d="M-4 10 v7 M0 10 v7 M4 10 v7" stroke="#5a2d0c" stroke-width="1"/>
        <circle cx="-15" cy="6" r="4.5" fill="#8fc8ff" opacity=".85"/><circle cx="15" cy="6" r="4.5" fill="#8fc8ff" opacity=".85"/>
        <g transform="translate(34 -26)" stroke="#8fc8ff" stroke-width="2" stroke-linecap="round"><path d="M0 -6 V6 M-5.2 -3.0 L5.2 3.0 M-5.2 3.0 L5.2 -3.0"/></g><g transform="translate(-37 -19)" stroke="#8fc8ff" stroke-width="2" stroke-linecap="round"><path d="M0 -5 V5 M-4.3 -2.5 L4.3 2.5 M-4.3 2.5 L4.3 -2.5"/></g></g>
      <g class="r r-hot"><path d="M-7 13 q3.5 -3 7 0 t7 0" stroke="#5a2d0c" stroke-width="2.4" fill="none"/><path class="drip" d="M20 -18 q-4 7 0 9 q4 -2 0 -9Z M-22 -12 q-3 5 0 7 q3 -2 0 -7Z" fill="#6fc3f5"/></g>
      <g class="r r-sad"><path d="M-8 16 Q0 8 8 16" stroke="#5a2d0c" stroke-width="2.5" fill="none" stroke-linecap="round"/><path class="drip" d="M-12 2 q-3 6 0 8 q3 -2 0 -8Z M12 2 q-3 6 0 8 q3 -2 0 -8Z" fill="#7cc9ef"/></g>
      <g class="r r-think"><circle cx="4" cy="13" r="2.8" fill="#5a2d0c"/><text x="28" y="-22" font-size="24" font-weight="900" fill="#2f80ed">?</text></g>
    </g>
  </g></g></g></g>
    <g data-k="mRide" class="fade hide"><g class="ride-dir" transform="scale(.42 .42)"><g class="rv-back">${backRider('#8b5a2b')}</g><g class="rv-front" style="display:none">${frontRider('#8b5a2b', null, true)}</g></g></g>
  </g></g></g>
  <g data-k="buddies"></g>
  <!-- the table top and what's on it are drawn in front of Bobo (Bobo stands behind the table) -->
  <g class="garden-top" transform="translate(0 20)"><rect x="462" y="416" width="86" height="5" rx="2" fill="#c98f4f"/>
    ${item('partyCloth', 0, 0, `<path d="M460 414 H550 V424 q-6 5 -11 0 q-6 5 -11 0 q-6 5 -12 0 q-6 5 -11 0 q-6 5 -12 0 q-6 5 -11 0 q-6 5 -11 0 q-6 5 -11 0Z" fill="#ff8ad8"/>`, 'fade')}
    ${item('cake', 505, 414, `<rect x="-11" y="-12" width="22" height="12" rx="2" fill="#fff0f5" stroke="#ff8ad8" stroke-width="1.5"/><path d="M-11 -7 q4 3 7 0 q4 3 7 0 q4 3 8 0" stroke="#ff8ad8" stroke-width="1.5" fill="none"/>
      <path d="M-4 -12 v-6 M4 -12 v-6" stroke="#2f80ed" stroke-width="2"/><g class="flicker"><circle cx="-4" cy="-20" r="2" fill="#ffb627"/></g><g class="flicker"><circle cx="4" cy="-20" r="2" fill="#ffb627"/></g>`)}
    ${item('platesReal', 0, 0, `<ellipse cx="482" cy="414" rx="8" ry="2.6" fill="#fff" stroke="#2f80ed" stroke-width="1.5"/><ellipse cx="530" cy="414" rx="8" ry="2.6" fill="#fff" stroke="#2f80ed" stroke-width="1.5"/>
      <rect x="490" y="405" width="6" height="9" rx="1" fill="#fff" stroke="#2fb35a" stroke-width="1.3"/><rect x="515" y="405" width="6" height="9" rx="1" fill="#fff" stroke="#2fb35a" stroke-width="1.3"/>`)}
    ${item('platesPlastic', 0, 0, `<ellipse cx="482" cy="414" rx="8" ry="2.6" fill="#ffb627"/><ellipse cx="530" cy="414" rx="8" ry="2.6" fill="#7fe06a"/>
      <path d="M489 404 h7 l-1 10 h-5Z" fill="#ff5b4a"/><path d="M515 404 h7 l-1 10 h-5Z" fill="#2f80ed"/><path d="M493 404 l3 -7 M519 404 l3 -7" stroke="#ff8ad8" stroke-width="1.5"/>`)}
    ${item('tacos', 0, 0, `<ellipse cx="505" cy="414" rx="14" ry="3.6" fill="#fff" stroke="#2fb35a" stroke-width="1.5"/><path d="M494 412 q6 -14 12 0Z" fill="#ffcf5a" stroke="#d9a33a"/><path d="M504 412 q6 -14 12 0Z" fill="#ffcf5a" stroke="#d9a33a"/>
      <circle cx="499" cy="407" r="2" fill="#7fe06a"/><circle cx="509" cy="407" r="2" fill="#ff5b4a"/><circle cx="511" cy="409" r="1.6" fill="#8b5a2b"/>`)}
    ${item('burger', 505, 414, `<ellipse cx="0" cy="0" rx="14" ry="3.6" fill="#fff" stroke="#c94f4f" stroke-width="1.5"/><path d="M-9 -3 q9 -14 18 0Z" fill="#e0a64a"/><rect x="-10" y="-4" width="20" height="3" rx="1" fill="#7fe06a"/><rect x="-10" y="-2" width="20" height="3" rx="1" fill="#7a3b1e"/>`)}
  </g>

  <!-- the road + bike lane in front (they go over the bridges to the other towns) -->
  <g transform="translate(0 20)">
  <rect x="-800" y="438" width="2600" height="21" class="road"/><path d="M-800 448.5 H1800" stroke="#fff" stroke-width="2" stroke-dasharray="14 12" opacity=".8"/>
  <path d="M-800 437.5 H1800 M-800 459.5 H1800" stroke="#c8cdd3" stroke-width="2"/>
  <rect x="-800" y="459" width="2600" height="9" fill="#4c9a6a"/><path d="M-800 459.5 H1800" stroke="#fff" stroke-width="1.6"/><path d="M-800 468 H1800" stroke="#c8cdd3" stroke-width="2"/>
  ${[100, 300, 500, 700].map((x) => `<g transform="translate(${x} 465.5) scale(.12)" opacity=".6"><circle cx="-28" cy="0" r="14" fill="none" stroke="#fff" stroke-width="7"/><circle cx="28" cy="0" r="14" fill="none" stroke="#fff" stroke-width="7"/><path d="M-28 0 L-6 0 L10 -18 L28 0" stroke="#fff" stroke-width="7" fill="none"/></g>`).join('')}
  <g data-k="traffic">${laneCar('A', '#ff6fa8', 15, -2, '#a0673a')}${laneCar('B', '#2f80ed', 13, -7, '#5c3a1e')}</g>
  <g data-k="traffic2" class="fade hide">${laneCar('A', '#ffb627', 15, -9.5, '#7a4a24')}${laneCar('B', '#9aa5b1', 13, -1, '#c08850')}</g>
  <g data-k="traffic3" class="fade hide">${laneCar('A', '#7d5fff', 15, -6, '#5c3a1e')}${laneCar('B', '#2fb35a', 13, -10.5, '#a0673a')}${laneCar('A', '#1fa7a0', 15, -13, '#7a4a24')}</g>
  <g data-k="cyclists" class="fade hide">${rider('#8d8f94', '#ffd23f', -3, 16)}</g>
  </g>
  <g data-k="roadFx"></g>

  <!-- the beach + the sea in front -->
  <g transform="translate(0 24)">
  <g class="pebbles">${PEBBLES}</g>
  ${item('beachTrash', 0, 0, `${bottle(612, 482, 80, 1.1)}${bottle(640, 480, -60, 1.1)}<path d="M582 482 l10 -3 l2 5Z" fill="#ff6fa8"/>`, 'fade')}
  ${item('beachTurtle', 652, 480, `<g class="float">${turtle(0, 0, 0.8)}</g>`)}
  <g data-k="crabs" class="fade">${crab(150, 484, 0)}${crab(470, 486, -5)}</g>
  </g>
  <!-- the harbor: a wooden pier with a crane -->
  <g class="harbor">
    <path d="M700 512 H724 V566 H700Z" fill="#b5773f"/><path d="M700 520 H724 M700 530 H724 M700 540 H724 M700 550 H724 M700 560 H724" stroke="#8b5a2b" stroke-width="1.2"/>
    <path d="M703 566 V578 M721 566 V578" stroke="#6b4423" stroke-width="3"/>
    <path d="M708 548 V498 L742 498 M708 512 L722 498 M742 498 V512" stroke="#ffb627" stroke-width="3" fill="none"/><rect x="738" y="512" width="8" height="6" fill="#555b63"/>
  </g>
  <g data-k="reef" class="reef">${reef(110, 604, 0.7, 'staghorn', 'brain', 'anemone', 'a', 'd', 'b')}${reef(700, 610, 0.65, 'fan', 'tube', 'brain', 'c', 'b', 'e')}</g>
  <g data-k="fish">
    <g class="swim" style="animation-duration:34s"><g transform="translate(0 562) scale(.6)">${fish()}</g></g>
    <g class="swim" style="animation-delay:-14s;animation-duration:40s"><g transform="translate(0 574) scale(.45)">${fish('#ffd23f')}</g></g>
    <g class="swim" style="animation-delay:-24s;animation-duration:30s"><g transform="translate(0 616) scale(.55)">${fish('#ff6fa8')}</g></g>
  </g>
  <g data-k="seaTurtle" class="fade"><g class="swim" style="animation-duration:75s;animation-delay:-50s"><g transform="translate(0 600) scale(1.1)"><g class="float">${turtle(0, 0, 1)}</g></g></g></g>
  ${item('seaBottles', 0, 0, [[52, 548, 80], [735, 556, -60], [300, 570, 100], [560, 560, 30]].map(([x, y, r], k) =>
    `<g class="wander" style="--wx:${k % 2 ? -1 : 1};animation-duration:${34 + k * 6}s;animation-delay:${-k * 9}s"><g class="float" style="animation-delay:-${k}s">${bottle(x, y, r, 1.3)}</g></g>`).join(''), 'fade')}
  <g data-k="boats" class="fade">
    <g class="sail" style="animation-duration:90s;animation-delay:-30s"><g transform="translate(0 566) scale(.8)">${sailboat('#2f80ed', '#a0673a')}</g></g>
    <g class="sail" style="animation-duration:120s;animation-delay:-85s"><g transform="translate(0 598)">${sailboat('#ff5b4a', '#7a4a24')}</g></g>
  </g>
  ${item('whale', 600, 584, WHALE)}

  <!-- animals and bugs (they come and go with the climate) -->
  <g data-k="butterflies" class="fade">${butterfly(660, 410, '#ff8ad8', 0)}${butterfly(588, 404, '#ffd23f', -5)}${butterfly(742, 414, '#8fd3ff', -9)}</g>
  <g data-k="songbirds" class="fade">${songbird(164, 377, '#ff5b4a', 0)}${songbird(350, 355, '#2f80ed', -1.2)}${songbird(704, 432, '#ffb627', -2.2)}</g>
  <g data-k="bees" class="fade">${bee(712, 432, 0)}${bee(745, 428, -2.4)}</g>
  <g data-k="bugs1" class="fade hide">${flies(318, 438)}${flies(690, 428)}</g>
  <g data-k="bugs2" class="fade hide">${flies(150, 430)}${flies(505, 418)}${flies(420, 360)}${flies(760, 432)}</g>
  ${item('heatHaze', 0, 0, `<g class="heat-lines"><path d="M120 300 q10 -15 0 -30 q-10 -15 0 -30 M300 290 q10 -15 0 -30 q-10 -15 0 -30 M520 300 q10 -15 0 -30 q-10 -15 0 -30 M700 290 q10 -15 0 -30 q-10 -15 0 -30"/></g>`, 'fade')}

  <g data-k="fx"></g>

  <g data-k="frontLayer"></g>
  <g data-k="fxTop"></g>
  </g>
</svg>`;
  }

  // Lights and the speech bubble: a second transparent SVG drawn above the night tint
  function buildTopSVG(u) {
    return `
<svg class="scene-top" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="${u}glow"><stop offset="0" stop-color="#fff2a8" stop-opacity=".95"/><stop offset=".35" stop-color="#ffcf5a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb03a" stop-opacity="0"/></radialGradient></defs>
  <g class="glows">
    <circle data-glow="lamps" cx="199" cy="398" r="20" fill="url(#${u}glow)"/>
    <circle data-glow="lamps" cx="476" cy="398" r="20" fill="url(#${u}glow)"/>
    <circle data-glow="houseLit" cx="314" cy="416" r="24" fill="url(#${u}glow)"/>
    <circle data-glow="houseLit" cx="386" cy="416" r="24" fill="url(#${u}glow)"/>
    <circle data-glow="lamps" cx="704" cy="294" r="14" fill="url(#${u}glow)"/>
  </g>
  <!-- lightning (only during storms, in time with the white flash) -->
  <g class="bolts"><path class="bolt" d="M560 0 L536 74 L556 74 L526 158 L582 58 L560 58 L582 0Z" fill="#fff36b" stroke="#fff" stroke-width="2"/>
    <path class="bolt b2" d="M180 6 L164 60 L180 60 L158 122 L200 50 L184 50 L200 6Z" fill="#fff9c4" stroke="#fff" stroke-width="2"/></g>
  <g data-k="bubble" class="bubble hide"><g class="bubble-in">
    <rect data-k="bubbleBox" x="-60" y="-37" width="120" height="31" rx="12" fill="#fff" stroke="#23313f" stroke-width="2.2"/>
    <path d="M-7 -6.6 L0 6 L7 -6.6" fill="#fff" stroke="#23313f" stroke-width="2.4" stroke-linejoin="round"/>
    <text data-k="bubbleText" x="0" y="-16" text-anchor="middle" font-size="16.5" font-weight="800" fill="#23313f"></text>
  </g></g>
</svg>`;
  }

  // Full-screen layers drawn with plain HTML (the GPU fades and moves these cheaply)
  const BACKDROP = `<div class="backdrop" aria-hidden="true">
      <div class="bd bd-morning"></div><div class="bd bd-day"></div><div class="bd bd-evening"></div><div class="bd bd-night"><div class="bd-stars">${STARS}</div></div><div class="bd bd-eclipse"><div class="bd-stars">${STARS}</div></div>
      <div class="moon-html"><div class="moon-halo"></div><div class="moon-disc"></div><div class="moon-cut"></div></div>
      <div class="sun-html"><div data-k="heatGlow" class="sun-heat fade hide"></div><div class="sun-halo"></div><div class="sun-disc"></div><div class="sun-tint"></div><div class="corona"></div><div class="eclipse-moon"></div></div>
      <div class="bd-haze"></div><div class="bd-gloom"></div>
      <div class="bd-cover bd-rain"></div><div class="bd-cover bd-storm"></div>
    </div>`;
  const FX_LAYERS = `<div class="fx-html" aria-hidden="true">
      <div class="fxh fxh-tint"></div><div class="fxh fxh-heat"></div><div class="fxh fxh-dark"></div><div class="fxh fxh-flash"></div>
    </div>`;

  /* Where things are (x, y = where Bobo's feet are) */
  const P = {
    home: [350, 454], door: [350, 450], friend: [166, 450], friend2: [62, 450], garden: [505, 454], vend: [650, 458], fountain: [676, 458],
    school: [108, 365], shops: [517, 365], thrift: [462, 365], mall: [574, 365], station: [232, 326],
    curb: [350, 458], gapF: [232, 454], gapB: [232, 368], lane: [350, 487],
  };
  const BACK_Y = 400;   // above this line = the back row
  const ROAD_Y = 465;   // below this line = in front of the cars

  const DROP = '<path d="M0 -6 q-5 6 0 9 q5 -3 0 -9Z" fill="#7cc9ef"/>';
  const BOX = '<rect x="-10" y="-8" width="20" height="16" fill="#c98f4f" stroke="#8b5a2b" stroke-width="1.5"/>';
  const TOY = '<g transform="scale(.5)"><path d="M-14 -4 h28 v8 h-28Z" fill="#ff5b4a"/><circle cx="-8" cy="5" r="4" fill="#23313f"/><circle cx="8" cy="5" r="4" fill="#23313f"/></g>';
  const BALL = '<circle r="5" fill="#ffd23f" stroke="#ff8c42" stroke-width="2"/>';
  const CUP = '<path d="M-3 -4 h6 l-1 8 h-4Z" fill="#fff" stroke="#2fb35a" stroke-width="1.2"/>';
  const PLASTIC = '<path d="M-3 -4 h6 l-1 8 h-4Z" fill="#ff5b4a"/>';
  // A traffic jam across the whole city: a queue of cars in both lanes
  const QUEUE_A = [362, 290, 196, 124, 52, -20, -92, -164, -236, -308];   // lane A (going left)
  const QUEUE_B = [-120, -48, 24, 96, 168, 240, 312, 412, 484, 556, 628, 700, 772, 844, 916, 988];   // lane B (going right)
  const JAM_SPEED = 0.2;   // city units per millisecond; every car in a jam moves at this speed

  /* What each choice shows. ev = Bobo goes to where it happens. good/bad = what the choice does:
     play() is the animation, apply() leaves lasting changes in the city (it runs at the end, or
     right away if the player moves on before the animation is done). pay = reward 2 turns later. */
  const ACTIONS = {
    school: {
      async ev(s) { s.wear('pack'); await s.travel(P.home); },
      good: {
        async play(s) {
          // there's a traffic jam on the roads… and Bobo just bikes right past it
          const jam = s.jamStart(QUEUE_A, QUEUE_B, false);
          await s.go([300, 456]);              // Bobo's bike is in the rack by the house
          s.hide('bikes_home'); s.wear('bike'); await s.w(150);
          // along the bike lane past all the cars, up the little street (seen from behind) to the bike rack at school
          await s.ridePath([[300, 487], [232, 487], [232, 374], [137, 370]]);
          s.wear('bike', false); s.show('bikes_school'); await s.w(150);
          s.remote = { bikes: 'school', people: [] };
          s.jamGo(jam);
          await s.go(P.school);
          s.sparkle(108, 330); s.jump(); await s.w(900);
          s.jamEnd();
        },
      },
      bad: {
        async play(s) {
          // dad drives Bobo in the family car: out of the driveway…
          await s.go([444, 456]);
          await s.dadOut();
          s.inside(true);
          const ride = await s.carOut(monkeyHead(-3, -23, '#8b5a2b'), headBack(-5, '#6b4423') + headBack(5, '#8b5a2b', 0.85));
          ride.cam = true;
          // …into a traffic jam that fills the whole city
          const jam = s.jamStart(QUEUE_A, QUEUE_B);
          sfx('honk'); await s.w(1200); sfx('honk'); await s.w(1200);
          let carGone;
          s.jamGo(jam, new Promise((done) => { carGone = done; }));   // (the cars by the shops wait for dad's car to leave)
          await ride.move(232, LANE_A, 202 / JAM_SPEED, 'linear');     // along the street to the little street…
          ride.remove();
          const up = s.vehicle('roadFx', `<g transform="scale(.94)">${carRear('#e63946', headBack(-5, '#6b4423') + headBack(5, '#8b5a2b', 0.85))}</g>`, 232, LANE_A, 1);
          up.carry(true); up.cam = true;
          await up.move(232, 384, 1600, 'ease-in-out');                 // …up the little street (seen from behind)…
          up.remove();
          // …left along the school street, and stop right at the school's front door
          const side = s.vehicle('backFx', car('#e63946', '#6b4423', monkeyHead(-3, -23, '#8b5a2b')), 232, 378, -1);
          side.carry(true); side.cam = true;
          await side.move(130, 378, 1300, 'ease-out');
          side.cam = false; side.carry(false);
          side.g.querySelector('.veh').innerHTML = car('#e63946', '#6b4423', '');   // (Bobo hops out of the back seat)
          // Bobo hops out at the front of the school, dad honks goodbye from the car
          s.place([118, 370]); s.inside(false);
          await s.go(P.school);
          sfx('honk'); s.jump(); await s.w(800);
          s.jamEnd();
          // (dad's drive home keeps going while the result shows)
          (async () => {
            const back = s.vehicle('backFx', car('#e63946', '#6b4423', ''), 130, 378, 1);   // turns around…
            side.remove();
            await back.move(232, 378, 1100, 'ease-in-out'); back.remove();
            const down = s.vehicle('roadFx', `<g transform="scale(.94)">${carFront('#e63946', '#6b4423')}</g>`, 232, 384, 1);
            await down.move(232, LANE_B - 2, 1500, 'ease-in-out'); down.remove();   // …down the little street…
            carGone();
            const home = s.vehicle('roadFx', familyCar('#e63946', ''), 232, LANE_B, 1);
            home.carry(true);
            await home.move(398, LANE_B, 900, 'ease-out');                          // …and home into the driveway
            await s.carPark(home);
            s.dadIn();
          })().catch(() => {});
        },
        apply(s) { s.traffic++; s.jamEnd(); },
      },
      pay(s) { s.show('cyclists'); s.reveal('bikeFriends', 330, 360); },
    },
    lights: {
      async ev(s) { await s.travel(P.home); s.houseLights(true); },
      good: {
        async play(s) {
          await s.go(P.door); s.chop(); await s.w(500);
          s.houseLights(false); s.energy('slow'); await s.w(400);
          await s.go(P.fountain); s.jump(); await s.w(600);
        },
      },
      bad: {
        async play(s) { await s.go(P.fountain); s.energy('fast'); s.burst(); await s.w(2200); },
        apply(s) { s.energyBad++; s.houseLights(true); },
      },
      pay(s) { s.reveal(['solarRoof', 'solarSchool'], 350, 360); s.renew++; s.updatePlant(); },
    },
    bottle: {
      async ev(s) { await s.travel(P.fountain); },
      good: {
        async play(s) {
          s.wear('bottle');
          [0, 1, 2].forEach((k) => setTimeout(() => s.toss(694, 424, 690, 438, DROP, 420), k * 160));
          await s.w(900); s.sparkle(694, 420); s.jump(); await s.w(600);
        },
      },
      bad: {
        async play(s) {
          await s.go(P.vend); s.chop(); await s.w(600);
          s.toss(630, 440, 660, 442, bottle(0, 0, 0, 1), 500, () => s.wear('plastic')); await s.w(1100);
          s.wear('plastic', false);
          s.toss(660, 438, 612, 504, bottle(0, 0, 0, 1.1), 900); await s.w(1100);
        },
        apply(s) { s.show('beachTrash'); s.show('seaBottles'); s.seaHurt = true; },
      },
      pay(s) { s.hide('beachTrash'); s.reveal('beachTurtle', 652, 498); },
    },
    toy: {
      async ev(s) { await s.travel(P.home); s.show('toyBroken'); },
      good: {
        async play(s) {
          const f = s.buddy('golden', '#ffd23f', P.friend);
          f.appear();
          await f.go([398, 456]);
          s.chop(); f.chop(); await s.w(1100);
          s.hide('toyBroken'); s.show('toyFixed'); s.sparkle(380, 440);
          s.toss(398, 430, 350, 432, BALL, 600); await s.w(300);
          s.toss(350, 430, 398, 432, TOY, 600); await s.w(800);
          s.line('thanksBanjo'); f.jump(); await s.w(1800);   // (the friend who helped is Banjo)
          await f.go(P.friend); await f.enter();
        },
      },
      bad: {
        async play(s) {
          const t = s.vehicle('roadFx', truck, -260, LANE_B, 1);
          t.puff(true);
          await t.move(330, LANE_B, 2200, 'ease-out');
          s.toss(336, 430, 412, 452, BOX, 700, () => s.show('boxClosed')); await s.w(800);
          const away = t.move(1150, LANE_B, 2400, 'ease-in');
          // Bobo unpacks it…
          await s.go([392, 456]); s.chop(); await s.w(900);
          s.hide('boxClosed'); s.show('boxPile'); s.hide('toyBroken');
          // …the new toy jumps out, and the empty box and the packing are left as trash
          s.toss(412, 432, 384, 454, TOY, 650, () => { s.show('toyNew'); s.sparkle(384, 440); });
          await s.w(700); s.line('thanksMom'); await s.w(1800);   // (mom ordered it online)
          await s.go(P.home); await s.w(300);
          await away; t.remove();
        },
        apply(s) { s.hide('boxClosed'); s.show('boxPile'); },
      },
      pay(s) { s.reveal('swapBox', 74, 345); },
    },
    hot: {
      async ev(s) { s.show('heatGlow'); await s.travel(P.home); },
      good: {
        // open the windows, then cool down in the shade of the park tree with a cold drink (no electricity)
        async play(s) {
          s.q('boboHouse').classList.add('win-open'); await s.w(500);
          await s.go([756, 458]); s.wear('glass'); s.sparkle(756, 420); await s.w(1000);
        },
      },
      bad: {
        async play(s) { s.show('acUnit'); s.show('acAir'); await s.w(500); s.energy('fast'); s.burst(); await s.w(2000); },
        apply(s) { s.show('acUnit'); s.energyBad++; },
      },
      pay(s) { s.reveal('shadeTrees', 350, 410); },
    },
    cold: {
      async ev(s) { await s.travel(P.home); },
      good: {
        async play(s) { await s.go(P.door); s.inside(true); await s.w(700); s.wear('sweater'); s.inside(false); await s.go(P.home); s.sparkle(350, 420); await s.w(600); },
      },
      bad: {
        async play(s) { await s.go(P.door); s.inside(true); await s.w(500); s.show('houseSmoke'); s.energy('fast'); await s.w(1600); s.inside(false); await s.go(P.home); },
        apply(s) { s.show('houseSmoke'); s.energyBad++; },
      },
      pay(s) { s.reveal('turbines', 82, 250); s.renew++; s.updatePlant(); },
    },
    shower: {
      // it's night: Bobo is already home (no playing outside in the dark)
      async ev(s) { s.wear('mud'); if (s.time() === 'night' && !s.remote && s.pos()[1] >= BACK_Y) s.place(P.home); else await s.travel(P.home); },
      good: {
        async play(s) { await s.go(P.door); s.inside(true); await s.w(300); s.flash('steam', 1300); await s.w(1300); s.wear('mud', false); s.inside(false); s.sparkle(350, 420); await s.w(500); },
      },
      bad: {
        async play(s) { await s.go(P.door); s.inside(true); await s.w(300); s.show('bathBubbles'); s.energy('fast'); s.burst(); await s.w(2600); s.hide('bathBubbles'); s.wear('mud', false); s.inside(false); await s.w(300); },
        apply(s) { s.energyBad++; },
      },
      pay(s) { s.reveal('solarHeater', 178, 386); s.renew++; s.updatePlant(); },
    },
    party: {
      async ev(s) {
        if (s.pos()[1] < BACK_Y) await s.travel(P.home);   // (home first, the same way Bobo always gets around)
        s.wear('hat'); s.show('partyCloth'); s.show('balloons'); s.show('cake');
        const a = s.buddy('golden', '#ffd23f', P.friend, '#2f80ed'), b = s.buddy('red', '#2fb35a', P.friend2, '#ffd23f');
        a.appear(); b.appear();
        const ga = a.go([470, 452]), gb = b.go([542, 452]);
        ga.catch(() => {}); gb.catch(() => {});
        // Bobo's family comes to the party too
        const fam = s.family(P.door, ['dad', 'mom', 'sister']);
        fam.forEach((m, k) => { m.kind = ['dad', 'mom', 'sister'][k]; m.appear(); });
        const gf = fam.map(async (m, k) => { await s.w(300 * k); await m.go([[402, 456], [580, 456], [598, 458]][k]); });
        gf.forEach((g) => g.catch(() => {}));
        await s.travel(P.garden);
        await Promise.all([ga, gb, ...gf]);
      },
      good: {
        async play(s) {
          s.show('platesReal'); await s.w(900);
          s.show('sortBins');
          [CUP, BALL, CUP].forEach((it, k) => setTimeout(() => s.toss(485 + k * 20, 430, 565 + k * 13, 440, it, 600), k * 260));
          await s.w(1000); s.buddies.forEach((b) => b.jump()); s.sparkle(578, 430); await s.w(600);
          s.partyOver();
        },
      },
      bad: {
        async play(s) {
          s.show('platesPlastic'); await s.w(900);
          s.show('trashBag');
          [PLASTIC, PLASTIC, PLASTIC].forEach((it, k) => setTimeout(() => s.toss(485 + k * 20, 430, 572, 440, it, 600), k * 220));
          await s.w(1300);
          s.partyOver();
        },
        apply(s) { s.show('trashPile'); },
      },
      pay(s) { s.reveal('recycling', 322, 330); },
    },
    jacket: {
      async ev(s) {
        // (still at school? school's over: home first.) Then to the shops, with a grown-up
        if (s.pos()[1] < BACK_Y && !(s.remote && s.remote.people.length)) await s.travel(P.home);
        await s.travel(P.shops, s.mode === 'car' ? ['dad'] : ['mom']);
      },
      good: {
        // a cool jacket from the thrift store (it's sunny, so Bobo carries it home)
        async play(s) {
          const grownUps = s.remote ? s.remote.people : [];
          await s.withMe(P.thrift, grownUps); s.inside(true); grownUps.forEach((m) => m.fade(false)); await s.w(1100);
          s.wear('carry'); s.inside(false); grownUps.forEach((m) => m.fade(true)); s.sparkle(462, 330); s.jump();
          s.line(s.mode === 'car' ? 'thanksDad' : 'thanksMom'); await s.w(1800);   // (whoever paid for it)
        },
      },
      bad: {
        async play(s) {
          // the new clothes come from a faraway factory: a cargo ship docks at the harbor and leaves again
          s.hide('boats');
          const ship = s.vehicle('fx', SHIP, 1000, 578, 1, 1.1);
          const delivery = (async () => {
            await ship.move(784, 578, 2600, 'ease-out');
            s.toss(770, 540, 714, 530, BOX, 600);
            await s.w(800);
            await ship.move(1100, 578, 2400, 'ease-in'); ship.remove(); s.show('boats');
          })();
          delivery.catch(() => {});
          const grownUps = s.remote ? s.remote.people : [];
          await s.withMe(P.mall, grownUps); s.inside(true); grownUps.forEach((m) => m.fade(false)); await s.w(1300);
          s.wear('bag'); s.inside(false); grownUps.forEach((m) => m.fade(true));
          s.line(s.mode === 'car' ? 'thanksDad' : 'thanksMom'); await s.w(1800);
          await delivery;
        },
      },
      pay(s) { s.reveal('clothesRack', 505, 340); },
    },
    trip: {
      async ev(s) {
        s.wear('pack'); await s.travel(P.home);
        // the whole family comes out of the house for the trip
        const fam = s.family(P.door);
        fam.forEach((m) => m.appear());
        await Promise.all(fam.map(async (m, k) => { await s.w(200 * k); await m.walk([376, 396, 414][k], [456, 456, 458][k]); }));
      },
      good: {
        async play(s) {
          // everybody goes to the station together (by bike or by car, like they always do)
          const fam = s.buddies.slice();
          fam.forEach((m, k) => { m.kind = ['dad', 'mom', 'sister'][k]; });
          await s.travel([240, 326], ['dad', 'mom', 'sister'], fam);
          const people = s.remote ? s.remote.people : fam;
          await Promise.all(people.map((m, k) => m.go([[204, 326], [220, 326], [258, 326]][k])));
          s.hide('trains');
          const tr = s.vehicle('trainFx', TRAIN, -700, 316, 1, 0.95);
          sfx('choo');
          await tr.move(325, 316, 3200, 'ease-out');
          people.forEach((m) => m.fade(false)); s.inside(true); await s.w(900);   // all aboard!
          await tr.move(1700, 316, 3400, 'ease-in'); tr.remove(); s.show('trains');
          people.forEach((m) => m.remove());
          if (s.remote) s.remote.people = [];
          s.away = 'train';    // back from Grandma's by train next time
        },
      },
      bad: {
        async play(s) {
          // everybody gets into the family car in the driveway
          const fam = s.buddies.slice();
          await Promise.all([s.go([444, 456]), ...fam.map((m, k) => m.walk([410, 424, 458][k], 454))]);
          await Promise.all(fam.map((m) => m.enter()));
          s.inside(true);
          const ride = await s.carOut(BACK_FAMILY, headBack(-6, '#6b4423') + headBack(0, '#a0703f', .9) + headBack(6, '#8b5a2b', .85));
          const jam = s.jamStart(QUEUE_A, QUEUE_B);
          sfx('honk'); await s.w(1200); sfx('honk'); await s.w(1200);
          s.jamGo(jam);
          await ride.move(-650, LANE_A, (ride.x + 650) / JAM_SPEED, 'linear'); ride.remove();   // (same speed as the jam, so it stays in the queue)
          s.jamEnd();
          s.away = 'car';
        },
        apply(s) { s.traffic++; s.jamEnd(); s.hide('parkedCar'); },
      },
      pay(s) { s.reveal('train2', 400, 300); },
    },
    food: {
      async ev(s) { await s.travel(P.garden); },
      good: {
        async play(s) { s.show('tacos'); s.sparkle(505, 420); await s.w(800); s.jump(); await s.w(700); },
      },
      bad: {
        async play(s) { s.show('burger'); await s.w(900); s.look(690); s.show('cows'); s.sparkle(696, 340); await s.w(1600); },
        apply(s) { s.show('cows'); },
      },
      pay(s) { s.reveal('veggieGarden', 746, 446); },
    },
  };

  const TIMES = ['morning', 'day', 'evening', 'night', 'eclipse'];

  function create(container) {
    const u = 's' + ++uid + '-';
    container.innerHTML = BACKDROP + buildSVG(u) + FX_LAYERS + buildTopSVG(u);
    const svg = container.querySelector('svg.scene-main');
    const q = (k) => container.querySelector(`[data-k="${k}"]`);
    container.insertAdjacentHTML('beforeend', '<div class="rain-fx" aria-hidden="true"></div>');
    // the slowest devices: the wing flaps stand still too
    // the birds' flapping wings (SMIL shape morphing) are the heaviest little extra: only on 'high'
    const wings = (t) => { if (!svg.pauseAnimations) return; if (t === 'high') svg.unpauseAnimations(); else svg.pauseAnimations(); };
    if (typeof Perf !== 'undefined') { wings(Perf.tier); Perf.onChange(wings); }
    // A random sky every game: sometimes clear, sometimes a few clouds drifting by
    q('skyClouds').innerHTML = Array.from({ length: [0, 1, 1, 2, 2, 3][Math.floor(Math.random() * 6)] }, () => {
      const y = 40 + Math.random() * 110, sc = 0.6 + Math.random() * 0.7, dur = 90 + Math.random() * 70;
      return `<g class="drift" style="animation-duration:${dur.toFixed(0)}s;animation-delay:${(-Math.random() * dur).toFixed(0)}s"><g transform="translate(0 ${y.toFixed(0)}) scale(${sc.toFixed(2)})"><g class="cloud"><circle cx="0" cy="0" r="22"/><circle cx="24" cy="-8" r="26"/><circle cx="50" cy="2" r="20"/><rect x="0" y="0" width="50" height="20"/></g></g></g>`;
    }).join('');
    const wrap = q('walkerWrap'), walker = svg.querySelector('.walker'), monkey = q('monkey'), rideDir = svg.querySelector('.ride-dir');
    let mood = '';
    let time = 'day';
    let reactTimer = 0, bubbleTimer = 0, walkTimer = 0, walkEnd = 0;
    let lineFor = () => '';   // (the game gives us Bobo's lines in the player's language, see setLines)
    let walkPos = [...P.home];
    let gen = 0;               // goes up whenever a new situation starts; old animations then stop
    let pending = null;        // the lasting changes of the choice that is still playing
    let climate = 1;
    let level = 0;
    const vehicles = [];
    const buddies = [];

    /* Camera. Phones (narrow, portrait): zoomed in, and the view slides sideways to follow Bobo.
       Laptops and tablets: the whole width, but with less empty sky so the city is closer.
       Sliding moves the pictures with the GPU, so it stays smooth. */
    const svgs = container.querySelectorAll('svg.scene-main, svg.scene-top');
    let vb = [0, 0, 800, 500], camFocus = 400;
    function camTo(x, ms = 0) {
      camFocus = x;
      if (vb[2] === 800) { container.style.setProperty('--camx', '0px'); return; }
      const r = container.getBoundingClientRect();
      const u = Math.min(r.width / vb[2], r.height / vb[3]);
      const cx = clamp(x - vb[2] / 2, 0, 800 - vb[2]);
      container.style.setProperty('--camt', Math.round(ms) + 'ms');
      container.style.setProperty('--camx', (-(cx - vb[0]) * u).toFixed(1) + 'px');
    }
    function applyZoom() {
      const r = container.getBoundingClientRect();
      if (!r.height) return;
      const game = container.classList.contains('scene-wrap');
      const phone = game && r.width / r.height < 1.1 && r.width < 760;
      const want = !game ? [0, 0, 800, 500] : phone ? [150, 0, 500, 500] : [0, 90, 800, 410];
      if (want.join() !== vb.join()) {
        vb = want;
        container.classList.toggle('zoomed', phone);
        container.classList.toggle('cropped', game && !phone);
        svgs.forEach((el) => el.setAttribute('viewBox', vb.join(' ')));
        container.dispatchEvent(new Event('scenezoom', { bubbles: true }));
      }
      camTo(camFocus, 0);   // (the card below changes size a lot: keep looking at the same spot)
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(applyZoom).observe(container);
    const CANCEL = { cancelled: true };
    const guard = (g) => { if (g !== gen) throw CANCEL; };

    const visible = (el) => el && !el.classList.contains('hide');
    function updateGlows() {
      const dark = time === 'night' || time === 'evening' || time === 'eclipse';
      container.querySelectorAll('[data-glow]').forEach((g) => {
        g.classList.toggle('on', dark && (g.dataset.glow === 'lamps' || visible(q(g.dataset.glow))));
      });
    }

    // back row = behind the houses; pavement = behind the cars on the road; bike lane = in front
    const layerFor = (y) => q(y < BACK_Y ? 'backLayer' : y < ROAD_Y ? 'midLayer' : 'frontLayer');
    /* Bobo walks to (x, y); resolves when there. */
    function walkTo(x, y, msWanted = 0, ease = 'ease-in-out') {
      const [cx, cy] = walkPos;
      const dist = Math.hypot(x - cx, y - cy);
      const ms = msWanted || Math.max(300, Math.min(2000, dist * 5.5 / s.speed));
      walker.style.transitionTimingFunction = ease;
      // switch layers at the start of a step (always in the side street, where nothing overlaps)
      const layer = layerFor(y);
      if (wrap.parentNode !== layer) {
        // moving to another layer would skip the slide (= a teleport), so settle where Bobo is first
        layer.appendChild(wrap);
        walker.style.transitionDuration = '0ms';
        void walker.getBoundingClientRect();
      }
      walkPos = [x, y];
      walker.style.transitionDuration = ms + 'ms';
      walker.style.transform = `translate(${x - 400}px, ${y - 400}px) scale(${depthK(y).toFixed(3)})`;
      walkEnd = performance.now() + ms;
      camTo(x, ms);
      placeBubble(ms);
      monkey.classList.toggle('walking', dist > 4);
      walker.classList.toggle('pedaling', dist > 4);
      if (Math.abs(x - cx) > 2) rideDir.setAttribute('transform', `scale(${x < cx ? -0.42 : 0.42} .42)`);
      const towardsUs = y - cy > Math.abs(x - cx);
      rideDir.querySelector('.rv-front').style.display = towardsUs ? '' : 'none';
      rideDir.querySelector('.rv-back').style.display = towardsUs ? 'none' : '';
      clearTimeout(walkTimer);
      return new Promise((done) => { walkTimer = setTimeout(() => { monkey.classList.remove('walking'); walker.classList.remove('pedaling'); done(); }, ms); });
    }
    // Plan a route: between the back and front rows Bobo always goes through the side street
    function route(from, to) {
      const back = (p) => p[1] < BACK_Y;
      if (back(from) === back(to)) return [to];
      return back(from) ? [[P.gapB[0], P.gapB[1]], [P.gapF[0], P.gapF[1]], to] : [[P.gapF[0], P.gapF[1]], [P.gapB[0], P.gapB[1]], to];
    }
    function place([x, y]) {
      walkPos = [x, y];
      const layer = layerFor(y);
      if (wrap.parentNode !== layer) layer.appendChild(wrap);
      walker.style.transitionDuration = '0ms';
      walker.style.transform = `translate(${x - 400}px, ${y - 400}px) scale(${depthK(y).toFixed(3)})`;
      void walker.getBoundingClientRect();
      walker.style.transitionDuration = '';
      camTo(x, 0);
    }

    const WEAR = { pack: ['mPack', 'mStraps'], bike: ['mRide'], hat: ['mHat'], sweater: ['mSweater'], cool: ['mJacketCool'], plain: ['mJacketPlain'],
      mud: ['mMud', 'mMudFace'], bottle: ['mBottle'], plastic: ['mPlastic'], glass: ['mGlass'], bag: ['mBag'], carry: ['mCarry'] };

    const s = {
      q,
      pos: () => walkPos,
      speed: 1,
      traffic: 0,
      energyBad: 0,
      renew: 0,
      seaHurt: false,
      away: null,
      buddies,
      show(k) { const el = q(k); if (el) el.classList.remove('hide'); updateGlows(); },
      hide(k) { const el = q(k); if (el) el.classList.add('hide'); updateGlows(); },
      flash(k, ms) { s.show(k); setTimeout(() => s.hide(k), ms); },
      wear(what, on = true) {
        WEAR[what].forEach((k) => q(k).classList.toggle('hide', !on));
        if (what === 'bike') walker.classList.toggle('riding', on);   // the side view on the bike replaces the front view
      },
      // Bobo goes in / comes out of a house, shop, car or train: the same gentle fade as everybody else
      inside(on, instant = false) {
        if (instant) { walker.style.transition = 'none'; walker.classList.toggle('inside', on); void walker.getBoundingClientRect(); walker.style.transition = ''; }
        else walker.classList.toggle('inside', on);
        if (on) q('bubble').classList.add('hide');
      },
      place,
      look(x) { camTo(x, 900); },
      time: () => time,
      // wait, but stop if a new situation started meanwhile
      async w(ms) { const g = gen; await sleep(ms); guard(g); },
      async go(to) {
        const g = gen;
        for (const p of route(walkPos, to)) { await walkTo(p[0], p[1]); guard(g); }
      },
      // one smooth ride along the street: speeds up, cruises, slows down (and the camera glides along)
      async ride(to, speed = 0.13) {
        const g = gen;
        await walkTo(to[0], to[1], Math.max(600, Math.hypot(to[0] - walkPos[0], to[1] - walkPos[1]) / speed), 'cubic-bezier(.45, 0, .35, 1)');
        guard(g);
      },
      houseLights(on) { s.q('boboHouse').classList.toggle('lit', on); s.q('boboHouse').classList.toggle('lights-off', !on); s[on ? 'show' : 'hide']('houseLit'); s[on ? 'show' : 'hide']('tv'); },
      energy(speed) {
        const e = q('energy');
        e.classList.remove('fast', 'slow');
        e.classList.add(speed);
        clearTimeout(s.energyTimer);
        s.energyTimer = setTimeout(() => e.classList.remove('fast', 'slow'), 3500);
      },
      burst() { s.flash('plantBurst', 2600); },
      // The family car backs out of the driveway (seen from behind) and drives off along the street (dad drives)
      async carOut(back, heads = headBack(-5, '#6b4423')) {
        s.hide('parkedCar');
        const r = s.vehicle('roadFx', `<g transform="scale(.94)">${carRear('#e63946', heads)}</g>`, 434, 442, 1);
        r.carry(true);
        await r.move(434, 466, 1000, 'ease-in-out');
        r.remove();
        const v = s.vehicle('roadFx', familyCar('#e63946', back), 434, LANE_A, -1);
        v.carry(true);
        return v;
      },
      // …and comes back along the street (from the right) and drives up into the driveway
      async carPark(v, heads = headBack(-5, '#6b4423')) {
        const lane = v.y;
        await v.move(434, lane, Math.max(600, Math.abs(v.x - 434) * 2.2), 'ease-out');
        v.remove();
        const r = s.vehicle('roadFx', `<g transform="scale(.94)">${carRear('#e63946', heads)}</g>`, 434, lane, 1);
        r.carry(true);
        await r.move(434, 442, 1000, 'ease-in-out');
        s.show('parkedCar'); r.remove();
      },
      // dad comes out of the house to drive, or goes back in after parking
      async dadOut() { const d = s.family(P.door, ['dad'])[0]; d.appear(); await d.walk(412, 452); await d.enter(); },
      dadIn() { const d = s.family([412, 452], ['dad'])[0]; d.appear(); (async () => { await d.go(P.door); await d.enter(); })().catch(() => {}); },
      // after the party: the friends walk home to their own houses, Bobo's family goes inside
      partyOver() {
        const homes = { golden: P.friend, red: P.friend2 };
        s.buddies.slice().forEach((m, k) => (async () => { await s.w(300 * k); await m.go(homes[m.kind] || P.door); await m.enter(); })().catch(() => {}));
      },
      // a reward appears: it pops in, a glowing ring pulses around it and stars burst out (so it's easy to notice)
      reveal(keys, x, y) {
        [].concat(keys).forEach((k) => { const el = q(k); s.show(k); if (el) restartAnim(el, 'reveal'); });
        s.look(x);
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('transform', `translate(${x} ${y})`);
        g.innerHTML = '<circle class="ring" r="22"/><circle class="ring" r="22" style="animation-delay:.35s"/><circle class="ring" r="22" style="animation-delay:.7s"/>';
        q('fxTop').appendChild(g);
        setTimeout(() => g.remove(), 2400);
        [[0, 0], [-26, -10], [26, -12], [-12, 18], [14, 16]].forEach(([dx, dy], k) => setTimeout(() => s.sparkle(x + dx, y + dy), k * 160));
      },
      /* ── getting around ──
         The first choice of the game (bike or car to school) decides how Bobo gets around town.
         Bike: Bobo (and whoever comes along) rides, and leaves the bikes at a bike rack.
         Car: dad drives from the driveway, parks in a parking bay and walks along. */
      mode: 'walk',
      remote: null,   // where the family car or the bikes are while Bobo is across town
      // a grown-up or the sister riding a bike (side view; from behind going away; from the front coming towards us)
      cyclist(kind, at) {
        const look = { dad: '#2f80ed', mom: '#ff6fa8', sister: '#ffd23f' }, [fur] = FRIENDS[kind];
        const size = kind === 'sister' ? 0.32 : 0.42;
        const g = document.createElementNS(NS, 'g');
        g.innerHTML = `<g class="cv-side">${sideRider(fur, look[kind])}</g><g class="cv-back" style="display:none">${backRider(fur)}</g><g class="cv-front" style="display:none">${frontRider(fur, look[kind])}</g>`;
        const c = { g, x: at[0], y: at[1], dir: 1 };
        const set = (ms, ease) => {
          const layer = c.y < BACK_Y ? q('backFx') : q('roadFx');
          if (g.parentNode !== layer) { layer.appendChild(g); g.style.transition = 'none'; void g.getBoundingClientRect(); }
          g.style.transition = ms ? `transform ${ms}ms ${ease}, opacity .4s` : 'none';
          g.style.transform = `translate(${c.x}px, ${c.y}px) scale(${(depthK(c.y) * size * c.dir).toFixed(3)}, ${(depthK(c.y) * size).toFixed(3)})`;
        };
        set(0);
        c.move = (x, y, ms, ease = 'linear') => {
          const dx = x - c.x, dy = y - c.y;
          const view = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'front' : 'back') : 'side';
          if (Math.abs(dx) > 2) c.dir = dx < 0 ? -1 : 1;
          ['side', 'back', 'front'].forEach((v) => { g.querySelector('.cv-' + v).style.display = v === view ? '' : 'none'; });
          c.x = x; c.y = y; set(ms, ease);
          g.classList.add('walker', 'pedaling');
          const p = s.w(ms); p.catch(() => {}); return p;
        };
        c.remove = () => g.remove();
        return c;
      },
      // Bobo rides along a path; the others follow in a line just behind
      async ridePath(points, others = [], speed = 0.13) {
        const legs = [];
        let prev = walkPos.slice();
        points.forEach((p) => { legs.push([p, Math.max(450, Math.hypot(p[0] - prev[0], p[1] - prev[1]) / speed)]); prev = p; });
        const last = legs.length - 1, from = legs.length > 1 ? legs[last - 1][0] : walkPos;
        const along = [Math.sign(legs[last][0][0] - from[0]), Math.sign(legs[last][0][1] - from[1])];
        const follow = others.map((r, k) => (async () => {
          await sleep(420 * (k + 1));
          for (let n = 0; n < legs.length; n++) {
            const [p, ms] = legs[n], back = n === last ? 20 * (k + 1) : 0;
            await r.move(p[0] - along[0] * back, p[1] - along[1] * back, ms, n === last ? 'ease-out' : 'linear');
          }
        })().catch(() => {}));
        for (let n = 0; n < legs.length; n++) {
          const g = gen;
          await walkTo(legs[n][0][0], legs[n][0][1], legs[n][1], n === 0 ? 'ease-in' : n === last ? 'ease-out' : 'linear');
          guard(g);
        }
        await Promise.all(follow);
      },
      // grown-ups walking with Bobo (parental supervision) follow a step behind
      async withMe(to, people) {
        await Promise.all([s.go(to), ...people.map(async (m, k) => { await s.w(200 * (k + 1)); await m.go([to[0] + 18 * (k + 1), to[1] + 1]); })]);
      },
      // turn walking people into riders where they stand (and back)
      toBikes(people) { return people.map((m) => { const c = s.cyclist(m.kind, m.pos); m.remove(); return c; }); },
      toWalkers(riders, kinds) { return riders.map((r, k) => { const m = s.buddy(kinds[k], { dad: '#2f80ed', mom: '#ff6fa8', sister: '#ffd23f' }[kinds[k]], [r.x, r.y], null, kinds[k] === 'dad' ? 'tie' : 'bow', { dad: 1.1, mom: 1.04, sister: 0.76 }[kinds[k]]); m.kind = kinds[k]; r.remove(); return m; }); },
      // go somewhere: walk on the same side of town; across town by bike or by car (see s.mode)
      async travel(to, kinds = [], existing = null) {
        const there = to[1] < BACK_Y, here = walkPos[1] < BACK_Y;
        const people = s.remote ? s.remote.people : [];
        if (there === here || s.mode === 'walk') { await s.withMe(to, people); return; }
        if (there) await (s.mode === 'bike' ? s.bikeThere(to, kinds, existing) : s.driveThere(to, kinds, existing));
        else await (s.mode === 'bike' ? s.bikeHome(to) : s.driveHome(to));
      },
      rackFor(to) { return to[1] < 345 ? ['station', [256, 342]] : to[0] < 300 ? ['school', [137, 368]] : ['mall', [606, 370]]; },
      bayFor(to) { return to[1] < 345 ? 290 : to[0] < 300 ? 168 : 600; },
      async bikeThere(to, kinds, existing) {
        const [rk, rp] = s.rackFor(to);
        // everyone takes their bike from the rack at home and rides off together
        let people = existing || s.family(P.door, kinds);
        people.forEach((m, k) => { m.kind = kinds[k]; if (!existing) m.appear(); });
        await Promise.all([s.go([300, 456]), ...people.map((m, k) => m.walk(318 + 16 * k, 456))]);
        s.hide('bikes_home'); s.wear('bike');
        const riders = s.toBikes(people);
        await s.ridePath([[300, 487], [232, 487], [232, rp[1] > 360 ? 374 : rp[1]], rp], riders);
        // lock the bikes at the rack by the destination
        s.wear('bike', false); s.show('bikes_' + rk); if (riders.length) s.show('bikes2_' + rk); if (riders.length > 1) s.show('bikes3_' + rk);
        people = s.toWalkers(riders, kinds);
        people.forEach((m) => { m.keep = true; });
        s.remote = { bikes: rk, people };
        await s.withMe(to, people);
      },
      async bikeHome(to) {
        const r = s.remote || { bikes: s.rackFor(walkPos)[0], people: [] };
        const [rk, rp] = s.rackFor(walkPos[1] < 345 ? [0, 330] : walkPos[0] < 300 ? [100, 365] : [600, 365]);
        await Promise.all([s.go(rp), ...r.people.map((m, k) => m.go([rp[0] + 14 * (k + 1), rp[1]]))]);
        ['bikes_', 'bikes2_', 'bikes3_'].forEach((b) => s.hide(b + rk));
        s.wear('bike');
        const kinds = r.people.map((m) => m.kind);
        const riders = s.toBikes(r.people);
        s.remote = null;
        await s.ridePath([[232, rp[1] > 360 ? 374 : rp[1]], [232, 487], [300, 487]], riders);
        s.wear('bike', false); s.show('bikes_home');
        const people = s.toWalkers(riders, kinds);
        await Promise.all([s.go(to), ...people.map(async (m, k) => { await s.w(200 * k); await m.go(P.door); await m.enter(); })]);
      },
      // by car: dad drives; whoever comes along rides in the back
      async driveThere(to, kinds, existing) {
        const bay = s.bayFor(to), riders = kinds.filter((k) => k !== 'dad');
        await s.go([444, 456]);
        const fam = existing || s.family(P.door, ['dad', ...riders]);
        if (!existing) fam.forEach((m) => m.appear());
        await Promise.all(fam.map(async (m, k) => { await s.w(180 * k); await m.walk(408 + 14 * k, 452); await m.enter(); }));
        s.inside(true);
        const back = [monkeyHead(-3, -23, '#8b5a2b')].concat(riders.map((k, n) => `<g transform="translate(${-9 + n * 9} -22.5) scale(.55)">${monkeyHead(0, 0, FRIENDS[k][0])}</g>`)).join('');
        const v = await s.carOut(back);
        v.cam = true;
        await v.move(232, LANE_A, 1200, 'ease-in-out');
        v.remove();
        const up = s.vehicle('roadFx', `<g transform="scale(.94)">${carRear('#e63946', headBack(-5, '#6b4423') + headBack(5, '#8b5a2b', .85))}</g>`, 232, LANE_A, 1);
        up.carry(true); up.cam = true;
        await up.move(232, 384, 1500, 'ease-in-out');
        up.remove();
        const side = s.vehicle('backFx', car('#e63946', '#6b4423', back), 232, 378, bay < 232 ? -1 : 1);
        side.carry(true); side.cam = true;
        await side.move(bay, 378, Math.max(500, Math.abs(bay - 232) * 6), 'ease-out');
        side.cam = false; side.carry(false); side.keep = true;
        // everybody gets out and walks with Bobo
        s.place([bay + 10, 367]); s.inside(false);
        const people = s.family([[bay - 10, 367]].concat(riders.map((_, n) => [bay + 26 + n * 14, 367])), ['dad', ...riders]);
        people.forEach((m, k) => { m.kind = ['dad', ...riders][k]; m.keep = true; m.appear(); });
        s.remote = { car: side, bay, people };
        await s.withMe(to, people);
      },
      async driveHome(to) {
        let r = s.remote;
        if (!r || !r.car) {
          // dad comes to pick Bobo up
          const bay = s.bayFor(walkPos);
          const fam = s.family(P.door, ['dad']); fam[0].appear();
          await fam[0].walk(408, 452); await fam[0].enter();
          const v = await s.carOut('');
          v.cam = true;
          await v.move(232, LANE_A, 1200, 'ease-in-out'); v.remove();
          const up = s.vehicle('roadFx', `<g transform="scale(.94)">${carRear('#e63946', headBack(-5, '#6b4423'))}</g>`, 232, LANE_A, 1);
          up.carry(true); up.cam = true;
          await up.move(232, 384, 1500, 'ease-in-out'); up.remove();
          const side = s.vehicle('backFx', car('#e63946', '#6b4423', ''), 232, 378, bay < 232 ? -1 : 1);
          side.cam = true;
          await side.move(bay, 378, Math.max(500, Math.abs(bay - 232) * 6), 'ease-out');
          side.cam = false;
          r = { car: side, bay, people: [] };
        }
        // everybody walks to the car and gets in
        await Promise.all([s.go([r.bay + 10, 367]), ...r.people.map((m, k) => m.go([r.bay - 10 + 14 * k, 367]))]);
        await Promise.all(r.people.map((m) => m.enter()));
        s.inside(true);
        const kinds = r.people.map((m) => m.kind).filter((k) => k !== 'dad');
        const back = [monkeyHead(-3, -23, '#8b5a2b')].concat(kinds.map((k, n) => `<g transform="translate(${-9 + n * 9} -22.5) scale(.55)">${monkeyHead(0, 0, FRIENDS[k][0])}</g>`)).join('');
        r.car.remove();
        s.remote = null;
        // back along the street, down the little street (coming towards us), along the main road and up the driveway
        const side = s.vehicle('backFx', car('#e63946', '#6b4423', back), r.bay, 378, r.bay < 232 ? 1 : -1);
        side.carry(true); side.cam = true;
        await side.move(232, 378, Math.max(500, Math.abs(r.bay - 232) * 6), 'ease-in-out'); side.remove();
        const down = s.vehicle('roadFx', `<g transform="scale(.94)">${carFront('#e63946', '#6b4423')}</g>`, 232, 384, 1);
        down.cam = true;
        await down.move(232, LANE_B - 2, 1500, 'ease-in-out'); down.remove();
        const home = s.vehicle('roadFx', familyCar('#e63946', back), 232, LANE_B, 1);
        home.carry(true); home.cam = true;
        await s.carPark(home, headBack(-5, '#6b4423') + headBack(5, '#8b5a2b', .85));
        // everybody gets out; the grown-ups (and the sister) go inside
        place([444, 456]); s.inside(false);
        const people = s.family([[410, 452]].concat(kinds.map((_, n) => [424 + n * 16, 454])), ['dad', ...kinds]);
        people.forEach((m) => m.appear());
        await Promise.all([s.go(to), ...people.map(async (m, k) => { await s.w(220 * k); await m.go(P.door); await m.enter(); })]);
      },
      setMode(m) { s.mode = m; },
      // A traffic jam across the whole city: the normal traffic stops and queues of cars fill both lanes
      jamStart(qa, qb, little = true) {
        container.classList.add('jammed');
        const kinds = ['#ffb627', '#9aa5b1', '#7d5fff', '#2fb35a', '#ff6fa8', '#2f80ed', '#e8a33d'], furs = ['#7a4a24', '#a0673a', '#5c3a1e', '#c08850'];
        const a = qa.map((x, k) => s.vehicle('roadFx', car(kinds[k % 7], furs[k % 4]), x, LANE_A, -1).fadeIn());
        const b = qb.map((x, k) => s.vehicle('roadFx', car(kinds[(k + 3) % 7], furs[(k + 1) % 4]), x, LANE_B, 1).fadeIn());
        // the street in front of the school and the shops (behind the houses)
        const c = [618, 572, 526, 480, 434, 388, 342, 296].map((x, k) => s.vehicle('backFx', car(kinds[(k + 5) % 7], furs[(k + 2) % 4]), x, 374, -1).fadeIn());
        c.forEach((v, k) => { v.color = kinds[(k + 5) % 7]; v.fur = furs[(k + 2) % 4]; });
        // the little street up to the station (cars seen from behind)
        const d = little ? [[232, 444], [232, 412]].map(([x, y], k) => s.vehicle('roadFx', `<g transform="scale(.94)">${carRear(kinds[(k + 1) % 7], headBack(-5, furs[k]))}</g>`, x, y, 1).fadeIn()) : [];
        d.forEach((v, k) => { v.color = kinds[(k + 1) % 7]; v.fur = furs[k]; });
        [...a, ...b, ...c, ...d].forEach((v) => v.puff(true));
        return { a, b, c, d, little };
      },
      // everybody drives on again, all at the same speed (so nobody bumps into anybody)
      jamGo({ a, b, c, d, little }, waitFor = null) {
        a.forEach((v) => v.move(v.x - 1200, LANE_A, 1200 / JAM_SPEED, 'linear'));
        b.forEach((v) => v.move(v.x + 1200, LANE_B, 1200 / JAM_SPEED, 'linear'));
        const speed = JAM_SPEED * 0.7;   // (the street by the shops is further away, so cars look slower there)
        // the little street: up to the corner, then right along the street by the shops into the mall's parking spot
        d.forEach((v, k) => (async () => {
          await v.move(232, 378, (v.y - 378) / speed, 'linear');
          v.remove();
          const side = s.vehicle('backFx', car(v.color, v.fur), 232, 378, 1);
          await side.move(612 - k * 30, 378, (380 - k * 30) / speed, 'linear');
          side.g.style.opacity = '0';
        })().catch(() => {}));
        // the street by the shops: to the corner, down the little street (coming towards us) and onto the main road
        const clear = little ? 3200 : 0;   // (wait until the little street is empty)
        c.forEach((v) => (async () => {
          if (waitFor) await waitFor; else await s.w(clear);
          await v.move(240, 374, (v.x - 240) / speed, 'linear');
          v.remove();
          const down = s.vehicle('roadFx', `<g transform="scale(.94)">${carFront(v.color, v.fur)}</g>`, 232, 380, 1);
          await down.move(232, LANE_A - 2, 86 / speed, 'linear');
          down.remove();
          // (the lane going left is empty by now: the jam ahead has already driven off over the bridge)
          const out = s.vehicle('roadFx', car(v.color, v.fur), 232, LANE_A, -1);
          await out.move(-800, LANE_A, 1032 / JAM_SPEED, 'linear');
        })().catch(() => {}));
      },
      jamEnd() { container.classList.remove('jammed'); },
      // Bobo comes back from Grandma's (by train or by car) before the next situation
      async arrive() {
        const how = s.away;
        s.away = null;
        if (how === 'train') {
          place(P.station); s.inside(true, true); s.hide('trains');
          const tr = s.vehicle('trainFx', TRAIN, 1600, 316, -1, 0.95);
          sfx('choo');
          await tr.move(139, 316, 3200, 'ease-out');
          // everybody gets off…
          s.inside(false);
          const fam = s.family([[206, 326], [222, 326], [258, 326]]);
          fam.forEach((m, k) => { m.kind = ['dad', 'mom', 'sister'][k]; m.keep = true; m.appear(); });
          await s.w(600);
          const leave = tr.move(-700, 316, 3200, 'ease-in');
          // …and they all go home together (the same way they came: by bike or by car)
          if (s.remote) s.remote.people = fam; else s.remote = { people: fam };
          if (s.mode === 'walk' || (!s.remote.car && !s.remote.bikes)) {
            s.remote = null;
            await Promise.all([s.go(P.home), ...fam.map(async (m, k) => { await s.w(220 * k); await m.go(P.door); await m.enter(); })]);
          } else await s.travel(P.home);
          await leave; tr.remove(); s.show('trains');
        } else if (how === 'car') {
          s.hide('parkedCar'); place(P.home); s.inside(true, true);
          const c = s.vehicle('roadFx', familyCar('#e63946'), 1400, LANE_A, -1);
          c.carry(true);
          await s.carPark(c, headBack(-6, '#6b4423') + headBack(0, '#a0703f', .9) + headBack(6, '#8b5a2b', .85));
          // the whole family gets out of the parked car and goes inside; Bobo stays out
          place([444, 456]); s.inside(false);
          const fam = s.family([[410, 452], [424, 454], [458, 454]]);
          fam.forEach((m) => m.appear());
          await s.w(500);
          await Promise.all([s.go(P.home), ...fam.map(async (m, k) => { await s.w(220 * k); await m.go(P.door); await m.enter(); })]);
        }
      },
      updatePlant() {
        // how much smoke the power plant makes: more energy used = more smoke; sun + wind power = less
        const lvl = clamp(1 + s.energyBad - s.renew, 0, 4);
        [1, 2, 3, 4].forEach((n) => q('ps' + n).classList.toggle('hide', n !== lvl));
        container.querySelector('.bd-haze').style.opacity = hazeFor();
      },
      vehicle(layer, inner, x, y, dir = 1, fixedScale = null) {
        const g = document.createElementNS(NS, 'g');
        g.innerHTML = `<g class="veh">${inner}</g>`;
        g.classList.add('vehicle');
        q(layer).appendChild(g);
        const v = { g, x, y };
        const k = () => fixedScale || depthK(y);
        const set = () => { g.style.transform = `translate(${v.x}px, ${v.y}px) scale(${(k() * dir).toFixed(3)}, ${k().toFixed(3)})`; };
        g.style.transition = 'none'; set(); void g.getBoundingClientRect();
        v.move = (x2, y2, ms, ease = 'ease-in-out') => {
          v.x = x2; v.y = y2;
          if (v.cam) camTo(x2, ms);
          g.style.transition = `transform ${ms}ms ${ease}, opacity .6s`; set();
          const p = s.w(ms); p.catch(() => {});   // (fine to not wait for it)
          return p;
        };
        v.puff = (on) => g.classList.toggle('puffing', on);
        v.carry = (on) => g.classList.toggle('with-bobo', on);
        v.fadeIn = () => { g.style.opacity = '0'; void g.getBoundingClientRect(); g.style.transition = 'opacity .6s'; g.style.opacity = '1'; return v; };
        v.remove = () => g.remove();
        vehicles.push(v);
        return v;
      },
      // Bobo's family: dad (with a tie), mom (with a bow) and a little sister (with a bow)
      family(spots, who = ['dad', 'mom', 'sister']) {
        const look = { dad: ['#2f80ed', 'tie', 1.1], mom: ['#ff6fa8', 'bow', 1.04], sister: ['#ffd23f', 'bow', 0.76] };
        return who.map((k, n) => s.buddy(k, look[k][0], Array.isArray(spots[0]) ? spots[n] : spots, null, look[k][1], look[k][2]));
      },
      // a friend monkey who can walk around
      buddy(kind, shirt, from, hat, extra = '', size = 1) {
        const [fur, face] = FRIENDS[kind];
        const g = document.createElementNS(NS, 'g');
        // (b.kind below: who this is, so they know which house is theirs)
        g.innerHTML = `<g class="mjump"><g transform="scale(${size}) ${MONKEY_FIT}">${buddy(fur, shirt, hat, face, extra)}</g></g>`;
        g.classList.add('buddy');
        q('buddies').appendChild(g);
        const b = { g, pos: from, kind };
        const set = (x, y, ms) => {
          const layer = y < BACK_Y ? q('backLayer') : q('buddies');
          if (g.parentNode !== layer) {
            // (moving to another layer would skip the slide: settle where we are first)
            layer.appendChild(g);
            g.style.transition = 'none';
            void g.getBoundingClientRect();
          }
          g.style.transition = ms ? `transform ${ms}ms linear, opacity .4s` : 'none'; g.style.transform = `translate(${x}px, ${y}px) scale(${depthK(y).toFixed(3)})`;
        };
        set(from[0], from[1], 0); void g.getBoundingClientRect();
        b.walk = (x, y) => {
          const ms = Math.max(300, Math.hypot(x - b.pos[0], y - b.pos[1]) * 5.5);
          b.pos = [x, y]; set(x, y, ms);
          g.classList.add('walking');
          const p = s.w(ms).finally(() => g.classList.remove('walking')); p.catch(() => {});
          return p;
        };
        // walk somewhere, through the side street if it's between the back and the front
        b.go = async (to) => { for (const p of route(b.pos, to)) await b.walk(p[0], p[1]); };
        b.chop = () => restartAnim(g.querySelector('.mjump'), 'chop');
        b.jump = () => restartAnim(g.querySelector('.mjump'), 'jump');
        b.remove = () => { g.remove(); const k = buddies.indexOf(b); if (k >= 0) buddies.splice(k, 1); };
        b.fade = (on) => { g.style.transition = 'opacity .4s'; g.style.opacity = on ? '1' : '0'; };
        // come out of a door (fade in where they are) / go in through a door (fade out, then gone)
        b.appear = () => { g.style.transition = 'none'; g.style.opacity = '0'; void g.getBoundingClientRect(); b.fade(true); };
        b.enter = async () => { b.fade(false); await sleep(450); b.remove(); };
        buddies.push(b);
        return b;
      },
      chop() { restartAnim(svg.querySelector('.mjump'), 'chop'); },
      /* throw something in an arc from (x1,y1) to (x2,y2) */
      toss(x1, y1, x2, y2, inner, ms = 800, after = null) {
        const g = document.createElementNS(NS, 'g');
        g.innerHTML = inner;
        q('fxTop').appendChild(g);
        const peak = Math.min(y1, y2) - 50 - Math.abs(x2 - x1) * 0.15, t0 = performance.now();
        const frame = (now) => {
          const k = Math.min(1, (now - t0) / ms);
          const x = x1 + (x2 - x1) * k;
          const y = (1 - k) * (1 - k) * y1 + 2 * (1 - k) * k * peak + k * k * y2;
          g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(k * 360 * Math.sign(x2 - x1 || 1)).toFixed(0)})`);
          if (k < 1) requestAnimationFrame(frame);
          else { g.remove(); if (after) after(); }
        };
        requestAnimationFrame(frame);
      },
      sparkle(x, y) {
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('transform', `translate(${x} ${y})`);
        g.innerHTML = `<g class="sparkle">${[0, 72, 144, 216, 288].map((a) =>
          `<g transform="rotate(${a})"><path d="M0 -14 l3 8 l8 1 l-6 5 l2 8 l-7 -4 l-7 4 l2 -8 l-6 -5 l8 -1z" fill="#fff36b" stroke="#ffb627" stroke-width="1"/></g>`).join('')}</g>`;
        q('fxTop').appendChild(g);
        setTimeout(() => g.remove(), 1300);
      },
      jump() { restartAnim(svg.querySelector('.mjump'), 'jump'); },
      line(key) { const text = lineFor(key); if (text) say(text); },   // Bobo says one of the game's lines (e.g. 'thanksMom')
      droop() { restartAnim(svg.querySelector('.mjump'), 'droop'); },
    };

    function restartAnim(el, cls) {
      el.classList.remove('jump', 'droop', 'chop', 'reveal');
      void el.getBoundingClientRect();
      el.classList.add(cls);
    }

    // Finish the last choice's lasting changes right away, and stop its animation
    function finishPending() {
      gen++;
      if (pending) { const p = pending; pending = null; p(s); }
    }
    // A new situation: clear away the last one's props, friends and vehicles
    function begin() {
      finishPending();
      vehicles.splice(0).forEach((v) => { if (v.keep) vehicles.push(v); else v.remove(); });
      if (s.away !== 'car' && !(s.remote && s.remote.car)) s.show('parkedCar');   // (the family car is home, unless it's out)
      buddies.slice().forEach((b) => { if (!b.keep) b.remove(); });
      q('seaFx').innerHTML = ''; q('trainFx').innerHTML = '';
      s.show('trains');
      ['partyCloth', 'balloons', 'cake', 'platesReal', 'platesPlastic', 'sortBins', 'trashBag', 'tacos', 'burger', 'fan', 'acAir', 'steam', 'bathBubbles',
        'toyBroken', 'toyFixed', 'toyNew', 'boxClosed', 'heatGlow', 'tv'].forEach(s.hide);
      s.q('boboHouse').classList.remove('win-open', 'lit', 'lights-off');
      s.hide('houseLit');
      Object.keys(WEAR).forEach((w) => s.wear(w, false));
      s.inside(false);
      s.speed = 1;
      container.classList.remove('jammed');
      updateTraffic();
    }
    function updateTraffic() {
      q('traffic2').classList.toggle('hide', s.traffic < 1);
      q('traffic3').classList.toggle('hide', s.traffic < 2);
    }

    /* ── time of day + weather ── */
    function setTime(t, fromEclipse = false) {
      if (!TIMES.includes(t)) t = 'day';
      if (!fromEclipse) endEclipse();
      time = t;
      document.documentElement.dataset.time = t;
      container.classList.toggle('heat-day', level >= 2 && (t === 'day'));
      q('heatHaze').classList.toggle('hide', !(level >= 2 && t === 'day'));
      updateGlows();
    }
    /* Super rare: a solar eclipse. The moon slides in front of the sun, it gets dark for a moment,
       and everybody puts on their (special!) eclipse glasses. */
    let eclipseTimer = 0, beforeEclipse = 'day';
    function eclipse() {
      if (container.classList.contains('eclipse-on')) return;
      beforeEclipse = time;
      container.classList.add('eclipse-on');
      setTime('eclipse', true);
      eclipseTimer = setTimeout(() => { const t = beforeEclipse; endEclipse(); setTime(t, true); }, 7200);
    }
    function endEclipse() {
      clearTimeout(eclipseTimer);
      container.classList.remove('eclipse-on');
    }
    function setWeather(w) {
      const wet = w === 'rain' || w === 'storm';
      svg.classList.toggle('rainy', wet);
      container.classList.toggle('raining', wet);
      container.classList.toggle('storming', w === 'storm');
      container.classList.toggle('fx-storm', w === 'storm');
    }

    /* ── reactions + speech bubble ── */
    function react(kind, ms = 2600) {
      clearTimeout(reactTimer);
      if (kind) monkey.dataset.react = kind; else delete monkey.dataset.react;
      if (kind === 'yay') s.jump();
      if (kind === 'sad') s.droop();
      if (kind && ms) reactTimer = setTimeout(() => delete monkey.dataset.react, ms);
    }
    const headTop = () => [walkPos[0], walkPos[1] - 62 * depthK(walkPos[1])];
    let bubbleW = 120;
    const bubbleScale = (feetY) => clamp(depthK(feetY) * 1.05, 0.72, 1.1);
    // keep the bubble inside the part of the city that's on screen (phones see only a slice of it)
    const bubbleXY = (hx, hy) => {
      const left = vb[2] === 800 ? 0 : clamp(camFocus - vb[2] / 2, 0, 800 - vb[2]), right = left + vb[2];
      return [Math.max(left + bubbleW / 2 + 6, Math.min(right - bubbleW / 2 - 6, hx)), Math.max(vb[1] + 40, hy - 8)];
    };
    const bubbleTransform = (x, y, sc) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc.toFixed(3)})`;
    function placeBubble(ms = 0) {
      const b = q('bubble'), [hx, hy] = headTop();
      const [x, y] = bubbleXY(hx, hy);
      b.style.transition = ms ? `transform ${ms}ms ease-in-out, opacity .25s` : 'opacity .25s';
      b.style.transform = bubbleTransform(x, y, bubbleScale(walkPos[1]));
    }
    // If Bobo is already walking when talking, start the bubble above the head right now
    // and let it travel along for the rest of the walk.
    function placeBubbleWhileWalking() {
      const left = walkEnd - performance.now();
      if (left <= 30) { placeBubble(0); return; }
      const m = new DOMMatrixReadOnly(getComputedStyle(walker).transform);
      const b = q('bubble'), cx = 400 + m.m41, cy = 400 + m.m42;
      const [x0, y0] = bubbleXY(cx, cy - 62 * m.d);
      b.style.transition = 'opacity .25s';
      b.style.transform = bubbleTransform(x0, y0, bubbleScale(cy));
      void b.getBoundingClientRect();
      const [hx, hy] = headTop(), [x1, y1] = bubbleXY(hx, hy);
      b.style.transition = `transform ${Math.round(left)}ms ease-out, opacity .25s`;
      b.style.transform = bubbleTransform(x1, y1, bubbleScale(walkPos[1]));
    }
    // How long a bubble stays: by the length of the text, so every language gets the same reading time
    // (a young reader needs about 1.5 s plus 80 ms per letter; never under 3 s, never over 7 s)
    const readMs = (text) => clamp(1500 + text.length * 80, 3000, 7000);
    function say(text, ms = null) {
      const b = q('bubble'), txt = q('bubbleText'), box = q('bubbleBox');
      clearTimeout(bubbleTimer);
      if (!text || walker.classList.contains('inside')) { b.classList.add('hide'); return; }
      txt.textContent = text;
      bubbleW = Math.min(420, txt.getComputedTextLength() + 22);
      box.setAttribute('x', -bubbleW / 2);
      box.setAttribute('width', bubbleW);
      placeBubbleWhileWalking();
      b.classList.remove('hide');
      restartAnim(b.querySelector('.bubble-in'), 'jump');
      if (ms !== 0) bubbleTimer = setTimeout(() => b.classList.add('hide'), ms || readMs(text));
    }

    function reset() {
      gen++; pending = null;
      svg.querySelectorAll('.pop[data-k], .fade[data-k]').forEach((el) => {
        const visibleAtStart = ['parkedCar', 'bikes_home', 'birds1', 'birds2', 'birds3', 'mHappy', 'ps1', 'farFish', 'crabs', 'butterflies', 'songbirds', 'bees', 'seaTurtle', 'boats', 'vt1', 'vt2', 'vt3', 'vAnimals', 'vBirds', 'hawk', 'pigeons', 'nestLife'];
        el.classList.toggle('hide', !visibleAtStart.includes(el.dataset.k));
      });
      q('fx').innerHTML = ''; q('fxTop').innerHTML = '';
      Object.assign(s, { traffic: 0, energyBad: 0, renew: 0, seaHurt: false, away: null, speed: 1 });
      endEclipse();
      begin();
      place(P.home);
      mood = '';
      setWeather('clear');
      s.updatePlant();
    }

    const hazeFor = () => Math.min(0.6, [0, 0.14, 0.28, 0.42][level] + Math.max(0, s.energyBad - s.renew) * 0.04).toFixed(2);

    /* The climate look. temp = how much warmer than the old normal (the game starts at +1.0 °C).
       Cooler = green, birds, butterflies, fish. Hotter = dry and brown, bugs, the sea rises,
       the coral bleaches and the animals leave. */
    function setStats(temp) {
      climate = temp;
      level = temp < 1.3 ? 0 : temp < 1.7 ? 1 : temp < 2.2 ? 2 : 3;
      [1, 2, 3].forEach((n) => svg.classList.toggle('clim-' + n, level >= n));
      container.classList.toggle('clim-hot', level >= 3);
      container.querySelector('.bd-haze').style.opacity = hazeFor();
      q('seaRise').style.strokeWidth = [0, 10, 20, 30][level];
      ['birds1', 'birds2', 'birds3'].forEach((k, n) => q(k).classList.toggle('hide', level > [1, 0, 0][n]));
      q('butterflies').classList.toggle('hide', level >= 1);
      q('bees').classList.toggle('hide', level >= 1);
      q('songbirds').classList.toggle('hide', level >= 2);
      q('crabs').classList.toggle('hide', level >= 2);
      q('farFish').classList.toggle('hide', level >= 2);
      q('fish').classList.toggle('hide', level >= 3);
      q('seaTurtle').classList.toggle('hide', level >= 2 || s.seaHurt);
      q('vt3').classList.toggle('hide', level >= 1);
      q('vt2').classList.toggle('hide', level >= 2);
      q('vt1').classList.toggle('hide', level >= 3);
      q('vAnimals').classList.toggle('hide', level >= 2);
      q('hawk').classList.toggle('hide', level >= 2);
      q('nestLife').classList.toggle('hide', level >= 2);
      q('vBirds').classList.toggle('hide', level >= 2);
      q('bugs1').classList.toggle('hide', level < 2);
      q('bugs2').classList.toggle('hide', level < 3);
      svg.classList.toggle('coral-pale', level === 2);
      svg.classList.toggle('coral-bleached', level >= 3);
      setTime(time);
      const m = level <= 1 ? 'mHappy' : level === 2 ? 'mMeh' : 'mSad';   // (the hotter the city, the less happy Bobo looks)
      if (m !== mood) {
        ['mHappy', 'mMeh', 'mSad'].forEach((k) => q(k).classList.toggle('hide', k !== m));
        mood = m;
      }
    }

    reset();
    return {
      reset,
      setStats,
      setTime,
      setWeather,
      react,
      say,
      /* Bobo goes to where the next situation happens. Resolves on arrival. */
      event(id) {
        begin();
        const g = gen;
        return s.arrive().then(() => ACTIONS[id].ev(s)).catch((e) => { if (e !== CANCEL) throw e; }).then(() => g === gen);
      },
      /* Plays what the choice does. Resolves when the animation is finished. */
      outcome(id, good) {
        const a = ACTIONS[id][good ? 'good' : 'bad'];
        gen++;
        const g = gen;
        pending = a.apply || null;
        return a.play(s).catch((e) => { if (e !== CANCEL) throw e; }).then(() => {
          if (g === gen && pending) { const p = pending; pending = null; p(s); }
          updateTraffic(); s.updatePlant();
          return sleep(500);
        });
      },
      finishJobs: finishPending,
      setMode: (m) => { s.mode = m; },   // 'bike' or 'car': how Bobo gets around town
      setLines: (fn) => { lineFor = fn; },   // fn(key) → that speech bubble line in the current language
      /* A reward 2 turns later (if Bobo was away on a trip, Bobo comes back first) */
      payoff(id) {
        begin();
        return s.arrive().catch((e) => { if (e !== CANCEL) throw e; }).then(() => ACTIONS[id].pay(s));
      },
      eclipse,
      // the happy ending: a whale comes to say hello
      whale() { s.hide('boats'); s.show('whale'); s.look(600); },
      /* the end of the game: everyone goes home */
      goHome() { begin(); return s.travel(P.home).catch(() => {}); },
      // for the title screen: a happy, clean city
      calm() { container.classList.add('calm'); },
      showcase() { ['solarRoof', 'solarSchool', 'turbines', 'cyclists', 'bikeFriends', 'shadeTrees', 'veggieGarden'].forEach(s.show); s.renew = 3; s.updatePlant(); },
      jump: s.jump,
      droop: s.droop,
    };
  }

  return { create };
})();
