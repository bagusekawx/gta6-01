// Particles and flashes: muzzle smoke, crash sparks, blood puffs, cash
// sparkles. One shared pool of small meshes, recycled, so effects cost
// almost nothing. No textures — plain coloured boxes and points.
import * as THREE from 'three';
import { rand } from './config.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.flash = null;
    this.flashUntil = 0;
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.geo = geo;
    this.mats = {};
  }

  _mat(color) {
    if (!this.mats[color]) {
      this.mats[color] = new THREE.MeshBasicMaterial({ color });
    }
    return this.mats[color];
  }

  burst(pos, color, count = 10, speed = 6, life = 0.7, up = 3) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, this._mat(color));
      m.position.copy(pos);
      const vel = new THREE.Vector3(rand(-1, 1), rand(0, 1), rand(-1, 1)).normalize().multiplyScalar(rand(speed * 0.4, speed));
      vel.y += up;
      this.scene.add(m);
      this.particles.push({ mesh: m, vel, life: rand(life * 0.5, life), age: 0 });
    }
    if (this.particles.length > 220) {
      const extra = this.particles.splice(0, this.particles.length - 220);
      extra.forEach((p) => this.scene.remove(p.mesh));
    }
  }

  muzzleFlash(pos) {
    if (!this.flash) {
      this.flash = new THREE.PointLight(0xffc860, 8, 12, 2);
      this.scene.add(this.flash);
    }
    this.flash.position.copy(pos);
    this.flashUntil = performance.now() + 60;
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 5;
      const s = 1 - p.age / p.life;
      p.mesh.scale.setScalar(Math.max(0.1, s));
    }
    if (this.flash && performance.now() > this.flashUntil) {
      this.scene.remove(this.flash);
      this.flash = null;
    }
  }
}
