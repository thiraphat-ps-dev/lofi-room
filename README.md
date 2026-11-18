# Lofi Room

Full-screen pixel-art scenes for listening to lofi from YouTube.

- Six animated scenes, drawn in code at about 360 px tall and scaled up with crisp pixels. The UI accent follows the scene.
  - Rainy room: city through a wet window, lightning, fairy lights, a sleeping cat.
  - Seaside sunset: lighthouse beam, sailboat, sun glitter on the water, surf, a crab and a swaying palm.
  - Snowy cabin: aurora over lit mountain ridges, chimney smoke, a lamp post, a hare that hops by.
  - Neon city: flickering signs, an equaliser billboard, a night train, the skyline mirrored in the water, a cat on the rooftop.
  - Forest campfire: the Milky Way, a tent, live flames and sparks, a sleeping fox, an owl and fireflies.
  - Thai night market: shophouses with Thai shop signs and laundry on the balconies, tangled power lines and fair lights, stalls for noodles, moo ping, Thai tea, fruit and roti, shoppers wandering past, a sleeping soi dog, and a bowl of noodles on our table.
- 40 built-in stations in five groups (lofi, rain and sleep, jazz and cafe, piano and focus, others), 23 of them 24/7 live radios, each checked to play in an embedded player.
- Plays on and on: when a video, mix or playlist ends, the next station starts; if a station can't be played it skips ahead (and stops trying after three misses in a row). Previous/next move through a playlist, then on to the neighbouring station.
- You can also open your own YouTube or YouTube Music link (song, album or playlist).
- "Hide panels" leaves only the clock and the player over the scene. The panels also fade out on their own after a few quiet seconds and come back on any mouse move, key or touch.
- Every scene is lit with a dithered light map, so it falls into night or dusk except where a light reaches: the lamp and moon in the rainy room, the setting sun at the seaside, the cabin windows and lamp post in the snow, the campfire in the forest. Neon signs wash the walls in their own colour.
- Mist, sun rays and dust in the light add depth, and each scene has something close to the viewer (a hanging plant, palm and dune grass, framing pines, string lights) that slides against the scene as the mouse moves.
- Rain ambience generated in the browser (Web Audio), with its own volume.
- Focus timer: 25 minutes focus, 5 minutes rest, with a soft chime.
- Remembers recent links and volumes in the browser.

The panels are soft frosted glass set in [Thira Sans](https://github.com/thiraphat-ps-dev/thira-sans) (SIL Open Font License, see `fonts/OFL.txt`), so the pixel scene stays the focus. Only the big clock keeps pixel digits.

No build step. Serve the folder with any static server:

```sh
python -m http.server 4321
```

Then open http://localhost:4321/.

## Limits

- YouTube Music has no public API for your library, so the room plays built-in stations or links you paste. Personal "mix" links (`list=RD…`) are played as the single song.
- Some videos have embedding turned off by their owner, and a station can stop working if its owner changes that later. The room shows a "Open on YouTube" link for those.
- Browsers block sound until you interact with the page, so press play after loading.
