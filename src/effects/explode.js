import { AIR } from '../blocks/BlockRegistry.js';

const BEDROCK = 4;
const TNT_ID = 17;

// Explosion sphérique : détruit les blocs (avec quelques drops), endommage les
// mobs et le joueur selon la distance, déclenche les TNT touchées (réaction en
// chaîne), projette des particules et secoue la caméra.
//
// ctx = { world, particles, sound, drops, player, mobs, shake, igniteTnt }
export function explode(ctx, cx, cy, cz, power) {
  const R = power;
  const world = ctx.world;

  // Destruction des blocs.
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        const x = Math.floor(cx) + dx;
        const y = Math.floor(cy) + dy;
        const z = Math.floor(cz) + dz;
        const id = world.getBlock(x, y, z);
        if (id === AIR || id === BEDROCK) continue;
        if (id === TNT_ID) { ctx.igniteTnt(x, y, z, 0.2 + Math.random() * 0.3); continue; } // chaîne
        world.setBlock(x, y, z, AIR);
        // ~25% des blocs détruits laissent un objet au sol.
        if (ctx.drops && Math.random() < 0.25) ctx.drops.spawn(id, x + 0.5, y + 0.5, z + 0.5, 1);
      }
    }
  }

  // Dégâts aux mobs.
  if (ctx.mobs) {
    for (const mob of ctx.mobs.mobs.slice()) {
      const mx = mob.position.x - cx, my = mob.position.y - cy, mz = mob.position.z - cz;
      const dist = Math.sqrt(mx * mx + my * my + mz * mz);
      if (dist < R + 1.5) {
        const dmg = Math.max(1, Math.floor((1 - dist / (R + 1.5)) * 24));
        const len = Math.hypot(mx, mz) || 1;
        ctx.mobs.damageMob(mob, dmg, (mx / len) * 8, (mz / len) * 8);
      }
    }
  }

  // Dégâts au joueur.
  const p = ctx.player;
  const px = p.position.x - cx, py = p.position.y + 0.9 - cy, pz = p.position.z - cz;
  const pdist = Math.sqrt(px * px + py * py + pz * pz);
  if (pdist < R + 2) {
    const dmg = Math.max(1, Math.floor((1 - pdist / (R + 2)) * 20));
    p.damage(dmg);
    const len = Math.hypot(px, pz) || 1;
    p.velocity.x += (px / len) * 8;
    p.velocity.z += (pz / len) * 8;
    p.velocity.y = Math.max(p.velocity.y, 6);
  }

  // Effets : particules (feu/fumée), son, secousse caméra.
  for (let i = 0; i < 30; i++) {
    const c = Math.random() < 0.5 ? '#ff8a3c' : '#555555';
    ctx.particles.emit(cx, cy, cz, c, 1, R * 1.5);
  }
  ctx.sound.playExplosion();
  if (ctx.shake) ctx.shake(0.6);
}
