// The HUD: DOM readouts (stars, cash, health, ammo, objective, speed),
// the canvas minimap, toasts, briefings and the menu screens. All styling
// lives in index.html; this module only writes values and visibility.
import { WORLD, LANDMARKS } from './config.js';

export class HUD {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      stars: $('stars'), money: $('money'), healthFill: $('health-fill'),
      ammo: $('ammo'), objective: $('objective'), missionName: $('mission-name'),
      speed: $('speed'), toast: $('toast'), briefing: $('briefing'),
      briefingTitle: $('briefing-title'), briefingText: $('briefing-text'),
      damage: $('damage'), crosshair: $('crosshair'),
      title: $('title-screen'), pause: $('pause-menu'),
      wasted: $('wasted-screen'), busted: $('busted-screen'),
      story: $('story-screen'), hint: $('controls-hint'),
      btnContinue: $('btn-continue'), saveNote: $('save-note'),
    };
    this.map = $('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.toastUntil = 0;
    this.damageUntil = 0;
    this.hintUntil = performance.now() + 14000;
  }

  toast(text, ms = 2600) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    this.toastUntil = performance.now() + ms;
  }

  flashDamage() {
    this.el.damage.style.opacity = '0.55';
    this.damageUntil = performance.now() + 220;
  }

  showBriefing(def) {
    this.el.briefingTitle.textContent = def.name;
    this.el.briefingText.textContent = def.briefing;
    this.el.briefing.style.display = 'block';
    clearTimeout(this._briefTimer);
    this._briefTimer = setTimeout(() => { this.el.briefing.style.display = 'none'; }, 7000);
  }

  showScreen(name) {
    for (const k of ['title', 'pause', 'wasted', 'busted', 'story']) {
      this.el[k].style.display = k === name ? 'flex' : 'none';
    }
  }

  update(world) {
    const { player, police, missions } = world;
    const now = performance.now();
    if (now > this.toastUntil) this.el.toast.style.opacity = '0';
    if (now > this.damageUntil) this.el.damage.style.opacity = '0';
    if (now > this.hintUntil) this.el.hint.style.opacity = '0';

    this.el.stars.textContent = '★'.repeat(police.stars) + '☆'.repeat(5 - police.stars);
    this.el.stars.style.color = police.stars > 0 ? '#ffd94a' : '#888888';
    this.el.money.textContent = '$' + Math.floor(world.money).toLocaleString('en-US');
    this.el.healthFill.style.width = Math.max(0, player.health) + '%';
    this.el.healthFill.style.background = player.health > 30 ? '#7ac74a' : '#c22a2a';
    this.el.ammo.textContent = player.onFoot ? `AMMO ${player.ammo} / 12` : '';
    this.el.crosshair.style.display = player.onFoot && world.mode === 'playing' ? 'block' : 'none';
    this.el.objective.textContent = missions.objectiveText();
    this.el.missionName.textContent = missions.active ? missions.active.def.name : (missions.done ? 'FREE ROAM' : 'SOLMAR BAY');
    if (!player.onFoot && player.vehicle) {
      const kmh = Math.round(Math.abs(player.vehicle.speed) * 3.6);
      this.el.speed.textContent = kmh + ' km/h';
      this.el.speed.style.display = 'block';
    } else {
      this.el.speed.style.display = 'none';
    }
    this.drawMinimap(world);
  }

  drawMinimap(world) {
    const c = this.mapCtx;
    const S = 180, H = WORLD.HALF;
    const toMap = (x, z) => [(x + H) / (H * 2) * S, (z + H) / (H * 2) * S];
    c.fillStyle = '#10141a';
    c.fillRect(0, 0, S, S);
    // Ocean strip on the east edge.
    c.fillStyle = '#2e7f9e';
    c.fillRect(toMap(WORLD.OCEAN_X, 0)[0], 0, S, S);
    c.fillStyle = '#e8d8a8';
    c.fillRect(toMap(WORLD.BEACH_X, 0)[0], 0, toMap(WORLD.OCEAN_X, 0)[0] - toMap(WORLD.BEACH_X, 0)[0], S);
    // Roads.
    c.strokeStyle = '#4a5058';
    c.lineWidth = 4;
    for (const r of WORLD.ROADS) {
      const [x] = toMap(r, 0);
      const [, y] = toMap(0, r);
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, S); c.stroke();
      c.beginPath(); c.moveTo(0, y); c.lineTo(S, y); c.stroke();
    }
    const dot = (x, z, color, size) => {
      const [mx, my] = toMap(x, z);
      c.fillStyle = color;
      c.fillRect(mx - size / 2, my - size / 2, size, size);
    };
    // Mission objective + next-mission beacon.
    if (world.missions.active && world.missions.marker.visible) {
      const p = world.missions.marker.position;
      dot(p.x, p.z, '#ffd94a', 8);
    } else if (world.missions.nextDef) {
      dot(world.missions.nextDef.start.x, world.missions.nextDef.start.z, '#4aff88', 8);
    }
    for (const e of world.missions.enemies) {
      if (e.state === 'alive') dot(e.mesh.position.x, e.mesh.position.z, '#ff4444', 4);
    }
    const flash = Math.sin(performance.now() / 180) > 0;
    for (const car of world.police.cars) dot(car.mesh.position.x, car.mesh.position.z, flash ? '#ff4444' : '#4488ff', 5);
    for (const cop of world.police.cops) dot(cop.mesh.position.x, cop.mesh.position.z, '#88aaff', 4);
    // Player arrow, rotated by heading.
    const p = world.player.position;
    const [px, py] = toMap(p.x, p.z);
    const heading = world.player.onFoot ? world.player.heading : world.player.vehicle.heading;
    c.save();
    c.translate(px, py);
    c.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) * -1 + Math.PI);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath();
    c.fill();
    c.restore();
    // North tick.
    c.fillStyle = '#ffffff';
    c.font = 'bold 11px Arial';
    c.fillText('N', 6, 14);
  }
}
