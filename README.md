# World Cup 2026 — Stadium Globe

A Three.js dashboard for following all 104 matches: an interactive globe with a
3D stadium at each of the 16 host venues. Click a beacon (or a match in the
schedule) to fly down to the stadium, see who plays there next, and get the
live game-day weather forecast — animated in 3D over the stadium.

Each venue is a stylised model of the real building (seat colours, roof type,
and signatures like Akron's grass berm, Atlanta's pinwheel roof, SoFi's
translucent canopy, BC Place's masts, AT&T's arches), with a photo of the real
stadium in the venue panel. Zoomed in, a little match plays on the pitch in the
upcoming fixture's kit colours while the crowd does the wave — and erupts when
someone scores.

## Run it

```sh
cd "world cup"
python3 serve.py        # -> http://127.0.0.1:8642
```

`serve.py` is a static server plus a same-origin `/api/feed` proxy for the
live fixture feed (the feed sends no CORS header, so the browser can't read it
directly) — that's what keeps scores updating in real time.

Any plain static server works too (e.g. `python3 -m http.server 8000`); it just
needs HTTP so the JSON can load. Without `serve.py` the page falls back to
public CORS proxies for live scores, which are less reliable.

## Data sources

- **Schedule / results** — [fixturedownload.com](https://fixturedownload.com)
  feed. Bundled at `data/matches.json` as the offline fallback / initial paint
  (`./update-schedule.sh` refreshes it), and **polled live every 60 s** in the
  browser — through `serve.py`'s `/api/feed` proxy, or public CORS proxies on
  plain static hosting — so scores and standings update during match days. An
  approximate live match clock is derived from kickoff time.
- **Weather** — [Open-Meteo](https://open-meteo.com) hourly forecast, fetched
  live for each stadium's coordinates at the kickoff hour (venue-local time)
  and re-fetched every 10 minutes while you watch. Forecasts reach ~16 days
  out; matches further away show when the forecast window opens.
- **Ground imagery** — when you fly to a stadium, a high-res
  [Esri World Imagery](https://www.esri.com) satellite patch is draped on the
  globe around the venue (~18× sharper than the base Blue Marble texture).

Note: per-event data (cards, scorers, lineups) isn't available from any
key-free public API — wiring that up would need e.g. a free
football-data.org API key.

## Controls

- Drag to spin the globe, scroll to zoom.
- Click a glowing beacon (or any match in the left panel) to fly to that stadium.
- In stadium view the camera slowly orbits; drag/scroll to look around.
- **← Back to globe** returns to orbit view.
