import { PLAYER_HALF_WIDTH, PLAYER_HEIGHT } from '../core/constants.js';
import { isSolid } from '../blocks/BlockRegistry.js';

// Collision AABB joueur/voxels. La boîte du joueur a pour pieds `pos` (y = bas)
// et monte de PLAYER_HEIGHT, avec une demi-largeur PLAYER_HALF_WIDTH en X/Z.

const HW = PLAYER_HALF_WIDTH;
const H = PLAYER_HEIGHT;
const STEP = 0.05; // pas du déplacement balayé (5 cm) pour un contact « collé »

// Y a-t-il un bloc solide qui chevauche la boîte du joueur à la position `pos` ?
function collides(world, pos) {
  const minX = Math.floor(pos.x - HW);
  const maxX = Math.floor(pos.x + HW);
  const minY = Math.floor(pos.y);
  const maxY = Math.floor(pos.y + H);
  const minZ = Math.floor(pos.z - HW);
  const maxZ = Math.floor(pos.z + HW);

  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (isSolid(world.getBlock(x, y, z))) return true;
      }
    }
  }
  return false;
}

// Déplace `pos` le long d'un axe d'au plus `delta`, en s'arrêtant net au
// contact (déplacement balayé par petits pas pour éviter le clipping et coller
// le joueur à la surface). Retourne true si un mur a été touché.
function sweep(world, pos, axis, delta) {
  if (delta === 0) return false;
  const dir = Math.sign(delta);
  let remaining = Math.abs(delta);

  while (remaining > 0) {
    const inc = Math.min(STEP, remaining) * dir;
    pos[axis] += inc;
    if (collides(world, pos)) {
      pos[axis] -= inc; // annule le dernier pas : on est au contact
      return true;
    }
    remaining -= Math.abs(inc);
  }
  return false;
}

// Applique le déplacement `vel * dt` avec résolution axe par axe (X, Z, puis Y).
// Met à jour `vel` (mise à zéro sur les axes bloqués) et retourne onGround.
export function moveWithCollisions(world, pos, vel, dt) {
  sweep(world, pos, 'x', vel.x * dt);
  sweep(world, pos, 'z', vel.z * dt);

  let onGround = false;
  const hitY = sweep(world, pos, 'y', vel.y * dt);
  if (hitY) {
    if (vel.y < 0) onGround = true; // on est tombé sur un bloc
    vel.y = 0;
  }
  return onGround;
}

export { collides };
