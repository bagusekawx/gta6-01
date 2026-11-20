// The story: six missions that take Jax from a nobody driver to the crew's
// wheelman. Each mission is data — a list of steps the state machine walks
// through — with a briefing, an objective line, and a cash reward. A
// beacon marks the current objective in the world and on the minimap.
import * as THREE from 'three';
import { LANDMARKS, rand } from './config.js';

export const MISSIONS = [
  {
    id: 'first-wheels', name: 'First Wheels', reward: 250,
    start: LANDMARKS.garage, startText: "Sal needs a driver. Steal a car and bring it to the garage.",
    briefing: "SAL: 'Kid, I need wheels and I need them now. Grab any car on the street and bring it here. Don't let the cops see you take it.'",
    done: "SAL: 'Not bad. You're hired. There's more work where that came from.'",
    steps: [
      { type: 'enterCar', text: 'Steal a car — press E next to one' },
      { type: 'goto', pos: LANDMARKS.garage, text: 'Drive it to Sal\'s Garage', needCar: true },
    ],
  },
  {
    id: 'the-drop', name: 'The Drop', reward: 400,
    start: LANDMARKS.garage, startText: 'A package is waiting at the docks. Pick it up, deliver it to the Coral Hotel.',
    briefing: "SAL: 'Package at the docks, Pier 9. Take it to the Coral Hotel — and don't open it.'",
    done: "SAL: 'Clean delivery. The hotel people are happy. You're moving up.'",
    steps: [
      { type: 'goto', pos: LANDMARKS.docks, text: 'Pick up the package at the Docks' },
      { type: 'goto', pos: LANDMARKS.hotel, text: 'Deliver the package to the Coral Hotel' },
    ],
  },
  {
    id: 'heat', name: 'Heat on the Street', reward: 300,
    start: LANDMARKS.garage, startText: 'The cops are onto you. Lose the heat.',
    briefing: "SAL: 'Somebody talked. PD has your name — lose them before you come back here.'",
    done: "SAL: 'Ghosted them clean. Nice driving.'",
    steps: [
      { type: 'wanted', stars: 2, text: 'You are wanted — 2 stars' },
      { type: 'escape', text: 'Lose the cops — stay out of sight until the stars clear' },
    ],
  },
  {
    id: 'dockyard', name: 'Dockyard Debt', reward: 800,
    start: LANDMARKS.docks, startText: 'The Vipers took the docks. Take them back.',
    briefing: "SAL: 'The Vipers muscled in on our dock. Go down there, clear them out, and bring me the cash they owe us.'",
    done: "SAL: 'The docks are ours again. The crew respects that.'",
    steps: [
      { type: 'kill', count: 4, area: LANDMARKS.docks, text: 'Clear the Vipers from the Docks (0/4)' },
      { type: 'goto', pos: LANDMARKS.docks, text: 'Collect the cash' },
      { type: 'goto', pos: LANDMARKS.garage, text: 'Bring the cash to Sal\'s Garage' },
    ],
  },
  {
    id: 'getaway', name: 'Getaway', reward: 1000,
    start: LANDMARKS.hotel, startText: 'Marco is at the hotel and the cops are coming. Get him to the safehouse.',
    briefing: "MARCO: 'Jax! Get me out of here — PD is all over the hotel. Safehouse, fast, and don't stop for anything!'",
    done: "MARCO: 'You drive like the devil himself. I owe you one.'",
    steps: [
      { type: 'enterCar', text: 'Get a car — fast' },
      { type: 'wanted', stars: 3, text: '3 stars — the whole city is after you' },
      { type: 'goto', pos: LANDMARKS.safehouse, text: 'Drive Marco to the Safehouse', needCar: true, timeLimit: 150 },
    ],
  },
  {
    id: 'big-score', name: 'The Big Score', reward: 2500,
    start: LANDMARKS.bank, startText: 'The Meridian Bank job. This is the one.',
    briefing: "SAL: 'Meridian Bank, midday, in and out. Grab the loot, then vanish. This sets us up for good.'",
    done: "SAL: 'We did it, kid. Solmar Bay is ours now.'",
    steps: [
      { type: 'goto', pos: LANDMARKS.bank, text: 'Reach the Meridian Bank' },
      { type: 'wait', seconds: 6, pos: LANDMARKS.bank, text: 'Grabbing the loot…' },
      { type: 'wanted', stars: 4, text: '4 stars — every cop in the city' },
      { type: 'goto', pos: LANDMARKS.safehouse, text: 'Escape to the Safehouse with the loot' },
    ],
  },
];

// Landmarks are buildings: objectives live at the doorstep, 18 units
// south of the center, where the player can actually stand. The center
// itself is inside the building's collider and unreachable.
function approachPoint(pos) {
  return { x: pos.x, z: pos.z + 18 };
}

function buildEnemyMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xb03030 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc28a5a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.34), shirt);
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), skin);
  head.position.y = 1.68;
  g.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.2, 0.4);
  g.add(gun);
  return g;
}

export class Missions {
  constructor(scene, city, effects, audio) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.audio = audio;
    this.index = 0;           // next mission to start
    this.active = null;       // {def, step, ...}
    this.enemies = [];
    this.startCooldown = 0;   // seconds before the next beacon can trigger
    this.marker = this.buildMarker();
    this.marker.visible = false;
    scene.add(this.marker);
    this.startBeacon = this.buildMarker(0x4aff88);
    this.startBeacon.visible = false;
    scene.add(this.startBeacon);
    this.onMissionStart = null;
    this.onMissionComplete = null;
    this.onMissionFailed = null;
  }

  buildMarker(color = 0xffd94a) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 20;
    g.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.6, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    g.add(ring);
    return g;
  }

  get nextDef() { return MISSIONS[this.index] || null; }
  get done() { return this.index >= MISSIONS.length; }

  showStartBeacon() {
    const def = this.nextDef;
    if (!def || this.active) { this.startBeacon.visible = false; return; }
    this.startBeacon.visible = true;
    const ap = approachPoint(def.start);
    this.startBeacon.position.set(ap.x, 0, ap.z);
  }

  startMission(def, world) {
    this.active = { def, step: 0, timer: 0, killed: 0, waitLeft: 0 };
    this.startBeacon.visible = false;
    this.onMissionStart?.(def);
    this.enterStep(world);
  }

  enterStep(world) {
    const m = this.active;
    const step = m.def.steps[m.step];
    if (!step) { this.completeMission(world); return; }
    m.timer = 0;
    m.target = null;
    if (step.type === 'kill') {
      this.spawnEnemies(step.area, step.count);
      this.marker.visible = true;
      const ap = approachPoint(step.area);
      this.marker.position.set(ap.x, 0, ap.z);
    } else if (step.pos) {
      this.marker.visible = true;
      m.target = approachPoint(step.pos);
      this.marker.position.set(m.target.x, 0, m.target.z);
    } else {
      this.marker.visible = false;
    }
    if (step.type === 'wanted') world.police.setStars(step.stars);
    if (step.type === 'wait') m.waitLeft = step.seconds;
  }

  spawnEnemies(area, count) {
    for (let i = 0; i < count; i++) {
      const mesh = buildEnemyMesh();
      // Ring around the area: on the streets and sidewalks, not inside
      // the landmark building itself.
      const a = rand(0, Math.PI * 2);
      const r = rand(20, 28);
      const x = area.x + Math.cos(a) * r;
      const z = area.z + Math.sin(a) * r;
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const enemy = { mesh, health: 100, shootCooldown: rand(0.5, 2), state: 'alive' };
      mesh.userData.kind = 'enemy';
      mesh.userData.ref = enemy;
      this.enemies.push(enemy);
    }
  }

  damageEnemy(enemy, amount, point) {
    if (enemy.state !== 'alive') return;
    enemy.health -= amount;
    this.effects.burst(point, 0xcc2222, 6, 4, 0.5);
    if (enemy.health <= 0) {
      enemy.state = 'dead';
      enemy.mesh.rotation.x = Math.PI / 2;
      enemy.mesh.position.y = 0.3;
      this.active.killed++;
      this.audio.pickup();
    }
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  objectiveText() {
    if (!this.active) {
      const def = this.nextDef;
      return def ? `Next: ${def.name} — go to the green marker` : 'Story complete — free roam Solmar Bay!';
    }
    const step = this.active.def.steps[this.active.step];
    if (!step) return '';
    if (step.type === 'kill') return `Clear the Vipers from the Docks (${this.active.killed}/${step.count})`;
    if (step.type === 'goto' && step.timeLimit) {
      const left = Math.max(0, Math.ceil(step.timeLimit - this.active.timer));
      return `${step.text} — ${left}s left`;
    }
    return step.text;
  }

  update(dt, world) {
    const player = world.player;
    const pos = player.position;
    // Start the next mission by walking into its green beacon.
    if (!this.active) {
      this.showStartBeacon();
      this.startCooldown = Math.max(0, this.startCooldown - dt);
      const def = this.nextDef;
      if (def && this.startCooldown <= 0) {
        const ap = approachPoint(def.start);
        if (Math.hypot(pos.x - ap.x, pos.z - ap.z) < 5) {
          this.startMission(def, world);
        }
      }
      return;
    }
    const m = this.active;
    const step = m.def.steps[m.step];
    m.timer += dt;
    // Enemy AI: face the player and shoot when close.
    for (const e of this.enemies) {
      if (e.state !== 'alive') continue;
      const d = Math.hypot(e.mesh.position.x - pos.x, e.mesh.position.z - pos.z);
      e.mesh.lookAt(pos.x, 0, pos.z);
      if (d < 45) {
        e.shootCooldown -= dt;
        if (e.shootCooldown <= 0) {
          e.shootCooldown = rand(1.0, 1.8);
          this.effects.muzzleFlash(e.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
          this.audio.shot();
          if (Math.random() < 0.35) player.takeDamage(8, world);
        }
      }
    }
    let advance = false;
    if (step.type === 'goto') {
      if (m.target && Math.hypot(pos.x - m.target.x, pos.z - m.target.z) < 6) {
        if (!step.needCar || !player.onFoot) advance = true;
      }
      if (step.timeLimit && m.timer > step.timeLimit) return this.failMission(world, 'Out of time');
    } else if (step.type === 'enterCar') {
      if (!player.onFoot) advance = true;
    } else if (step.type === 'kill') {
      if (m.killed >= step.count) advance = true;
    } else if (step.type === 'escape') {
      if (world.police.stars === 0) advance = true;
    } else if (step.type === 'wait') {
      m.waitLeft -= dt;
      if (m.waitLeft <= 0) advance = true;
    } else if (step.type === 'wanted') {
      advance = true;
    }
    if (advance) {
      m.step++;
      this.audio.blip();
      this.enterStep(world);
    }
    // Pulse the beacon.
    const s = 1 + Math.sin(performance.now() / 300) * 0.08;
    this.marker.scale.set(s, 1, s);
    this.startBeacon.scale.set(s, 1, s);
  }

  completeMission(world) {
    const def = this.active.def;
    this.active = null;
    this.clearEnemies();
    this.marker.visible = false;
    this.index++;
    this.startCooldown = 3;
    world.money += def.reward;
    this.audio.jingle();
    this.onMissionComplete?.(def);
    world.save();
  }

  failMission(world, reason) {
    this.active = null;
    this.clearEnemies();
    this.marker.visible = false;
    this.audio.fail();
    this.onMissionFailed?.(reason);
  }
}
