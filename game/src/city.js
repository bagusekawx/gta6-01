// Solmar Bay: a sun-soaked coastal grid city built from boxes, canvas
// facades and palms. Everything is generated in code — no model or image
// files. The module also owns collision boxes and road queries the other
// systems (traffic, police, missions, minimap) share.
import * as THREE from 'three';
import { WORLD, PALETTE, LANDMARKS, rand, randInt, pick } from './config.js';

function facadeTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let y = 14; y < 244; y += 26) {
    for (let x = 10; x < 118; x += 24) {
      g.fillStyle = Math.random() < lit ? '#ffe9a8' : '#2a3542';
      g.fillRect(x, y, 16, 16);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text, bg = '#1a2a3a', fg = '#ffd94a') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = fg;
  g.font = 'bold 44px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // {minX,maxX,minZ,maxZ}
    this.facades = PALETTE.building.map((col) => facadeTexture('#' + col.toString(16).padStart(6, '0'), 0.25));
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildCoast();
    this.buildPalms();
    this.buildLights();
  }

  addCollider(x, z, w, d) {
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  // Circle vs building boxes: returns a corrected position for a circle
  // of radius r that would otherwise overlap a building.
  resolveCollision(pos, r) {
    for (const b of this.colliders) {
      const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - nx, dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * r;
          pos.z = nz + (dz / d) * r;
        } else {
          pos.x = b.maxX + r;
        }
      }
    }
    pos.x = Math.max(-WORLD.HALF + 4, Math.min(WORLD.OCEAN_X - 4, pos.x));
    pos.z = Math.max(-WORLD.HALF + 4, Math.min(WORLD.HALF - 4, pos.z));
    return pos;
  }

  isOnRoad(x, z) {
    for (const r of WORLD.ROADS) {
      if (Math.abs(x - r) < WORLD.ROAD_WIDTH / 2 + 1) return true;
      if (Math.abs(z - r) < WORLD.ROAD_WIDTH / 2 + 1) return true;
    }
    return false;
  }

  nearestRoad(x, z) {
    let best = WORLD.ROADS[0], bd = Infinity;
    for (const r of WORLD.ROADS) {
      const d = Math.min(Math.abs(x - r), Math.abs(z - r));
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  randomRoadPoint() {
    const r = pick(WORLD.ROADS);
    const along = rand(-210, 210);
    return Math.random() < 0.5 ? { x: r, z: along } : { x: along, z: r };
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.SIZE, WORLD.SIZE),
      new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, 0);
    this.scene.add(ground);
  }

  buildRoads() {
    const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
    const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f0d8 });
    const dashGeo = new THREE.PlaneGeometry(3, 0.7);
    for (const r of WORLD.ROADS) {
      for (const horizontal of [true, false]) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.SIZE, WORLD.ROAD_WIDTH), roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.set(horizontal ? 0 : r, 0, horizontal ? r : 0);
        if (!horizontal) road.rotation.z = Math.PI / 2;
        this.scene.add(road);
        for (const side of [-1, 1]) {
          const walk = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.SIZE, 3), walkMat);
          walk.rotation.x = -Math.PI / 2;
          walk.position.set(
            horizontal ? 0 : r + side * (WORLD.ROAD_WIDTH / 2 + 1.5),
            0.02,
            horizontal ? r + side * (WORLD.ROAD_WIDTH / 2 + 1.5) : 0,
          );
          if (!horizontal) walk.rotation.z = Math.PI / 2;
          this.scene.add(walk);
        }
        for (let a = -225; a <= 225; a += 12) {
          const dash = new THREE.Mesh(dashGeo, dashMat);
          dash.rotation.x = -Math.PI / 2;
          if (!horizontal) dash.rotation.z = Math.PI / 2;
          dash.position.set(horizontal ? a : r, 0.03, horizontal ? r : a);
          this.scene.add(dash);
        }
      }
    }
  }

  building(x, z, w, d, h, label = null) {
    const tex = pick(this.facades);
    const side = new THREE.MeshLambertMaterial({ map: tex });
    const roof = new THREE.MeshLambertMaterial({ color: pick(PALETTE.roof) });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, side, side]);
    m.position.set(x, h / 2, z);
    this.scene.add(m);
    this.addCollider(x, z, w, d);
    if (label) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w * 0.9, 18), 3),
        new THREE.MeshBasicMaterial({ map: signTexture(label) }),
      );
      sign.position.set(x, Math.min(h - 2, 10), z + d / 2 + 0.15);
      this.scene.add(sign);
    }
    return m;
  }

  buildBlocks() {
    const landmarkAt = {};
    for (const [key, lm] of Object.entries(LANDMARKS)) landmarkAt[`${lm.x},${lm.z}`] = lm.label;
    for (let bx = 0; bx < WORLD.ROADS.length - 1; bx++) {
      for (let bz = 0; bz < WORLD.ROADS.length - 1; bz++) {
        const cx = (WORLD.ROADS[bx] + WORLD.ROADS[bx + 1]) / 2;
        const cz = (WORLD.ROADS[bz] + WORLD.ROADS[bz + 1]) / 2;
        const key = `${cx},${cz}`;
        const label = landmarkAt[key];
        const roll = Math.random();
        if (label) {
          this.building(cx, cz, 30, 26, label === 'MERIDIAN BANK' ? 26 : 16, label);
          continue;
        }
        if (roll < 0.14) { this.park(cx, cz); continue; }
        if (roll < 0.24) { this.parkingLot(cx, cz); continue; }
        const n = randInt(1, 3);
        for (let i = 0; i < n; i++) {
          const w = rand(12, 20), d = rand(12, 20);
          const h = rand(10, 46);
          const ox = n === 1 ? 0 : rand(-10, 10);
          const oz = n === 1 ? 0 : rand(-10, 10);
          this.building(cx + ox, cz + oz, w, d, h);
        }
      }
    }
  }

  park(cx, cz) {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 42),
      new THREE.MeshLambertMaterial({ color: 0x5a8a3a }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(cx, 0.04, cz);
    this.scene.add(grass);
    for (let i = 0; i < 7; i++) this.palm(cx + rand(-18, 18), cz + rand(-18, 18));
  }

  parkingLot(cx, cz) {
    const lot = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 42),
      new THREE.MeshLambertMaterial({ color: 0x55595e }),
    );
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(cx, 0.04, cz);
    this.scene.add(lot);
    this.parkedSpots = this.parkedSpots || [];
    for (let i = 0; i < 4; i++) this.parkedSpots.push({ x: cx - 12 + i * 8, z: cz, heading: Math.PI / 2 });
  }

  palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, 6, 6),
      new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk }),
    );
    trunk.position.y = 3;
    trunk.rotation.z = rand(-0.12, 0.12);
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 4.5, 4),
        new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf }),
      );
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.2, 6.4, Math.sin(a) * 1.2);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1 + Math.PI);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
  }

  buildCoast() {
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(22, WORLD.SIZE),
      new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(WORLD.BEACH_X + 8, 0.02, 0);
    this.scene.add(sand);
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(120, WORLD.SIZE + 200),
      new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(WORLD.OCEAN_X + 60, -0.15, 0);
    this.scene.add(ocean);
    // Boardwalk pier at the docks.
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(30, 1, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
    );
    pier.position.set(WORLD.OCEAN_X + 10, 0.6, 90);
    this.scene.add(pier);
  }

  buildPalms() {
    for (let z = -210; z <= 210; z += 30) {
      this.palm(WORLD.BEACH_X + 2, z + rand(-6, 6));
      if (Math.random() < 0.5) this.palm(-210 + rand(-4, 4), z);
    }
  }

  buildLights() {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
    for (const r of WORLD.ROADS) {
      for (let a = -180; a <= 180; a += 60) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 5), poleMat);
        pole.position.set(r + WORLD.ROAD_WIDTH / 2 + 1, 3.5, a);
        this.scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), bulbMat);
        bulb.position.set(r + WORLD.ROAD_WIDTH / 2 + 1, 7.1, a);
        this.scene.add(bulb);
      }
    }
  }
}
