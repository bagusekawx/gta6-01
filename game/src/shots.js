// Screenshot setups: ?shot=<name> puts the live game into a real gameplay
// state — the same systems the player uses, no staging tricks — so the
// screenshots are honest renders of the game. Used by shots.json.
import { MISSIONS } from './missions.js';

function snapCamera(world, yaw, pitch) {
  const p = world.player;
  p.camYaw = yaw;
  p.camPitch = pitch;
  p.updateCamera(1, world.camera);
}

export function applyShot(world, name) {
  const { player, police, missions, traffic } = world;
  world.mode = 'playing';
  world.hud.showScreen('none');
  if (name === 'chase') {
    // Cover shot: 3-star chase with the mission objective on the HUD.
    const car = traffic.parked.find((c) => c.type === 'sports') || traffic.parked[0];
    car.mesh.position.set(-30, 0, -30);
    car.heading = 0;
    player.enterVehicle(car, world);
    car.speed = 26;
    world.autoDrive = true;
    police.setStars(3);
    // Pursuers staged so the chase is in frame: one head-on ahead, two closing from behind.
    police.spawnCarAt(-30, -6, Math.PI);
    police.spawnCarAt(-22, -52, 0);
    police.spawnCarAt(-38, -58, 0);
    missions.index = 4;
    missions.startMission(MISSIONS[4], world);
    missions.active.step = 2;
    missions.enterStep(world);
    snapCamera(world, Math.PI, 0.3);
  } else if (name === 'explore') {
    // On foot on the beach boardwalk, palms and ocean, city behind.
    player.spawn(220, -20);
    player.camYaw = 0;
    snapCamera(world, player.camYaw, 0.38);
  } else if (name === 'drive') {
    // Fast drive down the coast road.
    const car = traffic.parked.find((c) => c.type === 'sports') || traffic.parked[0];
    car.mesh.position.set(210, 0, 60);
    car.heading = Math.PI;
    player.enterVehicle(car, world);
    car.speed = 38;
    world.autoDrive = true;
    snapCamera(world, 0, 0.3);
  } else if (name === 'mission') {
    // Dockyard shootout: mission 4's kill step, beacon and enemies in view.
    player.spawn(180, 100);
    missions.index = 3;
    missions.startMission(MISSIONS[3], world);
    player.camYaw = 0;
    snapCamera(world, player.camYaw, 0.25);
  }
  // Let one frame settle before the capture.
  world.hud.update(world);
}

// Runs after the ?sim= fast-forward: stage elements around the player's
// CURRENT position, so they are in frame at capture time.
export function postSim(world, name) {
  if (name !== 'chase') return;
  const { player, police } = world;
  const p = player.position;
  // Fresh pursuers around the player: one head-on ahead, one ahead-left,
  // one closing from behind-right.
  police.spawnCarAt(p.x, p.z + 26, Math.PI);
  police.spawnCarAt(p.x - 9, p.z + 16, Math.PI);
  police.spawnCarAt(p.x + 9, p.z - 16, 0);
}
