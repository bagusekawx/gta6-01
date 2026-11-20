// Solmar Bay — bootstrap and game loop. Builds the world, wires the
// systems together, and runs the frame loop. Modes: title, playing,
// paused, wasted, busted, story. ?shot=<name> jumps straight into a
// gameplay state for screenshots (see shots.js).
import * as THREE from 'three';
import { WORLD, PALETTE, LANDMARKS } from './config.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Effects } from './effects.js';
import { City } from './city.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions, MISSIONS } from './missions.js';
import { HUD } from './hud.js';
import { applyShot, postSim } from './shots.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.sky, 200, 460);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
camera.position.set(-60, 40, 120);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sun, 1.7);
sun.position.set(140, 220, 80);
scene.add(sun);

const input = new Input(canvas);
const audio = new AudioEngine();
const effects = new Effects(scene);
const city = new City(scene);
const traffic = new Traffic(scene, city);
const pedestrians = new Pedestrians(scene, city);
const player = new Player(scene, city, effects, audio);
const police = new Police(scene, city, effects, audio);
const missions = new Missions(scene, city, effects, audio);
const hud = new HUD();

const world = {
  scene, camera, renderer, input, audio, effects, city, traffic,
  pedestrians, player, police, missions, hud,
  mode: 'title', money: 50, storyShown: false,
  save() {
    const p = player.position;
    saveGame({
      money: this.money, missionIndex: missions.index,
      x: p.x, z: p.z, health: player.health,
    });
  },
  onWasted() {
    if (this.mode !== 'playing') return;
    this.mode = 'wasted';
    police.reset();
    if (missions.active) missions.failMission(this, 'You got wasted');
    hud.showScreen('wasted');
    audio.setEngine(0, false);
    audio.fail();
  },
  onBusted() {
    if (this.mode !== 'playing') return;
    this.mode = 'busted';
    police.reset();
    if (missions.active) missions.failMission(this, 'Busted by the cops');
    hud.showScreen('busted');
    audio.setEngine(0, false);
    audio.fail();
  },
};

police.onStarUp = (stars) => hud.toast(`WANTED — ${stars} star${stars > 1 ? 's' : ''}`, 2000);
police.onStarDown = (stars) => hud.toast(stars === 0 ? 'You lost them. Heat is off.' : `Heat dropping — ${stars} star${stars > 1 ? 's' : ''}`, 2000);
missions.onMissionStart = (def) => { hud.showBriefing(def); hud.toast(def.name, 2000); };
missions.onMissionComplete = (def) => {
  hud.toast(`MISSION PASSED — ${def.name}  +$${def.reward}`, 3500);
  if (missions.done && !world.storyShown) {
    world.storyShown = true;
    setTimeout(() => { world.mode = 'story'; hud.showScreen('story'); }, 3800);
  }
};
missions.onMissionFailed = (reason) => hud.toast(`MISSION FAILED — ${reason}`, 3000);

function startPlaying(fresh) {
  if (fresh) {
    clearSave();
    world.money = 50;
    missions.index = 0;
    missions.active = null;
    player.spawn(-30, -70);
  }
  world.mode = 'playing';
  hud.showScreen('none');
  audio.ensure();
  audio.startMusic();
  hud.toast(fresh ? 'Welcome to Solmar Bay' : 'Back in Solmar Bay', 2000);
}

function respawnAt(place) {
  player.spawn(place.x, place.z + 10);
  player.health = 100;
  world.money = Math.floor(world.money * 0.9);
  world.mode = 'playing';
  hud.showScreen('none');
  hud.toast('You lost 10% of your cash', 2500);
}

document.getElementById('btn-new').addEventListener('click', () => startPlaying(true));
document.getElementById('btn-continue').addEventListener('click', () => {
  const s = loadGame();
  startPlaying(false);
  if (s) {
    world.money = s.money ?? 50;
    missions.index = s.missionIndex ?? 0;
    player.spawn(s.x ?? -30, s.z ?? -70);
    player.health = s.health ?? 100;
  }
});
document.getElementById('btn-resume').addEventListener('click', () => {
  world.mode = 'playing';
  hud.showScreen('none');
});
document.getElementById('btn-save').addEventListener('click', () => {
  world.save();
  hud.toast('Game saved', 1500);
});
document.getElementById('btn-restart').addEventListener('click', () => startPlaying(true));
document.getElementById('btn-title').addEventListener('click', () => {
  world.mode = 'title';
  hud.showScreen('title');
});
document.getElementById('btn-wasted').addEventListener('click', () => respawnAt(LANDMARKS.hospital));
document.getElementById('btn-busted').addEventListener('click', () => respawnAt(LANDMARKS.policeHQ));
document.getElementById('btn-story').addEventListener('click', () => {
  world.mode = 'playing';
  hud.showScreen('none');
});

// First gesture unlocks audio.
const unlock = () => { audio.ensure(); audio.startMusic(); };
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

// Title screen: show Continue only when a save exists.
if (hasSave()) {
  hud.el.btnContinue.style.display = 'block';
  const s = loadGame();
  if (s) hud.el.saveNote.textContent = `Save found: $${Math.floor(s.money ?? 0)} — mission ${(s.missionIndex ?? 0) + 1} of 6`;
}
hud.showScreen('title');

// Screenshot mode: skip the title screen and stage the shot.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot && shot !== 'start') {
  world.mode = 'playing';
  hud.showScreen('none');
  hud.hintUntil = 0;
  applyShot(world, shot);
  // Fast-forward the live simulation (?sim=seconds) so the staged scene
  // has developed by the first rendered frame — headless captures take
  // their screenshot before much real game time has passed.
  const simSeconds = Number(params.get('sim') || 0);
  if (simSeconds > 0) {
    const step = 1 / 30;
    for (let t = 0; t < simSeconds; t += step) {
      player.update(step, input, world);
      traffic.update(step, player.vehicle);
      pedestrians.update(step);
      police.update(step, world);
      missions.update(step, world);
      effects.update(step);
    }
    postSim(world, shot);
    hud.update(world);
  }
}

// ?autotest=1: scripted end-to-end check of the mission flow, using the
// game's own systems. Results land in document.title for headless reads.
if (params.get('autotest') === '1') {
  const results = [];
  const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  const stepWorld = (seconds) => {
    const step = 1 / 30;
    for (let t = 0; t < seconds; t += step) {
      player.update(step, input, world);
      traffic.update(step, player.vehicle);
      pedestrians.update(step);
      police.update(step, world);
      missions.update(step, world);
      effects.update(step);
    }
  };
  world.mode = 'playing';
  hud.showScreen('none');
  // 1. Walk into the mission-1 start beacon at the garage doorstep.
  player.spawn(0, -42);
  stepWorld(1);
  check('mission 1 starts at garage doorstep', missions.active?.def.id === 'first-wheels' && missions.active.step === 0);
  // 2. Steal a car next to the player — one tick is enough for the
  // enterCar step to advance (the goto would complete on later ticks).
  const testCar = traffic.parked[0];
  testCar.mesh.position.set(2, 0, -42);
  testCar.heading = 0;
  player.enterVehicle(testCar, world);
  stepWorld(1 / 30);
  check('enterCar step advances', missions.active?.step === 1);
  // 3. Drive back to the garage doorstep.
  testCar.mesh.position.set(0, 0, -42);
  testCar.speed = 0;
  stepWorld(1);
  check('mission 1 completes at garage', missions.index === 1 && !missions.active);
  check('reward paid', world.money >= 250);
  // 3b. The next mission's beacon triggers after the cooldown.
  stepWorld(4);
  check('mission 2 chains from the same beacon', missions.active?.def.id === 'the-drop');
  // 4. Kill-step enemies spawn outside the docks building.
  missions.index = 3;
  player.spawn(158, 40);
  missions.startMission(MISSIONS[3], world);
  const outside = missions.enemies.every((e) => {
    const dx = Math.abs(e.mesh.position.x - 180), dz = Math.abs(e.mesh.position.z - 60);
    return dx > 16 || dz > 14;
  });
  check('dock enemies outside building', missions.enemies.length === 4 && outside);
  // 5. Wanted level spawns pursuing police cars.
  police.setStars(3);
  stepWorld(2);
  check('police cars spawn at 3 stars', police.cars.length >= 3);
  document.title = 'AUTOTEST ' + results.join(' | ');
  const div = document.createElement('div');
  div.id = 'autotest';
  div.textContent = results.join('\n');
  document.body.appendChild(div);
}

// Error overlay: visible only when something actually breaks.
window.addEventListener('error', (e) => {
  const el = document.getElementById('err');
  el.textContent = 'Error: ' + (e.message || 'unknown');
  el.style.display = 'block';
});
window.addEventListener('unhandledrejection', (e) => {
  const el = document.getElementById('err');
  el.textContent = 'Error: ' + (e.reason?.message || e.reason || 'unknown');
  el.style.display = 'block';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let orbitAngle = 0.6;
let autoSaveTimer = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (world.mode === 'playing') {
    if (input.pressed('Escape')) {
      world.mode = 'paused';
      hud.showScreen('pause');
      audio.setEngine(0, false);
    }
    if (input.pressed('KeyM')) audio.setMuted(!audio.muted);
    player.update(dt, input, world);
    traffic.update(dt, player.vehicle);
    pedestrians.update(dt);
    police.update(dt, world);
    missions.update(dt, world);
    effects.update(dt);
    autoSaveTimer += dt;
    if (autoSaveTimer > 60) { autoSaveTimer = 0; world.save(); }
  } else if (world.mode === 'paused') {
    if (input.pressed('Escape')) {
      world.mode = 'playing';
      hud.showScreen('none');
    }
  } else if (world.mode === 'title') {
    orbitAngle += dt * 0.03;
    camera.position.set(Math.cos(orbitAngle) * 150, 70, Math.sin(orbitAngle) * 150);
    camera.lookAt(0, 0, 0);
    traffic.update(dt, null);
    pedestrians.update(dt);
    effects.update(dt);
  }
  hud.update(world);
  renderer.render(scene, camera);
  input.endFrame();
}
frame();
