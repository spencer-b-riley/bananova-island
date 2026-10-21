/* Animation scaler: picks how many animations the device can handle smoothly.
   'high' = everything, 'mid' = fewer little extras, 'low' = only what the story needs.
   1. A first guess from the device (CPU cores, memory, graphics chip, screen, iPhone size).
   2. Then it watches the real frame rate while playing: if the device keeps struggling,
      it steps down a level (and remembers that for next time, on this device only).
   The level is set as <html data-perf="…">, and style.css turns animations off per level. */

const Perf = (() => {
  const KEY = 'bobosCity.perf';
  const ORDER = ['low', 'mid', 'high'];
  const root = document.documentElement;
  let tier = 'high';

  function gpuName() {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) return '';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    } catch (e) {
      return '';
    }
  }

  function guess() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'low';
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;           // (only some browsers tell us)
    const gpu = gpuName();
    const ua = navigator.userAgent;
    const iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let t = 'high';
    if (cores <= 2 || mem <= 2) t = 'low';
    else if (cores <= 4 || mem <= 3) t = 'mid';
    // weak graphics chips (older Android phones, old laptop graphics)
    if (/Mali-(4|T[0-7])|PowerVR|Adreno \(TM\) [2-5]\d\d|Intel\(R\) HD Graphics( [2-5]\d{2,3})?$|GMA|SwiftShader|llvmpipe/i.test(gpu)) t = 'low';
    else if (/Intel|Mali|Adreno \(TM\) 6/i.test(gpu) && t === 'high') t = 'mid';
    // iPhones all say "Apple GPU", so use the screen: small / older models start lower
    if (iOS) {
      const w = Math.min(screen.width, screen.height);
      t = w <= 375 ? 'mid' : 'high';
      if (w <= 320) t = 'low';
    }
    // very big screens with a high pixel density mean lots of pixels to redraw
    if (screen.width * screen.height * (devicePixelRatio || 1) ** 2 > 9e6 && t === 'high') t = 'mid';
    return t;
  }

  function set(t) {
    tier = t;
    root.dataset.perf = t;
  }

  function remembered() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(t) {
    try { localStorage.setItem(KEY, t); } catch (e) { /* storage blocked: fine */ }
  }

  // Watch the frame rate. About 3 seconds of slow frames in a row = step down one level.
  function watch() {
    let last = performance.now(), frames = 0, sum = 0, slowWindows = 0;
    const loop = (now) => {
      const dt = now - last;
      last = now;
      if (!document.hidden && dt < 400) {         // (ignore pauses, e.g. the tab was in the background)
        sum += dt;
        frames++;
        if (frames >= 60) {
          const avg = sum / frames;                  // ms per frame: 16 = 60 fps, 33 = 30 fps
          slowWindows = avg > 30 ? slowWindows + 1 : 0;
          if (slowWindows >= 3 && tier !== 'low') {
            set(ORDER[ORDER.indexOf(tier) - 1]);
            remember(tier);
            slowWindows = 0;
          }
          frames = 0;
          sum = 0;
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  const saved = remembered();
  set(ORDER.includes(saved) ? saved : guess());
  watch();

  return { get tier() { return tier; } };
})();
