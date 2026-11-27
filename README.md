# Skyline Ridge

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/muradpipit/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/muradpipit/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A bush-plane flight game for the make.fun bounty
[Make the best flight game](https://make.fun/c/best-flight-game-20261126-0057).

## The game

Fly the Kestrel, a red bush prop-plane, out of a canyon valley airfield.
Mission 1 is a ring run: thread all eight glowing gates strung through the
valley, over the lake and back. Mission 2 is the trip home: land on Runway 36
before the fuel runs out — a landing refuels the tanks, a hard impact or a
ditch in the lake ends the sortie.

- **Chase view** over procedural terrain: ridges, forest and dry-grass
  patches, a lake, clouds and a runway you can land on.
- **The aircraft in frame**, with a spinning prop, lit instruments and a full
  HUD: compass tape, artificial horizon, altitude, vertical speed, airspeed,
  throttle, fuel, score, rings and a timer.
- **Real flight feel**: throttle, lift-off, banked turns, stalls, fuel
  management and landings that read as landings.
- **Controls**: arrow keys pitch and bank, W/S throttle, the mouse steers
  like a stick, the wheel trims throttle, P pauses, R restarts, M mutes.
- **Sound**: a synthesised engine drone, wind and ring chimes, built with
  WebAudio — no audio files.

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome. It loads nothing from the network: every script, style and sound is
a file under `game/` or synthesised at run time. `node serve.ts` serves it
locally on http://localhost:8080 for play-testing.

## Files

- `game/` — the game: `index.html`, `css/style.css`, and `js/` split by job
  (`noise.js` terrain, `vec3.js` camera math, `terrain.js` world rendering,
  `plane.js` the Kestrel, `rings.js` the course, `flight.js` the flight
  model, `hud.js` instruments and screens, `audio.js` synth sound,
  `input.js` keyboard and mouse, `shots.js` screenshot staging,
  `main.js` bootstrap and game loop).
- `screenshots/` — four renders of the game itself, taken in headless
  Chromium: the ring run, a banking turn, final approach and a completed
  sortie.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` with the vendored make.fun
  library (`vendor/makefun-game.ts`).

## License

MIT — see `LICENSE`.
