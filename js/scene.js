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

  const RAIN = Array.from({ length: 46 }, (_, k) => {
    const x = (k * 97) % 820 - 10, y = (k * 53) % 300;
    return `<line x1="${x}" y1="${y}" x2="${x - 6}" y2="${y + 18}" style="animation-delay:${-(k % 7) * 0.09}s"/>`;
  }).join('');

  function buildSVG(u) {
    return `
<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Island" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${u}sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="285"><stop offset="0" class="st-sky-top"/><stop offset="1" class="st-sky-bot"/></linearGradient>
    <linearGradient id="${u}haze" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="285"><stop offset="0" class="st-haze-top"/><stop offset="1" class="st-haze-bot"/></linearGradient>
    <linearGradient id="${u}sea" gradientUnits="userSpaceOnUse" x1="0" y1="285" x2="0" y2="500"><stop offset="0" class="st-sea-top"/><stop offset="1" class="st-sea-bot"/></linearGradient>
    <filter id="${u}tod" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feColorMatrix data-k="todMatrix" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/></filter>
    <radialGradient id="${u}glow"><stop offset="0" stop-color="#fff2a8" stop-opacity=".95"/><stop offset=".35" stop-color="#ffcf5a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb03a" stop-opacity="0"/></radialGradient>
    <radialGradient id="${u}sun"><stop offset="0" stop-color="#fff6b0"/><stop offset="1" stop-color="#ffd23f"/></radialGradient>
  </defs>

  <rect x="-3000" y="-3000" width="6800" height="3285" fill="url(#${u}sky)"/>
  <rect data-k="haze" class="fade" x="-3000" y="-3000" width="6800" height="6800" fill="url(#${u}haze)" opacity="0"/>
  <g data-k="sun" class="sun"><circle data-k="heatGlow" class="fade hide" cx="680" cy="80" r="95" fill="#ffb03a" opacity=".45"/>
    <circle cx="680" cy="80" r="62" fill="#ffe680" opacity=".35"/><circle cx="680" cy="80" r="42" fill="url(#${u}sun)"/></g>
  <g class="nightsky">
    ${[[60,40],[140,90],[230,30],[320,70],[410,25],[500,60],[580,30],[760,50],[30,150],[260,140],[470,120],[720,170],[620,110],[180,190]].map(([x, y], k) =>
      `<circle class="star" cx="${x}" cy="${y}" r="${k % 3 ? 1.8 : 2.6}" style="animation-delay:${-k * 0.37}s"/>`).join('')}
    <g transform="translate(110 80)"><circle r="30" fill="#fff7d6" opacity=".25"/><circle r="22" fill="#fff4c2"/><circle cx="9" cy="-6" r="19" class="moon-cut"/></g>
  </g>

  <g class="drift" style="animation-delay:-12s"><g transform="translate(60 70)"><g class="cloud"><circle cx="0" cy="0" r="22"/><circle cx="24" cy="-8" r="26"/><circle cx="50" cy="2" r="20"/><rect x="0" y="0" width="50" height="20"/></g></g></g>
  <g data-k="rainClouds" class="fade hide">${[[-20, 40, 1.4], [170, 20, 1.6], [400, 35, 1.5], [620, 15, 1.7]].map(([x, y, sc]) =>
    `<g transform="translate(${x} ${y}) scale(${sc})"><g class="cloud rain-cloud"><circle cx="0" cy="0" r="22"/><circle cx="24" cy="-8" r="26"/><circle cx="50" cy="2" r="20"/><circle cx="76" cy="-2" r="18"/><rect x="0" y="0" width="76" height="20"/></g></g>`).join('')}</g>
  <g class="drift" style="animation-delay:-38s;animation-duration:80s"><g transform="translate(0 140) scale(.7)"><g class="cloud"><circle cx="0" cy="0" r="22"/><circle cx="24" cy="-8" r="26"/><circle cx="50" cy="2" r="20"/><rect x="0" y="0" width="50" height="20"/></g></g></g>

  ${item('darkSmoke', 0, 0, `<g class="billow">
      <circle cx="690" cy="330" r="14"/><circle cx="682" cy="290" r="20"/><circle cx="672" cy="245" r="26"/>
      <circle cx="660" cy="195" r="32"/><circle cx="640" cy="140" r="40"/><circle cx="600" cy="110" r="44"/><circle cx="690" cy="120" r="38"/><circle cx="545" cy="105" r="34"/></g>`, 'fade')}

  <g data-k="birds1" class="fade"><g class="glide"><g transform="translate(150 120)"><path class="bird" d="M0 0 q8 -8 16 0 q8 -8 16 0"/></g></g></g>
  <g data-k="birds2" class="fade"><g class="glide" style="animation-delay:-6s"><g transform="translate(250 90) scale(.8)"><path class="bird" d="M0 0 q8 -8 16 0 q8 -8 16 0"/></g></g></g>
  <g data-k="birds3" class="fade"><g class="glide" style="animation-delay:-11s"><g transform="translate(420 140) scale(.7)"><path class="bird" d="M0 0 q8 -8 16 0 q8 -8 16 0"/></g></g></g>

  <rect x="-3000" y="285" width="6800" height="3000" fill="url(#${u}sea)"/>
  <rect data-k="murk" class="fade" x="-3000" y="285" width="6800" height="3000" fill="#6f7d3c" opacity="0"/>
  <g class="waves"><path d="M20 310 q15 -8 30 0 q15 8 30 0 M640 300 q15 -8 30 0 q15 8 30 0 M300 296 q15 -6 30 0 q15 6 30 0"/></g>

  <g data-k="land">
  <ellipse cx="400" cy="372" rx="366" ry="100" fill="none" stroke="#e6f9ff" stroke-width="5" opacity=".7" class="foam"/>
  <ellipse cx="400" cy="368" rx="352" ry="94" fill="#ecc673"/>
  <ellipse cx="400" cy="362" rx="338" ry="84" fill="#fbe3a2"/>
  <path class="grass" d="M190 318 Q260 228 400 226 Q540 228 610 318Z"/>
  <ellipse class="grass" cx="400" cy="318" rx="245" ry="52"/>
  <ellipse class="grass light" cx="400" cy="312" rx="228" ry="42"/>

  <g data-k="flowers" class="fade">${flower(232, 334, '#ff6fa8')}${flower(318, 346, '#ffffff')}${flower(452, 350, '#b388ff')}${flower(640, 322, '#ff6fa8')}${flower(172, 320, '#ffd23f')}${flower(500, 352, '#ff8c42')}</g>

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

  ${palm(0, 205, 298, 0.9)}${palm(1, 268, 292, 1)}${palm(2, 332, 300, 0.85)}${palm(3, 470, 300, 0.85)}${palm(4, 532, 292, 1)}${palm(5, 598, 298, 0.9)}

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
  ${item('garden', 128, 400, `${flower(36, 2, '#ff6fa8')}${flower(48, 8, '#ffd23f')}${flower(-38, 4, '#b388ff')}
      <g transform="translate(60 4)"><path d="M0 0 l-4 -12 M0 0 l0 -14 M0 0 l4 -12" stroke="#3d9a2e" stroke-width="2.5"/><path d="M-4 0 h8 l-4 8z" fill="#ff8c42"/></g>
      <g transform="translate(-52 6)"><path d="M0 0 l-4 -12 M0 0 l0 -14 M0 0 l4 -12" stroke="#3d9a2e" stroke-width="2.5"/><path d="M-4 0 h8 l-4 8z" fill="#ff8c42"/></g>`)}
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

  <g data-k="fish"><g class="swim"><g transform="translate(0 482)">${fish()}</g></g><g class="swim" style="animation-delay:-6s;animation-duration:19s"><g transform="translate(0 470) scale(.8)">${fish('#ffd23f')}</g></g><g class="swim" style="animation-delay:-11s;animation-duration:14s"><g transform="translate(0 492) scale(.9)">${fish('#ff6fa8')}</g></g></g>
  ${item('babyFish', 0, 0, `<g class="swim" style="animation-delay:-3s;animation-duration:12s"><g transform="translate(0 488) scale(.5)">${fish()}</g></g><g class="swim" style="animation-delay:-8s;animation-duration:13s"><g transform="translate(0 476) scale(.5)">${fish('#ffd23f')}</g></g><g class="swim" style="animation-delay:-1s;animation-duration:15s"><g transform="translate(0 494) scale(.45)">${fish('#ff6fa8')}</g></g>`, 'fade')}
  ${item('jumper', 150, 474, `<g class="fishjump">${fish('#ffb627')}</g>`, 'fade')}
  ${item('seaBottles', 0, 0, `<g class="float">${bottle(52, 452, 80, 1.5)}</g><g class="float" style="animation-delay:-1s">${bottle(735, 462, -60, 1.5)}</g><g class="float" style="animation-delay:-2s">${bottle(300, 486, 100, 1.4)}</g>`, 'fade')}
  ${item('deadFish', 0, 0, `${deadFish(100, 470, 170, 1.8)}${deadFish(215, 484, 192, 1.6)}${deadFish(575, 486, 176, 1.5)}`, 'fade')}

  <g data-k="fx"></g>

  <g transform="translate(400 400)"><g data-k="monkey"><g class="mjump"><g class="bob">
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
    <ellipse class="wade" cx="0" cy="22" rx="38" ry="10" fill="#2bb3e0" stroke="#e6f9ff" stroke-width="3"/>
  </g></g>
  </g>

  <!-- lights that glow at night (drawn on top so they stay bright) -->
  <g class="glows">
    <circle data-glow="caveLamp" cx="176" cy="313" r="34" fill="url(#${u}glow)"/>
    <circle data-glow="campfire" cx="646" cy="384" r="46" fill="url(#${u}glow)"/>
    <circle data-glow="bonfire" cx="690" cy="350" r="90" fill="url(#${u}glow)"/>
    <circle data-glow="house" cx="352" cy="248" r="26" fill="url(#${u}glow)"/>
    <circle data-glow="house" cx="448" cy="248" r="26" fill="url(#${u}glow)"/>
  </g>

  <g data-k="rain" class="rain hide">${RAIN}</g>

  <g data-k="bubble" class="bubble hide" transform="translate(400 300)"><g class="bubble-in">
    <rect data-k="bubbleBox" x="-60" y="-54" width="120" height="48" rx="18" fill="#fff" stroke="#23313f" stroke-width="3"/>
    <path d="M-11 -7.5 L0 10 L11 -7.5" fill="#fff" stroke="#23313f" stroke-width="3" stroke-linejoin="round"/>
    <text data-k="bubbleText" x="0" y="-21" text-anchor="middle" font-size="25" font-weight="800" fill="#23313f"></text>
  </g></g>
</svg>`;
  }

  /* What each choice shows on the island.
     ev = the problem appears, good/bad = result, pay = reward 2 turns later. */
  const ACTIONS = {
    shelter: {
      ev() {},
      good(s) { s.hide('sticks'); s.show('caveBed'); s.show('caveLamp'); s.sparkle(158, 300); },
      bad(s) { s.hide('sticks'); [0, 1, 2].forEach((n) => s.palm(n, 'stump')); s.show('house'); },
      pay(s) { s.showCocos(); s.sparkle(532, 180); },
    },
    plastic: {
      ev(s) { s.show('bottles'); },
      good(s) { s.hide('bottles'); s.show('bin'); },
      bad(s) { s.hide('bottles'); s.show('seaBottles'); s.show('deadFish'); s.murk += 0.22; },
      pay(s) { s.show('pots'); s.sparkle(225, 400); },
    },
    food: {
      ev(s) { s.show('fruitpile'); },
      good(s) { s.hide('fruitpile'); s.show('basket'); },
      bad(s) { s.hide('fruitpile'); s.show('cores'); },
      pay(s) { s.rain(3200); s.sparkle(505, 405); },
    },
    banana: {
      ev(s) { s.show('bpSmall'); },
      good(s) { s.hide('bpSmall'); s.show('bpSapling'); },
      bad(s) { s.hide('bpSmall'); s.show('bpDead'); s.show('peel'); },
      pay(s) { s.hide('bpSapling'); s.show('bpTree'); s.sparkle(285, 300); },
    },
    fishing: {
      ev() {},
      good(s) { s.show('rod'); },
      bad(s) { s.show('net'); s.hide('fish'); s.murk += 0.08; },
      pay(s) { s.show('babyFish'); s.show('jumper'); s.sparkle(150, 450); },
    },
    compost: {
      ev(s) { s.show('scraps'); },
      good(s) { s.hide('scraps'); s.show('compost'); },
      bad(s) { s.hide('scraps'); s.show('trash'); },
      pay(s) { s.show('garden'); s.sparkle(128, 380); },
    },
    fire: {
      ev(s) { s.flames(3, true); s.flames(4, true); },
      good(s) { s.flames(3, false); s.flames(4, false); s.flash('smoke', 2200); s.show('bucket'); },
      bad(s) { s.flames(3, false); s.flames(4, false); s.palm(3, 'burnt'); s.palm(4, 'burnt'); s.show('ash'); },
      pay(s) { s.rain(3200); s.show('parrot'); },
    },
    firewood: { // the cold night
      ev() {},
      good(s) { s.show('campfire'); s.sparkle(646, 370); },
      bad(s) { s.show('bonfire'); s.show('darkSmoke'); s.palm(4, 'stump'); s.palm(5, 'stump'); s.smoke += 0.15; },
      pay(s) { s.show('woodpile'); s.show('campfire'); s.sparkle(690, 350); },
    },
    water: {
      ev(s) { s.show('heatGlow'); },
      good(s) { s.hide('heatGlow'); s.show('barrel'); },
      bad(s) { s.hide('heatGlow'); s.q('pondWater').classList.add('dirty'); s.show('bubbles'); },
      pay(s) { s.rain(3200); s.sparkle(624, 320); },
    },
    turtles: {
      ev(s) { s.show('turtles'); },
      good(s) { s.hide('turtles'); s.show('nest'); s.show('turtlesSwim'); },
      bad(s) { s.hide('turtles'); s.show('turtlesLeave'); },
      pay(s) { s.show('babies'); s.sparkle(630, 400); },
    },
  };

  /* Day/night: the island is tinted with a colour matrix (works on every browser). */
  const TIME_MATRIX = {
    day:     [1, 0, 0, 0, 0,     0, 1, 0, 0, 0,        0, 0, 1, 0, 0,       0, 0, 0, 1, 0],
    morning: [1.03, 0, 0, 0, 0.03, 0, 0.98, 0, 0, 0.01, 0, 0, 0.9, 0, 0,     0, 0, 0, 1, 0],
    evening: [1, 0, 0, 0, 0.05,  0, 0.8, 0, 0, 0,       0, 0, 0.75, 0, 0.04, 0, 0, 0, 1, 0],
    night:   [0.4, 0, 0, 0, 0,   0, 0.46, 0, 0, 0.02,   0, 0, 0.7, 0, 0.09,  0, 0, 0, 1, 0],
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
    let destroyed = false;

    const visible = (el) => el && !el.classList.contains('hide') && !el.classList.contains('swept');
    function updateGlows() {
      const dark = time === 'night' || time === 'evening';
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
      svg.classList.remove('dry', 'stormy', 'flooded', 'burned');
      s.murk = 0; s.smoke = 0; mood = ''; destroyed = false;
      setWeather('clear');
    }

    function setStats(h, i) {
      q('haze').setAttribute('opacity', Math.min(0.85, Math.max(0, (65 - i) / 65) * 0.75 + s.smoke).toFixed(2));
      q('murk').setAttribute('opacity', Math.min(0.75, ((100 - i) / 100) * 0.3 + s.murk).toFixed(2));
      ['birds1', 'birds2', 'birds3'].forEach((k, n) => q(k).classList.toggle('hide', i <= [25, 50, 75][n]));
      q('flowers').classList.toggle('hide', i < 60);
      svg.classList.toggle('unhealthy', i < 35);
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
      const things = svg.querySelectorAll('[data-k^="palm"], .pop[data-k], [data-k="flowers"], [data-k="darkSmoke"], [data-k="smoke"]');
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
      ['birds1', 'birds2', 'birds3', 'parrot'].forEach(s.hide);
    }

    function disaster(type) {
      const fx = q('fx');
      container.classList.add('shake');
      react('scared', 0);
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
        q('heatGlow').classList.remove('hide');
        fx.insertAdjacentHTML('beforeend', `
          <rect class="heat-tint" x="-3000" y="-3000" width="6800" height="6800" fill="#ff7a2e"/>
          <g class="heat-lines"><path d="M120 300 q10 -15 0 -30 q-10 -15 0 -30 M300 290 q10 -15 0 -30 q-10 -15 0 -30 M520 300 q10 -15 0 -30 q-10 -15 0 -30 M700 290 q10 -15 0 -30 q-10 -15 0 -30"/></g>`);
        q('pondWater').classList.add('dirty');
        destroyAll('heat');
      } else {
        svg.classList.add('stormy');
        setWeather('rain');
        fx.insertAdjacentHTML('beforeend', `
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
      outcome: (id, good) => ACTIONS[id][good ? 'good' : 'bad'](s),
      payoff: (id) => ACTIONS[id].pay(s),
      disaster,
      jump: s.jump,
      droop: s.droop,
    };
  }

  return { create };
})();
