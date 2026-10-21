/* Our own little icons (instead of emoji), drawn in the same cartoon style as the city.
   Icon('bike') returns an inline SVG that is 1em big, so it sizes like text. */

const Icon = (() => {
  const O = '#23313f';   // outline colour
  const st = `stroke="${O}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const face = (x, y, r, fur = '#8b5a2b') => `<circle cx="${x - r * 0.95}" cy="${y}" r="${r * 0.38}" fill="${fur}" ${st}/><circle cx="${x + r * 0.95}" cy="${y}" r="${r * 0.38}" fill="${fur}" ${st}/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${fur}" ${st}/><ellipse cx="${x}" cy="${y + r * 0.22}" rx="${r * 0.68}" ry="${r * 0.55}" fill="#e8c39e"/>
    <circle cx="${x - r * 0.3}" cy="${y - r * 0.15}" r="${r * 0.32}" fill="#e8c39e"/><circle cx="${x + r * 0.3}" cy="${y - r * 0.15}" r="${r * 0.32}" fill="#e8c39e"/>
    <circle cx="${x - r * 0.28}" cy="${y - r * 0.12}" r="${r * 0.13}" fill="${O}"/><circle cx="${x + r * 0.28}" cy="${y - r * 0.12}" r="${r * 0.13}" fill="${O}"/>
    <path d="M${x - r * 0.3} ${y + r * 0.38} Q${x} ${y + r * 0.68} ${x + r * 0.3} ${y + r * 0.38}" stroke="#5a2d0c" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;

  const ICONS = {
    // ── people + game ──
    monkey: face(16, 17, 10),
    thermo: `<rect x="12.5" y="3" width="7" height="20" rx="3.5" fill="#fff" ${st}/><rect x="14.6" y="10" width="2.8" height="12" fill="#ff5b4a"/><circle cx="16" cy="24" r="5.2" fill="#ff5b4a" ${st}/><path d="M20 8 h3 M20 12 h2 M20 16 h3" ${st}/>`,
    home: `<path d="M5 15 L16 5 L27 15" fill="#ff8c42" ${st}/><rect x="8" y="14" width="16" height="13" fill="#7fd3f7" ${st}/><rect x="14" y="19" width="4.5" height="8" fill="#8b5a2b" ${st}/>`,
    music: `<path d="M12 23 V8 L25 5 V20" fill="none" ${st}/><circle cx="9" cy="23" r="3.6" fill="#ff6fa8" ${st}/><circle cx="22" cy="20" r="3.6" fill="#ff6fa8" ${st}/>`,
    sound: `<path d="M4 12 H9 L15 7 V25 L9 20 H4Z" fill="#2f80ed" ${st}/><path d="M19 11.5 Q22 16 19 20.5 M22.5 8 Q28 16 22.5 24" fill="none" ${st}/>`,
    mute: `<path d="M4 12 H9 L15 7 V25 L9 20 H4Z" fill="#9aa5b1" ${st}/><path d="M20 12 L27 20 M27 12 L20 20" ${st} stroke="#ff5b4a" stroke-width="2.6"/>`,
    play: `<path d="M10 6 L26 16 L10 26Z" fill="${O}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>`,
    gamepad: `<path d="M7 11 H25 Q30 11 30 18 Q30 25 25 24 L21 20 H11 L7 24 Q2 25 2 18 Q2 11 7 11Z" fill="#7d5fff" ${st}/><path d="M9 15 V20 M6.5 17.5 H11.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="22" cy="15.5" r="1.7" fill="#ffd23f"/><circle cx="25.5" cy="18.5" r="1.7" fill="#ff5b4a"/>`,
    scroll: `<rect x="7" y="5" width="18" height="22" rx="2" fill="#fff3d6" ${st}/><path d="M11 11 H21 M11 15 H21 M11 19 H18" ${st}/><path d="M5 5 H27" ${st} stroke-width="3"/><path d="M5 27 H27" ${st} stroke-width="3"/>`,
    trophy: `<path d="M9 5 H23 V12 Q23 20 16 20 Q9 20 9 12Z" fill="#ffd23f" ${st}/><path d="M9 8 H5 Q5 15 10 15 M23 8 H27 Q27 15 22 15" fill="none" ${st}/><path d="M16 20 V24 M10 27 H22 L20 24 H12Z" fill="#c98f4f" ${st}/>`,
    lock: `<path d="M10 14 V10 Q10 5 16 5 Q22 5 22 10 V14" fill="none" ${st} stroke-width="2.6"/><rect x="7" y="14" width="18" height="13" rx="2.5" fill="#ffb627" ${st}/><circle cx="16" cy="20" r="2" fill="${O}"/>`,
    phone: `<rect x="9" y="3" width="14" height="26" rx="3" fill="${O}"/><rect x="11" y="6.5" width="10" height="17" rx="1" fill="#7fd3f7"/><circle cx="16" cy="26.3" r="1.2" fill="#fff"/>`,
    book: `<path d="M16 9 Q10 5 4 7 V25 Q10 23 16 27 Q22 23 28 25 V7 Q22 5 16 9Z" fill="#fff" ${st}/><path d="M16 9 V27" ${st}/><path d="M7 12 Q10 11 13 12.5 M7 16 Q10 15 13 16.5 M19 12.5 Q22 11 25 12 M19 16.5 Q22 15 25 16" ${st} stroke-width="1.4"/>`,
    skip: `<path d="M6 8 L15 16 L6 24Z M15 8 L24 16 L15 24Z" fill="${O}" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/><path d="M26.5 8 V24" ${st} stroke-width="3"/>`,
    next: `<path d="M5 16 H25 M18 9 L25 16 L18 23" fill="none" ${st} stroke-width="3.2"/>`,
    back: `<path d="M27 16 H7 M14 9 L7 16 L14 23" fill="none" ${st} stroke-width="3.2"/>`,
    replay: `<path d="M25 16 A9 9 0 1 1 22 9" fill="none" ${st} stroke-width="3"/><path d="M22 3 V9.5 H15.5" fill="none" ${st} stroke-width="3"/>`,
    check: `<circle cx="16" cy="16" r="12" fill="#2fb35a" ${st}/><path d="M10 16.5 L14.5 21 L22.5 11.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    think: `<circle cx="16" cy="16" r="12" fill="#ffb627" ${st}/><path d="M12.5 12.5 Q12.5 8.5 16.5 8.5 Q20.5 8.5 20.5 12 Q20.5 14.5 17.5 15.5 Q16 16 16 18.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="23" r="1.8" fill="#fff"/>`,
    bulb: `<path d="M16 4 Q24 4 24 12 Q24 16 20.5 19 V22 H11.5 V19 Q8 16 8 12 Q8 4 16 4Z" fill="#ffe066" ${st}/><rect x="11.5" y="22" width="9" height="5" rx="1.5" fill="#9aa5b1" ${st}/><path d="M13 13 Q16 16 19 13" fill="none" ${st} stroke-width="1.5"/>`,
    globe: `<circle cx="16" cy="16" r="12" fill="#4fc3f7" ${st}/><path d="M8 11 Q12 8 14 11 Q15 14 12 16 Q9 18 8 15Z M18 7 Q23 8 25 13 Q22 14 20 12 Q17 11 18 7Z M17 19 Q22 18 24 21 Q21 26 17 25 Q15 22 17 19Z" fill="#7fe06a"/>`,
    trash: `<path d="M8 10 H24 L22 27 H10Z" fill="#9aa5b1" ${st}/><path d="M6 10 H26 M13 10 V6 H19 V10 M13 14 V23 M19 14 V23" fill="none" ${st}/>`,
    shield: `<path d="M16 3 L26 7 V15 Q26 24 16 29 Q6 24 6 15 V7Z" fill="#2f80ed" ${st}/><path d="M11 16 L15 20 L21.5 12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    sparkle: `<path d="M16 3 L18.5 13.5 L29 16 L18.5 18.5 L16 29 L13.5 18.5 L3 16 L13.5 13.5Z" fill="#ffd23f" ${st}/><path d="M25 4 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 l3 -1Z" fill="#fff36b"/>`,
    hot: `<circle cx="16" cy="17" r="12" fill="#ff7a4d" ${st}/><path d="M10 14 q2 -2 4 0 M18 14 q2 -2 4 0" fill="none" ${st}/><path d="M11 21 Q16 17 21 21" fill="#5a2d0c" ${st}/><path d="M25 6 q-3 4 0 6 q3 -2 0 -6Z" fill="#6fc3f5"/>`,
    sun: `<g stroke="#ffb627" stroke-width="2.4" stroke-linecap="round"><path d="M16 2 V6 M16 26 V30 M2 16 H6 M26 16 H30 M6 6 L8.8 8.8 M23.2 23.2 L26 26 M6 26 L8.8 23.2 M23.2 8.8 L26 6"/></g><circle cx="16" cy="16" r="7.5" fill="#ffd23f" ${st}/>`,
    moon: `<circle cx="16" cy="16" r="13" fill="#fff6c8"/><circle cx="16" cy="16" r="10.5" fill="#151a2b"/>`,
    city: `<rect x="4" y="13" width="8" height="15" fill="#8fb3d9" ${st}/><rect x="12" y="5" width="9" height="23" fill="#f2c94c" ${st}/><rect x="21" y="10" width="7" height="18" fill="#ff9f80" ${st}/><path d="M15 9 h3 M15 13 h3 M15 17 h3 M7 17 h2 M7 21 h2 M23.5 14 h2 M23.5 18 h2" stroke="#fff" stroke-width="1.6"/>`,
    no: `<circle cx="16" cy="16" r="12" fill="#fff" ${st}/><circle cx="16" cy="16" r="8.5" fill="none" stroke="#ff5b4a" stroke-width="3"/><path d="M10 10 L22 22" stroke="#ff5b4a" stroke-width="3"/>`,
    web: `<circle cx="16" cy="16" r="12" fill="#e3f6ff" ${st}/><path d="M4 16 H28 M16 4 Q22 16 16 28 Q10 16 16 4 M6 10 H26 M6 22 H26" fill="none" ${st} stroke-width="1.4"/>`,
    secret: `${face(16, 17, 10)}<rect x="10.5" y="20" width="11" height="3.5" rx="1.5" fill="#fff" ${st} stroke-width="1.2"/><path d="M12.5 20 v3.5 M14.5 20 v3.5 M16.5 20 v3.5 M18.5 20 v3.5" stroke="${O}" stroke-width=".9"/>`,
    mask: `${face(16, 17, 10)}<path d="M7 13 Q16 9 25 13 L24 17 Q20 15.5 16 17 Q12 15.5 8 17Z" fill="#7d5fff" ${st} stroke-width="1.4"/><circle cx="12.6" cy="15" r="1.4" fill="#fff"/><circle cx="19.4" cy="15" r="1.4" fill="#fff"/>`,
    adult: `<circle cx="16" cy="9" r="5" fill="#e8c39e" ${st}/><path d="M11 6.5 Q16 2 21 6.5" fill="none" stroke="#8b5a2b" stroke-width="3" stroke-linecap="round"/><path d="M6 28 Q6 16 16 16 Q26 16 26 28Z" fill="#2fb35a" ${st}/>`,
    chat: `<path d="M5 6 H27 V21 H15 L9 27 V21 H5Z" fill="#fff" ${st}/><path d="M10 12 H22 M10 16 H18" ${st}/>`,
    // ── the choices ──
    bike: `<circle cx="8" cy="21" r="6" fill="none" ${st}/><circle cx="24" cy="21" r="6" fill="none" ${st}/><path d="M8 21 L13 12 L20 21 Z M13 12 H21 L24 21 M21 12 L20 9 H23 M11 9 H15" fill="none" stroke="#ff5b4a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    car: `<path d="M3 21 V16 Q3 14 5 14 H8 L11 9 H21 L24 14 H27 Q29 14 29 16 V21Z" fill="#e63946" ${st}/><path d="M12 10.5 H15.5 V14 H10.5Z M17.5 10.5 H20.5 L22.5 14 H17.5Z" fill="#cfefff"/><circle cx="9" cy="22" r="3.4" fill="${O}"/><circle cx="23" cy="22" r="3.4" fill="${O}"/>`,
    switch: `<rect x="8" y="4" width="16" height="24" rx="3" fill="#fff" ${st}/><rect x="12.5" y="9" width="7" height="14" rx="2" fill="#e3e8ec" ${st}/><rect x="13.5" y="16" width="5" height="6" rx="1" fill="#2fb35a"/>`,
    tv: `<rect x="4" y="9" width="24" height="16" rx="2.5" fill="#23313f"/><rect x="6.5" y="11.5" width="19" height="11" rx="1" fill="#7fd3f7"/><path d="M12 4 L16 9 L20 4" fill="none" ${st}/><path d="M10 28 H22" ${st}/>`,
    refill: `<rect x="11" y="9" width="10" height="19" rx="4" fill="#2fb35a" ${st}/><rect x="12.5" y="4" width="7" height="5" rx="1.5" fill="#1d8f43" ${st}/><circle cx="16" cy="18" r="2.6" fill="#ffd23f"/><path d="M24 7 q-3 4 0 6 q3 -2 0 -6Z" fill="#4fc3f7"/>`,
    plastic: `<path d="M12 11 Q12 8 14 7 V4 H18 V7 Q20 8 20 11 V27 H12Z" fill="#c8ecfa" ${st}/><rect x="12" y="15" width="8" height="5" fill="#ff6fa8"/><rect x="13.5" y="2.5" width="5" height="3" rx="1" fill="#2f80ed"/>`,
    wrench: `<path d="M20 4 A6 6 0 0 0 15 12 L5 22 Q4 26 8 26 L18 16 A6 6 0 0 0 27 11 L23 13 L19 9 L21 5Z" fill="#9aa5b1" ${st}/>`,
    box: `<path d="M5 11 L16 6 L27 11 V24 L16 29 L5 24Z" fill="#d9a36a" ${st}/><path d="M5 11 L16 16 L27 11 M16 16 V29" fill="none" ${st}/><path d="M10 8.5 L21 13.5" stroke="#c98f4f" stroke-width="2"/>`,
    fan: `<path d="M16 16 V27 M10 28 H22" ${st}/><circle cx="16" cy="12" r="9" fill="#e3f6ff" ${st}/><path d="M16 12 Q12 4 16 4.5 Q20 5 16 12 Q24 10 23 14 Q21 17 16 12 Q12 19 9.5 16 Q8.5 12.5 16 12Z" fill="#7fd3f7" stroke="${O}" stroke-width="1"/>`,
    ac: `<rect x="3" y="7" width="26" height="12" rx="2.5" fill="#fff" ${st}/><path d="M6 15 H26" ${st} stroke-width="1.4"/><path d="M9 22 q2 3 0 6 M16 22 q2 3 0 6 M23 22 q2 3 0 6" fill="none" stroke="#4fc3f7" stroke-width="2.2" stroke-linecap="round"/>`,
    sweater: `<path d="M11 5 Q16 8 21 5 L28 9 L26 15 L23 14 V27 H9 V14 L6 15 L4 9Z" fill="#4f8fd6" ${st}/><path d="M9 18 H23 M9 22 H23" stroke="#fff" stroke-width="2"/>`,
    flame: `<path d="M16 3 Q24 11 23 19 Q22 27 16 28 Q9 27 9 20 Q9 14 13 11 Q13 16 16 16 Q14 9 16 3Z" fill="#ff6b1a" ${st}/><path d="M16 26 Q12 25 12.5 21 Q13 18 16 16.5 Q19 19 19 22 Q19 25 16 26Z" fill="#ffd23f"/>`,
    shower: `<path d="M8 28 V8 Q8 4 13 4 Q18 4 18 9" fill="none" ${st}/><path d="M13 10 H24 L22 13 H15Z" fill="#9aa5b1" ${st}/><path d="M15.5 16 v3 M19 16 v4 M22.5 16 v3 M17 22 v3 M21 22 v3" stroke="#4fc3f7" stroke-width="2" stroke-linecap="round"/>`,
    bath: `<path d="M3 15 H29 L27 23 Q26 26 22 26 H10 Q6 26 5 23Z" fill="#fff" ${st}/><path d="M7 26 L6 29 M25 26 L26 29" ${st}/><circle cx="11" cy="12" r="3" fill="#e3f6ff" ${st} stroke-width="1.2"/><circle cx="17" cy="10" r="4" fill="#e3f6ff" ${st} stroke-width="1.2"/><circle cx="23" cy="12.5" r="2.6" fill="#e3f6ff" ${st} stroke-width="1.2"/>`,
    recycle: `<circle cx="16" cy="16" r="13" fill="#2fb35a" ${st}/><g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M10 18 A6.5 6.5 0 0 1 12 10.5"/><path d="M16 9.5 A6.5 6.5 0 0 1 22.5 15"/><path d="M21 21 A6.5 6.5 0 0 1 13.5 22"/></g><path d="M11 9 L14 10 L12 13Z M23.5 13 L23 16.5 L20.5 14.5Z M14 23.5 L11.5 21.5 L14.5 20Z" fill="#fff"/>`,
    trashbag: `<path d="M8 27 Q4 18 11 12 L13 9 H19 L21 12 Q28 18 24 27Z" fill="#3a3f47" ${st}/><path d="M13 9 L10 5 M19 9 L22 5" ${st}/><path d="M12 17 Q14 15 15 18" stroke="#6b737d" stroke-width="1.6" fill="none"/>`,
    thrift: `<path d="M16 5 Q19 5 19 8 Q19 10 16 11 V13 L27 22 H5 L16 13" fill="none" ${st}/><path d="M9 22 H23 V27 H9Z" fill="#2fb35a" ${st}/><path d="M24 4 l1.5 3 l3 .5 l-2.3 2 l.6 3 l-2.8 -1.5 l-2.8 1.5 l.6 -3 l-2.3 -2 l3 -.5Z" fill="#ffd23f" stroke="${O}" stroke-width="1"/>`,
    mall: `<rect x="4" y="10" width="24" height="18" fill="#8fb3d9" ${st}/><rect x="8" y="5" width="16" height="6" rx="1.5" fill="#ff5b4a" ${st}/><rect x="12" y="18" width="8" height="10" fill="#cfefff" ${st}/><path d="M7 14 h4 M21 14 h4" stroke="#fff" stroke-width="2"/>`,
    train: `<rect x="6" y="5" width="20" height="19" rx="5" fill="#e63946" ${st}/><rect x="9" y="8.5" width="14" height="7" rx="1.5" fill="#cfefff" ${st} stroke-width="1.4"/><circle cx="11" cy="19.5" r="1.8" fill="#fff3a8"/><circle cx="21" cy="19.5" r="1.8" fill="#fff3a8"/><path d="M10 24 L7 28 M22 24 L25 28 M8.5 26.5 H23.5" ${st}/>`,
    veggie: `<path d="M14 18 L13 28 H19 L18 18" fill="#7fbf4f" ${st}/><circle cx="11" cy="13" r="5" fill="#4fae3a" ${st}/><circle cx="21" cy="13" r="5" fill="#4fae3a" ${st}/><circle cx="16" cy="9" r="5.5" fill="#5cc148" ${st}/><circle cx="16" cy="16" r="4.5" fill="#4fae3a" ${st}/>`,
    burger: `<path d="M5 14 Q5 6 16 6 Q27 6 27 14Z" fill="#e0a64a" ${st}/><rect x="4" y="15" width="24" height="3.5" rx="1.5" fill="#7fe06a" ${st} stroke-width="1.4"/><rect x="5" y="18.5" width="22" height="4" rx="2" fill="#7a3b1e" ${st} stroke-width="1.4"/><path d="M5 23 H27 Q27 27 23 27 H9 Q5 27 5 23Z" fill="#e0a64a" ${st}/><circle cx="12" cy="10" r=".9" fill="#fff"/><circle cx="18" cy="9" r=".9" fill="#fff"/>`,
    // ── achievements + endings ──
    paws: `<ellipse cx="11" cy="20" rx="4" ry="5" fill="#8b5a2b" ${st}/><ellipse cx="22" cy="12" rx="4" ry="5" fill="#8b5a2b" ${st}/><circle cx="7.5" cy="13.5" r="1.6" fill="#8b5a2b"/><circle cx="11" cy="12" r="1.6" fill="#8b5a2b"/><circle cx="14.5" cy="13.5" r="1.6" fill="#8b5a2b"/><circle cx="18.5" cy="5.5" r="1.6" fill="#8b5a2b"/><circle cx="22" cy="4" r="1.6" fill="#8b5a2b"/><circle cx="25.5" cy="5.5" r="1.6" fill="#8b5a2b"/>`,
    medal: `<path d="M10 3 L14 13 M22 3 L18 13" stroke="#2f80ed" stroke-width="4"/><circle cx="16" cy="20" r="9" fill="#ffd23f" ${st}/><path d="M16 14 L17.8 18 L22 18.4 L18.8 21.2 L19.8 25.4 L16 23.2 L12.2 25.4 L13.2 21.2 L10 18.4 L14.2 18Z" fill="#fff36b" stroke="#c98f00" stroke-width="1"/>`,
    hundred: `<circle cx="16" cy="16" r="13" fill="#ff6fa8" ${st}/><text x="16" y="20.5" text-anchor="middle" font-size="11.5" font-weight="900" font-family="Arial, sans-serif" fill="#fff">11</text><path d="M8 24 H24" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
    balloon: `<ellipse cx="16" cy="12" rx="8" ry="9.5" fill="#ff5b4a" ${st}/><path d="M14.5 21.5 L17.5 21.5 L16 23.5Z" fill="#ff5b4a" ${st} stroke-width="1.2"/><path d="M16 23.5 Q13 26 16 29" fill="none" stroke="${O}" stroke-width="1.4"/><ellipse cx="13" cy="9" rx="2" ry="3" fill="#fff" opacity=".5"/>`,
  };

  return (name, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
})();
