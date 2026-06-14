import * as THREE from 'three';
import { isSolid } from '../blocks/BlockRegistry.js';

const GRAVITY = 10;
const ARROW_GEO = new THREE.BoxGeometry(0.07, 0.07, 0.6);
const ARROW_MAT = new THREE.MeshBasicMaterial({ color: 0xcbb88f });

// Flèches en vol : tirées par le joueur (arc) ou par les squelettes. Gravité
// légère, collision avec les blocs (s'arrêtent) et avec les cibles (dégâts).
// ctx = { scene, world, player, mobs }
export class ProjectileManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.arrows = [];
    this._tmp = new THREE.Vector3();
  }

  spawn(origin, dir, { fromPlayer = true, damage = 6, speed = 30 } = {}) {
    const mesh = new THREE.Mesh(ARROW_GEO, ARROW_MAT);
    mesh.position.copy(origin);
    this.ctx.scene.add(mesh);
    this.arrows.push({
      pos: origin.clone(),
      vel: dir.clone().normalize().multiplyScalar(speed),
      mesh,
      life: 4,
      fromPlayer,
      damage,
    });
  }

  update(dt) {
    const player = this.ctx.player;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      a.vel.y -= GRAVITY * dt;
      a.pos.addScaledVector(a.vel, dt);

      a.mesh.position.copy(a.pos);
      a.mesh.lookAt(this._tmp.copy(a.pos).add(a.vel));

      let hit = a.life <= 0;

      // Collision blocs.
      if (!hit && isSolid(this.ctx.world.getBlock(Math.floor(a.pos.x), Math.floor(a.pos.y), Math.floor(a.pos.z)))) {
        hit = true;
      }

      // Collision cibles.
      if (!hit && a.fromPlayer && this.ctx.mobs) {
        for (const mob of this.ctx.mobs.mobs) {
          const dx = a.pos.x - mob.position.x;
          const dy = a.pos.y - (mob.position.y + mob.height / 2);
          const dz = a.pos.z - mob.position.z;
          if (Math.abs(dx) < mob.hw + 0.2 && Math.abs(dz) < mob.hw + 0.2 && Math.abs(dy) < mob.height / 2 + 0.2) {
            this.ctx.mobs.damageMob(mob, a.damage, a.vel.x * 0.3, a.vel.z * 0.3);
            hit = true;
            break;
          }
        }
      } else if (!hit && !a.fromPlayer) {
        const dx = a.pos.x - player.position.x;
        const dy = a.pos.y - (player.position.y + 0.9);
        const dz = a.pos.z - player.position.z;
        if (Math.abs(dx) < 0.45 && Math.abs(dz) < 0.45 && Math.abs(dy) < 1.0) {
          player.damage(a.damage);
          hit = true;
        }
      }

      if (hit) {
        this.ctx.scene.remove(a.mesh);
        this.arrows.splice(i, 1);
      }
    }
  }

  get count() {
    return this.arrows.length;
  }
}
