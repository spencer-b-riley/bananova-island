# 🐒 Bobo's City 🏙️

A climate game for kids aged 8–10. Bobo the monkey lives in a busy city on an island, and the
player helps Bobo make **11 everyday choices**: how to get to school, what to do with the lights,
a broken toy, a birthday party, a new jacket, lunch and more. Every choice changes
🌡️ **the city's temperature** and 🐒 **Bobo's happiness**, and the city visibly changes with
the climate. Green choices "pay back" two turns later, and at the end players see a recap that
explains why each decision mattered.

*Made by students of the class "Climate Change Communication: Unraveling Communication and
Acceptance Challenges" at the University of St. Gallen (HSG).*

## Features

- 11 everyday choices kids really face: getting to school (bike or car), lights and TV,
  a water bottle, a broken toy, a hot day, a cold day, bath time, a birthday party with monkey
  friends, a new jacket (thrift store or fast fashion), a weekend trip (train or car), and lunch
  (a yummy veggie meal or a beef burger every day). Eating green is never about eating less.
- Real trade-offs: some green choices cost a little fun (a fan instead of the air conditioner),
  but many are better right away (biking past the traffic jam, a cheaper and cooler thrift jacket,
  swapping toys with a friend)
- A living city: school, skyscrapers, a thrift store, a mall, houses, a park, a power plant,
  a train line and a road with bridges to other towns, cars, trains and cyclists
- Bobo really goes places: bikes or rides to school (and gets stuck in a traffic jam), takes the
  train to Grandma's, shops at the thrift store or the mall, throws a party with friends, and more
- Bobo's outfits: backpack, bike, party hat, sweater, thrift jacket, plain jacket and a shopping bag
- Energy you can see: electricity flows from the power plant along a wire; using more energy makes
  the plant puff more smoke, and solar panels and wind turbines make it cleaner
- Rewards two turns later: a bike group, solar panels, a sea turtle on a clean beach, a toy swap box,
  shady trees, wind turbines, a solar water heater, a recycling center, a clothes rack, an extra
  train and a veggie garden with bees
- The climate changes the city step by step (no disasters, no game over):
  - cooler: green grass, birds, butterflies, bees, crabs, fish and a sea turtle, colourful coral
  - hotter: dry brown grass, hazy sky, a bigger sun, bugs and flies, the animals leave, the sea
    rises over the beach, the coral bleaches, and the weather gets wilder (more rain, then storms)
  - once the city is +1.9 °C or more, the heat also makes Bobo less happy
- Endings by temperature: **Climate Warrior** (up to +1.4 °C), **Warming Island** (up to
  +2.2 °C) and **Hot Island** (above that). The game starts at +1.0 °C, about how much warmer
  Earth already is today.
- Every game is different: questions come in a random order (getting to school is always first),
  each happens at a fitting time of day (the sun rises on the left and sets on the right), and the
  weather is random (wilder when the city is hotter)
- On phones the city is zoomed in and the view follows Bobo around
- A recap of every decision with "Did you know?" facts (skippable), then simple takeaways
- 16 achievements
- English, German, Italian and French (switch anytime, top-right)
- Music and sound effects, generated in the browser (no audio files)
- My Games history and achievements, saved **only on the player's own device**
  (deleting game history keeps achievements unless the player confirms a second question)
- Privacy tab that explains this and teaches online-safety tips
- "Play on your phone" QR code
- Works on laptops, tablets and phones with no scrolling

## Project structure

```
index.html          the page
css/style.css       all styling and animations
js/content.js       choice numbers (happiness + temperature changes), endings and achievements
js/i18n.js          ALL text in 4 languages, so edit wording here
js/scene.js         the city drawing, Bobo's trips and how the city changes
js/app.js           game flow
js/audio.js         music and sound effects
js/storage.js       local saving (browser only)
js/vendor/          QR code library (qrcode-generator 1.4.4, MIT, license file included)
vercel.json         security and privacy headers for Vercel
```

There is no build step. It's plain HTML, CSS and JavaScript.

## Editing the game

- **Change text:** edit `js/i18n.js`. Each language has the same structure, and the
  `choices` list is in the same order as `CHOICES` in `js/content.js`.
- **Change difficulty:** edit the `h` (happiness) and `t` (temperature) numbers in
  `js/content.js`, or `START`, `PAYOFF` and `HEAT_PENALTY` at the top of `js/app.js`.

## Run it locally

Open `index.html` in a browser, or run a tiny server from this folder:

```bash
python3 -m http.server 8000
```

Then go to http://localhost:8000.

## Deploy on Vercel

1. Go to https://vercel.com and sign in with GitHub.
2. Click **Add New… → Project** and import the `climate-island` repository.
3. Framework preset: **Other**. Leave the build command and output directory empty.
4. Click **Deploy**. Every push to `main` updates the live site automatically.

## Originality, credits and licenses

- **Name:** "Bobo's City" is a plain name chosen by our group. A web search was not done as a
  formal trademark clearance. The character and city are our own.
- **Art:** every drawing (city, Bobo, friends, animals, vehicles) is original SVG made in code
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
