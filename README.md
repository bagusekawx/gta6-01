[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/bagusekawx/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/bagusekawx/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar Bay — an open-world crime game

Jax Rourke came to Solmar Bay with nothing but a fast pair of hands. Six
jobs stand between him and the big score. A complete 3D open world in
desktop Chrome, built with three.js (vendored) and zero network requests.

**The city:** a sun-soaked coastal grid — driveable streets, traffic,
pedestrians, a beach and boardwalk pier, and named landmarks (Sal's Garage,
the Coral Hotel, Meridian Bank, the Docks, Solmar PD).

**The systems:**
- Explore on foot and by car; steal any car on the street (E)
- Traffic that drives the grid and pedestrians who flee from trouble
- A 5-star wanted level — police cars chase and ram, foot cops pursue and shoot
- 6 story missions with briefings, objectives, beacons and cash rewards
- Pistol combat with reload, enemies, and a drive-by-free world of trouble
- HUD with minimap, health, cash, stars, speed and mission objective
- Start screen, pause menu, localStorage save (auto + manual), synthesized WebAudio sound

**Play:** `node serve.ts`, then open http://localhost:8080. WASD to move and
drive, mouse to look, E to enter a car, click to shoot, R to reload, Shift
to sprint, Space to jump / handbrake, Esc to pause, M to mute.

**Hand in:** `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`
