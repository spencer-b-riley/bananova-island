# 🐒 Palmwise Island 🏝️

A climate game for kids aged 8–14. A monkey is alone on an island and the player makes
**10 two-option choices**. Each choice balances the monkey's happiness now 🐒 against the
island's long-term health 🏝️. The island visibly changes after every choice, sustainable
choices "pay back" two turns later, and at the end players see a recap that explains why
each decision mattered.

*Made by students of the class "Climate Change Communication: Unraveling Communication and
Acceptance Challenges" at the University of St. Gallen (HSG).*

## Features

- 10 choices: home (cave or big house), plastic on the beach, food, banana tree, fishing,
  compost/recycling, forest fire, a cold night, fresh water and turtle nests
- Day and night: each situation happens at a fitting time (morning, day, sunset, night) with
  rain on some days; at night the cave lantern, campfire and house windows glow
- The monkey reacts (happy, scared, cold, hot, sad, thinking) and talks in a speech bubble
- Two meters always on screen: 🐒 Monkey happiness and 🏝️ Island health
- The island changes with each choice (stumps, a big house, dead fish with cartoon X eyes, smoke, garden, baby turtles…)
- Green choices come back 2 turns later as a reward ("Remember your choice?")
- Disasters destroy everything on the island, including the house or the cave home: wind blows it
  away, a wave washes it away, or a wildfire burns it. The monkey always escapes (behind the big
  rock, up the hill, or into the cool sea)
- Endings: **Island Hero**, Island Friend, Getting There, Island in Trouble, or a natural
  disaster (giant flood waves, heatwave or huge thunderstorm) if a meter hits 0
- A recap of every decision with "Did you know?" facts (skippable), then simple takeaways
- English, German, Italian and French (switch anytime, top-right)
- Music and sound effects, generated in the browser (no audio files)
- Monkey-name filter: letters only and no rude words in all 4 languages
- My Games history and 12 achievements, saved **only on the player's own device**
  (deleting game history keeps achievements unless the player confirms a second question)
- Privacy tab that explains this and teaches online-safety tips
- "Play on your phone" QR code
- Works on laptops, tablets and phones with no scrolling

## Project structure

```
index.html          the page
css/style.css       all styling and animations
js/content.js       choice numbers (meter changes), endings and achievements
js/i18n.js          ALL text in 4 languages, so edit wording here
js/scene.js         the island drawing and how it changes
js/app.js           game flow
js/audio.js         music and sound effects
js/filter.js        monkey-name filter
js/storage.js       local saving (browser only)
js/vendor/          QR code library (qrcode-generator 1.4.4, MIT, license file included)
vercel.json         security and privacy headers for Vercel
```

There is no build step. It's plain HTML, CSS and JavaScript.

## Editing the game

- **Change text:** edit `js/i18n.js`. Each language has the same structure, and the
  `choices` list is in the same order as `CHOICES` in `js/content.js`.
- **Change difficulty:** edit the `h` / `i` numbers in `js/content.js`, or `START` and
  `PAYOFF` at the top of `js/app.js`.

## Run it locally

Open `index.html` in a browser, or run a tiny server from this folder:

```bash
python3 -m http.server 8000
```

Then go to http://localhost:8000.

## Deploy on Vercel

1. Go to https://vercel.com and sign in with GitHub.
2. Click **Add New… → Project** and import the `palmwise-island` repository.
3. Framework preset: **Other**. Leave the build command and output directory empty.
4. Click **Deploy**. Every push to `main` updates the live site automatically.

## Originality, credits and licenses

- **Name:** "Palmwise Island" is a made-up name (palm + wise, as in wise choices on a palm
  island). We chose it to avoid "Monkey Island", the name of a video game series owned by
  Disney/LucasArts. Web searches found no game, app, brand or trademark called "Palmwise"
  (this was not a formal trademark clearance).
- **Art:** every drawing (island, monkey, animals and disasters) is original SVG made in code
  for this project. No images, sprites or fonts are downloaded.
- **Music and sounds:** an original melody and effects, generated live with the Web Audio API.
  No audio files or samples are used.
- **Text:** all game text and facts were written for this project.
- **Emoji:** shown with the player's own device font (Unicode characters). No emoji images
  are included.
- **QR code library:** [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
  by Kazuhiko Arase, MIT License. See `js/vendor/LICENSE-qrcode-generator.txt`.
  "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
- **University name:** "University of St. Gallen (HSG)" appears only as a factual credit line.
  No logos are used.
