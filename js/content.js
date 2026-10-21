/* Game data that doesn't depend on language.
   All text (in 4 languages) lives in i18n.js, in the same order as CHOICES.

   h = change to 🐒 Bobo's happiness.
   t = change to 🌡️ the city's temperature (in °C above the old normal; the game starts at +1.0).
   Climate-smart ("good") choices don't warm the city. Some of them are ALSO more fun or
   cheaper right away (biking, thrift store, swapping toys), because green isn't always boring.
   times = the times of day that fit the situation. */

const CHOICES = [
  { id: 'school', good: { h: 6, t: 0, icon: 'bike' }, bad: { h: -2, t: 0.25, icon: 'car' }, times: ['morning'] },
  { id: 'lights', good: { h: -2, t: 0, icon: 'switch' }, bad: { h: 2, t: 0.15, icon: 'tv' }, times: ['evening', 'night'] },
  { id: 'bottle', good: { h: 4, t: 0, icon: 'refill' }, bad: { h: 2, t: 0.15, icon: 'plastic' }, times: ['morning', 'day'] },
  { id: 'toy', good: { h: 6, t: 0, icon: 'wrench' }, bad: { h: 8, t: 0.2, icon: 'box' }, times: ['day'] },
  { id: 'hot', good: { h: -6, t: 0, icon: 'fan' }, bad: { h: 8, t: 0.25, icon: 'ac' }, times: ['day'] },
  { id: 'cold', good: { h: 2, t: 0, icon: 'sweater' }, bad: { h: 6, t: 0.25, icon: 'flame' }, times: ['morning', 'evening'] },
  { id: 'shower', good: { h: 4, t: 0, icon: 'shower' }, bad: { h: 6, t: 0.15, icon: 'bath' }, times: ['evening'] },
  { id: 'party', good: { h: 2, t: 0, icon: 'recycle' }, bad: { h: 4, t: 0.2, icon: 'trashbag' }, times: ['day'] },
  { id: 'jacket', good: { h: 10, t: 0, icon: 'thrift' }, bad: { h: 4, t: 0.25, icon: 'mall' }, times: ['day'] },
  { id: 'trip', good: { h: 6, t: 0, icon: 'train' }, bad: { h: 2, t: 0.3, icon: 'car' }, times: ['morning', 'day'] },
  { id: 'food', good: { h: 4, t: 0, icon: 'veggie' }, bad: { h: 6, t: 0.3, icon: 'burger' }, times: ['day', 'evening'] },
];

// Endings depend on the final temperature (see app.js)
const ENDINGS = {
  warrior: { icon: 'medal' },   // up to +1.4 °C
  warming: { icon: 'thermo' },  // up to +2.2 °C
  hot:     { icon: 'hot' },     // above that
};

const ACHIEVEMENTS = [
  { id: 'first', icon: 'paws' },
  { id: 'warrior', icon: 'medal' },
  { id: 'perfect', icon: 'hundred' },
  { id: 'bike', icon: 'bike' },
  { id: 'lights', icon: 'switch' },
  { id: 'bottle', icon: 'refill' },
  { id: 'toy', icon: 'wrench' },
  { id: 'breeze', icon: 'fan' },
  { id: 'sweater', icon: 'sweater' },
  { id: 'shower', icon: 'shower' },
  { id: 'party', icon: 'balloon' },
  { id: 'thrift', icon: 'thrift' },
  { id: 'train', icon: 'train' },
  { id: 'veggie', icon: 'veggie' },
  { id: 'learner', icon: 'book' },
  { id: 'three', icon: 'replay' },
];

// which achievement belongs to which choice (unlocked by the climate-smart answer)
const CHOICE_ACH = { school: 'bike', lights: 'lights', bottle: 'bottle', toy: 'toy', hot: 'breeze', cold: 'sweater',
  shower: 'shower', party: 'party', jacket: 'thrift', trip: 'train', food: 'veggie' };

const TAKEAWAY_ICONS = ['bike', 'switch', 'wrench', 'recycle', 'veggie', 'chat'];
