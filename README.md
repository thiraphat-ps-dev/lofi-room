# Lofi Room

Full-screen pixel-art scenes for listening to lofi from YouTube.

- Five animated scenes: rainy room (lightning, fairy lights, curtains), seaside sunset (sailboat, crab), snowy cabin (aurora, shooting stars), neon city (searchlights, blimp, night train) and a forest campfire (fireflies). The UI accent follows the scene.
- 21 built-in stations in five groups (lofi, rain and sleep, jazz and cafe, piano and focus, others), each checked to play in an embedded player.
- You can also open your own YouTube or YouTube Music link (song, album or playlist).
- "Hide panels" leaves only the clock and the player over the scene.
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
