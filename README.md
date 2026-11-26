# Lofi Room

Full-screen pixel-art scenes for listening to lofi from YouTube.

- Seven animated scenes, drawn in code at about 360 px tall and scaled up with crisp pixels. The UI accent follows the scene.
  - Rainy room: city through a wet window, lightning, fairy lights, a sleeping cat. Things happen now and then: headlights sweep the wall, a plane blinks across the sky, a moth finds the lamp, the rain eases off or pours, a draught bends the candle, and the cat wakes for a look round or a yawn (thunder wakes it too). Click the cat to pet it.
  - Seaside sunset: lighthouse beam, sailboat, sun glitter on the water, surf, a crab and a swaying palm. Now and then: dolphins leap across the bay, a gull lands on the umbrella, a big wave runs up the sand (and the crab runs for it), fish jump, a gust bends the palm and blows sand along the beach, or the crab digs in and peeks out. Click the crab or the gull, and tap the sea to make a fish jump.
  - Snowy cabin: aurora over lit mountain ridges, chimney smoke, a lamp post, a hare that hops by. Now and then: a blizzard blows through, someone opens the door to look at the snow, the window cat paws at the glass or moves to the other window, a deer crosses the yard and stops to look, snow slides off the roof, the aurora flares, or a robin lands on the snowman. Click the window cat, the door, the hare or the robin, and tap the sky for a shooting star.
  - Neon city: flickering signs, an equaliser billboard, a night train, the skyline mirrored in the water, a cat on the rooftop. Now and then: fireworks over the skyline (the cat looks up), a sign shorts out in a spray of sparks, the big screen cuts to static for a cat ad, a neon shower passes over, the express train comes early, or the cat looks round and flicks an ear. Click the cat to pet it or the boombox to turn it up, and tap the sky for a firework.
  - Forest campfire: the Milky Way, a tent, live flames and sparks, a sleeping fox, an owl and fireflies. Now and then: a shower of shooting stars, a log settling in a burst of sparks, the owl turning its head right round, the fox waking, the fireflies gathering, someone sitting up in the tent. Click the fox, the owl or the fire.
  - Thai night market: shophouses with Thai shop signs and laundry on the balconies, tangled power lines and fair lights, stalls for noodles, moo ping, Thai tea, fruit and roti, shoppers wandering past, a sleeping soi dog, and a bowl of noodles on our table. Now and then: a delivery scooter rides by, the grill is fanned into a cloud of smoke, the fair lights cut out and come back one by one, a drizzle sends up umbrellas, or the dog wakes for a scratch. Click the dog or the grill.
  - Morning café, the one daytime scene: low sun through a big front window lays bright patches and dusty beams across the floor; outside, pastel shophouses, a street tree in the breeze, people walking, a passing bicycle and pigeons; inside, someone in headphones on the window bench, a cat asleep on the sill, a chalkboard menu in Thai, a barista behind the pastry case, the espresso machine letting off steam, a ceiling fan, and a latte with a heart on our table. Now and then a cloud dims the sun, the pigeons take off, a tuk-tuk goes by, a breeze shakes leaves down, the listener stretches, the barista looks up and waves, or the cat wakes. Click the cat, the barista or the pigeons.
- 56 built-in stations in nine categories (lofi, chillhop and jazzy beats, rain and sleep, jazz and café, piano and classical, ambient and focus, city pop and synthwave, game and anime, Thai and Asian), 33 of them 24/7 live radios listed first in each category, each checked to play in an embedded player.
- Category chips and a search box (title, tag or category, in Thai or English) above the list make a station quick to find; the chosen category is remembered.
- Plays on and on: when a video, mix or playlist ends, the next station starts; if a station can't be played it skips ahead (and stops trying after three misses in a row). Previous/next move through a playlist, then on to the neighbouring station; with a category chosen, previous/next and auto-advance stay within it.
- You can also open your own YouTube or YouTube Music link (song, album or playlist).
- "Hide panels" leaves only the clock and the player over the scene. The panels also fade out on their own after a few quiet seconds and come back on any mouse move, key or touch.
- Every scene is lit with a dithered light map, so it falls into night or dusk except where a light reaches: the lamp and moon in the rainy room, the setting sun at the seaside, the cabin windows and lamp post in the snow, the campfire in the forest. Neon signs wash the walls in their own colour.
- Mist, sun rays and dust in the light add depth, and each scene has something close to the viewer (a hanging plant, palm and dune grass, framing pines, string lights) that slides against the scene as the mouse moves.
- Each scene follows the time of day: dawn (5 to 7), day (7 to 17), dusk (17 to 19) and night, from the clock on your device. The sky, the light map and what is lit change with it (by day the rainy room looks out on a grey overcast city with only the odd window lit; at night the moon and the city lights come back), and the scene cross-fades when the hour turns. The sun/moon button holds one time of day instead of following the clock.
- Weather that comes and goes: clear skies, rain, storms with lightning and thunder, fog banks rolling through, and snow. Each scene starts in its own weather (rain in the room, snow at the cabin) and every few minutes something else may blow in; the weather button holds one instead. Scenes join in with what they already have: a storm in the room is a downpour with thunder, at the cabin it is a blizzard, the city's rain is its neon shower and the market's puts the umbrellas up. Rain and wind are added to the ambience, muffled behind the café's glass.
- Ambient sound for each scene, all made in the browser with Web Audio (no sound files): rain on the glass, waves and gulls at the sea, wind round the cabin, a city hum, a crackling campfire with crickets, the market crowd and the sizzle of the grill, a café murmur with cups clinking. It follows the time of day too (birds by day, crickets at night), and what happens in the scene is heard: thunder after the lightning, the cat purring when you pet it, fireworks, the night train, a scooter or tuk-tuk crossing from one speaker to the other, a gust of wind off the sea, the grill flaring when you click it. One button and one volume for all of it.
- Focus timer: 25 minutes focus, 5 minutes rest, with a soft chime. It keeps time in a background tab: the chime is scheduled ahead on the Web Audio clock (browsers slow background timers to once a minute), phases are counted from when each should end so nothing drifts, and the bell button turns on an optional desktop notification.
- Thai and English UI: it starts in your browser's language, and the ไทย/EN button switches without stopping the music. Scene and station names switch too; the Thai shop signs inside the scenes stay Thai.
- Remembers recent links, volumes, the time-of-day choice and your language in the browser.
- Installs as an app ("Install" in Chrome or Edge, "Add to Home Screen" on iOS) and opens offline: the scenes, sound and timer all run in the page, so only the stations need a connection.

The panels are soft frosted glass set in [Thira Sans](https://github.com/thiraphat-ps-dev/thira-sans) (SIL Open Font License, see `fonts/OFL.txt`), so the pixel scene stays the focus. Only the big clock keeps pixel digits.

No build step. Serve the folder with any static server:

```sh
python -m http.server 4321
```

Then open http://localhost:4321/.

## Code layout

Plain ES modules, no build step (so open it through a server, not as a file):

- `app.js`: the player, stations, timer and panels
- `ambience.js`: the scenes' sound, built from noise and oscillators: a bed per scene that changes with the time of day, plus one-shot sounds for things that happen
- `i18n.js`: UI text in Thai and English (`data-i18n` attributes in `index.html` for the fixed text, `t(key)` for the rest)
- `scenes/engine.js`: the canvas, the 12 fps loop, resizing, and `window.LofiScenes` for the app
- `scenes/weather.js`: the shared weather (clear, rain, storm, fog, snow): when it changes, the drops, flakes, fog banks, grey sky and lightning drawn over a scene, and what it adds to the sound
- `scenes/kit.js`: what every scene draws with: pixel helpers, dithered light maps, mist, rays, crisp Thai text and signs, people
- `scenes/animals.js`: the hand-drawn pixel sprites for the sleeping cat and fox, the owl and the rooftop cat
- `scenes/room.js`, `sea.js`, `snow.js`, `city.js`, `camp.js`, `market.js`, `cafe.js`: one scene each, exporting `{ id, name, accent, init, update, draw }`

- `sw.js`: the service worker. Our own files load network first (a deploy shows up on the next visit) with the cache as the offline fallback; Google Fonts are cached once.
- `manifest.webmanifest`, `icons/`, `og.png`: install metadata, the pixel icon, and the link-preview image

A scene reads `tod` from `kit.js` ('dawn', 'day', 'dusk' or 'night') in `init()` and builds that time of day; the engine rebuilds it when the phase changes. For sound, a scene can expose `sound(state)` returning levels for its bed (e.g. `{ rain: 1.4 }` during a downpour) and call `sfx(name)` from `kit.js` when something happens; the names are the keys of `SFX` in `ambience.js`. From the console, `LofiScenes.time('dusk')` holds a time of day and `LofiScenes.time('auto')` goes back to the clock.

For weather, a scene sets `sky: { native, kinds, area?, inline?, react?, strike? }` (see the top of `scenes/weather.js`): `native` is the weather it paints itself, so nothing is drawn over it then and the scene looks as it always has; `area(s)` limits the weather to a window; `react(s, w)` lets the scene drive its own rain or wind from the weather. `LofiScenes.weather('storm')` holds a weather and `LofiScenes.weather('auto')` lets it wander again.

A scene can also answer the pointer with `hot(state, x, y)` (the cursor becomes a hand) and `poke(state, x, y)` (a click or tap). From the console, `LofiScenes.peek()` returns the current scene and its state.

To add a scene, write a module like the others, list it in `SCENES` in `scenes/engine.js`, and add it to `SHELL` in `sw.js` so it works offline.

## Station check

A GitHub Action (`.github/workflows/check-stations.yml`) runs every Monday and asks YouTube's oEmbed endpoint whether each built-in station can still be embedded. If any can't, it opens an issue labelled `stations` (or comments on the open one). Run it locally with:

```sh
node scripts/check-stations.mjs
```

It can't tell when a live radio has ended and become a recording: those still pass.

## Limits

- YouTube Music has no public API for your library, so the room plays built-in stations or links you paste. Personal "mix" links (`list=RD…`) are played as the single song.
- Some videos have embedding turned off by their owner, and a station can stop working if its owner changes that later. The room shows a "Open on YouTube" link for those.
- Browsers block sound until you interact with the page, so press play after loading.
