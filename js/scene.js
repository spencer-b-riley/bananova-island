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

  const flies = (x, y) => `<g class="flies" transform="translate(${x} ${y})">${[[0, 0, 0], [10, -6, -0.3], [-8, -10, -0.6], [4, -14, -0.45]].map(([fx, fy, d], k) =>
    `<g transform="translate(${fx} ${fy})"><g class="fly-bug f${k % 2}" style="animation-delay:${d}s"><ellipse class="fwing" cx="-1.3" cy="-1.9" rx="2.1" ry="1.1" fill="#eef4f8" stroke="#9aa5b1" stroke-width=".3"/><ellipse class="fwing" cx="1.3" cy="-1.9" rx="2.1" ry="1.1" fill="#eef4f8" stroke="#9aa5b1" stroke-width=".3"/><ellipse rx="2.3" ry="1.6" fill="#2a2a2a"/></g></g>`).join('')}</g>`;
  // a fish that didn't make it in the too-warm sea (cartoon: belly up, x eye)
  const deadFish = (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-9 0 Q-2 6 6 2 L11 6 V-5 L6 -2 Q-2 -6 -9 0Z" fill="#b4bfb2" stroke="#6f7d6d" stroke-width="1"/><path d="M-6.4 -1.6 l2.4 2.4 M-4 -1.6 l-2.4 2.4" stroke="#3b4540" stroke-width="1"/></g>`;

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
  // (alt = how far up and down the bird drifts while it flies, and how slowly: so they don't all fly on one line)
  const gullFlight = (k, y, sc, dur, delay, left = false, alt = [24, 9]) =>
    `<g data-k="birds${k}" class="fade"><g class="fly${left ? ' left' : ''}" style="animation-duration:${dur}s;animation-delay:${delay}s"><g class="alt" style="--alt:${alt[0]}px;animation-duration:${alt[1]}s;animation-delay:${-alt[1] * 0.4}s"><g transform="translate(0 ${y}) scale(${left ? -sc : sc} ${sc})"><g class="soar">${gull.replace(/<animate /g, `<animate begin="${delay}s" `)}</g></g></g></g></g>`;
  // an airliner, far away and high up (with a white trail); it only comes by now and then
  const PLANE = `<path d="M-34 -1 H-190" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45"/>
      <path d="M-30 0 Q-30 -5 -24 -5 H22 Q30 -5 34 0 Q30 4 22 4 H-24 Q-30 4 -30 0Z" fill="#f4f6f8" stroke="#c8cdd3" stroke-width="1"/>
      <path d="M-4 -2 L-14 -15 H-8 L8 -2Z" fill="#cfd8e0"/><path d="M-4 2 L-12 12 H-6 L8 2Z" fill="#b8c4cf"/>
      <path d="M-26 -4 L-32 -14 H-26 L-18 -4Z" fill="#2f80ed"/><path d="M26 -3 Q30 -2 31 0 H24Z" fill="#9fd3f3"/>
      ${[-16, -10, -4, 2, 8, 14].map((x) => `<circle cx="${x}" cy="-1" r="1" fill="#9fd3f3"/>`).join('')}`;

  const tree = (x, y, sc = 1) => `<g transform="translate(${x} ${y}) scale(${sc})"><g class="tree">
      <path d="M-4 0 L-3 -30 L3 -30 L4 0Z" fill="#9b6a3c"/>
      <g class="crown"><circle cx="0" cy="-44" r="18" class="leaf"/><circle cx="-13" cy="-33" r="12" class="leaf dark"/><circle cx="13" cy="-34" r="13" class="leaf dark"/>
      <circle cx="-6" cy="-50" r="6" fill="#fff" opacity=".2"/></g></g></g>`;
  const bush = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})">
      <circle cx="-12" cy="-8" r="11" class="bush-d"/><circle cx="11" cy="-9" r="12" class="bush-d"/><circle cx="0" cy="-16" r="13" class="bush-l"/>
      <circle cx="-10" cy="-12" r="2" class="berry"/><circle cx="8" cy="-17" r="2" class="berry"/></g>`;
  // street lamp; flip = the arm points left
  const lamp = (x, y, flip, sc = 1) => `<g transform="translate(${x} ${y}) scale(${flip ? -sc : sc} ${sc})"><path d="M0 0 V-44 Q0 -52 8 -52 H11" stroke="#4a5563" stroke-width="3" fill="none"/>
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
    table: `<path d="M-2 0 V-14 M2 0 V-14" stroke="currentColor" stroke-width="3"/><path d="M-22 -15 Q0 -24 22 -15 Q0 -11 -22 -15Z" fill="currentColor"/>
      <g fill="#ffffff" opacity=".3"><circle cx="-12" cy="-16" r="1.4"/><circle cx="-3" cy="-18" r="1.4"/><circle cx="7" cy="-18" r="1.4"/><circle cx="15" cy="-16" r="1.4"/></g>`,
    pillar: `<g fill="currentColor"><rect x="-12" y="-26" width="7" height="26" rx="3.5"/><rect x="-3" y="-36" width="7" height="36" rx="3.5"/><rect x="6" y="-20" width="7" height="20" rx="3.5"/></g>
      <g fill="#00000022"><circle cx="-8.5" cy="-18" r="1.2"/><circle cx="0.5" cy="-28" r="1.2"/><circle cx="0.5" cy="-14" r="1.2"/><circle cx="9.5" cy="-10" r="1.2"/></g>`,
    sponge: `<path d="M-10 0 L-12 -24 Q0 -29 12 -24 L10 0Z" fill="currentColor"/><ellipse cx="0" cy="-24.5" rx="9.5" ry="3" fill="#00000035"/>
      <g fill="#00000020"><circle cx="-5" cy="-14" r="1.6"/><circle cx="4" cy="-9" r="1.6"/><circle cx="2" cy="-18" r="1.4"/></g>`,
    mushroom: `<path d="M-15 0 Q-15 -15 0 -15 Q15 -15 15 0Z" fill="currentColor"/><path d="M0 -14 V-1 M-7 -12 L-4 -1 M7 -12 L4 -1 M-12 -7 L-8 -1 M12 -7 L8 -1" stroke="#00000025" stroke-width="1.2"/>`,
    whip: `<path d="M-6 0 Q-11 -15 -4 -30 M0 0 Q3 -18 -1 -38 M5 0 Q10 -14 7 -28" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    bubble: `<g fill="currentColor"><circle cx="-7" cy="-5" r="5.5"/><circle cx="3" cy="-6" r="6.5"/><circle cx="-2" cy="-15" r="5.5"/><circle cx="8" cy="-15" r="4.5"/></g>
      <g fill="#ffffff" opacity=".35"><circle cx="-8.5" cy="-7" r="1.6"/><circle cx="1.5" cy="-8.5" r="1.8"/><circle cx="-3.5" cy="-17" r="1.5"/></g>`,
    anemone: `<ellipse cx="0" cy="-3" rx="9" ry="4" fill="currentColor"/>
      <g class="sway-soft" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"><path d="M-7 -4 q-6 -8 -4 -15 M-3 -5 q-3 -9 0 -17 M2 -5 q3 -9 1 -17 M6 -4 q6 -8 4 -15"/></g>`,
  };
  const coral = (x, y, type, col, sc = 1) => `<g transform="translate(${x} ${y}) scale(${sc})"><g class="coral c-${col}">${CORAL[type]}</g></g>`;
  // the long reef: a bumpy rock ridge all along the sea floor, covered in all kinds of coral
  const REEF_KINDS = ['staghorn', 'sponge', 'brain', 'table', 'anemone', 'whip', 'pillar', 'mushroom', 'fan', 'bubble', 'tube'];
  // Corals scattered all over the shallow water around the island (the light "lagoon"): not right at the shore,
  // not out in the deep (darker) water, and never where the bridges, their pillars or the pier are.
  const LAGOON = { cx: 400, cy: 450, rx: 590, ry: 170 };
  const SCATTER = (() => {
    const inLagoon = (x, y) => ((x - LAGOON.cx) / LAGOON.rx) ** 2 + ((y - LAGOON.cy) / LAGOON.ry) ** 2 < 0.86;
    const fromShore = (x, y) => Math.hypot(Math.max(-6 - x, 0, x - 806), Math.max(296 - y, 0, y - 534));   // (distance to the island)
    const PILLARS = [-300, -200, -100, -10, 870, 960, 1060, 1160];
    const clear = (x, y) => {
      if ((x < 20 || x > 780) && y > 446 && y < 500) return false;                               // the road bridge
      if (PILLARS.some((px) => x > px - 16 && x < px + 28) && ((y > 318 && y < 380) || (y > 470 && y < 560))) return false;   // its pillars
      if (x > 684 && x < 742 && y > 490 && y < 590) return false;                                 // the harbour pier
      return true;
    };
    let corals = '', weeds = '', k = 0;
    for (let gy = 342; gy < 640; gy += 14) {
      for (let gx = -230; gx < 1040; gx += 24) {
        const n = gy * 7 + gx;
        const x = gx + (rnd(n) - 0.5) * 18, y = gy + (rnd(n + 3) - 0.5) * 9;
        if (!inLagoon(x, y) || fromShore(x, y) < 30 || !clear(x, y) || rnd(n + 7) < 0.15) continue;
        const sc = +(0.24 + clamp((y - 340) / 290, 0, 1) * 0.32).toFixed(2);   // (smaller further back)
        corals += coral(+x.toFixed(1), +y.toFixed(1), REEF_KINDS[k % REEF_KINDS.length], 'abcde'[(k * 3) % 5], sc);
        if (k % 3 === 1) weeds += `<g transform="translate(${(x + 10 * sc / 0.4).toFixed(1)} ${y.toFixed(1)}) scale(${(sc / 0.4).toFixed(2)})"><g class="kelp" style="animation-delay:${(-k * 0.37 % 3).toFixed(2)}s;animation-duration:${3 + (k % 3) * 0.6}s">
          <path d="M0 0 C-3 -6 3 -11 0 -18 M3 0 C6 -5 1 -9 4 -13" stroke="${k % 2 ? '#3f9b5f' : '#58b26e'}" stroke-width="2.2" fill="none" stroke-linecap="round"/></g></g>`;
        k++;
      }
    }
    return { corals, weeds };
  })();
  // the deep water further out is darker (two soft steps)
  const DEEP = [[1.12, 0.14], [1.32, 0.16]].map(([f, o]) => {
    const rx = LAGOON.rx * f, ry = LAGOON.ry * f, l = LAGOON.cx - rx, r = LAGOON.cx + rx;
    return `<path d="M-900 285 H1900 V1000 H-900Z M${l} ${LAGOON.cy} A${rx} ${ry} 0 1 0 ${r} ${LAGOON.cy} A${rx} ${ry} 0 1 0 ${l} ${LAGOON.cy}Z" fill="#06305a" opacity="${o}" fill-rule="evenodd"/>`;
  }).join('');

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
  // a broad hawk wing (shoulder at 0,0, pointing back), with the feather "fingers" at the tip
  const HAWK_WING = 'M0 0 C-6 -6 -18 -9 -30 -8 L-33 -11 L-32.5 -7.5 L-36.5 -8.5 L-34.5 -5.5 L-38.5 -5 L-34.5 -2.6 L-37.5 -1 L-31 .4 C-22 3 -10 4.2 0 3Z';
  const HAWK_T = '0;.1;.22;.34;.46;.6;1';   // (two slow flaps, then a long glide)
  const tilt = (vals) => `<animateTransform attributeName="transform" type="rotate" dur="6s" repeatCount="indefinite" calcMode="spline" values="${vals}" keyTimes="${HAWK_T}" keySplines="${Array(6).fill('.45 0 .55 1').join(';')}"/>`;
  const HAWK = `<g class="hawk-side">
      <g transform="translate(1 -3)"><g>${tilt('34;50;16;46;18;34;34')}<path d="${HAWK_WING}" fill="#5a3a1e" transform="scale(.82 .7)"/></g></g>
      <path d="M-16 1 L-29 -2.5 L-30 2 L-28 6 L-16 3.5Z" fill="#a0673a"/><path d="M-27 -1.5 L-27.5 4.5 M-23 -0.5 L-23.5 4.5" stroke="#5a3a1e" stroke-width="1.2"/>
      <path d="M-17 1 C-11 -4.5 4 -6 12 -3.5 C16 -2 18 0.5 15.5 2.5 C8 5.5 -6 5 -16 3.5Z" fill="#7a4e2a"/>
      <path d="M1 2.2 C7 3.8 12 2.8 15 1.2 C12 -1 6 -1 1 2.2Z" fill="#ead8b8"/>
      <circle cx="14" cy="-3.6" r="4.2" fill="#f4f1ea"/><path d="M17.6 -4.8 Q21.6 -4.2 20.4 -1.2 L17.8 -1.8Z" fill="#f2c94c" stroke="#8a6a1e" stroke-width=".5"/>
      <circle cx="15.4" cy="-4.4" r="1.1" fill="#ffd23f"/><circle cx="15.6" cy="-4.4" r=".55" fill="#23313f"/><path d="M13 -6.4 L17 -5.6" stroke="#6b5a4a" stroke-width="1"/>
      <g transform="translate(2 -1)"><g>${tilt('24;40;4;36;6;24;24')}<path d="${HAWK_WING}" fill="#8a5a33" stroke="#4a2e16" stroke-width=".7"/>
        <path d="M-6 -1 C-14 -3 -22 -3 -29 -2 M-6 1.5 C-14 0 -21 0 -28 .5" stroke="#5a3a1e" stroke-width=".7" fill="none" opacity=".7"/></g></g></g>`;
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
  const exhaust = (x) => `<g class="exhaust"><circle cx="${x}" cy="-8" r="3"/><circle cx="${x - 5}" cy="-11" r="4" style="animation-delay:-.27s"/><circle cx="${x - 11}" cy="-14" r="5" style="animation-delay:-.54s"/></g>`;
  const wheel = (x, r = 7) => `<circle cx="${x}" cy="${-r + 2}" r="${r}" fill="#2b2f36"/><circle cx="${x}" cy="${-r + 2}" r="${r * 0.42}" fill="#b8c0c8"/>`;
  // a little monkey head looking out of a window (faces right)
  const monkeyHead = (x, y, fur, cls = '') => `<g class="${cls}" transform="translate(${x} ${y})"><circle cx="-4.6" cy="-.5" r="2.4" fill="${fur}"/><circle r="5.2" fill="${fur}"/>
      <ellipse cx="2.2" cy="1" rx="3.4" ry="3" fill="#e8c39e"/><circle cx="1.6" cy="-1.5" r=".95" fill="#23313f"/><path d="M1.2 2.4 q1.6 1.3 3.2 -.2" stroke="#5a2d0c" stroke-width=".8" fill="none"/></g>`;
  const car = (c, fur = '#7a4a24', back = monkeyHead(-3, -23, '#8b5a2b'), driver = true) => `${exhaust(-38)}
      <path d="M-32 -8 Q-32 -19 -24 -19 L-16 -19 L-8 -31 L12 -31 L22 -19 L28 -19 Q34 -19 34 -11 L34 -6 L-32 -6Z" fill="${c}"/>
      <path d="M-5 -28 L3 -28 L3 -20 L-11 -20Z M7 -28 L11 -28 L18 -20 L7 -20Z" fill="#cfefff"/>
      ${driver ? monkeyHead(11, -23, fur) : ''}<g class="passenger">${back}</g>
      <rect x="27" y="-16" width="6" height="4" rx="1" fill="#fff3a8"/><rect x="-32" y="-16" width="4" height="4" fill="#ff5b4a"/><path class="beam" d="M33 -14 L80 -24 L80 -2Z"/>
      ${wheel(-17)}${wheel(17)}`;
  // more kinds of vehicles driving around town (all facing right, wheels on y = 0, each with a monkey driver)
  const van = (c, fur) => `${exhaust(-40)}
      <path d="M-35 -7 V-33 Q-35 -38 -30 -38 H15 Q21 -38 25 -31 L31 -21 Q36 -20 36 -12 V-7Z" fill="${c}"/>
      <path d="M16 -34 H19 Q22 -33 24 -29 L28 -22 H16Z" fill="#cfefff"/>
      ${[-29, -16, -3].map((x) => `<rect x="${x}" y="-33" width="10" height="9" rx="1.5" fill="#cfefff"/>`).join('')}
      ${monkeyHead(21, -26, fur)}<path d="M-35 -17 H36" stroke="#fff" stroke-width="2" opacity=".45"/>
      <rect x="31" y="-15" width="5" height="4" rx="1" fill="#fff3a8"/><rect x="-35" y="-15" width="3" height="4" fill="#ff5b4a"/><path class="beam" d="M36 -13 L82 -23 L82 -1Z"/>
      ${wheel(-21)}${wheel(21)}`;
  const pickup = (c, fur) => `${exhaust(-38)}
      <path d="M-35 -7 V-21 H1 V-30 Q1 -34 5 -34 H15 L23 -22 Q34 -21 34 -12 V-7Z" fill="${c}"/>
      <path d="M6 -31 H14 L20 -23 H6Z" fill="#cfefff"/><rect x="-31" y="-28" width="13" height="7" rx="1" fill="#c98f4f" stroke="#8b5a2b" stroke-width="1"/>
      <rect x="-15" y="-26" width="9" height="5" rx="1" fill="#2fb35a"/>${monkeyHead(11, -24, fur)}
      <rect x="29" y="-16" width="5" height="4" rx="1" fill="#fff3a8"/><rect x="-35" y="-16" width="3" height="4" fill="#ff5b4a"/><path class="beam" d="M34 -14 L80 -24 L80 -2Z"/>
      ${wheel(-21, 7.5)}${wheel(21, 7.5)}`;
  const boxTruck = (c, fur) => `${exhaust(-46)}
      <rect x="-44" y="-42" width="52" height="35" rx="2" fill="#f7f7f7" stroke="#c8cdd3" stroke-width="1.5"/><path d="M-38 -27 h40" stroke="${c}" stroke-width="5"/>
      <path d="M9 -33 H22 L32 -20 Q36 -19 36 -12 V-7 H8 V-31Z" fill="${c}"/><path d="M13 -30 H21 L28 -21 H13Z" fill="#cfefff"/>${monkeyHead(20, -23, fur)}
      <rect x="31" y="-15" width="5" height="4" rx="1" fill="#fff3a8"/><path class="beam" d="M36 -13 L82 -23 L82 -1Z"/>
      ${wheel(-31)}${wheel(-16)}${wheel(23)}`;
  const bus = (c, fur) => `${exhaust(-56)}
      <rect x="-54" y="-42" width="104" height="36" rx="6" fill="${c}"/>
      ${[-48, -34, -20, -6, 8, 22].map((x) => `<rect x="${x}" y="-37" width="11" height="12" rx="1.5" fill="#cfefff"/>`).join('')}
      <path d="M37 -37 H45 Q49 -37 49 -32 V-23 H37Z" fill="#cfefff"/>${monkeyHead(42, -29, fur)}
      <path d="M-54 -19 H50" stroke="#fff" stroke-width="2.5" opacity=".7"/><rect x="45" y="-15" width="5" height="4" rx="1" fill="#fff3a8"/><path class="beam" d="M50 -13 L96 -23 L96 -1Z"/>
      ${wheel(-36)}${wheel(33)}`;
  const MODELS = { car: (c, fur) => car(c, fur), van, pickup, boxTruck, bus };
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
      <ellipse class="foot fl" cx="-11" cy="24" rx="9" ry="6" fill="${fur}"/><ellipse class="foot fr" cx="11" cy="24" rx="9" ry="6" fill="${fur}"/>
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
  const MONKEY_SC = 0.4;   // how big a monkey is in the city (smaller than a car, much smaller than a truck or a bus)
  const MONKEY_FIT = `translate(0 ${-30 * MONKEY_SC}) scale(${MONKEY_SC})`;   // Bobo-sized, standing on the origin
  const HEAD_H = 100 * MONKEY_SC;   // (from the feet to the top of the head)
  const RIDE_SC = 0.35;             // a monkey on a bike (the same size as a walking monkey)
  // A monkey riding a bike, seen from the side (faces right; the wheels touch the ground at y = 0).
  // shirt = null: just fur with a light belly (Bobo). The legs pedal and the wheels turn.
  const sideWheel = (x) => `<g transform="translate(${x} -15)"><circle r="15" fill="none" stroke="#23313f" stroke-width="4"/>
      <g class="wheelspin"><path d="M-13 0 H13 M0 -13 V13 M-9 -9 L9 9 M9 -9 L-9 9" stroke="#9aa5b1" stroke-width="1.3"/></g><circle r="2.6" fill="#555b63"/></g>`;
  const sideRider = (fur, shirt, pack = false) => `<g class="rider">
      <path d="M-12 -50 C-30 -48 -36 -64 -28 -75" stroke="${fur}" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${pack ? '<rect x="-28" y="-77" width="15" height="25" rx="5" fill="#ff6b4a"/><rect x="-28" y="-62" width="6" height="7" rx="2" fill="#e04f30"/>' : ''}
      <g transform="translate(-6 -44)"><g class="leg-b"><path d="M0 0 L12 12 L8 27" stroke="${fur}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/><ellipse cx="10" cy="28" rx="5" ry="3" fill="${fur}" opacity=".75"/></g></g>
      ${sideWheel(-27)}${sideWheel(27)}<circle cx="23" cy="-33" r="2.6" fill="#fff3a8"/><path class="beam" d="M25 -32 L66 -42 L66 -20Z"/>
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
  const PARKED_BIKE = '<g transform="scale(.29)"><circle cx="-26" cy="-14" r="14" fill="none" stroke="#23313f" stroke-width="4"/><circle cx="26" cy="-14" r="14" fill="none" stroke="#23313f" stroke-width="4"/><path d="M-26 -14 L0 -14 L-8 -36 Z M0 -14 L18 -36 L-8 -36 M26 -14 L18 -36 L16 -44 M11 -45 H22 M-14 -38 H-2" stroke="#ff5b4a" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>';
  const rack = (x, y, k) => `<g transform="translate(${x} ${y})"><path d="M0 0 v-7 q0 -4 4 -4 q4 0 4 4 v7 M10 0 v-7 q0 -4 4 -4 q4 0 4 4 v7 M20 0 v-7 q0 -4 4 -4 q4 0 4 4 v7" stroke="#8a939d" stroke-width="1.6" fill="none"/>
      <g data-k="bikes_${k}" class="fade hide"><g transform="translate(7 0)">${PARKED_BIKE}</g><g data-k="bikes2_${k}" class="fade hide" transform="translate(17 0)">${PARKED_BIKE}</g><g data-k="bikes3_${k}" class="fade hide" transform="translate(27 0)">${PARKED_BIKE}</g></g></g>`;
  const rider = (fur, shirt, x) => `<g class="tcar" data-lane="bike" data-x="${x}" style="transform:translateX(${x}px)"><g transform="translate(0 466.5) scale(.32)">${sideRider(fur, shirt)}</g></g>`;

  // cars looping along the road (lane A goes left, lane B goes right), each with a happy monkey driver
  const LANE_A = 468, LANE_B = 477;
  // (big vehicles are drawn bigger: a bus or a delivery truck is much taller than a monkey)
  const MODEL_SCALE = { car: 1.15, van: 1.2, pickup: 1.17, boxTruck: 1.45, bus: 1.45 };
  const MODEL_SIZE = { car: [-32, 34], van: [-35, 36], pickup: [-35, 34], boxTruck: [-44, 36], bus: [-54, 50] };   // (back and front, facing right)
  // a vehicle on the main road, starting at x (the traffic model drives it, see "Smart traffic")
  // (the traffic model picks each vehicle's kind and colour: mostly little cars, big ones only now and then)
  const laneCar = (lane, x) => `<g class="tcar puffing" data-lane="${lane}" data-x="${x}" style="transform:translateX(${x}px)"><g></g></g>`;

  function buildSVG(u) {
    const piers = (y, h) => [-300, -200, -100, -10, 870, 960, 1060, 1160].map((x) =>
      `<rect x="${x}" y="${y}" width="12" height="${h}" fill="#9aa5b1"/>`).join('');
    return `
<svg class="scene-main" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Bobo's City" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="${u}beachClip"><rect x="-200" y="486" width="1200" height="200"/></clipPath>
    <pattern id="${u}tufts" width="26" height="17" patternUnits="userSpaceOnUse"><path d="M3 13 l1.4 -4 l1.4 4 M7 13 l.8 -3 M15 6 l1.2 -3.6 l1.2 3.6 M21 15 l1 -3 l1 3 M11 16 l.7 -2.5" stroke="#2e6b2a" stroke-width=".9" fill="none" opacity=".5"/></pattern>
    <linearGradient id="${u}sea" gradientUnits="userSpaceOnUse" x1="0" y1="285" x2="0" y2="900"><stop offset="0" class="st-sea-top"/><stop offset=".35" class="st-sea-bot"/><stop offset="1" class="st-sea-deep"/></linearGradient>
  </defs>
  <g class="camera">

  <g data-k="skyClouds"></g>
  <!-- airplanes now and then, high up (far away, so they're small) -->
  <g class="plane" style="animation-duration:150s;animation-delay:-120s"><g transform="translate(0 112) scale(.32)">${PLANE}</g></g>
  <g class="plane left" style="animation-duration:210s;animation-delay:-40s"><g transform="translate(0 138) scale(-.22 .22)">${PLANE}</g></g>
  ${gullFlight(1, 128, 0.5, 30, -4, false, [30, 11])}${gullFlight(2, 228, 0.28, 40, -20, true, [18, 8])}${gullFlight(3, 540, 0.6, 26, -11, false, [14, 6])}
  <!-- one hawk circling high above the city -->
  <g data-k="hawk" class="fade"><g class="hawk-fly"><g class="alt" style="--alt:40px;animation-duration:17s"><g transform="translate(0 165) scale(-0.55 0.55)"><g class="soar">${HAWK}</g></g></g></g></g>

  <g class="ripples" fill="none" stroke="#ffffff" stroke-width="1.4">${[[120, 560, 0], [300, 590, -1.6], [470, 556, -3.1], [610, 600, -0.8], [760, 566, -2.3], [-30, 420, -1.2], [835, 380, -2.7], [40, 640, -3.6], [540, 646, -0.4], [230, 630, -2.9]]
    .map(([x, y, d]) => `<ellipse class="ripple" cx="${x}" cy="${y}" rx="12" ry="3.2" style="animation-delay:${d}s"/>`).join('')}</g>
  <g class="waves"><path d="M-260 320 q15 -8 30 0 q15 8 30 0 M900 318 q15 -8 30 0 q15 8 30 0 M-120 480 q15 -8 30 0 q15 8 30 0 M960 490 q15 -8 30 0 q15 8 30 0 M120 560 q15 -8 30 0 q15 8 30 0 M560 580 q15 -8 30 0 q15 8 30 0"/></g>
  <g data-k="seaFx"></g>

  <!-- offshore wind turbines (a reward) -->
  ${item('turbines', 0, 0, `${turbine(36, 300, 1, 0)}${turbine(82, 296, 0.85, -0.7)}${turbine(122, 293, 0.7, -1.3)}`, 'fade')}

  <!-- far away: a volcano island; its trees and animals come and go with the climate -->
  <g data-k="boltsBack"></g>
  ${VOLCANO}
  <g data-k="boltsFar"></g>
  ${DEEP}<ellipse class="lagoon" cx="${LAGOON.cx}" cy="${LAGOON.cy}" rx="${LAGOON.rx}" ry="${LAGOON.ry}"/>
  <g data-k="farFish" class="fade"><g class="swim" style="animation-duration:60s;animation-delay:-10s"><g transform="translate(0 346) scale(.28)">${fish('#ffd23f')}</g></g>
    <g class="swim" style="animation-duration:66s;animation-delay:-25s"><g transform="translate(0 360) scale(.3)">${fish('#7ad3ff')}</g></g></g>

  <!-- bridges: the train and the road go across the sea to the other towns -->
  <!-- corals and seaweed on the sea floor (under everything else in the sea) -->
  <g data-k="reef" class="reef">${SCATTER.corals}</g>
  <g data-k="seaweed" class="fade">${SCATTER.weeds}</g>
  ${piers(320, 50)}${piers(478, 70)}

  <!-- the island -->
  <path class="foam" d="M30 298 C160 284 640 284 770 298 C808 304 814 360 812 432 C810 508 790 538 744 538 L56 538 C10 538 -10 508 -12 432 C-14 360 -6 304 30 298Z" fill="none" stroke="#e6f9ff" stroke-width="5" opacity=".7"/>
  <path d="M34 296 C160 282 640 282 766 296 C800 302 808 360 806 430 C804 502 786 534 744 534 L56 534 C14 534 -4 502 -6 430 C-8 360 0 302 34 296Z" fill="#fbe3a2"/>
  <path data-k="seaRise" class="sea-rise" clip-path="url(#${u}beachClip)" d="M34 296 C160 282 640 282 766 296 C800 302 808 360 806 430 C804 502 786 534 744 534 L56 534 C14 534 -4 502 -6 430 C-8 360 0 302 34 296Z" fill="none" stroke="url(#${u}sea)"/>
  <path class="grass" d="M44 304 C170 292 630 292 756 304 C786 310 792 360 790 430 C788 478 770 490 738 490 L62 490 C30 490 12 478 10 430 C8 360 14 310 44 304Z"/>
  <path class="grass light" d="M60 310 C180 300 620 300 740 310 C766 316 770 340 760 352 L40 352 C30 340 34 316 60 310Z"/>
  <path d="M44 304 C170 292 630 292 756 304 C786 310 792 360 790 430 C788 478 770 490 738 490 L62 490 C30 490 12 478 10 430 C8 360 14 310 44 304Z" fill="url(#${u}tufts)"/>

  <!-- lightning behind the skyscrapers (the buildings hide the bottom of it, so it looks far away) -->
  <g data-k="boltsMid"></g>
  <!-- far back: skyscrapers and the power plant -->
  <g class="towers">
    <rect x="286" y="190" width="40" height="124" fill="#8fb3d9"/><rect x="286" y="190" width="40" height="8" fill="#6f93b9"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((r) => `<rect class="win${(r * 3 + 2) % 5 < 2 ? ' unlit' : ''}" x="292" y="${204 + r * 13}" width="10" height="7"/><rect class="win${(r * 3 + 4) % 5 < 2 ? ' unlit' : ''}" x="310" y="${204 + r * 13}" width="10" height="7"/>`).join('')}
    <rect x="332" y="140" width="52" height="174" fill="#f2c94c"/><path d="M332 140 L358 118 L384 140Z" fill="#e0a92f"/><path d="M358 118 V100" stroke="#e0a92f" stroke-width="3"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => `<rect class="win${(r * 3 + 6) % 5 < 2 ? ' unlit' : ''}" x="339" y="${152 + r * 14}" width="10" height="8"/><rect class="win${(r * 3 + 8) % 5 < 2 ? ' unlit' : ''}" x="353" y="${152 + r * 14}" width="10" height="8"/><rect class="win${(r * 3 + 10) % 5 < 2 ? ' unlit' : ''}" x="367" y="${152 + r * 14}" width="10" height="8"/>`).join('')}
    <rect x="390" y="172" width="46" height="142" fill="#ff9f80"/><rect x="390" y="172" width="46" height="6" fill="#e9805e"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => `<rect class="win${(r * 3 + 12) % 5 < 2 ? ' unlit' : ''}" x="397" y="${186 + r * 14}" width="12" height="8"/><rect class="win${(r * 3 + 14) % 5 < 2 ? ' unlit' : ''}" x="417" y="${186 + r * 14}" width="12" height="8"/>`).join('')}
    <rect x="442" y="222" width="34" height="92" fill="#9fd8c9"/>
    ${[0, 1, 2, 3, 4, 5].map((r) => `<rect class="win${(r * 3 + 16) % 5 < 2 ? ' unlit' : ''}" x="448" y="${232 + r * 13}" width="9" height="7"/><rect class="win${(r * 3 + 18) % 5 < 2 ? ' unlit' : ''}" x="462" y="${232 + r * 13}" width="9" height="7"/>`).join('')}
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
  <g class="station closed">
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
  <g class="bays" stroke="#fff" stroke-width="1.2" opacity=".85"><path d="M138 373.5 v4 M200 373.5 v4 M262 373.5 v4 M318 373.5 v4"/></g>
  <g fill="#fff" opacity=".8" font-size="6" font-weight="900" font-family="Arial, sans-serif"><text x="166" y="377">P</text><text x="287" y="377">P</text></g>
  <!-- the shops' car park, right across the street from the thrift store and the mall -->
  <rect x="482" y="375" width="112" height="21" class="road"/><path d="M482.5 377 V395.5 H593.5 V377" stroke="#d6dbe0" stroke-width="1" fill="none"/><path d="M538 380 v14" stroke="#fff" stroke-width="1.2" opacity=".85"/>
  <g fill="#fff" opacity=".8" font-size="7" font-weight="900" font-family="Arial, sans-serif" text-anchor="middle"><text x="511" y="393">P</text><text x="565" y="393">P</text></g>
  <!-- a little car park by the station, to the right of the little street -->
  <rect x="244" y="333" width="56" height="21" class="road"/><path d="M246 333.5 H299.5 V353.5 H246" stroke="#d6dbe0" stroke-width="1" fill="none"/>
  <text x="274" y="351" text-anchor="middle" fill="#fff" opacity=".8" font-size="6" font-weight="900" font-family="Arial, sans-serif">P</text>
  ${rack(182, 365, 'school')}${rack(306, 356, 'station')}${rack(596, 365, 'mall')}
  <!-- street lights along the street at the back -->
  ${lamp(30, 362, false, 0.7)}${lamp(412, 362, false, 0.7)}${lamp(252, 384, false, 0.7)}${lamp(612, 384, true, 0.7)}
  <!-- road signs: the shops' car park -->
  <g class="signs">
    <path d="M475 396 V378" stroke="#6b7280" stroke-width="1.6"/><rect x="470" y="367" width="10" height="10" rx="2" fill="#2f80ed"/><text x="475" y="375" text-anchor="middle" font-size="7.5" font-weight="900" fill="#fff" font-family="Arial, sans-serif">P</text>
  </g>
  <!-- the recycling center (a reward) behind Bobo's house -->
  ${item('recycling', 368, 362, `<rect x="-24" y="-34" width="48" height="34" rx="3" fill="#2fb35a"/><path d="M-28 -34 H28 L24 -41 H-24Z" fill="#23863e"/>
      <g transform="translate(0 -18)" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"><path d="M-7 5 A8 8 0 0 1 -5 -7"/><path d="M5 -7 A8 8 0 0 1 8 4"/><path d="M4 8 A8 8 0 0 1 -7 7"/></g>
      <rect x="-22" y="-7" width="11" height="7" fill="#2f80ed"/><rect x="-6" y="-7" width="11" height="7" fill="#ffd23f"/><rect x="10" y="-7" width="11" height="7" fill="#9aa5b1"/>`)}
  <g class="school closed">
    <rect x="40" y="312" width="136" height="50" fill="#ffcf5a"/><rect x="36" y="306" width="144" height="7" rx="2" fill="#c98f4f"/>
    <path d="M90 306 V290 L108 276 L126 290 V306Z" fill="#ffcf5a" stroke="#c98f4f" stroke-width="3"/><circle cx="108" cy="292" r="7" fill="#fff" stroke="#23313f" stroke-width="1.5"/><path d="M108 292 V287 M108 292 h4" stroke="#23313f" stroke-width="1.5"/>
    ${[50, 70, 136, 156].map((x) => `<rect class="win" x="${x}" y="320" width="13" height="12" rx="1"/><rect class="win" x="${x}" y="337" width="13" height="11" rx="1"/>`).join('')}
    <rect x="98" y="336" width="20" height="26" fill="#2f80ed"/><path d="M108 336 V362" stroke="#1d5fae" stroke-width="2"/>
    <text x="108" y="328" text-anchor="middle" font-size="9" font-weight="900" fill="#c0392b">A B C</text>
    <path d="M108 276 V264" stroke="#9aa5b1" stroke-width="2"/><path d="M109 264 l12 4 l-12 4Z" fill="#ff6fa8" class="flag"/>
    ${item('solarSchool', 46, 296, solar(10, 3), 'fade')}
    ${item('swapBox', 74, 362, `<rect x="-12" y="-14" width="24" height="14" rx="2" fill="#c98f4f" stroke="#8b5a2b" stroke-width="1.5"/><circle cx="-5" cy="-17" r="4" fill="#ff5b4a"/><rect x="0" y="-22" width="8" height="8" fill="#2f80ed"/><path d="M-9 -7 h18" stroke="#fff" stroke-width="2"/>`)}
  </g>
  <g class="thrift closed">
    <rect x="424" y="324" width="76" height="38" fill="#b388ff"/><rect x="420" y="308" width="84" height="15" rx="3" fill="#7e57c2"/>
    <path d="M454 320 q8 -9 16 0 M462 311 v4" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M450 320 h24" stroke="#fff" stroke-width="2.2"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((k) => `<path d="M${422 + k * 12} 323 h12 v6 q-6 5 -12 0Z" fill="${k % 2 ? '#fff' : '#ff6fa8'}"/>`).join('')}
    <rect class="win" x="430" y="336" width="20" height="18" rx="2"/><path d="M434 340 l3 -2 h6 l3 2 l-2 3 v8 h-8 v-8Z" fill="#2fb35a"/>
    <rect x="455" y="338" width="16" height="24" fill="#5e35b1"/><rect class="win" x="476" y="336" width="18" height="18" rx="2"/>
    ${item('clothesRack', 505, 362, `<path d="M-14 0 V-24 H14 V0" stroke="#6b5a4a" stroke-width="2" fill="none"/><path d="M-11 -24 l-2 4 v12 h8 v-12 l-2 -4Z" fill="#ff6fa8"/><path d="M-1 -24 l-2 4 v12 h8 v-12 l-2 -4Z" fill="#ffd23f"/><path d="M8 -24 l-2 4 v12 h7 v-12 l-2 -4Z" fill="#2f80ed"/>`)}
  </g>
  <g class="mall closed">
    <rect x="514" y="300" width="120" height="62" fill="#8fb3d9"/><rect x="510" y="294" width="128" height="8" rx="2" fill="#6f93b9"/>
    <rect x="548" y="304" width="52" height="15" rx="4" fill="#ff5b4a"/><path d="M566 309 h16 l-2 8 h-12Z M569 309 q5 -7 10 0" fill="none" stroke="#fff" stroke-width="2"/>
    ${[520, 538, 600, 618].map((x) => `<rect class="win" x="${x}" y="324" width="12" height="14" rx="1"/>`).join('')}
    <rect x="560" y="330" width="28" height="32" fill="#cfefff" stroke="#6f93b9" stroke-width="2"/><path d="M574 330 V362" stroke="#6f93b9" stroke-width="2"/>
    <text x="609" y="347" font-size="9" font-weight="900" fill="#fff">SALE</text>
  </g>
  ${tree(640, 340, 0.75)}
  <!-- a nest at the top of the tree; the chicks are gone when it gets too hot -->
  <g transform="translate(636 296)">${NEST.replace('MOM', songbird(0, 0, '#ff5b4a', 0))}</g>
  ${item('cows', 0, 0, `<path d="M652 362 V348 M752 362 V348 M652 351 H752 M652 357 H752" stroke="#a0673a" stroke-width="2"/>
      <g transform="translate(676 362) scale(.8)">${cow(0, 0, false)}</g><g transform="translate(718 360) scale(.8)">${cow(0, 0, true)}</g>
      <g class="cow-gas">${puffs(660, 340, 3, 5, '#a6b48a', 3)}</g>`)}

  <!-- the bike group (a reward): Bobo's two friends ride to school together -->
  <g data-k="bikeFriends" class="fade hide"><g class="to-school"><g transform="translate(0 376) scale(-.18 .18)">${sideRider('#d4a24c', '#ffd23f')}</g>
    <g transform="translate(20 377) scale(-.18 .18)">${sideRider('#b0602e', '#2fb35a')}</g></g></g>
  <g data-k="backFx"></g>
  <!-- Bobo walks here while in the back row (so the houses stay in front of Bobo) -->
  <g data-k="backLayer"></g>

  <!-- front row: the houses, the garden, the park (drawn 20 lower than the numbers inside) -->
  <g transform="translate(0 20)">
  <!-- Bobo's driveway, to the right of the house (the family car parks at the top) -->
  <path d="M416 438 V392 Q416 388 420 388 H448 Q452 388 452 392 V438Z" class="road"/>
  <rect x="14" y="426" width="772" height="12" class="pave"/>
  <!-- the bike lane on this side of the road (Bobo bikes here, so he never has to cross the cars) -->
  <rect x="-800" y="432.5" width="2600" height="5.5" fill="#4c9a6a"/><path d="M-800 432.5 H1800" stroke="#fff" stroke-width="1" opacity=".8"/>
  ${[60, 180, 520, 700].map((x) => `<g transform="translate(${x} 436.4) scale(.07)" opacity=".7"><circle cx="-28" cy="0" r="14" fill="none" stroke="#fff" stroke-width="8"/><circle cx="28" cy="0" r="14" fill="none" stroke="#fff" stroke-width="8"/><path d="M-28 0 L-6 0 L10 -18 L28 0" stroke="#fff" stroke-width="8" fill="none"/></g>`).join('')}
  <!-- a zebra crossing where the little street meets the main road (asphalt, the cars drive across it) -->
  <rect x="218" y="426" width="28" height="12" class="road"/>
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
  ${item('partyChairs', 0, 0, [462, 482, 528].map((x) => `<g transform="translate(${x} 420)"><rect x="-8" y="-21" width="16" height="3.4" rx="1.5" fill="#8b5a2b"/><path d="M-6.5 -18 V0 M6.5 -18 V0" stroke="#8b5a2b" stroke-width="2.4"/><rect x="-9" y="-3" width="18" height="3.4" rx="1" fill="#a0673a"/></g>`).join(''), 'fade')}
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

  ${rack(298, 426, 'home')}
  <!-- pigeons pecking on the pavement (behind the road, so the cars drive in front of them) -->
  <g data-k="pigeons" class="fade">${pigeon(188, 430, false, 0)}${pigeon(596, 430, true, -1.1)}</g>
  <!-- the toy in front of Bobo's house -->
  ${item('toyBroken', 384, 436, `<g transform="rotate(-14)"><path d="M-14 -10 h28 v8 h-28Z" fill="#ff5b4a"/><circle cx="-8" cy="0" r="4" fill="#23313f"/></g><circle cx="12" cy="0" r="4" fill="#23313f"/><path d="M2 -14 l3 -4 l2 4" stroke="#23313f" stroke-width="1.5" fill="none"/>`)}
      ${item('toyFixed', 384, 436, `<path d="M-14 -10 h28 v8 h-28Z" fill="#ff5b4a"/><path d="M-6 -16 h12 v6 h-12Z" fill="#cfefff"/><circle cx="-8" cy="0" r="4" fill="#23313f"/><circle cx="8" cy="0" r="4" fill="#23313f"/><path d="M-2 -6 h4" stroke="#ffd23f" stroke-width="3"/>`)}
      ${item('toyNew', 384, 436, `<path d="M-14 -10 h28 v8 h-28Z" fill="#2f80ed"/><path d="M-6 -16 h12 v6 h-12Z" fill="#cfefff"/><circle cx="-8" cy="0" r="4" fill="#23313f"/><circle cx="8" cy="0" r="4" fill="#23313f"/>`)}
  </g>

  <!-- Bobo -->
  <g data-k="midLayer"><g data-k="walkerWrap" transform="translate(400 400)"><g class="walker"><g transform="${MONKEY_FIT}"><g data-k="monkey"><g class="mjump"><g class="bob">
    <path d="M16 12 C46 14 52 -18 34 -26 C26 -28 24 -18 32 -16" stroke="#7a4a24" stroke-width="6" fill="none" stroke-linecap="round"/>
    <g data-k="mPack" class="fade hide"><rect x="-29" y="-20" width="58" height="38" rx="10" fill="#ff6b4a"/><rect x="-29" y="2" width="10" height="10" rx="2" fill="#e04f30"/><rect x="19" y="2" width="10" height="10" rx="2" fill="#e04f30"/></g>
    <ellipse class="foot fl" cx="-11" cy="24" rx="9" ry="6" fill="#7a4a24"/><ellipse class="foot fr" cx="11" cy="24" rx="9" ry="6" fill="#7a4a24"/>
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
    <g data-k="mRide" class="fade hide"><g class="ride-dir" transform="scale(${RIDE_SC} ${RIDE_SC})"><g class="rv-back">${backRider('#8b5a2b')}</g><g class="rv-front" style="display:none">${frontRider('#8b5a2b', null, true)}</g></g></g>
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
  <!-- the zebra crossing in front of Bobo's house (to the beach) -->
  <rect x="317" y="437" width="26" height="32" class="road"/>
  <g fill="#fff" opacity=".92">${[440, 445, 450, 455, 460, 465].map((y) => `<rect x="320" y="${y}" width="20" height="2.2"/>`).join('')}</g>
  <rect x="-800" y="459" width="2600" height="9" fill="#4c9a6a"/><path d="M-800 459.5 H1800" stroke="#fff" stroke-width="1.6"/><path d="M-800 468 H1800" stroke="#c8cdd3" stroke-width="2"/>
  ${[100, 300, 500, 700].map((x) => `<g transform="translate(${x} 465.5) scale(.12)" opacity=".6"><circle cx="-28" cy="0" r="14" fill="none" stroke="#fff" stroke-width="7"/><circle cx="28" cy="0" r="14" fill="none" stroke="#fff" stroke-width="7"/><path d="M-28 0 L-6 0 L10 -18 L28 0" stroke="#fff" stroke-width="7" fill="none"/></g>`).join('')}
  <!-- cars, vans, a pickup, a delivery truck and a bus (more of them come when the family drives a lot) -->
  <!-- (the far lane is drawn first, so the near lane is always in front of it) -->
  <g data-k="traffic">${laneCar('A', 700)}</g>
  <g data-k="traffic2" class="fade hide">${laneCar('A', -300)}</g>
  <g data-k="traffic3" class="fade hide">${laneCar('A', 200)}</g>
  <g data-k="trafficB">${laneCar('B', 250)}</g>
  <g data-k="traffic2B" class="fade hide">${laneCar('B', 1000)}</g>
  <g data-k="traffic3B" class="fade hide">${laneCar('B', -200)}</g>
  <g data-k="cyclists" class="fade hide">${rider('#8d8f94', '#ffd23f', 200)}</g>
  </g>
  <g data-k="roadFx"></g>

  <!-- the beach + the sea in front -->
  <g transform="translate(0 24)">
  <g class="pebbles">${PEBBLES}</g>
  ${[110, 286, 520, 650].map((x) => lamp(x, 468)).join('')}
  ${item('beachTrash', 0, 0, `${bottle(612, 482, 80, 1.1)}${bottle(640, 480, -60, 1.1)}<path d="M582 482 l10 -3 l2 5Z" fill="#ff6fa8"/>`, 'fade')}
  ${item('beachTurtle', 652, 480, `<g class="float">${turtle(0, 0, 0.8)}</g>`)}
  <g data-k="crabs" class="fade">${crab(150, 484, 0)}${crab(470, 486, -5)}</g>
  ${item('heatJunk', 0, 0, `${deadFish(392, 485, -8)}${deadFish(536, 489, 12)}${bottle(452, 486, 70, 0.9)}${bottle(298, 489, -50, 0.8)}<path d="M600 487 l9 -3 l2 5 l-8 2Z" fill="#ff6fa8" opacity=".9"/>`, 'fade')}
  ${item('cleanBeach', 600, 486, `<path d="M0 0 V-22" stroke="#8b5a2b" stroke-width="2.5"/><rect x="-16" y="-36" width="32" height="18" rx="3" fill="#fff8e1" stroke="#8b5a2b" stroke-width="2"/>
    <g transform="translate(-6 -27) scale(.5)"><path d="M-12 0 Q-4 -9 6 -3 L12 -9 V9 L6 3 Q-4 9 -12 0Z" fill="#4fc3f7"/></g><path d="M8.5 -22.5 L4.6 -26.4 A2.2 2.2 0 0 1 8.5 -29.2 A2.2 2.2 0 0 1 12.4 -26.4Z" fill="#ff5b4a"/>
    <g transform="translate(24 0)"><path d="M-6 -12 H6 L5 0 H-5Z" fill="#2fb35a" stroke="#23863e" stroke-width="1.2"/><rect x="-7" y="-14.5" width="14" height="3" rx="1" fill="#23863e"/></g>
    <g transform="translate(40 0)"><path d="M-6 -12 H6 L5 0 H-5Z" fill="#2f80ed" stroke="#1d5fae" stroke-width="1.2"/><rect x="-7" y="-14.5" width="14" height="3" rx="1" fill="#1d5fae"/></g>`)}
  </g>
  <!-- the harbor: a wooden pier with a crane -->
  <g class="harbor">
    <path d="M700 512 H724 V566 H700Z" fill="#b5773f"/><path d="M700 520 H724 M700 530 H724 M700 540 H724 M700 550 H724 M700 560 H724" stroke="#8b5a2b" stroke-width="1.2"/>
    <path d="M703 566 V578 M721 566 V578" stroke="#6b4423" stroke-width="3"/>
    <path d="M708 548 V498 L742 498 M708 512 L722 498 M742 498 V512" stroke="#ffb627" stroke-width="3" fill="none"/><rect x="738" y="512" width="8" height="6" fill="#555b63"/>
    <!-- a trash bin on the beach by the pier -->
    <g transform="translate(684 507)"><path d="M-5 -12 H5 L4.2 0 H-4.2Z" fill="#2fb35a" stroke="#23863e" stroke-width="1.2"/><rect x="-6" y="-14.5" width="12" height="3" rx="1" fill="#23863e"/><path d="M-1.8 -9 V-3 M1.8 -9 V-3" stroke="#fff" stroke-width=".9" opacity=".8"/></g>
  </g>
  <!-- when the sea gets too warm: plastic and dead fish floating -->
  ${item('seaJunk', 0, 0, `<g class="float">${deadFish(186, 552, 170)}${bottle(420, 566, 95, 1)}${deadFish(612, 556, 190)}<path d="M300 560 q6 -6 12 0 q-6 4 -12 0Z" fill="#e8eef2" opacity=".85"/></g>`, 'fade')}
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
  <!-- heat shimmer: little wavy lines rising off the hot road and roofs (only when it's very hot) -->
  ${item('heatHaze', 0, 0, `<g class="heat-lines">${[[96, 474], [188, 474], [306, 476], [420, 474], [540, 476], [650, 474], [760, 476],
    [150, 360], [470, 360], [600, 362], [340, 372], [108, 300], [574, 296]].map(([x, y], k) =>
    `<g transform="translate(${x} ${y})"><g class="shimmer" style="animation-delay:${(-k * 0.37 % 1.8).toFixed(2)}s"><path d="M-5 0 q2.5 -3.5 0 -7 q-2.5 -3.5 0 -7 M0 -2 q2.5 -3.5 0 -7 q-2.5 -3.5 0 -7 M5 0 q2.5 -3.5 0 -7 q-2.5 -3.5 0 -7"/></g></g>`).join('')}</g>`, 'fade')}

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
    ${[[40, 326], [422, 326], [262, 348], [602, 348]].map(([x, y]) => `<circle data-glow="lamps" cx="${x}" cy="${y}" r="13" fill="url(#${u}glow)"/>`).join('')}
    ${[110, 286, 520, 650].map((x) => `<circle data-glow="lamps" cx="${x + 14}" cy="440" r="20" fill="url(#${u}glow)"/>`).join('')}
  </g>
  <!-- lightning close by, up in the clouds (storms only; see strike() in the scene) -->
  <g data-k="boltsNear"></g>
  <g data-k="bubble" class="bubble hide"><g class="bubble-in">
    <path data-k="bubbleBox" d="" fill="#fff" stroke="#23313f" stroke-width="2.2" stroke-linejoin="round"/>
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
    home: [350, 454], door: [350, 450], seat: [482, 440], friend: [166, 450], friend2: [62, 450], garden: [505, 454], vend: [650, 458], fountain: [676, 458],
    school: [108, 365], shops: [517, 365], thrift: [462, 365], mall: [574, 365], station: [232, 326], pier: [716, 522], bin: [670, 506],
    curb: [350, 458], gapF: [232, 454], gapB: [232, 368], lane: [350, 487],
  };
  const BACK_Y = 400;   // above this line = the back row
  const CROSS_F = [330, 458], CROSS_B = [330, 494];   // the zebra crossing between the pavement and the beach
  const HOME_ROUTE = [['A', 195, 270], ['B', 195, 470]];   // from the little street across lane A, then along lane B
  const ROAD_Y = 465;   // below this line = in front of the cars

  const DROP = '<path d="M0 -6 q-5 6 0 9 q5 -3 0 -9Z" fill="#7cc9ef"/>';
  const BOX = '<rect x="-10" y="-8" width="20" height="16" fill="#c98f4f" stroke="#8b5a2b" stroke-width="1.5"/>';
  const TOY = '<g transform="scale(.5)"><path d="M-14 -4 h28 v8 h-28Z" fill="#ff5b4a"/><circle cx="-8" cy="5" r="4" fill="#23313f"/><circle cx="8" cy="5" r="4" fill="#23313f"/></g>';
  const BALL = '<circle r="5" fill="#ffd23f" stroke="#ff8c42" stroke-width="2"/>';
  const LITTER = bottle(0, 0, 30, 0.8);   // (Pip's empty bottle)
  const WRAPPER = '<path d="M-5 -2 l9 -3 l2 5 l-8 2Z" fill="#ff6fa8"/>';
  const CUP = '<path d="M-3 -4 h6 l-1 8 h-4Z" fill="#fff" stroke="#2fb35a" stroke-width="1.2"/>';
  const PLASTIC = '<path d="M-3 -4 h6 l-1 8 h-4Z" fill="#ff5b4a"/>';

  /* What each choice shows. ev = Bobo goes to where it happens. good/bad = what the choice does:
     play() is the animation, apply() leaves lasting changes in the city (it runs at the end, or
     right away if the player moves on before the animation is done). pay = reward 2 turns later. */
  const ACTIONS = {
    school: {
      async ev(s) { s.wear('pack'); await s.travel(P.home); },
      good: {
        async play(s) {
          await s.go([316, 452]);              // Bobo's bike is in the rack by the house
          s.hide('bikes_home'); s.wear('bike'); await s.w(150);
          // along the bike lane, up the little street (seen from behind) to the bike rack at school
          await s.ridePath([[316, 455], [232, 455], [232, 374], [198, 374], [198, 368]]);   // (along the bike lane on our side of the road)
          s.wear('bike', false); s.show('bikes_school'); await s.w(150);
          s.remote = { bikes: 'school', people: [] };
          await s.go(P.school);
          s.sparkle(108, 330); s.jump(); await s.w(900);
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
          await ride.move(232, LANE_A, 1100, 'ease-in-out');             // along the street to the little street…
          ride.remove();
          const up = s.vehicle('roadFx', `<g transform="scale(.94)">${carRear('#e63946', headBack(-5, '#6b4423') + headBack(5, '#8b5a2b', 0.85))}</g>`, 232, LANE_A, 1);
          up.carry(true); up.cam = true;
          await up.move(232, LANE_A - 14, 400, 'ease-in');
          s.roadFree();
          await up.move(232, 384, 1200, 'ease-out');                    // …up the little street (seen from behind)…
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
          // (dad's drive home keeps going while the result shows)
          (async () => {
            const back = s.vehicle('backFx', car('#e63946', '#6b4423', ''), 130, 378, 1);   // turns around…
            side.remove();
            await back.move(232, 378, 1100, 'ease-in-out'); back.remove();
            const down = s.vehicle('roadFx', `<g transform="scale(.94)">${carFront('#e63946', '#6b4423')}</g>`, 232, 384, 1);
            await down.move(232, LANE_A - 14, 1200, 'ease-out');                     // …down the little street…
            await s.roadClear(HOME_ROUTE);                                            // (dad waits until the road is clear)
            await down.move(232, LANE_B - 2, 500, 'ease-in-out'); down.remove();
            s.roadFree('A');   // (across lane A: those cars can go again)
            const home = s.vehicle('roadFx', familyCar('#e63946', ''), 232, LANE_B, 1);
            home.carry(true);
            await home.move(398, LANE_B, 900, 'ease-out');                          // …and home into the driveway
            await s.carPark(home);
            s.dadIn();
          })().catch(() => {});
        },
        apply(s) { s.traffic++; },
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
        s.show('partyChairs');
        const ga = a.go([462, 440]), gb = b.go([528, 440]);   // (everybody sits down at the table)
        ga.catch(() => {}); gb.catch(() => {});
        // Bobo's family comes to the party too
        const fam = s.family(P.door, ['dad', 'mom', 'sister']);
        fam.forEach((m, k) => { m.kind = ['dad', 'mom', 'sister'][k]; m.appear(); });
        const gf = fam.map(async (m, k) => { await s.w(300 * k); await m.go([[402, 456], [580, 456], [598, 458]][k]); });
        gf.forEach((g) => g.catch(() => {}));
        await s.travel(P.garden);
        await s.go(P.seat);   // (Bobo sits on a chair, so everybody can see him above the cake)
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
      pay(s) { s.reveal('recycling', 368, 330); },
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
          const ride = await s.carOut(BACK_FAMILY, headBack(-6, '#6b4423') + headBack(0, '#a0703f', .9) + headBack(6, '#8b5a2b', .85), -150);
          sfx('honk');
          await ride.move(-160, LANE_A, 2600, 'ease-in');   // (off over the bridge to Grandma's)
          s.roadFree();
          await ride.move(-650, LANE_A, 1600, 'linear'); ride.remove();
          s.away = 'car';
        },
        apply(s) { s.traffic++; s.hide('parkedCar'); },
      },
      pay(s) { s.reveal('train2', 400, 300); },
    },
    food: {
      async ev(s) { await s.travel(P.garden); s.show('partyChairs'); await s.go(P.seat); },   // (lunch at the table: sitting down)
      good: {
        async play(s) { s.show('tacos'); s.sparkle(505, 420); await s.w(800); s.jump(); await s.w(700); },
      },
      bad: {
        async play(s) { s.show('burger'); await s.w(900); s.look(690); s.show('cows'); s.sparkle(696, 340); await s.w(1600); },
        apply(s) { s.show('cows'); },
      },
      pay(s) { s.reveal('veggieGarden', 746, 446); },
    },
    litter: {
      // Pip (Bobo's friend from the green house) walks onto the pier with his trash… Bobo follows him
      async ev(s) {
        await s.travel(P.home);
        const f = s.buddy('red', '#2fb35a', P.friend2);
        f.appear(); f.keep = true; f.free = true;   // (Pip walks home by himself afterwards)
        const pip = f.go(P.pier); pip.catch(() => {});
        await s.w(1200);
        await s.go(P.bin);
        await pip;
      },
      good: {
        // Bobo stops him, takes the trash and puts it in the bin by the pier
        async play(s) {
          const f = s.buddies.find((b) => b.kind === 'red');
          await s.go([700, 516]);
          s.chop(); s.toss(716, 500, 702, 494, LITTER, 450); await s.w(600);
          await s.go(P.bin);
          s.toss(676, 494, 684, 496, LITTER, 500, () => s.sparkle(684, 490)); await s.w(700);
          if (f) { f.jump(); await s.w(600); s.walkHome(f); }
        },
      },
      bad: {
        // Pip throws it all into the sea: splash!
        async play(s) {
          const f = s.buddies.find((b) => b.kind === 'red');
          if (f) f.chop();
          s.toss(720, 498, 768, 572, LITTER, 800, () => s.splash(768, 574)); await s.w(300);
          s.toss(720, 498, 746, 578, WRAPPER, 750, () => s.splash(746, 580)); await s.w(900);
          s.show('seaBottles'); s.droop(); await s.w(900);
          if (f) s.walkHome(f);
        },
        apply(s) { s.show('seaBottles'); s.seaHurt = true; },
      },
      // the whole class cleans the beach (and the sea animals come back)
      pay(s) { s.hide('seaBottles'); s.hide('beachTrash'); s.seaHurt = false; s.reveal('cleanBeach', 620, 494); },
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
    // the birds' flapping wings (SMIL shape morphing) stop only on 'low', where the flying birds are hidden
    // (a bird hanging still in the sky looks broken)
    const wings = (t) => { if (!svg.pauseAnimations) return; if (t === 'low') svg.pauseAnimations(); else svg.unpauseAnimations(); };
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
    let boltTimer = 0;        // (the next lightning strike while there's a storm)
    /* ── Smart traffic ──
       Every vehicle on the main road (and the cyclist on the far bike lane) is driven here, a little every
       frame: it speeds up to its lane's speed, keeps a safe distance to whatever is ahead (the car in front,
       people on the zebra crossing, the family car pulling out) and brakes and starts again smoothly.
       Positions are measured along the direction of travel ("p"), so the same rules work for both lanes. */
    const LANES = { A: { dir: -1, v: 120, from: -1300, to: 500 }, B: { dir: 1, v: 138, from: -500, to: 1300 }, bike: { dir: 1, v: 55, from: -400, to: 1200 } };
    const ACCEL = 90, BRAKE = 360;
    // calm traffic: mostly little cars; a van, a bus or a truck only now and then, and never two at once
    const SMALL = ['car', 'car', 'car', 'pickup'], BIG = ['van', 'bus', 'boxTruck'];
    const PAINT = ['#ff6fa8', '#2f80ed', '#ffb627', '#7d5fff', '#2fb35a', '#1fa7a0', '#e8a33d', '#9aa5b1'], FURS = ['#7a4a24', '#a0673a', '#5c3a1e', '#c08850'];
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    function setModel(c, model) {
      const k = (c.lane === 'A' ? 0.92 : 0.96) * MODEL_SCALE[model], size = MODEL_SIZE[model];
      c.el.firstElementChild.innerHTML = `<g transform="translate(0 ${(c.lane === 'A' ? LANE_A : LANE_B) - 20}) scale(${c.lane === 'A' ? -k : k} ${k})">${MODELS[model](pick(PAINT), pick(FURS))}</g>`;
      c.model = model; c.big = BIG.includes(model); c.rear = size[0] * k; c.front = size[1] * k;
    }
    const cars = [...container.querySelectorAll('.tcar')].map((el) => {
      const lane = el.dataset.lane, L = LANES[lane], group = el.parentNode.closest('[data-k]');
      const c = { el, lane, dir: L.dir, vmax: L.v, p: L.dir * +el.dataset.x, v: L.v, rear: -10, front: 10, group, on: !group.classList.contains('hide') };
      if (lane === 'bike') { c.rear = -30 * 0.32; c.front = 30 * 0.32; } else setModel(c, pick(SMALL));
      return c;
    });
    const zones = new Map();   // things the cars have to stop for: id → { lane, x1, x2 } (or a moving one: get() → [x1, x2, speed])
    const zoneP = (z) => {
      const L = LANES[z.lane], xs = z.get ? z.get() : [z.x1, z.x2, 0];
      if (!xs) return null;
      const a = L.dir * xs[0], b = L.dir * xs[1];
      return [Math.min(a, b), Math.max(a, b), Math.max(0, L.dir * (xs[2] || 0))];
    };
    const stopDist = (c) => (c.v * c.v) / (2 * BRAKE) + 12;
    // is this stretch of a lane free (nobody in it, and nobody too close to stop before it)?
    const laneFree = (lane, x1, x2, ahead = 0) => {
      const [a, b] = zoneP({ lane, x1, x2 });
      return cars.every((c) => !c.on || c.lane !== lane || c.p + c.rear > b || c.p + c.front < a - stopDist(c) - ahead);
    };
    // a family car on the main road is an obstacle exactly where it is, at its speed (the cars behind it follow it)
    let famIds = 0;
    const EASE = { linear: (t) => t, 'ease-in': (t) => t * t, 'ease-out': (t) => 1 - (1 - t) ** 2, ease: (t) => 1 - (1 - t) ** 2,
      'ease-in-out': (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2) };
    function trackOnRoad(v) {
      const id = 'car' + ++famIds;
      const zone = (laneY) => () => {
        const now = performance.now(), [x, y] = v.where(now), [xb] = v.where(now - 80);
        return Math.abs(y - laneY) < 4.5 ? [x - 38, x + 38, (x - xb) / 0.08] : null;
      };
      zones.set(id + ':A', { lane: 'A', get: zone(LANE_A) });
      zones.set(id + ':B', { lane: 'B', get: zone(LANE_B) });
      return id;
    }
    let lastTick = performance.now();
    function tick(now) {
      const dt = Math.min(0.05, (now - lastTick) / 1000);
      lastTick = now;
      if (!svg.isConnected) return;
      Object.keys(LANES).forEach((lane) => {
        const L = LANES[lane];
        const list = cars.filter((c) => c.lane === lane);
        list.forEach((c) => {
          // (hidden extra traffic, also on the slowest devices, isn't on the road at all)
          const on = !c.group.classList.contains('hide') && !(/^traffic[23]/.test(c.group.dataset.k) && document.documentElement.dataset.perf === 'low');
          if (on && !c.on) { c.p = L.from - 300; c.v = L.v; }   // (more traffic: it drives in from off-screen)
          c.on = on;
        });
        const going = list.filter((c) => c.on).sort((a, b) => b.p - a.p);
        const lz = [...zones.values()].filter((z) => z.lane === lane).map(zoneP).filter(Boolean);
        going.forEach((c, n) => {
          const nose = c.p + c.front;
          // whatever is closest ahead: the car in front, people crossing, the family car… and how fast it goes
          let gap = Infinity, leadV = c.vmax;
          if (n > 0) { gap = going[n - 1].p + going[n - 1].rear - nose; leadV = going[n - 1].v; }
          lz.forEach(([a, b, zv]) => { if (nose <= a + 2 && a - nose < gap) { gap = a - nose; leadV = zv; } });   // (already in it? drive on through)
          // keep a safe distance and otherwise just go as fast as the one in front (no stopping for nothing)
          const want = 20 + c.v * 0.3;
          const target = gap === Infinity ? c.vmax : clamp(leadV + (gap - want) * 1.6, 0, c.vmax);
          c.v = c.v < target ? Math.min(target, c.v + ACCEL * dt) : Math.max(target, c.v - BRAKE * dt);
          if (gap < 5) c.v = Math.min(c.v, leadV, gap < 2 ? 0 : leadV);
          c.p += c.v * dt;
        });
        // off-screen: come back round at the other end, behind the last car. (Only after everybody has moved:
        // otherwise the car behind would see it as "the car in front" for a moment and stop dead.)
        going.filter((c) => c.p + c.rear > L.to).forEach((c) => {
          const rest = going.filter((o) => o !== c && o.p + o.rear <= L.to), last = rest[rest.length - 1];
          if (lane !== 'bike') setModel(c, !cars.some((o) => o !== c && o.on && o.big) && Math.random() < 0.1 ? pick(BIG) : pick(SMALL));
          c.p = Math.min(L.from, last ? last.p + last.rear - c.front - 40 : L.from);
          c.shown = null;
        });
        going.forEach((c) => {
          const x = (c.dir * c.p).toFixed(1);
          if (x !== c.shown) { c.shown = x; c.el.style.transform = `translateX(${x}px)`; }
        });
      });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // wait (at most ~6 s) until these stretches of road are free, then the cars stop before them until let go
    async function claimRoad(id, stretches, wait = sleep) {
      for (let k = 0; k < 40 && !stretches.every(([l, x1, x2]) => laneFree(l, x1, x2)); k++) await wait(150);
      stretches.forEach(([lane, x1, x2], n) => zones.set(`${id}:${n}`, { lane, x1, x2 }));
    }
    const freeRoad = (id) => [...zones.keys()].forEach((k) => { if (k === id || k.startsWith(id + ':')) zones.delete(k); });
    // people walk over the zebra crossing: they wait until the cars (and bikes) can stop, the cars wait for them
    let crossIds = 0;
    const CROSS_STRETCH = (x) => [['A', x - 20, x + 20], ['B', x - 20, x + 20], ['bike', x - 20, x + 20]];
    const hooks = { carTrip: () => {} };   // (the game listens for car trips, see onCarTrip)
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
        const k = g.dataset.glow;
        g.classList.toggle('on', dark && (k === 'lamps' || visible(q(k))));
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
      if (Math.abs(x - cx) > 2) rideDir.setAttribute('transform', `scale(${x < cx ? -RIDE_SC : RIDE_SC} ${RIDE_SC})`);
      const towardsUs = y - cy > Math.abs(x - cx);
      rideDir.querySelector('.rv-front').style.display = towardsUs ? '' : 'none';
      rideDir.querySelector('.rv-back').style.display = towardsUs ? 'none' : '';
      clearTimeout(walkTimer);
      return new Promise((done) => { walkTimer = setTimeout(() => { monkey.classList.remove('walking'); walker.classList.remove('pedaling'); done(); }, ms); });
    }
    // Plan a route: between the back and front rows Bobo always goes through the side street
    function route(from, to) {
      const beach = (p) => p[1] > 488;
      if (beach(from) && !beach(to)) return [CROSS_B, CROSS_F, ...route(CROSS_F, to)];
      if (!beach(from) && beach(to)) return [...route(from, CROSS_F), CROSS_B, to];
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
        const g = gen, path = route(walkPos, to), id = 'walk' + ++crossIds;
        try {
          for (const p of path) {
            const crossing = (p === CROSS_B || p === CROSS_F) && Math.abs(walkPos[1] - p[1]) > 20;
            if (crossing) { await claimRoad(id, CROSS_STRETCH(p[0]), s.w); guard(g); }
            await walkTo(p[0], p[1]); guard(g);
            if (crossing) freeRoad(id);
          }
        } finally { freeRoad(id); }
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
      async carOut(back, heads = headBack(-5, '#6b4423'), toX = 232) {
        await s.roadClear([['A', Math.min(toX, 434) - (toX < 0 ? 330 : 100), 475]]);   // (dad looks both ways and goes when it's clear)
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
        if (lane === LANE_B) await s.roadClear([['A', 400, 470]]);   // (across lane A into the driveway)
        v.remove();
        const r = s.vehicle('roadFx', `<g transform="scale(.94)">${carRear('#e63946', heads)}</g>`, 434, lane, 1);
        r.carry(true);
        await r.move(434, 442, 1000, 'ease-in-out');
        s.show('parkedCar'); r.remove();
        s.roadFree();   // (parked: the other cars can go again)
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
        const size = kind === 'sister' ? RIDE_SC * 0.76 : RIDE_SC;
        const g = document.createElementNS(NS, 'g');
        g.classList.add('cv');
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
      rackFor(to) { return to[1] < 345 ? ['station', [318, 358]] : to[0] < 300 ? ['school', [198, 368]] : ['mall', [606, 370]]; },
      // where the family car parks: the station's car park (up the little street), or a bay on the street by the school / shops
      bayFor(to) {
        if (to[1] < 345) return { x: 274, y: 346, station: true };   // (up the little street to the station's car park)
        if (to[0] < 300) return { x: 168, y: 378 };                   // (a bay on the street by the school)
        return { x: to[0] < 520 ? 511 : 565, y: 392, lot: true };     // (the shops' car park, across from the shop)
      },
      // where people stand when they get out of (or wait for) the parked car
      outOf(bay, k) {
        if (bay.lot) return k < 0 ? [bay.x + 32, bay.y - 3] : [bay.x - 32 - 14 * k, bay.y - 3];
        return bay.station ? (k < 0 ? [bay.x + 30, bay.y - 3] : [bay.x - 32 - 14 * k, bay.y - 3]) : (k < 0 ? [bay.x + 10, 367] : [bay.x - 10 + 14 * k, 367]);
      },
      // the street the car drives along to get to that bay (the shops' car park is just off the school street)
      streetY(bay) { return bay.station ? bay.y : 378; },
      // up the little street: to the school street, or all the way up to the station's car park
      upTo(bay) { return bay.station ? bay.y : 384; },
      async bikeThere(to, kinds, existing) {
        const [rk, rp] = s.rackFor(to);
        // everyone takes their bike from the rack at home and rides off together
        let people = existing || s.family(P.door, kinds);
        people.forEach((m, k) => { m.kind = kinds[k]; if (!existing) m.appear(); });
        await Promise.all([s.go([316, 452]), ...people.map((m, k) => m.walk(334 + 16 * k, 452))]);
        s.hide('bikes_home'); s.wear('bike');
        const riders = s.toBikes(people);
        await s.ridePath(rp[1] > 360 ? [[316, 455], [232, 455], [232, 374], [rp[0], 374], rp] : [[316, 455], [232, 455], [232, rp[1]], rp], riders);
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
        await s.ridePath(rp[1] > 360 ? [[rp[0], 374], [232, 374], [232, 455], [316, 455]] : [[232, rp[1]], [232, 455], [316, 455]], riders);
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
        hooks.carTrip();   // (Bobo got into the car again)
        const back = [monkeyHead(-3, -23, '#8b5a2b')].concat(riders.map((k, n) => `<g transform="translate(${-9 + n * 9} -22.5) scale(.55)">${monkeyHead(0, 0, FRIENDS[k][0])}</g>`)).join('');
        const v = await s.carOut(back);
        v.cam = true;
        await v.move(232, LANE_A, 1200, 'ease-in-out');
        v.remove();
        const up = s.vehicle('roadFx', `<g transform="scale(.94)">${carRear('#e63946', headBack(-5, '#6b4423') + headBack(5, '#8b5a2b', .85))}</g>`, 232, LANE_A, 1);
        up.carry(true); up.cam = true;
        await up.move(232, LANE_A - 14, 400, 'ease-in');
        s.roadFree();                                 // (off the main road: the other cars can go again)
        await up.move(232, s.upTo(bay), bay.station ? 2000 : 1200, 'ease-out');
        up.remove();
        const side = s.vehicle('backFx', car('#e63946', '#6b4423', back), 232, s.streetY(bay), bay.x < 232 ? -1 : 1);
        side.carry(true); side.cam = true;
        await side.move(bay.x, s.streetY(bay), Math.max(500, Math.abs(bay.x - 232) * 6), bay.lot ? 'ease-in-out' : 'ease-out');
        if (bay.lot) await side.move(bay.x, bay.y, 600, 'ease-out');   // (pull into the car park)
        // parked: everybody gets out, so the car is empty (nobody waits inside)
        side.g.querySelector('.veh').innerHTML = car('#e63946', '#6b4423', '', false);
        side.cam = false; side.carry(false); side.keep = true;
        s.place(s.outOf(bay, -1)); s.inside(false);
        const people = s.family(['dad', ...riders].map((_, k) => s.outOf(bay, k)), ['dad', ...riders]);
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
          await up.move(232, LANE_A - 14, 400, 'ease-in');
          s.roadFree();
          await up.move(232, s.upTo(bay), bay.station ? 2000 : 1200, 'ease-out'); up.remove();
          const side = s.vehicle('backFx', car('#e63946', '#6b4423', ''), 232, s.streetY(bay), bay.x < 232 ? -1 : 1);
          side.cam = true;
          await side.move(bay.x, s.streetY(bay), Math.max(500, Math.abs(bay.x - 232) * 6), bay.lot ? 'ease-in-out' : 'ease-out');
          if (bay.lot) await side.move(bay.x, bay.y, 600, 'ease-out');
          side.cam = false;
          r = { car: side, bay, people: [] };
        }
        // everybody walks to the car and gets in
        await Promise.all([s.go(s.outOf(r.bay, -1)), ...r.people.map((m, k) => m.go(s.outOf(r.bay, k)))]);
        await Promise.all(r.people.map((m) => m.enter()));
        s.inside(true);
        hooks.carTrip();
        const kinds = r.people.map((m) => m.kind).filter((k) => k !== 'dad');
        const back = [monkeyHead(-3, -23, '#8b5a2b')].concat(kinds.map((k, n) => `<g transform="translate(${-9 + n * 9} -22.5) scale(.55)">${monkeyHead(0, 0, FRIENDS[k][0])}</g>`)).join('');
        r.car.remove();
        s.remote = null;
        // back along the street, down the little street (coming towards us), along the main road and up the driveway
        const side = s.vehicle('backFx', car('#e63946', '#6b4423', back), r.bay.x, r.bay.y, r.bay.x < 232 ? 1 : -1);
        side.carry(true); side.cam = true;
        if (r.bay.lot) await side.move(r.bay.x, s.streetY(r.bay), 600, 'ease-in-out');   // (out of the car park)
        await side.move(232, s.streetY(r.bay), Math.max(500, Math.abs(r.bay.x - 232) * 6), 'ease-in-out'); side.remove();
        const down = s.vehicle('roadFx', `<g transform="scale(.94)">${carFront('#e63946', '#6b4423')}</g>`, 232, s.upTo(r.bay), 1);
        down.cam = true;
        await down.move(232, LANE_A - 14, r.bay.station ? 2000 : 1200, 'ease-out');   // (down to the main road… and stop)
        await s.roadClear(HOME_ROUTE);                                                   // (wait for a gap, then the cars wait for us)
        await down.move(232, LANE_B - 2, 500, 'ease-in-out'); down.remove();
        s.roadFree('A');   // (across lane A: those cars can go again)
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
          await s.roadClear([['A', 400, 1460]]);   // (nobody in front of us on the way in)
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
        // where it is right now (worked out from the move it's doing; the traffic needs this every frame)
        v.where = (now = performance.now()) => {
          const m = v.path;
          if (!m) return [v.x, v.y];
          const t = clamp((now - m.t0) / m.ms, 0, 1), e = (EASE[m.ease] || EASE['ease-in-out'])(t);
          return [m.x0 + (m.x1 - m.x0) * e, m.y0 + (m.y1 - m.y0) * e];
        };
        v.move = (x2, y2, ms, ease = 'ease-in-out') => {
          const [x0, y0] = v.where();
          v.path = { x0, y0, x1: x2, y1: y2, t0: performance.now(), ms: Math.max(1, ms), ease };
          v.x = x2; v.y = y2;
          g.classList.add('moving');   // (exhaust puffs while it drives)
          clearTimeout(v.stop); v.stop = setTimeout(() => g.classList.remove('moving'), ms);
          if (v.cam) camTo(x2, ms);
          g.style.transition = `transform ${ms}ms ${ease}, opacity .6s`; set();
          const p = s.w(ms); p.catch(() => {});   // (fine to not wait for it)
          return p;
        };
        v.puff = (on) => g.classList.toggle('puffing', on);
        v.carry = (on) => g.classList.toggle('with-bobo', on);
        v.fadeIn = () => { g.style.opacity = '0'; void g.getBoundingClientRect(); g.style.transition = 'opacity .6s'; g.style.opacity = '1'; return v; };
        const tracked = layer === 'roadFx' ? trackOnRoad(v) : null;
        v.remove = () => { g.remove(); if (tracked) freeRoad(tracked); };
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
          const layer = y < BACK_Y ? q('backLayer') : y < ROAD_Y ? q('buddies') : q('frontLayer');
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
          const p = (b.free ? sleep(ms) : s.w(ms)).finally(() => g.classList.remove('walking')); p.catch(() => {});
          return p;
        };
        // walk somewhere, through the side street if it's between the back and the front
        b.go = async (to) => {
          const path = route(b.pos, to), id = 'walk' + ++crossIds;
          try {
            for (const p of path) {
              const crossing = (p === CROSS_B || p === CROSS_F) && Math.abs(b.pos[1] - p[1]) > 20;
              if (crossing) await claimRoad(id, CROSS_STRETCH(p[0]), b.free ? sleep : s.w);
              await b.walk(p[0], p[1]);
              if (crossing) freeRoad(id);
            }
          } finally { freeRoad(id); }
        };
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
      // The family car wants to drive on the main road: dad looks and goes as soon as nobody is close (no car in
      // those stretches, and none coming within ~140). The cars that catch up just slow down behind him.
      async roadClear(stretches) {
        for (let k = 0; k < 40 && !stretches.every(([l, x1, x2]) => laneFree(l, x1, x2, 140)); k++) await s.w(150);
      },
      roadFree() {},
      // a friend walks back home by themselves and goes in (it keeps going while the next scene starts)
      walkHome(b) {
        const homes = { golden: P.friend, red: P.friend2 };
        b.free = true; b.keep = true;
        (async () => { await b.go(homes[b.kind] || P.friend); await b.enter(); })().catch(() => {});
      },
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
      splash(x, y) {
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('transform', `translate(${x} ${y})`);
        g.innerHTML = '<ellipse rx="10" ry="3" fill="none" stroke="#fff" stroke-width="2"/><ellipse rx="5" ry="1.6" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M-6 -2 l-3 -7 M0 -3 v-9 M6 -2 l3 -7" stroke="#cfefff" stroke-width="2" stroke-linecap="round"/>';
        q('fxTop').appendChild(g);
        g.animate([{ opacity: 1, transform: `translate(${x}px, ${y}px) scale(.4)` }, { opacity: 0, transform: `translate(${x}px, ${y}px) scale(1.6)` }], { duration: 900, easing: 'ease-out' }).onfinish = () => g.remove();
        sfx('splash');
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
      s.roadFree();   // (a cut-short drive never leaves the traffic waiting)
      vehicles.splice(0).forEach((v) => { if (v.keep) vehicles.push(v); else v.remove(); });
      if (s.away !== 'car' && !(s.remote && s.remote.car)) s.show('parkedCar');   // (the family car is home, unless it's out)
      buddies.slice().forEach((b) => { if (!b.keep) b.remove(); });
      q('seaFx').innerHTML = ''; q('trainFx').innerHTML = '';
      s.show('trains');
      ['partyChairs', 'partyCloth', 'balloons', 'cake', 'platesReal', 'platesPlastic', 'sortBins', 'trashBag', 'tacos', 'burger', 'fan', 'acAir', 'steam', 'bathBubbles',
        'toyBroken', 'toyFixed', 'toyNew', 'boxClosed', 'heatGlow', 'tv'].forEach(s.hide);
      s.q('boboHouse').classList.remove('win-open', 'lit', 'lights-off');
      s.hide('houseLit');
      Object.keys(WEAR).forEach((w) => s.wear(w, false));
      s.inside(false);
      s.speed = 1;
      updateTraffic();
    }
    function updateTraffic() {
      ['traffic2', 'traffic2B'].forEach((k) => q(k).classList.toggle('hide', s.traffic < 1));
      ['traffic3', 'traffic3B'].forEach((k) => q(k).classList.toggle('hide', s.traffic < 2));
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
      if (w === 'storm' && !boltTimer) boltTimer = setTimeout(lightning, 900);
      if (w !== 'storm') { clearTimeout(boltTimer); boltTimer = 0; }
    }

    /* Lightning: every strike is new, somewhere else, at a different distance. Far ones are thin and faint
       (behind the volcano, on the volcano, out at sea), middle ones disappear behind the skyscrapers,
       close ones flicker between the clouds. The flash on the screen is gentle, and bigger for closer ones. */
    const BOLT = {
      back: { layer: 'boltsBack', w: 0.7, top: [175, 215], op: 0.55, flash: 0.03 },
      far: { layer: 'boltsFar', w: 1.1, top: [120, 165], op: 0.75, flash: 0.05 },
      mid: { layer: 'boltsMid', w: 1.8, top: [40, 90], op: 0.85, flash: 0.08 },
      near: { layer: 'boltsNear', w: 2.6, top: [-10, 10], op: 0.95, flash: 0.13 },
    };
    const rnd = (a, b) => a + Math.random() * (b - a);
    // the top of the volcano island at x (or null if x isn't over the volcano)
    const volcanoY = (x) => {
      const l = Math.abs((x - 616) / 1.15);
      return l > 94 ? null : 291 - 1.15 * 64 * Math.pow(clamp(1 - (l - 13) / 81, 0, 1), 1.4);
    };
    const zigzag = (x0, y0, x1, y1, n) => {
      const pts = [[x0, y0]], wob = Math.abs(y1 - y0) * 0.09;
      for (let k = 1; k < n; k++) pts.push([x0 + (x1 - x0) * k / n + rnd(-wob, wob), y0 + (y1 - y0) * k / n + rnd(-wob, wob) * 0.4]);
      pts.push([x1, y1]);
      return pts;
    };
    const pathOf = (pts) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
    function strike(depth) {
      const d = BOLT[depth];
      let x0 = rnd(30, 770), x1, y1;
      if (depth === 'far' && Math.random() < 0.6) x0 = rnd(540, 700);   // (the volcano gets hit a lot)
      const y0 = rnd(d.top[0], d.top[1]);
      if (depth === 'near') { x1 = x0 + rnd(-60, 60); y1 = rnd(90, 160); }   // (between the clouds, high above the city)
      else {
        x1 = x0 + rnd(-30, 30);
        const v = depth === 'far' ? volcanoY(x1) : null;
        y1 = v !== null ? v : depth === 'mid' ? 292 : 288;
      }
      const main = zigzag(x0, y0, x1, y1, 7 + Math.floor(Math.random() * 4));
      const from = main[2 + Math.floor(Math.random() * 3)], side = Math.random() < 0.5 ? -1 : 1, len = (y1 - y0) * rnd(0.25, 0.4);
      const branch = zigzag(from[0], from[1], from[0] + side * len * 0.7, from[1] + len, 3);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('fill', 'none'); g.setAttribute('stroke-linejoin', 'round'); g.setAttribute('stroke-linecap', 'round');
      g.innerHTML = `<path d="${pathOf(main)} ${pathOf(branch)}" stroke="#bcd4ff" stroke-width="${d.w * 3.2}" opacity=".3"/>`
        + `<path d="${pathOf(main)}" stroke="#fffdf0" stroke-width="${d.w}"/><path d="${pathOf(branch)}" stroke="#fffdf0" stroke-width="${d.w * 0.6}"/>`;
      g.style.opacity = '0';
      q(d.layer).appendChild(g);
      const steps = [{ opacity: 0 }, { opacity: d.op, offset: 0.06 }, { opacity: d.op * 0.15, offset: 0.22 }, { opacity: d.op * 0.9, offset: 0.32 }, { opacity: 0 }];
      g.animate(steps, { duration: 650 }).onfinish = () => g.remove();
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const fl = container.querySelector('.fxh-flash');
        if (fl) fl.animate(steps.map((st) => ({ ...st, opacity: st.opacity / d.op * d.flash })), { duration: 650 });
      }
    }
    function lightning() {
      if (!svg.isConnected || !container.classList.contains('storming')) { boltTimer = 0; return; }
      const r = Math.random(), depth = r < 0.25 ? 'back' : r < 0.55 ? 'far' : r < 0.8 ? 'mid' : 'near';
      strike(depth);
      if (Math.random() < 0.3) setTimeout(() => { if (svg.isConnected) strike(['back', 'far', 'mid'][Math.floor(Math.random() * 3)]); }, rnd(250, 600));
      const slow = typeof Perf !== 'undefined' && Perf.tier === 'low' ? 1.8 : 1;
      boltTimer = setTimeout(lightning, rnd(1500, 4000) * slow);
    }

    /* ── reactions + speech bubble ── */
    function react(kind, ms = 2600) {
      clearTimeout(reactTimer);
      if (kind) monkey.dataset.react = kind; else delete monkey.dataset.react;
      if (kind === 'yay') s.jump();
      if (kind === 'sad') s.droop();
      if (kind && ms) reactTimer = setTimeout(() => delete monkey.dataset.react, ms);
    }
    const headTop = () => [walkPos[0], walkPos[1] - HEAD_H * depthK(walkPos[1])];
    let bubbleW = 120;
    const bubbleScale = (feetY) => clamp(depthK(feetY) * 1.05, 0.72, 1.1);
    // keep the bubble inside the part of the city that's on screen (phones see only a slice of it)
    // The bubble always sits right above Bobo's head (its tail points at him). Only if the text box would stick out
    // of the screen does the box slide a little to the side, while the tail stays above his head.
    // the bubble's outline: a rounded box with the tail (pointing down at Bobo, at x = 0) as one shape
    const bubbleShape = (w, dx) => {
      const l = -w / 2 + dx, r = w / 2 + dx, t = -37, b = -6, R = 12, tx = clamp(0, l + R + 8, r - R - 8);
      return `M${l + R} ${t} H${r - R} Q${r} ${t} ${r} ${t + R} V${b - R} Q${r} ${b} ${r - R} ${b} H${tx + 7} L${tx} ${b + 12} L${tx - 7} ${b}`
        + ` H${l + R} Q${l} ${b} ${l} ${b - R} V${t + R} Q${l} ${t} ${l + R} ${t}Z`;
    };
    const viewLeft = () => (vb[2] === 800 ? 0 : clamp(camFocus - vb[2] / 2, 0, 800 - vb[2]));
    const bubbleXY = (hx, hy) => {
      const left = viewLeft(), right = left + vb[2];
      const cx = Math.max(left + bubbleW / 2 + 6, Math.min(right - bubbleW / 2 - 6, hx));
      const lim = Math.max(0, bubbleW / 2 - 16), dx = clamp(cx - hx, -lim, lim);
      q('bubbleBox').setAttribute('d', bubbleShape(bubbleW, dx));
      q('bubbleText').setAttribute('x', dx);
      return [hx, hy - 8];
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
      const [x0, y0] = bubbleXY(cx, cy - HEAD_H * m.d);
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
      // (only when Bobo can be seen: not inside a car or a house, and on the screen)
      const left = viewLeft(), onScreen = walkPos[0] > left - 10 && walkPos[0] < left + vb[2] + 10;
      if (!text || walker.classList.contains('inside') || !onScreen) { b.classList.add('hide'); return; }
      txt.textContent = text;
      bubbleW = Math.min(420, txt.getComputedTextLength() + 22);
      box.setAttribute('d', bubbleShape(bubbleW, 0));
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
      q('heatJunk').classList.toggle('hide', level < 2);
      q('seaweed').classList.toggle('hide', level >= 2);    // (the seaweed dies off in a too-warm sea)   // (dead fish and plastic wash up on the beach…)
      q('seaJunk').classList.toggle('hide', level < 3);    // (…and float in the sea)
      q('bugs2').classList.toggle('hide', level < 3);
      svg.classList.toggle('coral-pale', level === 2);
      svg.classList.toggle('coral-bleached', level >= 3);
      setTime(time);
      const m = level <= 1 ? 'mHappy' : 'mMeh';   // (when it gets hot Bobo looks neutral, never sad: it's a game for kids)
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
      setLines: (fn) => { lineFor = fn; },
      // Is Bobo at the school door (after getting there in the morning)?
      atSchool: () => Math.hypot(walkPos[0] - P.school[0], walkPos[1] - P.school[1]) < 30,
      speaking: () => !q('bubble').classList.contains('hide'),
      // The school day goes by: Bobo goes in, the sun moves to later in the day, and after a while he comes out
      async schoolDay(t) {
        s.inside(true);
        await sleep(1200);
        setTime(t);
        await sleep(5000);
        s.inside(false); s.jump();
        say(lineFor('schoolOut'));
        await sleep(1500);
      },
      onCarTrip: (fn) => { hooks.carTrip = fn; },   // fn() whenever Bobo gets into the car for a trip around town   // fn(key) → that speech bubble line in the current language
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
