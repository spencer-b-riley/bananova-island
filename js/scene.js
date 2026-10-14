/* The island: a cartoon SVG drawing that changes with every choice.
   Scene.create(container) returns an object with:
     setStats(h, i)        – monkey mood, sky haze, birds, flowers, sea color
     event(id)             – show the problem (e.g. bottles on the beach)
     outcome(id, good)     – show what the choice did
     payoff(id)            – show the reward 2 turns later
     disaster(type)        – 'flood' | 'heat' | 'storm' animation (returns a Promise)
     setTime(t)            – 'morning' | 'day' | 'evening' | 'night'
     setWeather(w)         – 'rain' | 'clear'
     react(kind, ms)       – monkey face: 'yay' | 'scared' | 'cold' | 'hot' | 'sad' | 'think'
     say(text, ms)         – speech bubble above the monkey
   Every part of the drawing has a data-k="name" so it can be shown/hidden. */

const Scene = (() => {
  let uid = 0;

  /* ── little drawing helpers ── */
  const item = (k, x, y, inner, cls = 'pop', hidden = true) =>
    `<g transform="translate(${x} ${y})"><g data-k="${k}" class="${cls}${hidden ? ' hide' : ''}">${inner}</g></g>`;

  const flame = (x, y, s = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><g class="flicker">
      <path d="M0 10 C-18 -6 -8 -26 0 -46 C8 -26 18 -6 0 10Z" fill="#ff6b1a"/>
      <path d="M0 8 C-9 -2 -4 -14 0 -26 C4 -14 9 -2 0 8Z" fill="#ffd23f"/></g></g>`;

  const LEAF = 'M0 0 Q28 -24 62 4 Q30 -8 0 0Z';
  const palm = (n, x, y, s) => `
    <g transform="translate(${x} ${y}) scale(${s})"><g data-k="palm${n}">
      <g class="part alive"><g class="sway">
        <path class="trunk" d="M0 0 C-6 -40 8 -80 -4 -118"/>
        <path class="ring" d="M-7 -20 h11 M-4 -45 h11 M0 -70 h9 M-2 -95 h8"/>
        <g transform="translate(-4 -118)">
          <path class="leaf" d="${LEAF}" transform="rotate(-12)"/>
          <path class="leaf" d="${LEAF}" transform="rotate(28)"/>
          <path class="leaf dark" d="${LEAF}" transform="scale(-1 1) rotate(-12)"/>
          <path class="leaf dark" d="${LEAF}" transform="scale(-1 1) rotate(28)"/>
          <path class="leaf" d="${LEAF}" transform="rotate(-78)"/>
          <g class="cocos fade hide"><circle cx="-7" cy="7" r="6.5"/><circle cx="6" cy="8" r="6.5"/><circle cx="0" cy="14" r="6.5"/></g>
        </g></g></g>
      <g class="part stump hide"><path d="M-10 0 L-8 -16 L8 -16 L10 0Z" fill="#9b6a3c"/><ellipse cx="0" cy="-16" rx="8" ry="3.5" fill="#e5b77f"/><path d="M-3 -16 a3 1.5 0 1 0 6 0" stroke="#b98a55" fill="none"/></g>
      <g class="part burnt hide"><path d="M0 0 C-4 -30 4 -60 -2 -88" stroke="#3b2b25" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M-1 -58 l-18 -14 M0 -72 l15 -12" stroke="#3b2b25" stroke-width="4" stroke-linecap="round"/></g>
      <g class="part flames hide">${flame(-4, -112, 1.3)}${flame(-24, -96, 0.8)}${flame(16, -100, 0.9)}${flame(2, -45, 0.9)}${flame(-14, -10, 0.7)}</g>
    </g></g>`;

  const fish = (color = '#ff8c42') => `
    <ellipse cx="0" cy="0" rx="14" ry="8" fill="${color}"/>
    <path d="M-12 0 L-24 -8 L-22 0 L-24 8Z" fill="${color}"/>
    <path d="M-2 -7 Q2 -13 6 -7" fill="${color}" stroke="#00000022"/>
    <circle cx="7" cy="-2" r="2.6" fill="#fff"/><circle cx="7.6" cy="-2" r="1.4" fill="#23313f"/>`;

  // A sick fish, belly-up with cartoon X eyes (kid friendly!)
  const deadFish = (x, y, r, sc = 1) => `
    <g transform="translate(${x} ${y}) rotate(${r}) scale(${sc})"><g class="float">
      <ellipse cx="0" cy="0" rx="15" ry="8" fill="#a9b8a3"/>
      <path d="M-13 0 L-25 -8 L-23 0 L-25 8Z" fill="#a9b8a3"/>
      <ellipse cx="0" cy="3" rx="10" ry="4" fill="#d6e0cf"/>
      <path d="M4 -5 l6 6 M10 -5 l-6 6" stroke="#23313f" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M12 3 q2 2 0 4" stroke="#23313f" stroke-width="1.5" fill="none"/></g></g>`;

  const bottle = (x, y, r, sc = 1) => `
    <g transform="translate(${x} ${y}) rotate(${r}) scale(${sc})">
      <rect x="-5" y="-16" width="10" height="16" rx="3" fill="#a8e0f5" stroke="#4fb0d8" stroke-width="1.5"/>
      <rect x="-2.5" y="-21" width="5" height="5" rx="1" fill="#2f80ed"/>
      <rect x="-5" y="-11" width="10" height="4" fill="#ff6fa8" opacity=".8"/></g>`;

  const turtle = (x, y, s = 1, flip = false) => `
    <g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
      <ellipse cx="-11" cy="5" rx="5" ry="3" fill="#8fd16a"/><ellipse cx="9" cy="6" rx="5" ry="3" fill="#8fd16a"/>
      <ellipse cx="17" cy="-2" rx="6" ry="5" fill="#8fd16a"/><circle cx="19" cy="-3" r="1.3" fill="#23313f"/>
      <ellipse cx="0" cy="0" rx="16" ry="10" fill="#4f9a3a"/>
      <path d="M-8 -4 l5 -4 h6 l5 4 l-5 4 h-6Z M-14 2 h6 M8 2 h6" stroke="#3d7a2c" stroke-width="1.6" fill="none"/></g>`;

  const flower = (x, y, c) => `
    <g transform="translate(${x} ${y})"><path d="M0 0 V-10" stroke="#3d9a2e" stroke-width="2"/>
      <circle cx="-3" cy="-12" r="3" fill="${c}"/><circle cx="3" cy="-12" r="3" fill="${c}"/>
      <circle cx="0" cy="-15" r="3" fill="${c}"/><circle cx="0" cy="-9.5" r="3" fill="${c}"/>
      <circle cx="0" cy="-12" r="2" fill="#ffd23f"/></g>`;

  const fruit = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x - r / 3}" cy="${y - r / 3}" r="${r / 3}" fill="#fff" opacity=".45"/>`;

  const flies = (x, y) => `<g class="flies" transform="translate(${x} ${y})">
      <circle cx="0" cy="0" r="1.8"/><circle cx="10" cy="-6" r="1.8" style="animation-delay:-.3s"/><circle cx="-8" cy="-10" r="1.8" style="animation-delay:-.6s"/></g>`;

  const bananas = `<path d="M0 0 Q10 10 24 -2 Q10 5 0 0Z" fill="#ffd93b" stroke="#c9a227" stroke-width="1.2"/>`;

  // simple repeatable "random" so every screen draws the same scene
  const rnd = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

  // Rain clouds across the whole sky (also past the edges, for wide screens),
  // with rain falling from underneath each cloud down to the sea.
  const RAIN_CLOUDS = Array.from({ length: 13 }, (_, k) => [-900 + k * 210, 28 + (k % 3) * 18, 1.35 + (k % 2) * 0.25]);
  const rainCloudsSVG = RAIN_CLOUDS.map(([x, y, sc]) =>
    `<g transform="translate(${x} ${y}) scale(${sc})"><g class="cloud rain-cloud"><circle cx="0" cy="0" r="22"/><circle cx="24" cy="-8" r="26"/><circle cx="50" cy="2" r="20"/><circle cx="76" cy="-2" r="18"/><rect x="0" y="0" width="76" height="20"/></g></g>`).join('');
  const rainSVG = RAIN_CLOUDS.map(([x, y, sc], c) => Array.from({ length: 7 }, (_, k) => {
    const x1 = x + (6 + k * 11) * sc, y1 = y + 22 * sc;
    return `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${(x1 - 26).toFixed(0)}" y2="505" style="animation-delay:${(-rnd(c * 7 + k) * 0.5).toFixed(2)}s"/>`;
  }).join('')).join('');

  // Night stars across the whole sky
  const STARS = Array.from({ length: 46 }, (_, k) =>
    `<circle class="star" cx="${(-600 + rnd(k + 1) * 2000).toFixed(0)}" cy="${(-220 + rnd(k + 99) * 440).toFixed(0)}" r="${k % 3 ? 1.8 : 2.6}" style="animation-delay:${(-k * 0.37).toFixed(2)}s"/>`).join('');

  // Seagull with flapping wings (faces right)
  const gull = `<g class="gull">
      <path class="wing far" d="M0 -1 Q-3 -11 -12 -15 Q-7 -7 0 -1Z" fill="#b9c2ca"/>
      <ellipse cx="0" cy="0" rx="8" ry="3.4" fill="#fff"/><path d="M-7 -0.5 L-13 -2.5 L-12 2Z" fill="#dfe4e8"/>
      <circle cx="7" cy="-1.6" r="2.8" fill="#fff"/><path d="M9.4 -1.8 L13.5 -0.8 L9.4 0Z" fill="#ffb627"/><circle cx="7.6" cy="-2.3" r=".8" fill="#23313f"/>
      <path class="wing near" d="M1 -1 Q-1 -12 -9 -17 L-12 -15.5 Q-6 -8 -2 -1Z" fill="#eef1f4" stroke="#9aa3ad" stroke-width=".8"/></g>`;
  const gullFlight = (k, y, sc, dur, delay) =>
    `<g data-k="birds${k}" class="fade"><g class="fly" style="animation-duration:${dur}s;animation-delay:${delay}s"><g transform="translate(0 ${y}) scale(${sc})"><g class="soar">${gull}</g></g></g></g>`;

  // Bushes and grass tufts make the island dense; they wilt or burn when the island is sick
  const bush = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})"><g class="veg">
      <circle cx="-12" cy="-8" r="11" class="bush-d"/><circle cx="11" cy="-9" r="12" class="bush-d"/><circle cx="0" cy="-16" r="13" class="bush-l"/>
      <circle cx="-6" cy="-20" r="3.5" fill="#fff" opacity=".22"/><circle cx="-10" cy="-12" r="2" class="berry"/><circle cx="8" cy="-17" r="2" class="berry"/><circle cx="12" cy="-8" r="2" class="berry"/></g></g>`;
  const tuft = (x, y, sc = 1) => `<g transform="translate(${x} ${y}) scale(${sc})"><g class="veg"><path class="tuft" d="M-8 0 q2 -10 -3 -16 M0 0 q0 -12 2 -19 M8 0 q-2 -10 5 -15"/></g></g>`;

  // Coral reef in the shallow water; it bleaches when the island gets sick
  // Realistic reef pieces. currentColor = coral colour (changes when it bleaches).
  const CORAL = {
    staghorn: `<path d="M0 0 C-1 -10 -9 -15 -13 -27 M0 0 C1 -12 4 -21 2 -35 M0 -5 C6 -11 12 -16 16 -27 M2 -22 C-2 -26 -5 -31 -6 -37 M-7 -17 C-13 -19 -17 -21 -21 -23 M15 -24 C19 -27 21 -30 22 -34"
        stroke="currentColor" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      <g fill="#ffffff" opacity=".35"><circle cx="-13" cy="-27" r="2.6"/><circle cx="2" cy="-35" r="2.6"/><circle cx="16" cy="-27" r="2.6"/><circle cx="-6" cy="-37" r="2.3"/><circle cx="-21" cy="-23" r="2.3"/><circle cx="22" cy="-34" r="2.3"/></g>`,
    brain: `<path d="M-19 0 Q-20 -21 0 -22 Q20 -21 19 0Z" fill="currentColor"/>
      <path d="M-14 -3 q3 -7 6 -2 t6 -3 t6 1 t5 -2 M-11 -10 q3 -5 6 -1 t6 -2 t6 0 M-6 -16 q3 -3 6 0 t5 -1" stroke="#00000030" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M-15 -12 Q-10 -19 -2 -20" stroke="#ffffff50" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    fan: `<path d="M-1 0 L0 -7 C-20 -9 -24 -28 -12 -38 C-4 -44 6 -44 13 -38 C24 -28 20 -9 1 -7 L1 0Z" fill="currentColor" opacity=".9"/>
      <path d="M0 -7 C-6 -18 -12 -26 -12 -36 M0 -7 C0 -20 0 -30 1 -42 M0 -7 C6 -18 12 -26 13 -36 M-17 -20 Q0 -26 17 -20 M-14 -30 Q0 -35 15 -30" stroke="#00000028" stroke-width="1.3" fill="none"/>`,
    tube: `<rect x="-14" y="-18" width="8" height="18" rx="3" fill="currentColor"/><rect x="-4" y="-28" width="8" height="28" rx="3" fill="currentColor"/><rect x="6" y="-14" width="8" height="14" rx="3" fill="currentColor"/>
      <ellipse cx="-10" cy="-18" rx="4" ry="1.8" fill="#00000035"/><ellipse cx="0" cy="-28" rx="4" ry="1.8" fill="#00000035"/><ellipse cx="10" cy="-14" rx="4" ry="1.8" fill="#00000035"/>`,
    anemone: `<ellipse cx="0" cy="-3" rx="9" ry="4" fill="currentColor"/>
      <g class="sway-soft" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"><path d="M-7 -4 q-6 -8 -4 -15 M-3 -5 q-3 -9 0 -17 M2 -5 q3 -9 1 -17 M6 -4 q6 -8 4 -15 M0 -5 q0 -8 0 -19"/></g>`,
  };
  const coral = (x, y, type, col, sc = 1) =>
    `<g transform="translate(${x} ${y}) scale(${sc})"><g class="coral c-${col}">${CORAL[type]}</g></g>`;
  const kelp = (x, y, h, d) => `<g transform="translate(${x} ${y})"><g class="kelp" style="animation-delay:${d}s">
      <path d="M0 0 C-6 ${-h * 0.3} 6 ${-h * 0.6} 0 ${-h} M4 0 C10 ${-h * 0.3} -2 ${-h * 0.55} 6 ${-h * 0.8}" stroke="#3f9b5f" stroke-width="4" fill="none" stroke-linecap="round"/></g></g>`;
  const rock = (x, y, w) => `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${w * 0.32}" fill="#5b6470" opacity=".85"/><ellipse cx="${x - w * 0.25}" cy="${y - w * 0.12}" rx="${w * 0.45}" ry="${w * 0.15}" fill="#7a8592" opacity=".7"/>`;
  // A reef cluster: rock + a few corals + seaweed
  const reef = (x, y, sc, a, b, c, ca, cb, cc) => `<g transform="translate(${x} ${y}) scale(${sc})">${rock(0, 2, 34)}
      ${kelp(-30, 4, 46, (x % 7) * -0.3)}${coral(-14, 0, a, ca)}${coral(14, 2, b, cb, 0.9)}${coral(0, 4, c, cc, 0.75)}</g>`;

  // Little island critters
  const butterfly = (x, y, col, d) => `<g transform="translate(${x} ${y})"><g class="flutter" style="animation-delay:${d}s"><g class="bfly">
      <ellipse class="bwing" cx="-5" cy="-3" rx="6" ry="4.5" fill="${col}"/><ellipse class="bwing" cx="5" cy="-3" rx="6" ry="4.5" fill="${col}"/>
      <ellipse class="bwing" cx="-4" cy="3" rx="4" ry="3" fill="${col}"/><ellipse class="bwing" cx="4" cy="3" rx="4" ry="3" fill="${col}"/>
      <rect x="-1" y="-6" width="2" height="11" rx="1" fill="#23313f"/></g></g></g>`;
  const bee = (x, y, d) => `<g transform="translate(${x} ${y})"><g class="beefly" style="animation-delay:${d}s">
      <ellipse class="bwing" cx="-1" cy="-5" rx="3.5" ry="2.4" fill="#e8f7ff" opacity=".9"/>
      <ellipse cx="0" cy="0" rx="5.5" ry="3.8" fill="#ffd23f"/><path d="M-1.6 -3.6 v7.2 M1.8 -3.6 v7.2" stroke="#23313f" stroke-width="1.5"/><circle cx="5" cy="-0.5" r="1.4" fill="#23313f"/></g></g>`;
  const crab = (x, y, d) => `<g transform="translate(${x} ${y})"><g class="scuttle" style="animation-delay:${d}s">
      <path d="M-7 2 l-5 4 M-4 3 l-3 5 M7 2 l5 4 M4 3 l3 5" stroke="#e8573f" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="0" cy="0" rx="9" ry="5.5" fill="#ff6b4a"/><path d="M-4 -4 v-5 M4 -4 v-5" stroke="#e8573f" stroke-width="1.6"/><circle cx="-4" cy="-9" r="1.8" fill="#23313f"/><circle cx="4" cy="-9" r="1.8" fill="#23313f"/>
      <circle cx="-12" cy="-3" r="3.5" fill="#ff6b4a"/><circle cx="12" cy="-3" r="3.5" fill="#ff6b4a"/></g></g>`;
  const frog = `<g class="hop"><ellipse cx="0" cy="-5" rx="9" ry="6" fill="#4caf50"/><circle cx="-4" cy="-11" r="3.4" fill="#4caf50"/><circle cx="4" cy="-11" r="3.4" fill="#4caf50"/>
      <circle cx="-4" cy="-11.5" r="1.6" fill="#23313f"/><circle cx="4" cy="-11.5" r="1.6" fill="#23313f"/><path d="M-4 -4 q4 3 8 0" stroke="#2e7d32" stroke-width="1.4" fill="none"/>
      <ellipse cx="-8" cy="0" rx="4" ry="2" fill="#43a047"/><ellipse cx="8" cy="0" rx="4" ry="2" fill="#43a047"/></g>`;

  // Where sick (dead) fish appear, one more for every harmful choice
  const DEAD_SLOTS = [[100, 470, 170, 1.6], [640, 488, 176, 1.5], [215, 486, 192, 1.5], [40, 446, 185, 1.3], [700, 470, 165, 1.4],
    [330, 494, 180, 1.3], [760, 452, 190, 1.2], [150, 496, 175, 1.2], [440, 497, 188, 1.25], [-80, 470, 178, 1.4], [880, 480, 185, 1.4]];

  function buildSVG(u) {
    return `
<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Island" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${u}sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="285"><stop offset="0" class="st-sky-top"/><stop offset="1" class="st-sky-bot"/></linearGradient>
    <linearGradient id="${u}haze" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="285"><stop offset="0" class="st-haze-top"/><stop offset="1" class="st-haze-bot"/></linearGradient>
    <linearGradient id="${u}sea" gradientUnits="userSpaceOnUse" x1="0" y1="285" x2="0" y2="900"><stop offset="0" class="st-sea-top"/><stop offset=".35" class="st-sea-bot"/><stop offset="1" class="st-sea-deep"/></linearGradient>
    <filter id="${u}tod" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feColorMatrix data-k="todMatrix" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/></filter>
    <radialGradient id="${u}glow"><stop offset="0" stop-color="#fff2a8" stop-opacity=".95"/><stop offset=".35" stop-color="#ffcf5a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb03a" stop-opacity="0"/></radialGradient>
    <radialGradient id="${u}sun"><stop offset="0" stop-color="#fff6b0"/><stop offset="1" stop-color="#ffd23f"/></radialGradient>
  </defs>

  <rect x="-3000" y="-3000" width="6800" height="3285" fill="url(#${u}sky)"/>
  <rect data-k="haze" class="fade" x="-3000" y="-3000" width="6800" height="6800" fill="url(#${u}haze)" opacity="0"/>
  <rect data-k="gloom" class="fade hide" x="-3000" y="-3000" width="6800" height="6800" fill="#4b5563" opacity=".3"/>
  <g data-k="sun" class="sun"><circle data-k="heatGlow" class="fade hide" cx="680" cy="80" r="95" fill="#ffb03a" opacity=".45"/>
    <circle cx="680" cy="80" r="62" fill="#ffe680" opacity=".35"/><circle cx="680" cy="80" r="42" fill="url(#${u}sun)"/>
    <circle class="corona" cx="680" cy="80" r="50" fill="none" stroke="#fff6c8" stroke-width="7"/>
    <circle class="eclipse-moon" cx="680" cy="80" r="44" fill="#151a2b"/></g>
  <g class="nightsky">
    ${STARS}
    <g class="night-moon" transform="translate(110 80)"><circle r="30" fill="#fff7d6" opacity=".25"/><circle r="22" fill="#fff4c2"/><circle cx="9" cy="-6" r="19" class="moon-cut"/></g>
  </g>

  <g class="drift" style="animation-delay:-40s"><g transform="translate(60 70)"><g class="cloud"><circle cx="0" cy="0" r="22"/><circle cx="24" cy="-8" r="26"/><circle cx="50" cy="2" r="20"/><rect x="0" y="0" width="50" height="20"/></g></g></g>
  <g data-k="stormClouds" class="fade hide">
    <rect x="-3000" y="-3000" width="6800" height="3080" fill="#3f4652"/>
    ${Array.from({ length: 30 }, (_, k) => `<circle cx="${-1000 + k * 100}" cy="${80 + (k % 3) * 14}" r="${62 + (k % 4) * 10}" fill="${k % 2 ? '#4a5260' : '#3f4652'}"/>`).join('')}
    ${Array.from({ length: 22 }, (_, k) => `<circle cx="${-900 + k * 130}" cy="${150 + (k % 2) * 12}" r="${46 + (k % 3) * 8}" fill="#565f6d"/>`).join('')}
  </g>
  <g data-k="rainClouds" class="fade hide">${rainCloudsSVG}</g>
  <g class="drift" style="animation-delay:-38s;animation-duration:80s"><g transform="translate(0 140) scale(.7)"><g class="cloud"><circle cx="0" cy="0" r="22"/><circle cx="24" cy="-8" r="26"/><circle cx="50" cy="2" r="20"/><rect x="0" y="0" width="50" height="20"/></g></g></g>

  ${item('darkSmoke', 0, 0, `<g class="billow">
      <circle cx="690" cy="330" r="14"/><circle cx="682" cy="290" r="20"/><circle cx="672" cy="245" r="26"/>
      <circle cx="660" cy="195" r="32"/><circle cx="640" cy="140" r="40"/><circle cx="600" cy="110" r="44"/><circle cx="690" cy="120" r="38"/><circle cx="545" cy="105" r="34"/></g>`, 'fade')}

  ${gullFlight(1, 110, 1.4, 19, -4)}${gullFlight(2, 78, 1.1, 25, -15)}${gullFlight(3, 150, 1.2, 22, -9)}

  <rect x="-3000" y="285" width="6800" height="3000" fill="url(#${u}sea)"/>
  <rect data-k="murk" class="fade" x="-3000" y="285" width="6800" height="3000" fill="#6f7d3c" opacity="0"/>
  <g class="waves"><path d="M20 310 q15 -8 30 0 q15 8 30 0 M640 300 q15 -8 30 0 q15 8 30 0 M300 296 q15 -6 30 0 q15 6 30 0 M-260 320 q15 -8 30 0 q15 8 30 0 M-520 300 q15 -6 30 0 q15 6 30 0 M900 318 q15 -8 30 0 q15 8 30 0 M1160 300 q15 -6 30 0 q15 6 30 0 M-120 460 q15 -8 30 0 q15 8 30 0 M960 470 q15 -8 30 0 q15 8 30 0"/></g>

  <g data-k="land">
  <g transform="translate(716 306) scale(.85)"><g data-k="whale" class="fade hide"><g class="whale-bob">
    <path d="M-34 0 L-50 -16 L-45 0 L-52 10Z" fill="#4a6fa5"/>
    <path d="M-36 6 Q-32 -18 0 -20 Q30 -20 36 2 Q20 10 -36 6Z" fill="#4a6fa5"/>
    <path d="M-26 4 Q0 10 32 2" stroke="#9cc0ea" stroke-width="3" fill="none"/>
    <circle cx="20" cy="-7" r="2.3" fill="#23313f"/><circle cx="20.8" cy="-7.7" r=".8" fill="#fff"/><path d="M24 -1 q6 3 10 -1" stroke="#23313f" stroke-width="1.6" fill="none"/>
    <circle cx="14" cy="-2" r="3" fill="#ff9aa2" opacity=".6"/>
    <g class="spout"><path d="M6 -20 q-6 -14 -14 -16 M6 -20 v-20 M6 -20 q6 -14 14 -16" stroke="#dff4ff" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-37" r="3.2" fill="#dff4ff"/><circle cx="21" cy="-37" r="3.2" fill="#dff4ff"/><circle cx="6" cy="-44" r="3.2" fill="#dff4ff"/></g>
    <ellipse cx="0" cy="8" rx="46" ry="4.5" fill="#e6f9ff" opacity=".75"/></g></g></g>
  <ellipse class="lagoon" cx="400" cy="408" rx="560" ry="132"/>
  <ellipse class="lagoon" cx="400" cy="396" rx="450" ry="108"/>
  <g data-k="farFish" class="fade"><g class="swim" style="animation-duration:60s;animation-delay:-10s"><g transform="translate(0 312) scale(.45)">${fish('#ffd23f')}</g></g>
    <g class="swim" style="animation-duration:70s;animation-delay:-42s"><g transform="translate(0 300) scale(.4)">${fish('#ff8c42')}</g></g>
    <g class="swim" style="animation-duration:66s;animation-delay:-25s"><g transform="translate(0 326) scale(.5)">${fish('#7ad3ff')}</g></g></g>
  <ellipse cx="400" cy="372" rx="366" ry="100" fill="none" stroke="#e6f9ff" stroke-width="5" opacity=".7" class="foam"/>
  <ellipse cx="400" cy="368" rx="352" ry="94" fill="#ecc673"/>
  <ellipse cx="400" cy="362" rx="338" ry="84" fill="#fbe3a2"/>
  <path class="grass" d="M190 318 Q260 228 400 226 Q540 228 610 318Z"/>
  <ellipse class="grass" cx="400" cy="318" rx="245" ry="52"/>
  <ellipse class="grass light" cx="400" cy="312" rx="228" ry="42"/>

  ${tuft(84, 376)}${tuft(742, 366)}${tuft(272, 438, 0.9)}${tuft(712, 384, 0.8)}
  <g data-k="flowers" class="fade">${flower(306, 322, '#ff6fa8')}${flower(452, 352, '#b388ff')}${flower(614, 326, '#ffd23f')}${flower(258, 342, '#ffffff')}</g>

  <g transform="translate(566 342)"><g data-k="pond">
    <ellipse class="pondwater" data-k="pondWater" cx="0" cy="0" rx="40" ry="11"/>
    <path d="M-20 -3 q8 -3 16 0" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>
    <g data-k="bubbles" class="fade hide"><circle cx="-12" cy="-6" r="4" fill="#fff" opacity=".9"/><circle cx="-2" cy="-9" r="3" fill="#fff" opacity=".9"/><circle cx="12" cy="-6" r="5" fill="#fff" opacity=".9"/></g>
  </g></g>

  <g transform="translate(158 342)"><g data-k="cave">
    <path d="M-66 0 Q-72 -54 -32 -78 Q8 -94 46 -72 Q76 -52 68 0Z" fill="#8f99a3"/>
    <path d="M-48 -30 Q-36 -62 2 -72" stroke="#b4bcc4" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M40 -60 Q58 -44 58 -20" stroke="#76808a" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M-34 0 Q-36 -56 2 -56 Q38 -56 36 0Z" fill="#2c3139"/></g></g>
  ${item('caveBed', 154, 341, `<ellipse cx="0" cy="-5" rx="24" ry="7" fill="#4fae3a"/><path d="M-20 -8 q6 -8 12 0 M-4 -9 q6 -8 12 0 M10 -8 q5 -7 10 0" stroke="#7fd65b" stroke-width="3" fill="none"/>`)}
  ${item('caveLamp', 176, 330, `<path d="M0 -26 v-6" stroke="#6b4423" stroke-width="2"/><rect x="-7" y="-26" width="14" height="18" rx="4" fill="#ffe680" stroke="#a0673a" stroke-width="2.5"/><circle cx="0" cy="-17" r="4" fill="#fff6b0"/><rect x="-5" y="-8" width="10" height="3" fill="#a0673a"/>`)}

  ${palm(0, 264, 300, 0.85)}${palm(1, 320, 290, 1)}${palm(2, 372, 300, 0.8)}${palm(3, 462, 300, 0.82)}${palm(4, 526, 290, 1)}${palm(5, 592, 300, 0.9)}
  ${bush(240, 360, 0.6)}${bush(340, 356, 0.62)}${bush(558, 312, 0.66)}${bush(670, 344, 0.7)}

  ${item('parrot', 528, 180, `<ellipse cx="0" cy="0" rx="8" ry="12" fill="#ff4d4d"/><circle cx="2" cy="-12" r="7" fill="#ff4d4d"/>
      <path d="M7 -13 q6 2 2 7Z" fill="#ffd23f"/><circle cx="4" cy="-14" r="1.6" fill="#23313f"/>
      <path d="M-6 -4 q-8 10 -2 18 q6 -6 4 -14Z" fill="#2f80ed"/><path d="M-2 10 l-4 14 M2 10 l2 14" stroke="#ffd23f" stroke-width="3"/>`)}
  ${item('ash', 0, 0, `<ellipse cx="500" cy="306" rx="70" ry="9" fill="#4a4a4a" opacity=".45"/><ellipse cx="470" cy="312" rx="30" ry="5" fill="#333" opacity=".4"/>`, 'fade')}
  ${item('smoke', 0, 0, `<g class="puff"><circle cx="470" cy="190" r="18"/><circle cx="530" cy="160" r="24"/><circle cx="505" cy="130" r="16"/></g>`, 'fade')}
  ${item('bucket', 505, 330, `<path d="M-9 0 L-12 -16 H12 L9 0Z" fill="#4f8fd6"/><path d="M-12 -16 q12 -14 24 0" stroke="#555" stroke-width="2" fill="none"/>`)}

  ${item('sticks', 400, 302, `<path d="M-32 0 L20 -9 M-22 -4 L28 2 M-26 -11 L16 -3" stroke="#8b5a2b" stroke-width="5" stroke-linecap="round"/><path d="M-6 -8 q8 -14 20 -8 q-8 4 -20 8Z" fill="#62b544"/>`, 'pop', false)}
  ${item('house', 400, 302, `
      <rect x="-82" y="-86" width="164" height="86" fill="#c17f45"/>
      <path d="M-82 -70 H82 M-82 -54 H82 M-82 -38 H82 M-82 -22 H82 M-82 -6 H82" stroke="#9c5f2c" stroke-width="3"/>
      <rect x="40" y="-134" width="16" height="30" fill="#7a4020"/>
      <path d="M-98 -84 L0 -138 L98 -84Z" fill="#8a4b25"/>
      <rect x="-62" y="-66" width="28" height="24" fill="#bfe9ff" stroke="#6b3a1a" stroke-width="4"/>
      <rect x="34" y="-66" width="28" height="24" fill="#bfe9ff" stroke="#6b3a1a" stroke-width="4"/>
      <path d="M-14 0 V-38 H14 V0Z" fill="#6b3a1a"/>`)}

  ${item('bpSmall', 285, 354, `<path d="M0 0 V-14" stroke="#4a9a33" stroke-width="3"/><path d="M0 -10 q-12 -6 -14 -16 q10 2 14 12Z M0 -12 q12 -8 14 -18 q-10 4 -14 14Z" fill="#62c544"/><g transform="translate(14 -2)">${bananas}</g>`)}
  ${item('bpSapling', 285, 354, `<path d="M0 0 V-34" stroke="#4a9a33" stroke-width="4"/><path d="M0 -20 q-22 -6 -28 -24 q18 4 28 20Z M0 -26 q22 -10 26 -30 q-18 8 -26 26Z M0 -34 q-6 -16 2 -26 q4 12 -2 26Z" fill="#62c544"/>`)}
  ${item('bpTree', 285, 354, `<path d="M-6 0 L-3 -72 L3 -72 L6 0Z" fill="#7da04a"/>
      <path d="M0 -72 q-46 -16 -66 12 q34 -8 66 -12Z M0 -72 q46 -18 66 10 q-34 -6 -66 -10Z M0 -74 q-20 -34 -6 -50 q14 20 6 50Z M0 -70 q-36 4 -48 34 q22 -20 48 -34Z" fill="#4fbf3a"/>
      <g transform="translate(4 -62)"><g transform="rotate(30)">${bananas}</g><g transform="translate(-2 6) rotate(40)">${bananas}</g><g transform="translate(-4 12) rotate(50)">${bananas}</g></g>`)}
  ${item('bpDead', 285, 354, `<path d="M0 0 q2 -8 -2 -14" stroke="#9b7a3c" stroke-width="3" fill="none"/><path d="M-2 -12 q-12 0 -16 8 M-1 -10 q10 -2 12 8" stroke="#b08a4a" stroke-width="3" fill="none"/>`)}

  ${item('barrel', 624, 352, `<rect x="-14" y="-30" width="28" height="30" rx="4" fill="#a0673a"/><path d="M-14 -22 H14 M-14 -8 H14" stroke="#6b4423" stroke-width="3"/><ellipse cx="0" cy="-30" rx="14" ry="4" fill="#7cc9ef"/>`)}

  ${item('scraps', 128, 400, `<ellipse cx="0" cy="-3" rx="26" ry="6" fill="#e2c07a"/><path d="M-16 -5 q6 -12 12 0Z" fill="#ffb347"/><path d="M2 -8 q8 -8 14 2" stroke="#ffd93b" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="-24" y="-17" width="10" height="13" rx="2" fill="#9aa5b1"/><path d="M8 -4 l6 -10 l6 10z" fill="#e05d5d"/>`)}
  ${item('compost', 128, 400, `<rect x="-24" y="-30" width="48" height="30" rx="3" fill="#a8743a"/><path d="M-24 -20 H24 M-24 -10 H24" stroke="#7d522b" stroke-width="3"/><path d="M-10 -30 q0 -10 6 -13 M6 -30 q2 -12 10 -12" stroke="#4a9a33" stroke-width="3" fill="none"/><circle cx="-4" cy="-44" r="4" fill="#62c544"/><circle cx="16" cy="-43" r="4" fill="#62c544"/>`)}
  ${item('garden', 128, 400, `${flower(36, 2, '#ff6fa8')}${flower(48, 8, '#ffd23f')}${flower(-28, 2, '#b388ff')}
      <g transform="translate(60 4)"><path d="M0 0 l-4 -12 M0 0 l0 -14 M0 0 l4 -12" stroke="#3d9a2e" stroke-width="2.5"/><path d="M-4 0 h8 l-4 8z" fill="#ff8c42"/></g>
      <g transform="translate(-40 2)"><path d="M0 0 l-4 -12 M0 0 l0 -14 M0 0 l4 -12" stroke="#3d9a2e" stroke-width="2.5"/><path d="M-4 0 h8 l-4 8z" fill="#ff8c42"/></g>`)}
  ${item('trash', 128, 400, `<path d="M-34 0 Q-28 -30 0 -32 Q26 -30 34 0Z" fill="#8a8f98"/><rect x="-18" y="-22" width="12" height="10" fill="#c94f4f" transform="rotate(-15)"/><rect x="6" y="-20" width="9" height="14" rx="2" fill="#5ab4d6"/><path d="M-8 -30 l10 -6 l4 8z" fill="#f2c94c"/>${flies(0, -40)}`)}

  ${item('bottles', 225, 422, `${bottle(-28, 0, -70)}${bottle(-6, -4, 20)}${bottle(16, 2, 80)}${bottle(34, -6, -10)}`)}
  ${item('bin', 225, 422, `<path d="M-17 -36 H17 L13 0 H-13Z" fill="#2fa84f"/><rect x="-19" y="-41" width="38" height="7" rx="2" fill="#23863e"/><text x="0" y="-11" text-anchor="middle" font-size="20" font-weight="700" fill="#fff">♻</text>`)}
  ${item('pots', 225, 422, `<g transform="translate(34 0)"><rect x="-6" y="-10" width="12" height="10" rx="2" fill="#a8e0f5" stroke="#4fb0d8"/>${flower(0, -8, '#ff6fa8')}</g><g transform="translate(-34 2)"><rect x="-6" y="-10" width="12" height="10" rx="2" fill="#a8e0f5" stroke="#4fb0d8"/>${flower(0, -8, '#ffd23f')}</g>`)}

  ${item('rod', 318, 442, `<path d="M-24 0 L22 -64" stroke="#8b5a2b" stroke-width="4" stroke-linecap="round"/><path d="M22 -64 Q44 -40 42 14" stroke="#fff" stroke-width="1.2" fill="none"/>
      <path d="M-8 0 L-11 -16 H11 L8 0Z" fill="#4f8fd6"/><g transform="translate(0 -18) rotate(-70) scale(.6)">${fish()}</g>`)}
  ${item('net', 318, 444, `<path d="M-38 0 Q-34 -34 0 -36 Q34 -34 38 0Z" fill="#ff9a55"/>
      <g transform="translate(-16 -14) scale(.7)">${fish('#ffb067')}</g><g transform="translate(14 -20) scale(.7) rotate(15)">${fish('#ff8c42')}</g><g transform="translate(4 -6) scale(.7) rotate(-10)">${fish('#ffa04d')}</g>
      <path d="M-34 -6 L18 -34 M-24 -1 L30 -28 M-10 0 L36 -18 M34 -6 L-18 -34 M24 -1 L-30 -28 M10 0 L-36 -18" stroke="#4d3b2e" stroke-width="1.6"/>`)}

  ${item('fruitpile', 505, 428, `${fruit(-14, -7, 9, '#ff5a5a')}${fruit(4, -7, 9, '#ffb627')}${fruit(20, -6, 8, '#7ed957')}${fruit(-5, -21, 9, '#ffd93b')}${fruit(12, -20, 8, '#ff5a5a')}${fruit(3, -33, 8, '#ff9f1c')}`)}
  ${item('basket', 505, 428, `${fruit(-8, -20, 7, '#ff5a5a')}${fruit(6, -21, 7, '#ffd93b')}<path d="M-22 -18 H22 L16 0 H-16Z" fill="#c98f4f"/><path d="M-20 -12 H20 M-18 -6 H18 M-8 -18 L-6 0 M8 -18 L6 0" stroke="#a3703a" stroke-width="2"/>`)}
  ${item('cores', 505, 428, `<path d="M-14 -2 q-4 -8 0 -14 q4 6 0 14Z M-14 -16 v-4" fill="#f5e6c4" stroke="#c94f4f" stroke-width="2"/><path d="M4 -2 q8 -8 18 -2 q-8 0 -18 2Z" fill="#ffb347"/>${flies(4, -24)}`)}
  ${item('peel', 452, 430, `<path d="M0 0 q-10 -4 -14 4 M0 0 q10 -4 14 4 M0 0 q0 -10 -2 -14" stroke="#ffd93b" stroke-width="5" stroke-linecap="round" fill="none"/>`)}

  ${item('turtles', 630, 418, `${turtle(-14, 0, 1)}${turtle(22, 8, 0.9)}`)}
  ${item('nest', 630, 418, `<ellipse cx="0" cy="0" rx="22" ry="6" fill="#e3bd6c"/><circle cx="-8" cy="-4" r="4.5" fill="#fff"/><circle cx="1" cy="-6" r="4.5" fill="#fff"/><circle cx="9" cy="-3" r="4.5" fill="#fff"/>
      <path d="M-30 4 V-14 M-18 8 V-10 M18 8 V-10 M30 4 V-14 M-30 -8 H30" stroke="#a0673a" stroke-width="2.5"/>`)}
  ${item('babies', 630, 418, `<g class="crawl">${turtle(-10, 0, 0.45)}</g><g class="crawl" style="animation-delay:-1s">${turtle(8, 4, 0.45)}</g><g class="crawl" style="animation-delay:-2s">${turtle(0, -4, 0.45)}</g>`)}
  ${item('turtlesSwim', 720, 478, `<g class="float">${turtle(0, 0, 0.9)}</g>`)}
  ${item('turtlesLeave', 660, 470, `<g class="swimaway">${turtle(0, 0, 1)}${turtle(34, 10, 0.9)}</g>`, 'fade')}

  ${item('woodpile', 690, 384, `<rect x="-26" y="-12" width="52" height="12" rx="6" fill="#a0673a"/><rect x="-20" y="-24" width="40" height="12" rx="6" fill="#b5773f"/><rect x="-12" y="-36" width="24" height="12" rx="6" fill="#a0673a"/>
      <circle cx="-22" cy="-6" r="5" fill="#e5b77f"/><circle cx="-16" cy="-18" r="5" fill="#e5b77f"/><circle cx="-8" cy="-30" r="5" fill="#e5b77f"/>`)}
  ${item('bonfire', 690, 384, `<path d="M-30 0 L30 -14 M-30 -14 L30 0" stroke="#6b4423" stroke-width="7" stroke-linecap="round"/>${flame(0, -14, 2.2)}${flame(-18, -6, 1.3)}${flame(18, -6, 1.3)}`)}
  ${item('campfire', 646, 394, `<ellipse cx="0" cy="0" rx="16" ry="4" fill="#888"/><path d="M-12 0 L12 -5 M-12 -5 L12 0" stroke="#6b4423" stroke-width="4" stroke-linecap="round"/>${flame(0, -5, 0.7)}`)}

  <g data-k="reef" class="reef">
    ${reef(60, 512, 0.9, 'staghorn', 'brain', 'anemone', 'a', 'd', 'b')}${reef(200, 516, 0.85, 'fan', 'tube', 'brain', 'c', 'b', 'e')}
    ${reef(330, 514, 0.8, 'brain', 'staghorn', 'anemone', 'e', 'a', 'c')}${reef(640, 514, 0.85, 'staghorn', 'fan', 'tube', 'b', 'c', 'a')}
    ${reef(770, 512, 0.9, 'tube', 'brain', 'anemone', 'd', 'a', 'e')}
    ${reef(-140, 520, 1.1, 'fan', 'staghorn', 'brain', 'a', 'e', 'b')}${reef(-380, 520, 1.1, 'brain', 'tube', 'anemone', 'c', 'd', 'a')}
    ${reef(960, 520, 1.1, 'staghorn', 'brain', 'tube', 'c', 'b', 'd')}${reef(1200, 520, 1.1, 'fan', 'anemone', 'brain', 'e', 'a', 'c')}
    ${reef(120, 640, 1.4, 'brain', 'fan', 'staghorn', 'b', 'a', 'e')}${reef(460, 660, 1.5, 'staghorn', 'tube', 'fan', 'a', 'd', 'c')}
    ${reef(760, 630, 1.4, 'fan', 'brain', 'anemone', 'c', 'e', 'b')}${reef(300, 780, 1.6, 'tube', 'staghorn', 'brain', 'd', 'b', 'a')}${reef(640, 800, 1.6, 'brain', 'fan', 'staghorn', 'e', 'c', 'a')}
  </g>
  <!-- deeper, bigger fish (they leave when the sea gets sick or is overfished) -->
  <g data-k="deepFish" class="fade">
    <g class="swim" style="animation-duration:46s;animation-delay:-5s"><g transform="translate(0 560) scale(1.5)">${fish('#4fa3e0')}</g></g>
    <g class="swim" style="animation-duration:52s;animation-delay:-30s"><g transform="translate(0 600) scale(1.3)">${fish('#ffd23f')}</g></g>
    <g class="swim" style="animation-duration:58s;animation-delay:-18s"><g transform="translate(0 690) scale(1.8)">${fish('#ff8c42')}</g></g>
    <g class="swim" style="animation-duration:50s;animation-delay:-40s"><g transform="translate(0 740) scale(1.4)">${fish('#7ad3ff')}</g></g>
    <g class="swim" style="animation-duration:64s;animation-delay:-12s"><g transform="translate(0 820) scale(1.6)">${fish('#ff6fa8')}</g></g>
  </g>
  <g data-k="bigFish" class="fade"><g class="swim" style="animation-duration:80s;animation-delay:-20s"><g transform="translate(0 650) scale(3)">${fish('#3d7cc9')}</g></g></g>
  <g data-k="seaTurtle" class="fade"><g class="swim" style="animation-duration:75s;animation-delay:-50s"><g transform="translate(0 540) scale(1.6)"><g class="float">${turtle(0, 0, 1)}</g></g></g></g>
  <g data-k="critters">
    <g data-k="butterflies" class="fade">${butterfly(280, 300, '#ff8ad8', 0)}${butterfly(470, 300, '#ffd23f', -2)}${butterfly(360, 318, '#8fd3ff', -4)}</g>
    <g data-k="bees" class="fade">${bee(300, 330, 0)}${bee(626, 306, -1.2)}${bee(450, 330, -2.1)}</g>
    <g data-k="crabs" class="fade">${crab(150, 426, 0)}${crab(560, 440, -1.5)}</g>
    <g transform="translate(520 344)"><g data-k="frog" class="fade">${frog}</g></g>
  </g>
  <g data-k="fish"><g class="swim" style="animation-duration:34s"><g transform="translate(0 482)">${fish()}</g></g><g class="swim" style="animation-delay:-14s;animation-duration:40s"><g transform="translate(0 470) scale(.8)">${fish('#ffd23f')}</g></g><g class="swim" style="animation-delay:-24s;animation-duration:30s"><g transform="translate(0 492) scale(.9)">${fish('#ff6fa8')}</g></g></g>
  ${item('babyFish', 0, 0, `<g class="swim" style="animation-delay:-6s;animation-duration:26s"><g transform="translate(0 488) scale(.5)">${fish()}</g></g><g class="swim" style="animation-delay:-17s;animation-duration:28s"><g transform="translate(0 476) scale(.5)">${fish('#ffd23f')}</g></g><g class="swim" style="animation-delay:-2s;animation-duration:32s"><g transform="translate(0 494) scale(.45)">${fish('#ff6fa8')}</g></g>`, 'fade')}
  ${item('jumper', 150, 474, `<g class="fishjump">${fish('#ffb627')}</g>`, 'fade')}
  ${item('seaBottles', 0, 0, `<g class="float">${bottle(52, 452, 80, 1.5)}</g><g class="float" style="animation-delay:-1s">${bottle(735, 462, -60, 1.5)}</g><g class="float" style="animation-delay:-2s">${bottle(300, 486, 100, 1.4)}</g>`, 'fade')}
  ${DEAD_SLOTS.map(([x, y, r, sc], k) => `<g data-k="dead${k}" class="fade hide">${deadFish(x, y, r, sc)}</g>`).join('')}

  <g data-k="fx"></g>

  <g transform="translate(400 400)"><g class="walker"><g data-k="monkey"><g class="mjump"><g class="bob">
    <path d="M16 12 C46 14 52 -18 34 -26 C26 -28 24 -18 32 -16" stroke="#7a4a24" stroke-width="6" fill="none" stroke-linecap="round"/>
    <ellipse cx="-11" cy="24" rx="9" ry="6" fill="#7a4a24"/><ellipse cx="11" cy="24" rx="9" ry="6" fill="#7a4a24"/>
    <ellipse cx="0" cy="0" rx="22" ry="26" fill="#8b5a2b"/>
    <ellipse cx="0" cy="6" rx="13" ry="16" fill="#e8c39e"/>
    <path d="M-18 -8 Q-34 6 -24 20" stroke="#8b5a2b" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M18 -8 Q34 6 24 20" stroke="#8b5a2b" stroke-width="9" fill="none" stroke-linecap="round"/>
    <g transform="translate(0 -40)">
      <circle cx="-26" cy="0" r="10" fill="#8b5a2b"/><circle cx="-26" cy="0" r="6" fill="#e8c39e"/>
      <circle cx="26" cy="0" r="10" fill="#8b5a2b"/><circle cx="26" cy="0" r="6" fill="#e8c39e"/>
      <circle cx="0" cy="0" r="26" fill="#8b5a2b"/>
      <ellipse cx="0" cy="8" rx="18" ry="14" fill="#e8c39e"/>
      <circle cx="-8" cy="-4" r="9" fill="#e8c39e"/><circle cx="8" cy="-4" r="9" fill="#e8c39e"/>
      <g class="eyes"><circle cx="-7" cy="-4" r="3.6" fill="#23313f"/><circle cx="7" cy="-4" r="3.6" fill="#23313f"/>
      <circle cx="-6" cy="-5.5" r="1.2" fill="#fff"/><circle cx="8" cy="-5.5" r="1.2" fill="#fff"/></g>
      <circle cx="-2.5" cy="5" r="1.4" fill="#5a2d0c"/><circle cx="2.5" cy="5" r="1.4" fill="#5a2d0c"/>
      <g data-k="mHappy" class="fade mood"><path d="M-9 10 Q0 21 9 10 Z" fill="#5a2d0c"/><path d="M-5 14 Q0 18 5 14" fill="#ff8fa3"/><circle cx="-15" cy="6" r="4" fill="#ff9aa2" opacity=".6"/><circle cx="15" cy="6" r="4" fill="#ff9aa2" opacity=".6"/></g>
      <g data-k="mMeh" class="fade hide mood"><path d="M-7 13 Q0 15 7 13" stroke="#5a2d0c" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>
      <g data-k="mSad" class="fade hide mood"><path d="M-8 16 Q0 8 8 16" stroke="#5a2d0c" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M-12 2 q-3 6 0 8 q3 -2 0 -8Z" fill="#7cc9ef"/></g>
      <!-- reactions (shown by Scene.react) -->
      <g class="r r-yay"><path d="M-11 -3 q4 -6 8 0 M3 -3 q4 -6 8 0" stroke="#23313f" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M-10 9 Q0 25 10 9Z" fill="#5a2d0c"/><path d="M-5 15 Q0 20 5 15" fill="#ff8fa3"/>
        <path class="heart" d="M32 -30 c-3 -6 -11 -2 -6 4 l6 6 l6 -6 c5 -6 -3 -10 -6 -4Z" fill="#ff5a7a"/><path class="heart" style="animation-delay:-.4s" d="M-34 -24 c-2 -4 -8 -1 -4 3 l4 4 l4 -4 c4 -4 -2 -7 -4 -3Z" fill="#ff5a7a"/></g>
      <g class="r r-scared"><circle cx="-8" cy="-4" r="7" fill="#fff" stroke="#23313f" stroke-width="1.5"/><circle cx="8" cy="-4" r="7" fill="#fff" stroke="#23313f" stroke-width="1.5"/>
        <circle cx="-8" cy="-4" r="2.6" fill="#23313f"/><circle cx="8" cy="-4" r="2.6" fill="#23313f"/><ellipse cx="0" cy="14" rx="5" ry="6" fill="#5a2d0c"/>
        <text x="30" y="-22" font-size="24" font-weight="900" fill="#ff5b4a">!</text></g>
      <g class="r r-cold"><rect x="-8" y="10" width="16" height="7" rx="2" fill="#fff" stroke="#5a2d0c" stroke-width="1.5"/><path d="M-4 10 v7 M0 10 v7 M4 10 v7" stroke="#5a2d0c" stroke-width="1"/>
        <circle cx="-15" cy="6" r="4.5" fill="#8fc8ff" opacity=".85"/><circle cx="15" cy="6" r="4.5" fill="#8fc8ff" opacity=".85"/>
        <text x="28" y="-20" font-size="16" fill="#8fc8ff">❄</text><text x="-42" y="-14" font-size="13" fill="#8fc8ff">❄</text></g>
      <g class="r r-hot"><path d="M-7 13 q3.5 -3 7 0 t7 0" stroke="#5a2d0c" stroke-width="2.4" fill="none"/><path class="drip" d="M20 -18 q-4 7 0 9 q4 -2 0 -9Z M-22 -12 q-3 5 0 7 q3 -2 0 -7Z" fill="#6fc3f5"/></g>
      <g class="r r-sad"><path d="M-8 16 Q0 8 8 16" stroke="#5a2d0c" stroke-width="2.5" fill="none" stroke-linecap="round"/><path class="drip" d="M-12 2 q-3 6 0 8 q3 -2 0 -8Z M12 2 q-3 6 0 8 q3 -2 0 -8Z" fill="#7cc9ef"/></g>
      <g class="r r-think"><circle cx="4" cy="13" r="2.8" fill="#5a2d0c"/><text x="28" y="-22" font-size="24" font-weight="900" fill="#2f80ed">?</text></g>
    </g>
  </g></g>
  </g></g></g>
  <!-- the sea in front of the monkey's legs when it hides in the water (same colours as the sea) -->
  <g class="wade-water">
    <clipPath id="${u}wade"><path d="M470 474 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 V560 H470Z"/></clipPath>
    <g clip-path="url(#${u}wade)">
      <!-- exactly the same layers as the sea around it, so it blends in perfectly -->
      <rect x="400" y="285" width="300" height="300" fill="url(#${u}sea)"/>
      <rect data-k="wadeMurk" x="400" y="285" width="300" height="300" fill="#6f7d3c" opacity="0"/>
      <ellipse class="lagoon" cx="400" cy="408" rx="560" ry="132"/><ellipse class="lagoon" cx="400" cy="396" rx="450" ry="108"/>
      <ellipse cx="400" cy="372" rx="366" ry="100" fill="none" stroke="#e6f9ff" stroke-width="5" opacity=".7" class="foam"/>
    </g>
    <path class="wade-foam" d="M476 474 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0" stroke="#e6f9ff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>
  </g>
  <g data-k="fxTop"></g>
  </g>

  <!-- lights that glow at night (drawn on top so they stay bright) -->
  <g class="glows">
    <circle data-glow="caveLamp" cx="176" cy="313" r="34" fill="url(#${u}glow)"/>
    <circle data-glow="campfire" cx="646" cy="384" r="46" fill="url(#${u}glow)"/>
    <circle data-glow="bonfire" cx="690" cy="350" r="90" fill="url(#${u}glow)"/>
    <circle data-glow="house" cx="352" cy="248" r="26" fill="url(#${u}glow)"/>
    <circle data-glow="house" cx="448" cy="248" r="26" fill="url(#${u}glow)"/>
  </g>

  <g data-k="rain" class="rain hide">${rainSVG}</g>

  <g data-k="bubble" class="bubble hide" transform="translate(400 300)"><g class="bubble-in">
    <rect data-k="bubbleBox" x="-60" y="-54" width="120" height="48" rx="18" fill="#fff" stroke="#23313f" stroke-width="3"/>
    <path d="M-11 -7.5 L0 10 L11 -7.5" fill="#fff" stroke="#23313f" stroke-width="3" stroke-linejoin="round"/>
    <text data-k="bubbleText" x="0" y="-21" text-anchor="middle" font-size="25" font-weight="800" fill="#23313f"></text>
  </g></g>
</svg>`;
  }

  /* What each choice shows on the island.
     ev = the problem appears, good/bad = result, pay = reward 2 turns later.
     s.task(x, y, fn) walks the monkey to (x, y), does fn there, then walks back. */
  const BOTTLE = bottle(0, 0, 0, 1.3);
  const FISH_SMALL = `<g transform="scale(.7)">${fish()}</g>`;
  const DROP = '<path d="M0 -8 q-6 8 0 12 q6 -4 0 -12Z" fill="#7cc9ef"/>';
  const ACTIONS = {
    shelter: {
      ev() {},
      good(s) { s.hide('sticks'); s.task(212, 372, () => { s.show('caveBed'); s.show('caveLamp'); s.sparkle(158, 300); }); },
      bad(s) {
        s.task(300, 370, () => {
          s.chop();
          setTimeout(() => { s.hide('sticks'); [0, 1, 2].forEach((n) => s.palm(n, 'stump')); s.show('house'); }, 700);
        });
      },
      pay(s) { s.showCocos(); s.sparkle(526, 180); },
    },
    plastic: {
      ev(s) { s.show('bottles'); },
      good(s) {
        s.task(262, 414, () => {
          s.show('bin');
          [[-28, 0], [-6, -4], [16, 2], [34, -6]].forEach(([dx, dy], k) =>
            setTimeout(() => s.toss(225 + dx, 422 + dy, 225, 386, BOTTLE, 520, k === 3 ? () => s.hide('bottles') : null), k * 160));
        }, 2000);
      },
      bad(s) {
        s.task(250, 418, () => {
          s.hide('bottles');
          [[52, 452], [300, 486], [735, 462]].forEach(([x, y], k) =>
            setTimeout(() => s.toss(250, 380, x, y, BOTTLE, 900, () => { s.splash(x, y); if (k === 2) { s.show('seaBottles'); s.addDead(1); s.murk += 0.22; } }), k * 260));
        }, 2300);
      },
      pay(s) { s.show('pots'); s.sparkle(225, 400); },
    },
    food: {
      ev(s) { s.show('fruitpile'); },
      good(s) { s.task(470, 420, () => { s.hide('fruitpile'); s.show('basket'); }); },
      bad(s) { s.task(470, 420, () => { s.hide('fruitpile'); s.show('cores'); }); },
      pay(s) { s.rain(3200); s.sparkle(505, 405); },
    },
    banana: {
      ev(s) { s.show('bpSmall'); },
      good(s) { s.task(318, 368, () => { s.hide('bpSmall'); s.show('bpSapling'); s.sparkle(285, 330); }); },
      bad(s) { s.task(318, 368, () => { s.hide('bpSmall'); s.show('bpDead'); s.show('peel'); }); },
      pay(s) { s.hide('bpSapling'); s.show('bpTree'); s.sparkle(285, 300); },
    },
    fishing: {
      ev() {},
      good(s) {   // a fishing rod: cast, wait, one fish jumps into the bucket
        s.task(352, 432, () => {
          s.show('rod');
          setTimeout(() => s.toss(362, 486, 318, 424, FISH_SMALL, 700, () => s.sparkle(318, 420)), 900);
        }, 2400);
      },
      bad(s) {    // a giant net: throw it out, drag back tons of fish
        s.task(352, 432, () => {
          s.toss(352, 392, 300, 488, '<path d="M-18 -10 L18 -10 L14 10 L-14 10Z" fill="none" stroke="#4d3b2e" stroke-width="2"/><path d="M-16 -4 H16 M-15 3 H15 M-8 -10 V10 M0 -10 V10 M8 -10 V10" stroke="#4d3b2e" stroke-width="1.2"/>', 800,
            () => { s.splash(300, 488); setTimeout(() => { s.show('net'); s.hide('fish'); s.murk += 0.08; }, 500); });
        }, 2400);
      },
      pay(s) { s.show('babyFish'); s.show('jumper'); s.sparkle(150, 450); },
    },
    compost: {
      ev(s) { s.show('scraps'); },
      good(s) { s.task(176, 404, () => { s.hide('scraps'); s.show('compost'); }); },
      bad(s) { s.task(176, 404, () => { s.hide('scraps'); s.show('trash'); }); },
      pay(s) { s.show('garden'); s.sparkle(128, 380); },
    },
    fire: {
      ev(s) { s.flames(3, true); s.flames(4, true); },
      good(s) {   // run to the fire with the bucket and throw the water
        s.show('bucket');
        s.task(440, 360, () => {
          [0, 1, 2].forEach((k) => setTimeout(() => s.toss(440, 330, 470 + k * 30, 210 + k * 10, DROP, 500), k * 140));
          setTimeout(() => { s.flames(3, false); s.flames(4, false); s.flash('smoke', 2200); }, 650);
        }, 2000);
      },
      bad(s) { s.flames(3, false); s.flames(4, false); s.palm(3, 'burnt'); s.palm(4, 'burnt'); s.show('ash'); },
      pay(s) { s.rain(3200); s.show('parrot'); },
    },
    firewood: { // the cold night
      ev() {},
      good(s) { s.task(612, 398, () => { s.show('campfire'); s.sparkle(646, 370); }); },
      bad(s) {
        s.task(560, 352, () => {
          s.chop();
          setTimeout(() => { s.show('bonfire'); s.show('darkSmoke'); s.palm(4, 'stump'); s.palm(5, 'stump'); s.smoke += 0.15; }, 700);
        });
      },
      pay(s) { s.show('woodpile'); s.show('campfire'); s.sparkle(690, 350); },
    },
    water: {
      ev(s) { s.show('heatGlow'); },
      good(s) { s.hide('heatGlow'); s.task(522, 370, () => { s.show('barrel'); s.toss(560, 340, 600, 326, DROP, 400); }); },
      bad(s) { s.hide('heatGlow'); s.task(522, 370, () => { s.jump(); s.splash(566, 342); s.q('pondWater').classList.add('dirty'); s.show('bubbles'); }); },
      pay(s) { s.rain(3200); s.sparkle(624, 320); },
    },
    turtles: {
      ev(s) { s.show('turtles'); },
      good(s) { s.task(300, 380, () => { s.hide('turtles'); s.show('nest'); s.show('turtlesSwim'); }); }, // plays somewhere else
      bad(s) { s.task(580, 410, () => { s.hide('turtles'); s.show('turtlesLeave'); }); },                  // shoos them away
      pay(s) { s.show('babies'); s.sparkle(630, 400); },
    },
  };

  /* Day/night: the island is tinted with a colour matrix (works on every browser). */
  const TIME_MATRIX = {
    day:     [1, 0, 0, 0, 0,     0, 1, 0, 0, 0,        0, 0, 1, 0, 0,       0, 0, 0, 1, 0],
    morning: [1.03, 0, 0, 0, 0.03, 0, 0.98, 0, 0, 0.01, 0, 0, 0.9, 0, 0,     0, 0, 0, 1, 0],
    evening: [1, 0, 0, 0, 0.05,  0, 0.8, 0, 0, 0,       0, 0, 0.75, 0, 0.04, 0, 0, 0, 1, 0],
    night:   [0.4, 0, 0, 0, 0,   0, 0.46, 0, 0, 0.02,   0, 0, 0.7, 0, 0.09,  0, 0, 0, 1, 0],
    eclipse: [0.5, 0, 0, 0, 0,   0, 0.52, 0, 0, 0.02,   0, 0, 0.72, 0, 0.08,  0, 0, 0, 1, 0],
  };

  function create(container) {
    const u = 's' + ++uid + '-';
    container.innerHTML = buildSVG(u);
    const svg = container.querySelector('svg');
    const q = (k) => svg.querySelector(`[data-k="${k}"]`);
    const land = q('land');
    const monkey = q('monkey');
    let mood = '';
    let matrix = TIME_MATRIX.day.slice();
    let time = 'day';
    let tween = 0;
    let reactTimer = 0;
    let bubbleTimer = 0;
    let followRaf = 0;
    let destroyed = false;
    let deadCount = 0;
    let badCount = 0;
    let walkPos = [400, 400];
    let walkTimer = 0;
    let taskId = 0;
    let whaleAllowed = false;
    const harmed = { sea: false, fish: false };

    const visible = (el) => el && !el.classList.contains('hide') && !el.classList.contains('swept');
    function updateGlows() {
      const dark = time === 'night' || time === 'evening' || time === 'eclipse';
      svg.querySelectorAll('[data-glow]').forEach((g) => {
        g.classList.toggle('on', dark && !destroyed && visible(q(g.dataset.glow)));
      });
    }

    const s = {
      q,
      murk: 0,
      smoke: 0,
      show(k) { const el = q(k); if (el) el.classList.remove('hide'); updateGlows(); },
      hide(k) { const el = q(k); if (el) el.classList.add('hide'); updateGlows(); },
      flash(k, ms) { s.show(k); setTimeout(() => s.hide(k), ms); },
      palm(n, state) {
        const p = q('palm' + n);
        ['alive', 'stump', 'burnt'].forEach((st) => p.querySelector('.' + st).classList.toggle('hide', st !== state));
        p.dataset.state = state;
      },
      flames(n, on) { q('palm' + n).querySelector('.flames').classList.toggle('hide', !on); },
      showCocos() {
        for (let n = 0; n < 6; n++) {
          const p = q('palm' + n);
          if (p.dataset.state === 'alive') p.querySelector('.cocos').classList.remove('hide');
        }
      },
      /* walk to (x, y) in island coordinates; resolves when there */
      walkTo(x, y) {
        const w = svg.querySelector('.walker');
        const [cx, cy] = walkPos;
        const dist = Math.hypot(x - cx, y - cy);
        const ms = Math.max(350, Math.min(1500, dist * 5.5));
        walkPos = [x, y];
        w.style.transitionDuration = ms + 'ms';
        w.style.transform = `translate(${x - 400}px, ${y - 400}px)`;
        monkey.classList.toggle('walking', dist > 4);
        clearTimeout(walkTimer);
        return new Promise((done) => { walkTimer = setTimeout(() => { monkey.classList.remove('walking'); done(); }, ms); });
      },
      home() { return s.walkTo(400, 400); },
      task(x, y, fn, stay = 1700) {
        const id = ++taskId;
        s.walkTo(x, y).then(() => {
          if (id !== taskId) return;
          fn();
          setTimeout(() => { if (id === taskId && !destroyed) s.home(); }, stay);
        });
      },
      chop() { restartAnim(svg.querySelector('.mjump'), 'chop'); },
      /* throw something in an arc from (x1,y1) to (x2,y2) */
      toss(x1, y1, x2, y2, inner, ms = 800, after = null) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.innerHTML = inner;
        q('fxTop').appendChild(g);
        const peak = Math.min(y1, y2) - 70 - Math.abs(x2 - x1) * 0.15, t0 = performance.now();
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
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${x} ${y})`);
        g.innerHTML = `<g class="splash"><ellipse rx="14" ry="4" fill="none" stroke="#e6f9ff" stroke-width="3"/><path d="M-8 -2 l-4 -10 M0 -3 v-14 M8 -2 l4 -10" stroke="#e6f9ff" stroke-width="3" stroke-linecap="round"/></g>`;
        q('fxTop').appendChild(g);
        setTimeout(() => g.remove(), 900);
      },
      addDead(n) {
        deadCount = Math.min(DEAD_SLOTS.length, deadCount + n);
        for (let k = 0; k < deadCount; k++) s.show('dead' + k);
      },
      rain(ms) { setWeather('rain'); clearTimeout(s.rainTimer); s.rainTimer = setTimeout(() => setWeather('clear'), ms); },
      sparkle(x, y) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${x} ${y})`);
        g.innerHTML = `<g class="sparkle">${[0, 72, 144, 216, 288].map((a) =>
          `<g transform="rotate(${a})"><path d="M0 -14 l3 8 l8 1 l-6 5 l2 8 l-7 -4 l-7 4 l2 -8 l-6 -5 l8 -1z" fill="#fff36b" stroke="#ffb627" stroke-width="1"/></g>`).join('')}</g>`;
        q('fx').appendChild(g);
        setTimeout(() => g.remove(), 1300);
      },
      jump() { restartAnim(svg.querySelector('.mjump'), 'jump'); },
      droop() { restartAnim(svg.querySelector('.mjump'), 'droop'); },
    };

    function restartAnim(el, cls) {
      el.classList.remove('jump', 'droop');
      void el.getBoundingClientRect();
      el.classList.add(cls);
    }

    /* ── time of day + weather ── */
    function setTime(t) {
      if (!TIME_MATRIX[t]) t = 'day';
      time = t;
      document.documentElement.dataset.time = t;  // sky + sea colours (also the page background)
      const from = matrix.slice(), to = TIME_MATRIX[t], start = performance.now(), node = q('todMatrix');
      cancelAnimationFrame(tween);
      land.setAttribute('filter', `url(#${u}tod)`);
      const stepFn = (now) => {
        const k = Math.min(1, (now - start) / 1400), e = k * k * (3 - 2 * k);
        matrix = from.map((v, n) => v + (to[n] - v) * e);
        node.setAttribute('values', matrix.map((v) => v.toFixed(3)).join(' '));
        if (k < 1) tween = requestAnimationFrame(stepFn);
        else if (t === 'day') land.removeAttribute('filter'); // no filter needed in daylight
      };
      tween = requestAnimationFrame(stepFn);
      updateGlows();
    }
    function setWeather(w) {
      const rainy = w === 'rain';
      svg.classList.toggle('rainy', rainy);
      q('rain').classList.toggle('hide', !rainy);
      q('rainClouds').classList.toggle('hide', !rainy);
      q('gloom').classList.toggle('hide', !rainy);
      if (!rainy) q('stormClouds').classList.add('hide');
    }

    /* ── monkey reactions + speech bubble ── */
    function react(kind, ms = 2600) {
      clearTimeout(reactTimer);
      if (kind) monkey.dataset.react = kind; else delete monkey.dataset.react;
      if (kind === 'yay') s.jump();
      if (kind === 'sad') s.droop();
      if (kind && ms) reactTimer = setTimeout(() => delete monkey.dataset.react, ms);
    }
    function say(text, ms = 3000) {
      const b = q('bubble'), txt = q('bubbleText'), box = q('bubbleBox');
      clearTimeout(bubbleTimer);
      if (!text) { b.classList.add('hide'); return; }
      txt.textContent = text;
      const w = Math.min(560, txt.getComputedTextLength() + 34);
      box.setAttribute('x', -w / 2);
      box.setAttribute('width', w);
      // place the bubble just above the monkey's head, wherever the monkey is
      const r = monkey.getBoundingClientRect(), ctm = svg.getScreenCTM();
      let x = 400, y = 300;
      if (ctm && r.width) {
        const pt = svg.createSVGPoint();
        pt.x = r.left + r.width / 2; pt.y = r.top;
        const p = pt.matrixTransform(ctm.inverse());
        x = p.x; y = p.y - 10;
      }
      x = Math.max(w / 2 + 6, Math.min(800 - w / 2 - 6, x));
      y = Math.max(62, y);
      b.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      b.classList.remove('hide');
      cancelAnimationFrame(followRaf);
      const follow = () => {   // keep the bubble above the monkey while it walks around
        if (b.classList.contains('hide')) return;
        const r2 = monkey.getBoundingClientRect(), m = svg.getScreenCTM();
        if (m && r2.width) {
          const pt = svg.createSVGPoint();
          pt.x = r2.left + r2.width / 2; pt.y = r2.top;
          const p2 = pt.matrixTransform(m.inverse());
          const nx = Math.max(w / 2 + 6, Math.min(800 - w / 2 - 6, p2.x)), ny = Math.max(62, p2.y - 10);
          b.setAttribute('transform', `translate(${nx.toFixed(1)} ${ny.toFixed(1)})`);
        }
        followRaf = requestAnimationFrame(follow);
      };
      followRaf = requestAnimationFrame(follow);
      restartAnim(b.querySelector('.bubble-in'), 'jump');
      if (ms) bubbleTimer = setTimeout(() => b.classList.add('hide'), ms);
    }

    function reset() {
      svg.querySelectorAll('.pop, .fade').forEach((el) => {
        const k = el.dataset.k;
        if (!k) return;
        const visibleAtStart = ['sticks', 'flowers', 'birds1', 'birds2', 'birds3', 'mHappy', 'haze', 'murk', 'sun'];
        el.classList.toggle('hide', !visibleAtStart.includes(k));
      });
      for (let n = 0; n < 6; n++) { s.palm(n, 'alive'); s.flames(n, false); q('palm' + n).querySelector('.cocos').classList.add('hide'); }
      q('pondWater').classList.remove('dirty');
      q('fish').classList.remove('hide');
      q('fx').innerHTML = '';
      svg.classList.remove('dry', 'stormy', 'flooded', 'burned', 'eclipse', 'coral-pale', 'coral-bleached');
      q('fxTop').innerHTML = '';
      taskId++; walkPos = [400, 400];
      svg.querySelector('.walker').style.transform = '';
      harmed.sea = false; harmed.fish = false;
      s.murk = 0; s.smoke = 0; mood = ''; destroyed = false; deadCount = 0; badCount = 0;
      setWeather('clear');
    }

    function setStats(h, i) {
      q('haze').setAttribute('opacity', Math.min(0.85, Math.max(0, (65 - i) / 65) * 0.75 + s.smoke).toFixed(2));
      q('murk').setAttribute('opacity', Math.min(0.75, ((100 - i) / 100) * 0.3 + s.murk).toFixed(2));
      q('wadeMurk').setAttribute('opacity', q('murk').getAttribute('opacity'));
      ['birds1', 'birds2', 'birds3'].forEach((k, n) => q(k).classList.toggle('hide', i <= [25, 50, 75][n]));
      q('flowers').classList.toggle('hide', i < 60);
      // critters come and go with the island's health; a whale visits a really healthy island
      q('crabs').classList.toggle('hide', i < 40 || destroyed);
      q('frog').classList.toggle('hide', i < 50 || destroyed);
      q('butterflies').classList.toggle('hide', i < 55 || destroyed);
      q('bees').classList.toggle('hide', i < 65 || destroyed);
      q('whale').classList.toggle('hide', !whaleAllowed || i < 88 || destroyed);
      // fish and turtles live deeper too; they leave when the sea is polluted or overfished
      q('farFish').classList.toggle('hide', i < 35 || harmed.fish);
      q('deepFish').classList.toggle('hide', i < 45 || harmed.fish);
      q('bigFish').classList.toggle('hide', i < 65 || harmed.fish || harmed.sea);
      q('seaTurtle').classList.toggle('hide', i < 55 || harmed.sea);
      svg.classList.toggle('unhealthy', i < 35);
      // coral bleaches as the island gets sicker and more harmful choices pile up
      const stress = (90 - i) + badCount * 8;  // starts colourful at the beginning of a game
      svg.classList.toggle('coral-pale', stress >= 45 && stress < 80);
      svg.classList.toggle('coral-bleached', stress >= 80);
      const m = h >= 60 ? 'mHappy' : h >= 30 ? 'mMeh' : 'mSad';
      if (m !== mood) {
        ['mHappy', 'mMeh', 'mSad'].forEach((k) => q(k).classList.toggle('hide', k !== m));
        mood = m;
      }
    }

    /* Disasters destroy everything on the island (the house, the cave home, trees, everything).
       Storm: wind blows it away. Flood: a wave washes it away. Heat: a wildfire burns it.
       Each thing is hit when the wind / wave / fire reaches it. The monkey always escapes. */
    function destroyAll(type) {
      destroyed = true;
      updateGlows();
      const box = svg.getBoundingClientRect(), ctm = svg.getScreenCTM();
      const things = svg.querySelectorAll('[data-k^="palm"], .pop[data-k], .veg, [data-k="flowers"], [data-k="darkSmoke"], [data-k="smoke"]');
      const fires = [];
      things.forEach((el) => {
        if (el.classList.contains('hide')) return;
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        const x = (r.left + r.width / 2 - box.left) / box.width; // 0 = left edge, 1 = right edge
        const rnd = Math.random();
        let delay;
        if (type === 'storm') {           // wind blows left → right, up into the sky
          delay = 0.9 + x * 1.0 + rnd * 0.3;
          el.style.setProperty('--dx', 1300 + rnd * 300 + 'px');
          el.style.setProperty('--dy', -(180 + rnd * 260) + 'px');
          el.style.setProperty('--rot', 360 + rnd * 540 + 'deg');
          el.classList.add('swept');
        } else if (type === 'flood') {    // the wave rolls right → left and drags things along
          delay = 0.1 + (820 - x * 800) / 780 + rnd * 0.1;
          el.style.setProperty('--dx', -(1400 + rnd * 300) + 'px');
          el.style.setProperty('--dy', 40 + rnd * 80 + 'px');
          el.style.setProperty('--rot', -(120 + rnd * 300) + 'deg');
          el.classList.add('swept');
        } else {                          // wildfire spreads from the hot side (right) to the left
          delay = 0.4 + (1 - x) * 1.6 + rnd * 0.2;
          el.classList.add('scorched');
          if (ctm) {
            const pt = svg.createSVGPoint();
            pt.x = r.left + r.width / 2; pt.y = r.bottom;
            const p = pt.matrixTransform(ctm.inverse());
            fires.push(`<g transform="translate(${p.x.toFixed(0)} ${p.y.toFixed(0)}) scale(${Math.min(2.2, 0.8 + r.height / box.height * 6).toFixed(2)})"><g class="wildfire" style="--delay:${delay.toFixed(2)}s">${flame(0, 0, 1)}${flame(-12, 4, 0.7)}${flame(12, 4, 0.7)}</g></g>`);
          }
        }
        el.style.setProperty('--delay', delay.toFixed(2) + 's');
      });
      if (fires.length) q('fx').insertAdjacentHTML('beforeend', fires.join(''));
      ['birds1', 'birds2', 'birds3', 'parrot', 'butterflies', 'bees', 'crabs', 'frog', 'whale'].forEach(s.hide);
    }

    /* Super rare: a solar eclipse. The moon slides in front of the sun and it gets dark for a moment. */
    function eclipse() {
      const before = time;
      svg.classList.add('eclipse');
      setTime('eclipse');
      setTimeout(() => { svg.classList.remove('eclipse'); setTime(before); }, 7000);
    }

    function disaster(type) {
      const fx = q('fx');
      taskId++;
      const w = svg.querySelector('.walker');
      w.style.transitionDuration = '300ms';
      w.style.transform = '';
      walkPos = [400, 400];
      container.classList.add('shake');
      react('scared', 0);
      monkey.classList.add('walking');
      setTimeout(() => monkey.classList.remove('walking'), 1500);
      if (type === 'flood') {
        svg.classList.add('flooded');
        fx.insertAdjacentHTML('beforeend', `
          <rect class="flood-water" x="-3000" y="500" width="6800" height="3000" fill="#2b8fd0" opacity=".82"/>
          <g class="flood-wave">
            <path d="M820 520 C830 330 900 160 1040 140 C1160 125 1225 210 1185 262 C1165 212 1112 196 1082 226 C1052 256 1082 330 1160 400 L4000 400 L4000 520Z" fill="#2aa0e6"/>
            <path d="M1040 142 C1150 128 1218 198 1187 258" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round"/>
            <circle cx="1000" cy="170" r="9" fill="#fff"/><circle cx="975" cy="200" r="6" fill="#fff"/><circle cx="1210" cy="190" r="7" fill="#fff"/></g>`);
        destroyAll('flood');
      } else if (type === 'heat') {
        svg.classList.add('dry', 'burned');
        setTimeout(() => s.splash(530, 474), 1750);   // the monkey dives into the sea
        q('heatGlow').classList.remove('hide');
        q('fxTop').insertAdjacentHTML('beforeend', `
          <rect class="heat-tint" x="-3000" y="-3000" width="6800" height="6800" fill="#ff7a2e"/>
          <g class="heat-lines"><path d="M120 300 q10 -15 0 -30 q-10 -15 0 -30 M300 290 q10 -15 0 -30 q-10 -15 0 -30 M520 300 q10 -15 0 -30 q-10 -15 0 -30 M700 290 q10 -15 0 -30 q-10 -15 0 -30"/></g>`);
        q('pondWater').classList.add('dirty');
        destroyAll('heat');
      } else {
        svg.classList.add('stormy');
        setWeather('rain');
        s.show('stormClouds');
        q('fxTop').insertAdjacentHTML('beforeend', `
          <rect class="storm-dark" x="-3000" y="-3000" width="6800" height="6800" fill="#1d2533"/>
          <path class="bolt" d="M430 0 L400 110 L436 110 L390 240 L470 90 L432 90 L462 0Z" fill="#fff36b"/>
          <rect class="storm-flash" x="-3000" y="-3000" width="6800" height="6800" fill="#fff"/>
          <g class="wind">${[90, 170, 250, 330, 410].map((y, k) =>
            `<path style="animation-delay:${0.6 + k * 0.17}s" d="M-200 ${y} q60 -18 120 0 t120 0 t120 0"/>`).join('')}</g>`);
        destroyAll('storm');
      }
      return new Promise((resolve) => setTimeout(() => { container.classList.remove('shake'); react('sad', 0); resolve(); }, 4300));
    }

    reset();
    return {
      reset,
      setStats,
      setTime,
      setWeather,
      react,
      say,
      event: (id) => ACTIONS[id].ev(s),
      outcome: (id, good) => {
        ACTIONS[id][good ? 'good' : 'bad'](s);
        if (!good) {
          badCount++;
          s.addDead(1);  // every harmful choice makes the sea a bit sicker
          if (id === 'plastic' || id === 'compost') harmed.sea = true;
          if (id === 'fishing') harmed.fish = true;
        }
      },
      eclipse,
      allowWhale(on) { whaleAllowed = on; },
      payoff: (id) => ACTIONS[id].pay(s),
      disaster,
      jump: s.jump,
      droop: s.droop,
    };
  }

  return { create };
})();
