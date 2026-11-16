# Lofi Room

A pixel-art rainy room for listening to music from YouTube and YouTube Music.

- Paste a YouTube or YouTube Music link (song, album or playlist) and it plays through the official YouTube embedded player.
- Rain ambience generated in the browser (Web Audio), with its own volume.
- Focus timer: 25 minutes focus, 5 minutes rest, with a soft chime.
- Remembers recent links and volumes in the browser.

No build step. Serve the folder with any static server:

```sh
python -m http.server 4321
```

Then open http://localhost:4321/.

## Limits

- YouTube Music has no public API for your library, so the room plays links you paste. Personal "mix" links (`list=RD…`) are played as the single song.
- Some videos have embedding turned off by their owner. The room shows a "Open on YouTube" link for those.
- Browsers block sound until you interact with the page, so press play after loading.
