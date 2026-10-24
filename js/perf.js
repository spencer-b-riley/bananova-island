/* Animation scaler: picks how many animations the device can handle smoothly.
   'high' = everything, 'mid' = fewer little extras, 'low' = only what the story needs.
   To go easy on graphics chips (and batteries and fans), most devices start at 'mid':
   only clearly strong ones (Apple M-chips, gaming graphics cards) get 'high'.
   1. A first guess from the device (CPU cores, memory, graphics chip, screen, iPhone size).
   2. Then it watches the real frame rate while playing: if the device struggles even a little,
      it steps down a level. (It checks fresh every visit, so one slow moment never sticks.)
   The level is set as <html data-perf="…">, and style.css turns animations off per level.
   Other code can listen for changes with Perf.onChange(fn). */

const Perf = (() => {
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
    let t = 'mid';
    // only clearly strong graphics get everything (Apple M-chips, gaming / pro graphics cards, newer phone chips)
    const strong = /Apple M\d|RTX|GTX (1[0-9]{3}|9[6-9]0)|Radeon (RX|Pro) ?[5-9]\d{2,3}|Radeon Pro W|Arc A|Adreno \(TM\) [7-9]\d\d|Mali-G7[1-9]|Immortalis/i.test(gpu);
    if (strong && cores >= 6 && mem >= 4) t = 'high';
    if (cores <= 2 || mem <= 2) t = 'low';
    // weak graphics chips (older Android phones, old laptop graphics, no graphics chip at all)
    if (/Mali-(4|T[0-7])|PowerVR|Adreno \(TM\) [2-5]\d\d|Intel\(R\) HD Graphics( [2-5]\d{2,3})?$|GMA|SwiftShader|llvmpipe|Microsoft Basic Render/i.test(gpu)) t = 'low';
    // iPhones all say "Apple GPU", so use the screen: very small / old models start lowest
    if (iOS) {
      const w = Math.min(screen.width, screen.height);
      t = w <= 320 ? 'low' : 'mid';
    }
    // very big screens with a high pixel density mean lots of pixels to redraw
    if (screen.width * screen.height * (devicePixelRatio || 1) ** 2 > 9e6 && t === 'high') t = 'mid';
    return t;
  }

  const listeners = [];
  function set(t) {
    if (t === tier && root.dataset.perf === t) return;
    tier = t;
    root.dataset.perf = t;
    listeners.forEach((fn) => fn(t));
  }

  // Watch the frame rate (after the first few seconds of loading). About 2 seconds below ~45 frames a
  // second = step down from 'high' to 'mid'; below ~33 fps (it looks choppy) = 'low'.
  // And the other way: a device that stays perfectly smooth (~4 s at 55+ fps) gets one level more, as its
  // graphics chip can clearly do it (Safari hides the chip's name, so a strong Mac or iPhone starts on 'mid').
  // Once it had to step down it never steps up again (no going back and forth).
  function watch() {
    let last = performance.now(), frames = 0, sum = 0, slowWindows = 0, smoothWindows = 0, steppedDown = false, steppedUp = false;
    const start = performance.now();
    const loop = (now) => {
      const dt = now - last;
      last = now;
      if (!document.hidden && dt < 400 && now - start > 4000) {   // (ignore loading and pauses, e.g. the tab was in the background)
        sum += dt;
        frames++;
        if (frames >= 60) {
          const avg = sum / frames;                  // ms per frame: 16 = 60 fps, 33 = 30 fps
          slowWindows = avg > (tier === 'high' ? 22 : 30) ? slowWindows + 1 : 0;
          smoothWindows = avg < 18 ? smoothWindows + 1 : 0;
          if (slowWindows >= 2 && tier !== 'low') {
            set(ORDER[ORDER.indexOf(tier) - 1]);
            slowWindows = 0; smoothWindows = 0; steppedDown = true;
          } else if (smoothWindows >= 4 && !steppedDown && !steppedUp && tier !== 'high') {
            set(ORDER[ORDER.indexOf(tier) + 1]);
            smoothWindows = 0; steppedUp = true;
          }
          frames = 0;
          sum = 0;
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  set(guess());
  watch();

  return { get tier() { return tier; }, onChange(fn) { listeners.push(fn); } };
})();
