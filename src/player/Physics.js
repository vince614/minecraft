import { PLAYER_HALF_WIDTH, PLAYER_HEIGHT } from '../core/constants.js';
import { isSolid } from '../blocks/BlockRegistry.js';

// Collision AABB générique contre les voxels. Une entité est définie par ses
// pieds `pos` (y = bas), une demi-largeur `hw` en X/Z et une hauteur `h`.
// Utilisée par le joueur ET les mobs (tailles variables).

const STEP = 0.05; // pas du déplacement balayé (5 cm) pour un contact « collé »

// Un bloc solide chevauche-t-il la boîte (pos, hw, h) ?
export function collidesBox(world, pos, hw, h) {
  const minX = Math.floor(pos.x - hw);
  const maxX = Math.floor(pos.x + hw);
  const minY = Math.floor(pos.y);
  const maxY = Math.floor(pos.y + h);
  const minZ = Math.floor(pos.z - hw);
  const maxZ = Math.floor(pos.z + hw);

  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (isSolid(world.getBlock(x, y, z))) return true;
      }
    }
  }
  return false;
}

// Déplace `pos` le long d'un axe d'au plus `delta`, en s'arrêtant au contact.
function sweepBox(world, pos, axis, delta, hw, h) {
  if (delta === 0) return false;
  const dir = Math.sign(delta);
  let remaining = Math.abs(delta);

  while (remaining > 0) {
    const inc = Math.min(STEP, remaining) * dir;
    pos[axis] += inc;
    if (collidesBox(world, pos, hw, h)) {
      pos[axis] -= inc;
      return true;
    }
    remaining -= Math.abs(inc);
  }
  return false;
}

// Applique vel*dt avec résolution axe par axe (X, Z, puis Y).
// Met `vel` à zéro sur les axes bloqués ; retourne onGround.
export function moveBox(world, pos, vel, dt, hw, h) {
  sweepBox(world, pos, 'x', vel.x * dt, hw, h);
  sweepBox(world, pos, 'z', vel.z * dt, hw, h);

  let onGround = false;
  const hitY = sweepBox(world, pos, 'y', vel.y * dt, hw, h);
  if (hitY) {
    if (vel.y < 0) onGround = true;
    vel.y = 0;
  }
  return onGround;
}

// --- Variantes joueur (dimensions par défaut) -----------------------------

export function moveWithCollisions(world, pos, vel, dt) {
  return moveBox(world, pos, vel, dt, PLAYER_HALF_WIDTH, PLAYER_HEIGHT);
}

export function collides(world, pos) {
  return collidesBox(world, pos, PLAYER_HALF_WIDTH, PLAYER_HEIGHT);
}
