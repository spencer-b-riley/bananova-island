# 🐒 Bobo's City 🏙️

A climate game for kids aged 8–10. Bobo the monkey lives in a busy city on an island, and the
player helps Bobo make **12 everyday choices**: how to get to school, what to do with the lights,
a broken toy, a birthday party, a new jacket, lunch and more. Every choice changes
🌡️ **the city's temperature**, and the city visibly changes with the climate. Green choices "pay back" two turns later, and at the end players see a recap that
explains why each decision mattered.

*Made by students of the class "Climate Change Communication: Unraveling Communication and
Acceptance Challenges" at the University of St. Gallen (HSG).*

## Features

- 12 everyday choices kids really face: getting to school (bike or car), lights and TV,
  a water bottle, a broken toy, a hot day, a cold day, bath time, a birthday party with monkey
  friends, a new jacket (thrift store or fast fashion), a weekend trip (train or car), lunch
  (a yummy veggie meal or a beef burger every day), and a friend about to throw his trash into
  the sea from the pier (stop him and use the bin, or let him). Eating green is never about eating less.
- Bobo bikes on the bike lane on the houses' side of the road, so he never rides into the cars, and
  a smart traffic model drives every car, van, truck and bus: they keep a safe distance, brake and start
  smoothly, stop for people on the zebra crossing in front of Bobo's house (people wait for a gap
  first). Dad pulls out as soon as no car is close, and cars that catch up just slow down behind him.
- Seagulls and the hawk drift up and down at different heights, and now and then an airplane flies by.
- Day and night: at night homes and offices light up (not every window), the school, the shops and the
  station are closed (dark windows), and street lights glow along the streets.
- Parking: little car parks by the school (across the street), the station and the shops (right across
  the street from the thrift store and the mall). Bike racks at home, the school, the station and the mall.
- How Bobo gets to school decides how the family gets around for the rest of the game. With the
  car, every extra car trip warms the city a tiny bit (+0.03 °C, never enough to lose) and a
  little message says so.
- Green choices are often better right away (biking to school with friends, a cheaper and cooler
  thrift jacket, swapping toys with a friend, cooling down in the shade)
- A living city: Bobo's street with the school, skyscrapers, a thrift store, a mall, houses, a park,
  a power plant, trees, a train line and a road with bridges to other towns, cars, vans, pickups, a delivery truck and a bus (each with a
  happy monkey driver), trains, cyclists and sailboats. Far away there's a volcano island whose
  trees and animals also come and go with the climate.
- Bobo really goes places: bikes or rides to school, takes the
  train to Grandma's, shops at the thrift store or the mall, throws a party with friends, and more
- Speech bubbles stay up longer for longer text, so every language gets the same reading time
- Bobo's outfits: backpack, bike, party hat, sweater, thrift jacket, plain jacket and a shopping bag
- Energy you can see: electricity flows from the power plant along a wire; using more energy makes
  the plant puff more smoke, and solar panels and wind turbines make it cleaner
- Rewards two turns later: a bike group, solar panels, a sea turtle on a clean beach, a toy swap box,
  shady trees, wind turbines, a solar water heater, a recycling center, a clothes rack, an extra
  train, a veggie garden with bees and a beach clean-up
- The climate changes the city step by step (no disasters):
  - cooler: green grass, birds, butterflies, bees, crabs, fish and a sea turtle, a long colourful coral
    corals of many kinds scattered over the shallow water all around the island (the deep water further out is
    darker), little seaweed swaying between them, and ripples on the water (the seaweed dies off when it's hot)
  - hotter: dry brown grass, hazy sky, a bigger sun, bugs and flies, the animals leave, the sea
    rises over the beach, the coral bleaches, plastic and dead fish wash up, heat shimmers off the
    roads, and the weather gets wilder (more rain, then storms, with lightning near and far)
  - Bobo's face turns neutral when it gets hot (never sad: it's a game for kids)
  - it's never too late: after a lot of warming (over +1.5 °C), 3 or more green choices in a row
    cool the city a little
- Endings by temperature: **Climate Warrior** (up to +1.3 °C), **Warming Island** (up to
  +2.0 °C) and **Hot Island** (above that). The game starts at +1.0 °C, about how much warmer
  Earth already is today. If the city reaches +2.5 °C, the island overheats and the game is
  lost right away (a real loss, with Play again). It's meant to be hard: roughly, one bad choice
  is still a Climate Warrior, five or more and the island overheats.
- Every game is different: questions come in a random order (getting to school is always first and
  the birthday party comes later on),
  each happens at a fitting time of day (the sun rises on the left and sets on the right), and the
  weather is random (wilder when the city is hotter). Lunch is always on a different day than school.
- The camera is close up on every screen (phone and computer) and follows Bobo, cars, bikes and
  trains around, so the action is big and easy to see
- Title screen: Banjo runs around the island doing tricks while the camera follows him; when the
  player presses Play he sprints to Bobo's house and shouts "Let's go!" before the game starts
- Text in the game can't be selected or highlighted by accident (taps and long-presses on phones)
- Animation scaler (`js/perf.js`): to go easy on graphics chips, most devices start with fewer
  little extras (only strong ones like Apple M-chips or gaming graphics cards get everything). It
  guesses from the CPU, memory, graphics chip and iPhone screen size, then watches the real frame
  rate and switches off little extras (flapping wings, swaying plants) if the device struggles. The
  animals always stay and keep moving: they show how healthy the island is. Big changes happen one at a time (the sky changes first, then Bobo moves).
- All icons are our own drawings (`js/icons.js`), no emoji
- A recap of every decision with "Did you know?" facts, then simple takeaways. The first time,
  players tick "I read this" on every card before going on; after that the recap can be skipped
- 16 achievements
- English, German, Italian and French (switch anytime, top-right)
- Music and sound effects, generated in the browser (no audio files): three tunes (Island, Breeze,
  Bounce) that take turns, each playing a few times before fading into the next
- My Games history and achievements, saved **only on the player's own device**
  (deleting game history keeps achievements unless the player confirms a second question)
- Privacy tab that explains this and teaches online-safety tips
- "Play on your phone" QR code
- Works on laptops, tablets and phones with no scrolling

## Project structure

```
index.html          the page
css/style.css       all styling and animations
js/content.js       choice numbers (temperature changes), endings and achievements
js/i18n.js          ALL text in 4 languages, so edit wording here
js/scene.js         the city drawing, Bobo's trips and how the city changes
js/app.js           game flow
js/icons.js         our own icons (instead of emoji)
js/perf.js          animation scaler (fewer animations on slower devices)
js/audio.js         music and sound effects
js/storage.js       local saving (browser only)
js/vendor/          QR code library (qrcode-generator 1.4.4, MIT, license file included)
vercel.json         security and privacy headers for Vercel
```

There is no build step. It's plain HTML, CSS and JavaScript.

## Editing the game

- **Change text:** edit `js/i18n.js`. Each language has the same structure, and the
  `choices` list is in the same order as `CHOICES` in `js/content.js`.
- **Change difficulty:** edit the `t` (temperature) numbers in `js/content.js`, or `START_T`,
  `PAYOFF_T` and `LOSE_T` at the top of `js/app.js`.

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
- **Music and sounds:** three original melodies and effects, generated live with the Web Audio API.
  No audio files or samples are used.
- **Text:** all game text and facts were written for this project.
- **Emoji:** shown with the player's own device font (Unicode characters). No emoji images
  are included.
- **QR code library:** [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
  by Kazuhiko Arase, MIT License. See `js/vendor/LICENSE-qrcode-generator.txt`.
  "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
- **University name:** "University of St. Gallen (HSG)" appears only as a factual credit line.
  No logos are used.
