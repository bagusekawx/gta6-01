// Solmar Bay — tuning, palette and shared constants. One source of truth so
// every system (city, traffic, police, missions) agrees on the world.
export const WORLD = {
  SIZE: 480,
  HALF: 240,
  ROAD_PITCH: 60,
  ROAD_WIDTH: 14,
  ROADS: [-210, -150, -90, -30, 30, 90, 150, 210],
  BEACH_X: 222, // sand starts here; ocean beyond
  OCEAN_X: 238,
};

export const PALETTE = {
  sky: 0x87c5e8,
  sun: 0xfff2c8,
  ground: 0x8a9a5b,
  sand: 0xe8d8a8,
  ocean: 0x2e7f9e,
  road: 0x3a3f46,
  sidewalk: 0x9aa0a6,
  building: [0xe8dcc8, 0xd8c8b0, 0xc8b8a0, 0xf0e8d8, 0xd0d8e0, 0xe0c8a8, 0xc8d0c8, 0xe8c8b8],
  roof: [0x8a4a3a, 0x5a6a7a, 0x7a7a6a, 0x9a7a4a],
  palmTrunk: 0x7a5a3a,
  palmLeaf: 0x3a8a4a,
};

export const CAR_TYPES = {
  sedan:  { topSpeed: 34, accel: 16, grip: 8.5, length: 4.4, width: 2.0, height: 1.35, color: 0x7a8a9a, seats: 1 },
  taxi:   { topSpeed: 32, accel: 15, grip: 8.0, length: 4.4, width: 2.0, height: 1.35, color: 0xf2c200, seats: 1 },
  sports: { topSpeed: 46, accel: 22, grip: 10.0, length: 4.2, width: 1.9, height: 1.05, color: 0xc22a2a, seats: 1 },
  truck:  { topSpeed: 26, accel: 11, grip: 6.5, length: 5.6, width: 2.3, height: 2.2, color: 0x4a6a8a, seats: 1 },
  cop:    { topSpeed: 40, accel: 20, grip: 9.5, length: 4.5, width: 2.0, height: 1.4, color: 0x1a1a1a, seats: 1 },
  van:    { topSpeed: 28, accel: 12, grip: 7.0, length: 5.0, width: 2.1, height: 2.0, color: 0xdadada, seats: 1 },
};

export const TUNING = {
  walkSpeed: 6,
  sprintSpeed: 10.5,
  jumpSpeed: 7.5,
  gravity: 20,
  playerRadius: 0.7,
  pistolDamage: 34,
  pistolRange: 90,
  pistolAmmo: 12,
  reloadTime: 1.4,
  fireInterval: 0.22,
  maxHealth: 100,
  wantedDecayDelay: 9,   // seconds unseen before stars start falling
  wantedDecayRate: 6,    // points per second while hidden
  starPoints: 50,        // points per star
  bustDistance: 1.6,
  trafficCount: 26,
  pedestrianCount: 34,
  policeCarCap: 6,
};

export const LANDMARKS = {
  garage:   { x: 0, z: -60, label: "SAL'S GARAGE" },
  safehouse:{ x: -120, z: 120, label: 'SAFEHOUSE' },
  hotel:    { x: 60, z: -120, label: 'CORAL HOTEL' },
  bank:     { x: 0, z: 0, label: 'MERIDIAN BANK' },
  docks:    { x: 180, z: 60, label: 'DOCKS' },
  hospital: { x: -60, z: 0, label: 'GENERAL HOSPITAL' },
  policeHQ: { x: 0, z: 120, label: 'SOLMAR PD' },
  plaza:    { x: -120, z: -120, label: 'PALM PLAZA' },
};

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
export function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
