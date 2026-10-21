/* Game data that doesn't depend on language.
   All text (in 4 languages) lives in i18n.js, in the same order as CHOICES.

   h = change to 🐒 Bobo's happiness.
   t = change to 🌡️ the city's temperature (in °C above the old normal; the game starts at +1.0).
   Climate-smart ("good") choices don't warm the city. Some of them are ALSO more fun or
   cheaper right away (biking, thrift store, swapping toys), because green isn't always boring.
   times = the times of day that fit the situation (school is in the morning, the bath at night,
   and Bobo never plays outside at night). */

const CHOICES = [
  { id: 'school', good: { t: 0, icon: 'bike' }, bad: { t: 0.35, icon: 'car' }, times: ['morning'] },
  { id: 'lights', good: { t: 0, icon: 'switch' }, bad: { t: 0.2, icon: 'tv' }, times: ['day'] },
  { id: 'bottle', good: { t: 0, icon: 'refill' }, bad: { t: 0.2, icon: 'plastic' }, times: ['morning', 'day'] },
  { id: 'toy', good: { t: 0, icon: 'wrench' }, bad: { t: 0.3, icon: 'box' }, times: ['day'] },
  { id: 'hot', good: { t: 0, icon: 'shade' }, bad: { t: 0.35, icon: 'ac' }, times: ['day'] },
  { id: 'cold', good: { t: 0, icon: 'sweater' }, bad: { t: 0.35, icon: 'flame' }, times: ['morning', 'evening'] },
  { id: 'shower', good: { t: 0, icon: 'shower' }, bad: { t: 0.2, icon: 'bath' }, times: ['night'] },
  { id: 'party', good: { t: 0, icon: 'recycle' }, bad: { t: 0.3, icon: 'trashbag' }, times: ['day'] },
  { id: 'jacket', good: { t: 0, icon: 'thrift' }, bad: { t: 0.35, icon: 'mall' }, times: ['day'] },
  { id: 'trip', good: { t: 0, icon: 'train' }, bad: { t: 0.4, icon: 'car' }, times: ['morning', 'day'] },
  { id: 'food', good: { t: 0, icon: 'veggie' }, bad: { t: 0.4, icon: 'burger' }, times: ['day'] },
];

// Endings depend on the final temperature (see app.js). Reaching +2.5 °C ends the game right away.
const ENDINGS = {
  warrior: { icon: 'medal' },   // up to +1.3 °C
  warming: { icon: 'thermo' },  // up to +2.0 °C
  hot:     { icon: 'hot' },     // above that
  overheated: { icon: 'hot' },  // +2.5 °C or more: game over (can happen before the last choice)
};

const ACHIEVEMENTS = [
  { id: 'first', icon: 'paws' },
  { id: 'warrior', icon: 'medal' },
  { id: 'perfect', icon: 'hundred' },
  { id: 'bike', icon: 'bike' },
  { id: 'lights', icon: 'switch' },
  { id: 'bottle', icon: 'refill' },
  { id: 'toy', icon: 'wrench' },
  { id: 'breeze', icon: 'shade' },
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
