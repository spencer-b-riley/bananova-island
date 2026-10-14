/* Game data that doesn't depend on language.
   All text (in 4 languages) lives in i18n.js, in the same order as CHOICES.

   h = change to 🐒 monkey happiness, i = change to 🏝️ island health.
   Sustainable ("good") choices cost a little happiness now but pay back
   two turns later (see PAYOFF in app.js).
   time = time of day the situation happens (morning, day, evening, night). */

const CHOICES = [
  { id: 'shelter',  good: { h: -8,  i: 5,  emoji: '🪨' }, bad: { h: 10, i: -12, emoji: '🪓' }, time: 'morning', disaster: 'storm' },
  { id: 'plastic',  good: { h: -8,  i: 5,  emoji: '🗑️' }, bad: { h: 8,  i: -15, emoji: '🌊' }, time: 'day', disaster: 'flood' },
  { id: 'food',     good: { h: -8,  i: 4,  emoji: '🧺' }, bad: { h: 12, i: -10, emoji: '😋' }, time: 'day', disaster: 'heat' },
  { id: 'banana',   good: { h: -8,  i: 5,  emoji: '🌱' }, bad: { h: 8,  i: -10, emoji: '🍌' }, time: 'day', disaster: 'heat' },
  { id: 'fishing',  good: { h: -6,  i: 5,  emoji: '🎣' }, bad: { h: 10, i: -14, emoji: '🕸️' }, time: 'evening', disaster: 'flood' },
  { id: 'compost',  good: { h: -8,  i: 5,  emoji: '♻️' }, bad: { h: 8,  i: -12, emoji: '🪰' }, time: 'day', disaster: 'storm' },
  { id: 'fire',     good: { h: -14, i: 6, emoji: '💧' }, bad: { h: 8,  i: -18, emoji: '🔥' }, time: 'day', disaster: 'heat' },
  { id: 'firewood', good: { h: -6,  i: 4,  emoji: '🍂' }, bad: { h: 12, i: -12, emoji: '🪓' }, time: 'night', disaster: 'heat' },
  { id: 'water',    good: { h: -8,  i: 4,  emoji: '🌧️' }, bad: { h: 10, i: -12, emoji: '💦' }, time: 'day', disaster: 'heat' },
  { id: 'turtles',  good: { h: -8,  i: 5,  emoji: '🐢' }, bad: { h: 8,  i: -12, emoji: '👋' }, time: 'night', disaster: 'flood' },
];

const ENDINGS = {
  hero:     { emoji: '🏆' },
  friend:   { emoji: '🌴' },
  okay:     { emoji: '🌤️' },
  struggle: { emoji: '🌧️' },
  flood:    { emoji: '🌊', disaster: true },
  heat:     { emoji: '🥵', disaster: true },
  storm:    { emoji: '⛈️', disaster: true },
};

const ACHIEVEMENTS = [
  { id: 'first',       emoji: '👣' },
  { id: 'hero',        emoji: '🏆' },
  { id: 'perfect',     emoji: '💯' },
  { id: 'tree',        emoji: '🌳' },
  { id: 'ocean',       emoji: '🌊' },
  { id: 'planter',     emoji: '🍌' },
  { id: 'fisher',      emoji: '🎣' },
  { id: 'firefighter', emoji: '🚒' },
  { id: 'turtle',      emoji: '🐢' },
  { id: 'compost',     emoji: '♻️' },
  { id: 'water',       emoji: '💧' },
  { id: 'cozy',        emoji: '🔥' },
  { id: 'learner',     emoji: '📚' },
  { id: 'survivor',    emoji: '⛈️' },
  { id: 'three',       emoji: '🔁' },
  // Mystery achievements: hidden as "???" until unlocked
  { id: 'whale',       emoji: '🐋', mystery: true },
  { id: 'stormchaser', emoji: '🌪️', mystery: true },
  { id: 'eclipse',     emoji: '🌑', mystery: true }, // about 1 game in 100
  { id: 'pirates',     emoji: '🏴‍☠️', mystery: true }, // about 1 game in 100
  { id: 'legend',      emoji: '👑', mystery: true }, // unlock every other achievement
];

const TAKEAWAY_EMOJI = ['🗑️', '♻️', '🍎', '🌱', '💧', '🐢'];
