// The player: Jax Rourke, on foot and behind the wheel. Foot movement is
// camera-relative with sprint and jump; driving reuses the shared car
// model; the pistol is a centre-screen raycast. The camera is a smoothed
// third-person follow that eases behind the car while driving.
import * as THREE from 'three';
import { TUNING, WORLD, clamp, angleLerp } from './config.js';
import { driveCar } from './vehicles.js';

function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x8a2a2a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.34), jacket);
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 10), skin);
  head.position.y = 1.68;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  cap.position.y = 1.84;
  g.add(cap);
  const legGeo = new THREE.BoxGeometry(0.24, 0.72, 0.26);
  const l1 = new THREE.Mesh(legGeo, jeans); l1.position.set(-0.16, 0.36, 0);
  const l2 = new THREE.Mesh(legGeo, jeans); l2.position.set(0.16, 0.36, 0);
  g.add(l1, l2);
  g.userData.legs = [l1, l2];
  return g;
}

export class Player {
  constructor(scene, city, effects, audio) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.audio = audio;
    this.mesh = buildPlayerMesh();
    scene.add(this.mesh);
    this.health = TUNING.maxHealth;
    this.ammo = TUNING.pistolAmmo;
    this.reloading = 0;
    this.fireCooldown = 0;
    this.heading = 0;
    this.vy = 0;
    this.grounded = true;
    this.walkPhase = 0;
    this.onFoot = true;
    this.vehicle = null;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.lastMouseMove = 0;
    this.dead = false;
    this.raycaster = new THREE.Raycaster();
    this.spawn(-30, -70);
  }

  get position() {
    return this.onFoot ? this.mesh.position : this.vehicle.mesh.position;
  }

  spawn(x, z) {
    this.mesh.position.set(x, 0, z);
    this.heading = Math.PI;
    this.camYaw = Math.PI;
    this.health = TUNING.maxHealth;
    this.dead = false;
    if (this.vehicle) { this.vehicle.driver = 'parked'; this.vehicle = null; }
    this.onFoot = true;
    this.mesh.visible = true;
  }

  nearestCar(cars, maxDist = 4.5) {
    let best = null, bd = maxDist;
    for (const c of cars) {
      const d = Math.hypot(c.mesh.position.x - this.mesh.position.x, c.mesh.position.z - this.mesh.position.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  enterVehicle(car, world) {
    const wasOwned = car.driver === 'traffic' || car.driver === 'parked';
    this.vehicle = car;
    car.driver = 'player';
    car.speed = 0;
    this.onFoot = false;
    this.mesh.visible = false;
    this.audio.blip();
    // Stealing in sight of the law is a crime; a clean steal is free.
    if (wasOwned && world.police.nearestCopDistance(this.position) < 45) {
      world.police.addWanted(20, 'Car stolen');
    }
  }

  exitVehicle(world) {
    const car = this.vehicle;
    car.driver = 'parked';
    car.speed = 0;
    const side = car.mesh.position.clone();
    side.x += Math.cos(car.heading) * 3;
    side.z -= Math.sin(car.heading) * 3;
    this.mesh.position.set(side.x, 0, side.z);
    this.city.resolveCollision(this.mesh.position, TUNING.playerRadius);
    this.vehicle = null;
    this.onFoot = true;
    this.mesh.visible = true;
    this.audio.blip();
  }

  takeDamage(amount, world) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - amount);
    this.audio.damage();
    world.hud.flashDamage();
    if (this.health <= 0) {
      this.dead = true;
      world.onWasted();
    }
  }

  shoot(world) {
    if (this.fireCooldown > 0 || this.reloading > 0 || this.ammo <= 0) return;
    this.fireCooldown = TUNING.fireInterval;
    this.ammo--;
    this.audio.shot();
    const cam = world.camera;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), cam);
    this.raycaster.far = TUNING.pistolRange;
    const targets = [];
    for (const e of world.missions.enemies) targets.push(e.mesh);
    for (const p of world.pedestrians.peds) if (p.state !== 'down') targets.push(p.mesh);
    for (const c of [...world.traffic.cars, ...world.traffic.parked]) targets.push(c.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    const muzzle = this.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.effects.muzzleFlash(muzzle);
    if (hits.length > 0) {
      const hit = hits[0];
      let obj = hit.object;
      while (obj && !obj.userData.kind) obj = obj.parent;
      this.effects.burst(hit.point, 0xffc860, 6, 4, 0.4);
      const kind = obj?.userData.kind;
      if (kind === 'enemy') world.missions.damageEnemy(obj.userData.ref, TUNING.pistolDamage, hit.point);
      else if (kind === 'ped') {
        const ped = obj.userData.ref;
        ped.state = 'down';
        ped.downUntil = performance.now() + 8000;
        ped.mesh.rotation.x = Math.PI / 2;
        ped.mesh.position.y = 0.3;
        world.police.addWanted(60, 'Pedestrian down');
        world.pedestrians.fleeFrom(hit.point.x, hit.point.z, 40);
      }
      this.effects.burst(hit.point, 0xaaaaaa, 4, 3, 0.3);
    }
    world.pedestrians.fleeFrom(this.mesh.position.x, this.mesh.position.z, 25);
    if (world.police.nearestCopDistance(this.position) < 50) world.police.addWanted(8, 'Shots fired');
    if (this.ammo === 0) this.reloading = TUNING.reloadTime;
  }

  update(dt, input, world) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.ammo = TUNING.pistolAmmo;
    }
    const { dx, dy } = input.consumeMouse();
    if (dx !== 0 || dy !== 0) {
      this.camYaw -= dx * 0.0026;
      this.camPitch = clamp(this.camPitch + dy * 0.0022, -0.15, 1.1);
      this.lastMouseMove = performance.now();
    }
    if (input.key('KeyQ')) this.camYaw += dt * 2.2;
    if (input.key('ArrowLeft')) this.camYaw += dt * 2.4;
    if (input.key('ArrowRight')) this.camYaw -= dt * 2.4;

    if (this.onFoot) this.updateOnFoot(dt, input, world);
    else this.updateDriving(dt, input, world);
    this.updateCamera(dt, world.camera);
  }

  updateOnFoot(dt, input, world) {
    const fwd = (input.key('KeyW') || input.key('ArrowUp') ? 1 : 0) - (input.key('KeyS') || input.key('ArrowDown') ? 1 : 0);
    const strafe = (input.key('KeyD') ? 1 : 0) - (input.key('KeyA') ? 1 : 0);
    const sprint = input.key('ShiftLeft') || input.key('ShiftRight');
    const speed = sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
    const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
    let mx = (sin * fwd + cos * strafe) * speed;
    let mz = (cos * fwd - sin * strafe) * speed;
    const moving = Math.hypot(mx, mz) > 0.1;
    if (moving) {
      this.heading = angleLerp(this.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
      this.walkPhase += dt * speed * 1.6;
      this.mesh.userData.legs[0].rotation.x = Math.sin(this.walkPhase) * 0.7;
      this.mesh.userData.legs[1].rotation.x = -Math.sin(this.walkPhase) * 0.7;
    } else {
      this.mesh.userData.legs[0].rotation.x *= 0.8;
      this.mesh.userData.legs[1].rotation.x *= 0.8;
    }
    this.mesh.position.x += mx * dt;
    this.mesh.position.z += mz * dt;
    this.city.resolveCollision(this.mesh.position, TUNING.playerRadius);
    this.mesh.rotation.y = this.heading;
    if (input.pressed('Space') && this.grounded) {
      this.vy = TUNING.jumpSpeed;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= TUNING.gravity * dt;
      this.mesh.position.y += this.vy * dt;
      if (this.mesh.position.y <= 0) {
        this.mesh.position.y = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }
    if (input.pressed('KeyE')) {
      const car = this.nearestCar([...world.traffic.cars, ...world.traffic.parked, ...world.police.cars]);
      if (car) this.enterVehicle(car, world);
    }
    if (input.mouseDown && input.locked) this.shoot(world);
    else if (input.mouseClicked && !input.locked) this.shoot(world);
    if (input.pressed('KeyR') && this.ammo < TUNING.pistolAmmo) this.reloading = TUNING.reloadTime;
    this.audio.setEngine(0, false);
  }

  updateDriving(dt, input, world) {
    const car = this.vehicle;
    // Shot mode holds the throttle so the car keeps moving while the scene
    // fast-forwards for a screenshot.
    const throttle = world.autoDrive ? 1
      : (input.key('KeyW') || input.key('ArrowUp') ? 1 : 0) - (input.key('KeyS') || input.key('ArrowDown') ? 1 : 0);
    const steer = (input.key('KeyA') || input.key('ArrowLeft') ? 1 : 0) - (input.key('KeyD') || input.key('ArrowRight') ? 1 : 0);
    const handbrake = input.key('Space');
    const crashed = driveCar(car, dt, handbrake ? throttle * 0.4 : throttle, steer, this.city);
    if (handbrake) car.speed *= 1 - 1.8 * dt;
    if (crashed) {
      this.audio.crash();
      this.effects.burst(car.mesh.position, 0xffaa33, 12, 7, 0.6);
      car.health -= 8;
    }
    // Running over a pedestrian is a crime.
    const ped = world.pedestrians.hitCheck(car.mesh.position, 2.4);
    if (ped && Math.abs(car.speed) > 4) {
      world.police.addWanted(50, 'Pedestrian hit');
      world.pedestrians.fleeFrom(car.mesh.position.x, car.mesh.position.z, 35);
    }
    // Shunt traffic cars out of the way.
    for (const o of world.traffic.cars) {
      if (o === car) continue;
      const d = Math.hypot(o.mesh.position.x - car.mesh.position.x, o.mesh.position.z - car.mesh.position.z);
      if (d < 3.4 && Math.abs(car.speed) > 6) {
        o.speed = Math.max(o.speed, 6);
        o.heading = Math.atan2(o.mesh.position.x - car.mesh.position.x, o.mesh.position.z - car.mesh.position.z);
        this.effects.burst(o.mesh.position, 0xffaa33, 6, 5, 0.5);
        this.audio.crash();
      }
    }
    this.audio.setEngine(Math.min(1, Math.abs(car.speed) / car.spec.topSpeed), true);
    if (input.pressed('KeyE')) this.exitVehicle(world);
    if (car.health <= 0) {
      this.effects.burst(car.mesh.position, 0xff5533, 30, 9, 1.2);
      this.audio.crash();
      this.exitVehicle(world);
      world.traffic.parked.push(car);
    }
  }

  updateCamera(dt, camera) {
    const target = this.position.clone();
    target.y += 1.6;
    // While driving, ease the camera behind the car unless the mouse moved recently.
    if (!this.onFoot && performance.now() - this.lastMouseMove > 1800) {
      this.camYaw = angleLerp(this.camYaw, this.vehicle.heading + Math.PI, Math.min(1, dt * 1.4));
    }
    const dist = this.onFoot ? 7.5 : 10.5;
    const height = this.onFoot ? 2.6 : 4.2;
    const cx = target.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cz = target.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cy = target.y + Math.sin(this.camPitch) * dist + height * 0.4;
    const desired = new THREE.Vector3(cx, Math.max(1.2, cy), cz);
    camera.position.lerp(desired, Math.min(1, dt * 6));
    camera.lookAt(target);
  }
}
