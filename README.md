# Lofi Room

Full-screen pixel-art scenes for listening to lofi from YouTube.

- Four animated scenes: rainy room, seaside sunset, snowy cabin and neon city. The UI accent follows the scene.
- Ten built-in stations (lofi, rain, jazz, bossa nova, synthwave, ambient), each checked to play in an embedded player.
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
