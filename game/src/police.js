// The law: a 0–5 star wanted level, police cars that hunt the player down
// and foot cops who chase and shoot. Crimes add points; staying out of
// sight lets the heat cool off. Get caught on foot and you are busted.
import * as THREE from 'three';
import { TUNING, WORLD, rand, pick } from './config.js';
import { makeCar, driveCar } from './vehicles.js';

export class Police {
  constructor(scene, city, effects, audio) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.audio = audio;
    this.points = 0;
    this.stars = 0;
    this.cars = [];
    this.cops = [];
    this.unseenTimer = 0;
    this.flashPhase = 0;
  }

  addWanted(points, reason) {
    if (points <= 0) return;
    this.points = Math.min(TUNING.starPoints * 5, this.points + points);
    const stars = Math.min(5, Math.floor(this.points / TUNING.starPoints));
    if (stars > this.stars) {
      this.stars = stars;
      this.onStarUp?.(stars, reason);
    }
    this.unseenTimer = 0;
  }

  setStars(stars) {
    this.points = stars * TUNING.starPoints;
    this.stars = stars;
    this.unseenTimer = 0;
  }

  reset() {
    this.points = 0;
    this.stars = 0;
    this.unseenTimer = 0;
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const c of this.cops) this.scene.remove(c.mesh);
    this.cars = [];
    this.cops = [];
    this.audio.setSiren(false);
  }

  nearestCopDistance(pos) {
    let best = Infinity;
    for (const c of this.cars) best = Math.min(best, Math.hypot(c.mesh.position.x - pos.x, c.mesh.position.z - pos.z));
    for (const c of this.cops) best = Math.min(best, Math.hypot(c.mesh.position.x - pos.x, c.mesh.position.z - pos.z));
    return best;
  }

  spawnCarNear(pos) {
    const p = this.city.randomRoadPoint();
    // Spawn on a road 40–70 units away so sirens arrive, not teleport in.
    let x = p.x, z = p.z, tries = 0;
    while (Math.hypot(x - pos.x, z - pos.z) < 40 && tries++ < 8) {
      const q = this.city.randomRoadPoint();
      x = q.x; z = q.z;
    }
    this.spawnCarAt(x, z, Math.atan2(pos.x - x, pos.z - z));
  }

  spawnCarAt(x, z, heading) {
    const car = makeCar('cop', x, z, heading);
    car.driver = 'police';
    car.speed = 20;
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  spawnCopNear(pos) {
    const a = rand(0, Math.PI * 2);
    const d = rand(15, 30);
    const mesh = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.34), navy);
    torso.position.y = 1.05;
    mesh.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), skin);
    head.position.y = 1.68;
    mesh.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.14, 8), navy);
    cap.position.y = 1.86;
    mesh.add(cap);
    mesh.position.set(pos.x + Math.cos(a) * d, 0, pos.z + Math.sin(a) * d);
    this.scene.add(mesh);
    this.cops.push({ mesh, heading: 0, shootCooldown: rand(0.5, 1.5), speed: 7 });
  }

  update(dt, world) {
    const player = world.player;
    const pos = player.position;
    this.flashPhase += dt * 8;
    const wantedCars = Math.min(TUNING.policeCarCap, this.stars === 0 ? 0 : this.stars + 1);
    const wantedCops = this.stars >= 2 ? Math.min(4, this.stars) : 0;
    while (this.cars.length < wantedCars) this.spawnCarNear(pos);
    while (this.cops.length < wantedCops) this.spawnCopNear(pos);
    // Despawn stragglers far behind.
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      const d = Math.hypot(c.mesh.position.x - pos.x, c.mesh.position.z - pos.z);
      if (this.stars === 0 || d > 160) {
        this.scene.remove(c.mesh);
        this.cars.splice(i, 1);
      }
    }
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      const d = Math.hypot(c.mesh.position.x - pos.x, c.mesh.position.z - pos.z);
      if (this.stars === 0 || d > 120) {
        this.scene.remove(c.mesh);
        this.cops.splice(i, 1);
      }
    }
    // Pursuit: steer at the player, ram on contact.
    for (const car of this.cars) {
      const dx = pos.x - car.mesh.position.x;
      const dz = pos.z - car.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let d = (want - car.heading) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, d * 1.8));
      const throttle = dist > 6 ? 1 : 0.4;
      driveCar(car, dt, throttle, steer, this.city);
      if (dist < 3.2 && Math.abs(car.speed) > 5) {
        this.effects.burst(car.mesh.position, 0xffaa33, 8, 6, 0.5);
        this.audio.crash();
        if (!player.onFoot) player.vehicle.health -= 4;
        else player.takeDamage(4, world);
        car.speed *= 0.4;
      }
      // Flash the light bar.
      const bar = car.mesh.userData.lightBar;
      if (bar) {
        const on = Math.sin(this.flashPhase) > 0;
        bar.children[0].visible = on;
        bar.children[1].visible = !on;
      }
    }
    // Foot cops run the player down; at 3+ stars they shoot.
    for (const cop of this.cops) {
      const dx = pos.x - cop.mesh.position.x;
      const dz = pos.z - cop.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      cop.heading = Math.atan2(dx, dz);
      cop.mesh.rotation.y = cop.heading;
      if (dist > 2) {
        cop.mesh.position.x += Math.sin(cop.heading) * cop.speed * dt;
        cop.mesh.position.z += Math.cos(cop.heading) * cop.speed * dt;
        this.city.resolveCollision(cop.mesh.position, 0.5);
      }
      if (this.stars >= 3 && dist < 45 && dist > 4) {
        cop.shootCooldown -= dt;
        if (cop.shootCooldown <= 0) {
          cop.shootCooldown = rand(0.9, 1.6);
          this.effects.muzzleFlash(cop.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)));
          this.audio.shot();
          if (Math.random() < 0.3) player.takeDamage(7, world);
        }
      }
      // Busted: a cop catches the player standing still on foot.
      if (player.onFoot && dist < TUNING.bustDistance && !player.dead) {
        world.onBusted();
      }
    }
    // Heat decay: unseen for a while, the stars fall one by one.
    const nearest = this.nearestCopDistance(pos);
    if (this.stars > 0 && nearest > 55) {
      this.unseenTimer += dt;
      if (this.unseenTimer > TUNING.wantedDecayDelay) {
        this.points = Math.max(0, this.points - TUNING.wantedDecayRate * dt);
        const stars = Math.floor(this.points / TUNING.starPoints);
        if (stars < this.stars) {
          this.stars = stars;
          this.onStarDown?.(stars);
        }
      }
    } else {
      this.unseenTimer = 0;
    }
    this.audio.setSiren(this.cars.length > 0 && nearest < 70);
  }
}
