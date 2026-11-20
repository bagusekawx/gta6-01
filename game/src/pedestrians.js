// Pedestrians: simple walking figures on the sidewalks. They stroll, turn
// at intersections, and flee from gunfire and speeding cars. Hitting one
// is a crime the police notice.
import * as THREE from 'three';
import { WORLD, TUNING, rand, pick } from './config.js';

const SHIRTS = [0xc24a4a, 0x4a7ac2, 0x4ac27a, 0xc2a44a, 0x8a4ac2, 0xe8e8e8, 0x4ac2c2, 0xe08a4a];
const SKINS = [0xf2c89a, 0xc28a5a, 0x8a5a3a, 0xe8b88a];

function buildPedMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(SKINS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick([0x2a3a4a, 0x4a4a4a, 0x3a2a4a]) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt);
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), skin);
  head.position.y = 1.65;
  g.add(head);
  const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.24);
  const l1 = new THREE.Mesh(legGeo, pants); l1.position.set(-0.15, 0.35, 0);
  const l2 = new THREE.Mesh(legGeo, pants); l2.position.set(0.15, 0.35, 0);
  g.add(l1, l2);
  g.userData.legs = [l1, l2];
  return g;
}

export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.peds = [];
    for (let i = 0; i < TUNING.pedestrianCount; i++) {
      this.peds.push(this.spawn());
    }
  }

  spawn() {
    const r = pick(WORLD.ROADS);
    const along = rand(-210, 210);
    const side = pick([-1, 1]) * (WORLD.ROAD_WIDTH / 2 + 2.5);
    const horizontal = Math.random() < 0.5;
    const mesh = buildPedMesh();
    mesh.position.set(horizontal ? along : r + side, 0, horizontal ? r + side : along);
    const heading = horizontal ? pick([Math.PI / 2, -Math.PI / 2]) : pick([0, Math.PI]);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const ped = {
      mesh, heading, speed: rand(1.2, 2.2), state: 'walk',
      fleeUntil: 0, downUntil: 0, walkPhase: rand(0, 6),
    };
    mesh.userData.kind = 'ped';
    mesh.userData.ref = ped;
    return ped;
  }

  fleeFrom(x, z, radius = 30) {
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < radius) {
        p.state = 'flee';
        p.fleeUntil = performance.now() + rand(2500, 5000);
        p.heading = Math.atan2(p.mesh.position.x - x, p.mesh.position.z - z);
      }
    }
  }

  // A car hit a pedestrian: knock them down, return the ped (or null).
  hitCheck(carPos, radius) {
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.mesh.position.x - carPos.x, p.mesh.position.z - carPos.z);
      if (d < radius) {
        p.state = 'down';
        p.downUntil = performance.now() + 8000;
        p.mesh.rotation.x = Math.PI / 2;
        p.mesh.position.y = 0.3;
        return p;
      }
    }
    return null;
  }

  update(dt) {
    const now = performance.now();
    for (const p of this.peds) {
      if (p.state === 'down') {
        if (now > p.downUntil) {
          this.scene.remove(p.mesh);
          this.peds[this.peds.indexOf(p)] = this.spawn();
        }
        continue;
      }
      const speed = p.state === 'flee' ? 5.5 : p.speed;
      if (p.state === 'flee' && now > p.fleeUntil) p.state = 'walk';
      p.walkPhase += dt * speed * 2.2;
      p.mesh.userData.legs[0].rotation.x = Math.sin(p.walkPhase) * 0.6;
      p.mesh.userData.legs[1].rotation.x = -Math.sin(p.walkPhase) * 0.6;
      const nx = p.mesh.position.x + Math.sin(p.heading) * speed * dt;
      const nz = p.mesh.position.z + Math.cos(p.heading) * speed * dt;
      p.mesh.position.set(nx, 0, nz);
      p.mesh.rotation.y = p.heading;
      this.city.resolveCollision(p.mesh.position, 0.5);
      // Turn at intersections sometimes; bounce off the world edge.
      if (Math.random() < dt * 0.12) {
        p.heading += pick([-Math.PI / 2, Math.PI / 2]);
      }
      if (Math.abs(nx) > 225 || Math.abs(nz) > 225) p.heading += Math.PI;
    }
  }
}
