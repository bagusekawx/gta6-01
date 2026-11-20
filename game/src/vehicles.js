// Cars: a box-built factory, one shared arcade driving model, and the
// traffic system. The player, the police and the traffic all drive through
// driveCar(), so every car in the city handles the same way.
import * as THREE from 'three';
import { WORLD, CAR_TYPES, TUNING, rand, pick, angleLerp } from './config.js';

export function buildCarMesh(type, color) {
  const spec = CAR_TYPES[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9ac8e0 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height * 0.62, spec.length), bodyMat);
  body.position.y = spec.height * 0.45;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.88, spec.height * 0.55, spec.length * 0.5), glassMat);
  cabin.position.set(0, spec.height * 0.95, -spec.length * 0.05);
  g.add(cabin);
  const cabinTop = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.9, 0.12, spec.length * 0.52), bodyMat);
  cabinTop.position.set(0, spec.height * 1.22, -spec.length * 0.05);
  g.add(cabinTop);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  g.userData.wheels = [];
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx * (spec.width / 2 - 0.05), 0.36, wz * (spec.length / 2 - 0.7));
    g.add(w);
    g.userData.wheels.push(w);
  }
  const lightGeo = new THREE.BoxGeometry(0.4, 0.22, 0.1);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(lightGeo, headMat);
    h.position.set(s * (spec.width / 2 - 0.4), 0.62, spec.length / 2 + 0.03);
    g.add(h);
    const t = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    t.position.set(s * (spec.width / 2 - 0.4), 0.62, -spec.length / 2 - 0.03);
    g.add(t);
  }
  if (type === 'cop') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    red.position.x = -0.28; blue.position.x = 0.28;
    bar.add(red, blue);
    bar.position.set(0, spec.height * 1.32, -spec.length * 0.05);
    g.add(bar);
    g.userData.lightBar = bar;
  }
  return g;
}

export function makeCar(type, x, z, heading, color = null) {
  const spec = CAR_TYPES[type];
  const mesh = buildCarMesh(type, color ?? spec.color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return { type, spec, mesh, heading, speed: 0, steer: 0, driver: null, health: 100, brake: 0 };
}

// Arcade driving shared by player, traffic and police. Returns 'crash' when
// the car hit a building hard, else null.
export function driveCar(car, dt, throttle, steer, city) {
  const spec = car.spec;
  car.steer = angleLerp(car.steer, steer, Math.min(1, dt * 8));
  const forward = car.speed >= 0 ? 1 : -1;
  car.speed += throttle * spec.accel * dt;
  car.speed -= car.speed * 0.55 * dt; // drag + rolling resistance
  car.speed = Math.max(-spec.topSpeed * 0.42, Math.min(spec.topSpeed, car.speed));
  if (Math.abs(car.speed) > 0.5) {
    car.heading += car.steer * (1.9 - Math.min(1.1, Math.abs(car.speed) / spec.topSpeed)) * forward * dt * Math.min(1, Math.abs(car.speed) / 6 + 0.25);
  }
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const nx = car.mesh.position.x + fx * car.speed * dt;
  const nz = car.mesh.position.z + fz * car.speed * dt;
  const before = { x: car.mesh.position.x, z: car.mesh.position.z };
  car.mesh.position.set(nx, 0, nz);
  city.resolveCollision(car.mesh.position, spec.length * 0.45);
  const moved = Math.hypot(car.mesh.position.x - before.x, car.mesh.position.z - before.z);
  const wanted = Math.hypot(nx - before.x, nz - before.z);
  let crashed = null;
  if (wanted > 0.01 && moved < wanted * 0.55 && Math.abs(car.speed) > 8) {
    crashed = 'crash';
    car.speed *= -0.25;
  }
  car.mesh.rotation.y = car.heading;
  // Body roll + wheel spin for feel.
  car.mesh.rotation.z = -car.steer * Math.min(1, Math.abs(car.speed) / 20) * 0.06;
  const spin = (car.speed * dt) / 0.36;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  return crashed;
}

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    const types = ['sedan', 'sedan', 'taxi', 'van', 'truck', 'sports'];
    for (let i = 0; i < TUNING.trafficCount; i++) {
      const p = city.randomRoadPoint();
      const car = makeCar(pick(types), p.x, p.z, pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), pick([0x8a9aaa, 0xb03a3a, 0x3a7a5a, 0xd8d8d8, 0x5a4a8a, 0xc8a03a]));
      car.driver = 'traffic';
      car.route = this.newRoute(car);
      car.speed = rand(8, 14);
      scene.add(car.mesh);
      this.cars.push(car);
    }
    // Parked cars in lots and along curbs — the stealable fleet.
    this.parked = [];
    const spots = city.parkedSpots || [];
    for (const s of spots) {
      const car = makeCar(pick(['sedan', 'sports', 'van']), s.x, s.z, s.heading, pick([0x2a6a9a, 0xc22a2a, 0xe8e8e8, 0x3a3a3a]));
      car.driver = 'parked';
      scene.add(car.mesh);
      this.parked.push(car);
    }
    for (let i = 0; i < 10; i++) {
      const r = pick(WORLD.ROADS);
      const along = rand(-200, 200);
      const car = makeCar(pick(['sedan', 'taxi', 'sports']), r + WORLD.ROAD_WIDTH / 2 + 2.2, along, Math.PI / 2, pick([0x7a5a9a, 0x9a9a2a, 0x2a9a7a]));
      car.driver = 'parked';
      scene.add(car.mesh);
      this.parked.push(car);
    }
  }

  newRoute(car) {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const road = pick(WORLD.ROADS);
    return { axis, road, dir: Math.random() < 0.5 ? 1 : -1, lane: (Math.random() < 0.5 ? -1 : 1) * 3.5 };
  }

  carAhead(car, dist) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    for (const o of this.cars) {
      if (o === car) continue;
      const dx = o.mesh.position.x - car.mesh.position.x;
      const dz = o.mesh.position.z - car.mesh.position.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < dist && side < 2.4) return true;
    }
    return false;
  }

  update(dt, playerCar) {
    for (const car of this.cars) {
      const r = car.route;
      // Steer toward the lane line, then along it.
      let targetHeading;
      if (r.axis === 'x') {
        const laneZ = r.road + r.lane;
        const dz = laneZ - car.mesh.position.z;
        targetHeading = (r.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.max(-0.5, Math.min(0.5, dz * 0.06));
      } else {
        const laneX = r.road + r.lane;
        const dx = laneX - car.mesh.position.x;
        targetHeading = (r.dir > 0 ? 0 : Math.PI) + Math.max(-0.5, Math.min(0.5, -dx * 0.06));
      }
      let d = (targetHeading - car.heading) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, d * 1.6));
      let throttle = 0.55;
      if (this.carAhead(car, 10)) throttle = -0.6;
      if (playerCar && playerCar !== car) {
        const dx = playerCar.mesh.position.x - car.mesh.position.x;
        const dz = playerCar.mesh.position.z - car.mesh.position.z;
        if (Math.hypot(dx, dz) < 8) throttle = -0.4;
      }
      driveCar(car, dt, throttle, steer, this.city);
      // At an intersection, sometimes turn onto the cross street.
      const nearCross = WORLD.ROADS.some((cr) =>
        Math.abs((r.axis === 'x' ? car.mesh.position.x : car.mesh.position.z) - cr) < 2);
      if (nearCross && Math.random() < dt * 0.25) car.route = this.newRoute(car);
      // Loop back when leaving the city.
      if (Math.abs(car.mesh.position.x) > 225 || Math.abs(car.mesh.position.z) > 225) {
        const p = this.city.randomRoadPoint();
        car.mesh.position.set(p.x, 0, p.z);
        car.route = this.newRoute(car);
      }
    }
  }
}
