/* Game data that doesn't depend on language.
   All text (in 4 languages) lives in i18n.js, in the same order as CHOICES.

   h = change to 🐒 Bobo's happiness.
   t = change to 🌡️ the city's temperature (in °C above the old normal; the game starts at +1.0).
   Climate-smart ("good") choices don't warm the city. Some of them are ALSO more fun or
   cheaper right away (biking, thrift store, swapping toys), because green isn't always boring.
   times = the times of day that fit the situation. */

const CHOICES = [
  { id: 'school', good: { h: 6, t: 0, emoji: '🚲' }, bad: { h: -2, t: 0.25, emoji: '🚗' }, times: ['morning'] },
  { id: 'lights', good: { h: -2, t: 0, emoji: '💡' }, bad: { h: 2, t: 0.15, emoji: '📺' }, times: ['evening', 'night'] },
  { id: 'bottle', good: { h: 4, t: 0, emoji: '🍶' }, bad: { h: 2, t: 0.15, emoji: '🥤' }, times: ['morning', 'day'] },
  { id: 'toy', good: { h: 6, t: 0, emoji: '🔧' }, bad: { h: 8, t: 0.2, emoji: '📦' }, times: ['day'] },
  { id: 'hot', good: { h: -6, t: 0, emoji: '🌬️' }, bad: { h: 8, t: 0.25, emoji: '❄️' }, times: ['day'] },
  { id: 'cold', good: { h: 2, t: 0, emoji: '🧶' }, bad: { h: 6, t: 0.25, emoji: '🔥' }, times: ['morning', 'evening'] },
  { id: 'shower', good: { h: 4, t: 0, emoji: '🚿' }, bad: { h: 6, t: 0.15, emoji: '🛁' }, times: ['evening'] },
  { id: 'party', good: { h: 2, t: 0, emoji: '♻️' }, bad: { h: 4, t: 0.2, emoji: '🗑️' }, times: ['day'] },
  { id: 'jacket', good: { h: 10, t: 0, emoji: '🛍️' }, bad: { h: 4, t: 0.25, emoji: '🏬' }, times: ['day'] },
  { id: 'trip', good: { h: 6, t: 0, emoji: '🚆' }, bad: { h: 2, t: 0.3, emoji: '🚗' }, times: ['morning', 'day'] },
  { id: 'food', good: { h: 4, t: 0, emoji: '🥦' }, bad: { h: 6, t: 0.3, emoji: '🍔' }, times: ['day', 'evening'] },
];

// Endings depend on the final temperature (see app.js)
const ENDINGS = {
  warrior: { emoji: '🦸' },   // up to +1.4 °C
  warming: { emoji: '🌡️' },   // up to +2.2 °C
  hot:     { emoji: '🥵' },    // above that
};

const ACHIEVEMENTS = [
  { id: 'first',   emoji: '👣' },
  { id: 'warrior', emoji: '🦸' },
  { id: 'perfect', emoji: '💯' },
  { id: 'bike',    emoji: '🚲' },
  { id: 'lights',  emoji: '💡' },
  { id: 'bottle',  emoji: '🍶' },
  { id: 'toy',     emoji: '🔧' },
  { id: 'breeze',  emoji: '🌬️' },
  { id: 'sweater', emoji: '🧶' },
  { id: 'shower',  emoji: '🚿' },
  { id: 'party',   emoji: '🎈' },
  { id: 'thrift',  emoji: '🛍️' },
  { id: 'train',   emoji: '🚆' },
  { id: 'veggie',  emoji: '🥦' },
  { id: 'learner', emoji: '📚' },
  { id: 'three',   emoji: '🔁' },
];

// which achievement belongs to which choice (unlocked by the climate-smart answer)
const CHOICE_ACH = { school: 'bike', lights: 'lights', bottle: 'bottle', toy: 'toy', hot: 'breeze', cold: 'sweater',
  shower: 'shower', party: 'party', jacket: 'thrift', trip: 'train', food: 'veggie' };

const TAKEAWAY_EMOJI = ['🚲', '💡', '🔧', '♻️', '🥦', '🗣️'];
