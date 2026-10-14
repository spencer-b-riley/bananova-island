/* Saves games, achievements and settings ONLY in this browser (localStorage).
   Nothing is ever sent to a server. If storage is blocked (private mode),
   the game still works – it just won't remember anything. */

const Store = (() => {
  const KEY = 'palmwiseIsland.v1';
  const MAX_GAMES = 50;

  const blank = () => ({ games: [], ach: {}, settings: { lang: null, music: true, sfx: true } });
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

  function load() {
    const data = blank();
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') return data;

    if (Array.isArray(raw.games)) {
      data.games = raw.games
        .filter((g) => g && typeof g === 'object')
        .slice(-MAX_GAMES)
        .map((g) => ({
          d: num(g.d), n: String(g.n || '').slice(0, 12), e: String(g.e || ''),
          h: num(g.h), i: num(g.i), g: num(g.g), c: num(g.c),
        }));
    }
    if (raw.ach && typeof raw.ach === 'object') {
      for (const k of Object.keys(raw.ach)) if (typeof raw.ach[k] === 'number') data.ach[k] = raw.ach[k];
    }
    const s = raw.settings || {};
    if (typeof s.lang === 'string') data.settings.lang = s.lang;
    if (typeof s.music === 'boolean') data.settings.music = s.music;
    if (typeof s.sfx === 'boolean') data.settings.sfx = s.sfx;
    return data;
  }

  function save(data) {
    try {
      data.games = data.games.slice(-MAX_GAMES);
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  return { load, save, MAX_GAMES };
})();
