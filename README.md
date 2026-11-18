# Lofi Room

Full-screen pixel-art scenes for listening to lofi from YouTube.

- Five animated scenes, drawn in code at about 360 px tall and scaled up with crisp pixels. The UI accent follows the scene.
  - Rainy room: city through a wet window, lightning, fairy lights, a sleeping cat.
  - Seaside sunset: lighthouse beam, sailboat, sun glitter on the water, surf, a crab and a swaying palm.
  - Snowy cabin: aurora over lit mountain ridges, chimney smoke, a lamp post, a hare that hops by.
  - Neon city: flickering signs, an equaliser billboard, a night train, the skyline mirrored in the water, a cat on the rooftop.
  - Forest campfire: the Milky Way, a tent, live flames and sparks, a sleeping fox, an owl and fireflies.
- 21 built-in stations in five groups (lofi, rain and sleep, jazz and cafe, piano and focus, others), each checked to play in an embedded player.
- You can also open your own YouTube or YouTube Music link (song, album or playlist).
- "Hide panels" leaves only the clock and the player over the scene. The panels also fade out on their own after a few quiet seconds and come back on any mouse move, key or touch.
- The rainy room is lit with a dithered light map: lamp and moon shafts with drifting dust, a candle, and a hanging plant in the foreground. The city behind the glass shifts slightly with the mouse.
- Rain ambience generated in the browser (Web Audio), with its own volume.
- Focus timer: 25 minutes focus, 5 minutes rest, with a soft chime.
- Remembers recent links and volumes in the browser.

No build step. Serve the folder with any static server:

```sh
python -m http.server 4321
```

Then open http://localhost:4321/.

## Limits

- YouTube Music has no public API for your library, so the room plays built-in stations or links you paste. Personal "mix" links (`list=RD…`) are played as the single song.
- Some videos have embedding turned off by their owner, and a station can stop working if its owner changes that later. The room shows a "Open on YouTube" link for those.
- Browsers block sound until you interact with the page, so press play after loading.
