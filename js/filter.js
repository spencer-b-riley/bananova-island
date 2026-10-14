/* Monkey name filter.
   - Letters only (no numbers, @, links…), so kids can't type phone numbers or emails.
   - 2–12 characters.
   - Blocks rude words in English, German, Italian and French, including
     sneaky spellings like "f.u.u.u.ck" or "sh1t". */

const NameFilter = (() => {
  // Blocked anywhere inside the name.
  const ANYWHERE = [
    'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'bastard', 'nigger', 'nigga',
    'faggot', 'retard', 'nazi', 'hitler', 'porn', 'penis', 'vagina', 'boob', 'dildo', 'wank', 'twat',
    'piss', 'asshole', 'jizz', 'sex', 'horny', 'suicide',
    // German
    'scheiss', 'scheis', 'fotze', 'wichs', 'hure', 'arsch', 'schlampe', 'missgeburt', 'spast',
    'schwuchtel', 'fick', 'hurensohn',
    // Italian
    'cazzo', 'merda', 'puttana', 'stronz', 'vaffanculo', 'troia', 'minchia', 'coglion', 'frocio',
    // French
    'merde', 'putain', 'salope', 'connard', 'connasse', 'encule', 'batard', 'pute', 'nique',
    'couille', 'chier',
  ];
  // Blocked only as a whole word (they appear inside normal names too).
  const WHOLE_WORD = [
    'ass', 'arse', 'anal', 'cum', 'tit', 'tits', 'cock', 'fag', 'rape', 'kys', 'kill', 'killer',
    'dumb', 'stupid', 'idiot', 'loser', 'ugly', 'fat', 'poop', 'dummkopf', 'depp', 'idiota', 'scemo',
    'stupido', 'culo', 'figa', 'porco', 'bite', 'cul', 'con', 'debile',
  ];

  const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '+': 't' };

  const plain = (s) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[0134578@$!+]/g, (c) => LEET[c] ?? c);
  // "fuck" → /f+u+c+k+/ so stretched spellings like "fuuuck" are caught too,
  // without turning "boob" into "bob" (which would block the name Bobo).
  const stretch = (w) => w.split('').map((c) => c + '+').join('');
  const anywhere = ANYWHERE.map((w) => new RegExp(stretch(w)));
  const whole = WHOLE_WORD.map((w) => new RegExp('^' + stretch(w) + '$'));

  function isRude(name) {
    const p = plain(name);
    const joined = p.replace(/[^a-z]/g, '');
    if (anywhere.some((re) => re.test(joined))) return true;
    const words = [joined, ...p.split(/[^a-z]+/).filter(Boolean)];
    return words.some((word) => whole.some((re) => re.test(word)));
  }

  /** Returns { ok: true, name } or { ok: false, reason: 'short'|'long'|'chars'|'bad' } */
  function check(raw) {
    const name = String(raw || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2) return { ok: false, reason: 'short' };
    if (name.length > 12) return { ok: false, reason: 'long' };
    if (!/^\p{L}[\p{L}\p{M} '\-]*$/u.test(name)) return { ok: false, reason: 'chars' };
    if (isRude(name)) return { ok: false, reason: 'bad' };
    return { ok: true, name: name.charAt(0).toUpperCase() + name.slice(1) };
  }

  return { check };
})();
