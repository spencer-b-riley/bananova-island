/* Sound effects + a looping island tune, all made with the Web Audio API.
   No audio files are downloaded. Browsers only allow sound after the
   player taps/clicks once, so unlock() is called on the first interaction. */

const Sound = (() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf;
  let sfxOn = true, musicOn = true, timer = null, nextTime = 0, step = 0;

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return true;
  }

  function note(freq, t, dur, { type = 'triangle', vol = 0.3, bus = sfxBus, to = null, attack = 0.01 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(t, dur, { vol = 0.3, freq = 800, to = null, type = 'lowpass', attack = 0.02, bus = sfxBus } = {}) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t); src.stop(t + dur + 0.05);
  }

  const FX = {
    click: (t) => note(midi(84), t, 0.07, { type: 'sine', vol: 0.15 }),
    good: (t) => [72, 76, 79, 84].forEach((n, k) => note(midi(n), t + k * 0.08, 0.28, { vol: 0.22 })),
    bad: (t) => {
      note(midi(67), t, 0.28, { type: 'square', vol: 0.07, to: midi(62) });
      note(midi(62), t + 0.25, 0.45, { type: 'square', vol: 0.07, to: midi(55) });
    },
    payoff: (t) => [79, 84, 88, 91, 96].forEach((n, k) => note(midi(n), t + k * 0.07, 0.35, { type: 'sine', vol: 0.16 })),
    achieve: (t) => {
      [72, 76, 79].forEach((n, k) => note(midi(n), t + k * 0.1, 0.2, { type: 'square', vol: 0.06 }));
      [84, 88].forEach((n) => note(midi(n), t + 0.32, 0.6, { type: 'triangle', vol: 0.2 }));
    },
    win: (t) => {
      [72, 74, 76, 79, 81, 84].forEach((n, k) => note(midi(n), t + k * 0.09, 0.3, { vol: 0.2 }));
      [76, 79, 84].forEach((n) => note(midi(n), t + 0.6, 1.0, { vol: 0.14 }));
    },
    lose: (t) => [67, 66, 65, 64].forEach((n, k) => note(midi(n), t + k * 0.25, 0.4, { type: 'sawtooth', vol: 0.05 })),
    splash: (t) => noise(t, 0.6, { vol: 0.25, freq: 2500, to: 300 }),
    honk: (t) => { note(midi(64), t, 0.18, { type: 'square', vol: 0.07 }); note(midi(64), t + 0.24, 0.3, { type: 'square', vol: 0.07 }); },
    choo: (t) => [0, 0.32].forEach((d) => { note(midi(76), t + d, 0.26, { type: 'triangle', vol: 0.12 }); note(midi(80), t + d, 0.26, { type: 'triangle', vol: 0.08 }); }),
    pop: (t) => note(midi(80), t, 0.12, { type: 'sine', vol: 0.2, to: midi(92) }),
    storm: (t) => {
      noise(t, 3.4, { vol: 0.15, freq: 4000, type: 'highpass', attack: 0.5 });
      noise(t + 0.9, 1.6, { vol: 0.6, freq: 400, to: 60 });
      noise(t + 2.3, 1.2, { vol: 0.4, freq: 300, to: 50 });
    },
  };

  function play(name) {
    if (!sfxOn || !init() || !FX[name]) return;
    FX[name](ctx.currentTime + 0.01);
  }

  /* ── Music: three cheerful island tunes (all our own). Each loops for a while (about a minute), then the
     music fades into the next one, so it changes only now and then. ── */
  const TUNES = [
    { // "Island": bright, in C
      step: 0.19, lead: 'triangle', vol: 0.22,
      melody: [76, 0, 79, 0, 81, 79, 76, 0, 74, 0, 76, 0, 72, 0, 0, 0,
        76, 0, 79, 0, 81, 84, 81, 79, 76, 0, 74, 0, 72, 0, 0, 0,
        81, 0, 84, 0, 86, 84, 81, 0, 79, 0, 81, 0, 76, 0, 0, 0,
        74, 76, 79, 0, 76, 74, 72, 0, 74, 0, 76, 0, 72, 0, 0, 0],
      bass: [48, 45, 41, 43, 48, 45, 41, 43] },   // C Am F G
    { // "Breeze": slower and gentle, in G
      step: 0.23, lead: 'sine', vol: 0.26,
      melody: [71, 0, 74, 0, 76, 0, 74, 71, 69, 0, 67, 0, 69, 0, 0, 0,
        71, 0, 74, 0, 79, 0, 76, 74, 76, 0, 74, 0, 71, 0, 0, 0,
        74, 0, 76, 0, 79, 0, 81, 79, 76, 0, 74, 0, 76, 0, 0, 0,
        74, 0, 71, 0, 69, 71, 74, 0, 71, 0, 69, 0, 67, 0, 0, 0],
      bass: [43, 40, 36, 38, 43, 40, 36, 38] },   // G Em C D
    { // "Bounce": quicker and playful, in F
      step: 0.17, lead: 'square', vol: 0.1,
      melody: [72, 0, 72, 74, 77, 0, 74, 72, 69, 0, 72, 0, 67, 0, 0, 0,
        72, 0, 72, 74, 77, 0, 79, 77, 74, 0, 72, 0, 74, 0, 0, 0,
        77, 0, 77, 79, 81, 0, 79, 77, 74, 0, 77, 0, 72, 0, 0, 0,
        74, 72, 69, 0, 72, 69, 67, 0, 69, 0, 67, 0, 65, 0, 0, 0],
      bass: [41, 38, 34, 36, 41, 38, 34, 36] },   // F Dm Bb C
  ];
  const LOOPS_PER_TUNE = 4;
  let tune = 0, loops = 0;

  function playStep(i, t) {
    const T = TUNES[tune], m = T.melody[i];
    if (m) note(midi(m), t, T.step * 1.5, { type: T.lead, vol: T.vol, bus: musicBus });
    if (i % 8 === 0) note(midi(T.bass[i / 8]), t, T.step * 2.6, { type: 'sine', vol: 0.4, bus: musicBus });
    if (i % 8 === 4) note(midi(T.bass[(i - 4) / 8] + 7), t, T.step * 2.1, { type: 'sine', vol: 0.3, bus: musicBus });
    if (i % 2 === 1) noise(t, 0.05, { vol: 0.05, freq: 7000, type: 'highpass', attack: 0.005, bus: musicBus });
  }

  function tick() {
    while (nextTime < ctx.currentTime + 0.3) {
      playStep(step, nextTime);
      nextTime += TUNES[tune].step;
      step = (step + 1) % TUNES[tune].melody.length;
      if (step === 0 && ++loops >= LOOPS_PER_TUNE) {
        // time for the next tune: a short fade out, a little pause, and in again
        loops = 0;
        tune = (tune + 1) % TUNES.length;
        const t = nextTime;
        musicBus.gain.cancelScheduledValues(t - 0.8);
        musicBus.gain.setValueAtTime(0.16, t - 0.8);
        musicBus.gain.linearRampToValueAtTime(0.0001, t);
        nextTime += 0.6;
        musicBus.gain.setValueAtTime(0.0001, nextTime);
        musicBus.gain.linearRampToValueAtTime(0.16, nextTime + 1.2);
      }
    }
  }

  function startMusic() {
    if (!musicOn || timer || !init()) return;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(tick, 80);
  }
  function stopMusic() {
    clearInterval(timer);
    timer = null;
  }
  /** Fade the music out for a moment (e.g. during a disaster). */
  function duck(seconds) {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(0.0001, t + 0.4);
    musicBus.gain.setValueAtTime(0.0001, t + seconds);
    musicBus.gain.linearRampToValueAtTime(0.16, t + seconds + 1.5);
  }

  return {
    unlock: init,
    play,
    duck,
    setSfx(on) { sfxOn = on; },
    setMusic(on) { musicOn = on; on ? startMusic() : stopMusic(); },
    startMusic,
  };
})();
