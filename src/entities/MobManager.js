import * as THREE from 'three';
import { CHUNK_HEIGHT } from '../core/constants.js';
import { isSolid, isWater, itemColor } from '../blocks/BlockRegistry.js';
import { moveBox } from '../player/Physics.js';
import { Mob, MOB_DEFS, PASSIVE_TYPES } from './Mob.js';

const GRAVITY = 26;
const JUMP = 7;
const PASSIVE_CAP = 10;
const HOSTILE_CAP = 8;
const VILLAGER_CAP = 6;
const AGGRO_RANGE = 16;
const PLAYER_ATTACK = 5;

// Gère toutes les créatures : apparition/disparition autour du joueur, IA
// (errance / fuite / poursuite), physique, combat et butin. L'apparition des
// hostiles (zombies) dépend de la nuit ; les villageois apparaissent près des
// villages.
export class MobManager {
  constructor(ctx) {
    // ctx = { scene, world, player, particles, sound, inventory, isNight, villages }
    this.ctx = ctx;
    this.mobs = [];
    this.spawnTimer = 0;

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
  }

  update(dt) {
    this.spawnTimer += dt;
    if (this.spawnTimer > 1.2) {
      this.spawnTimer = 0;
      this._trySpawn();
    }

    const player = this.ctx.player;
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      this._updateMob(mob, dt);

      // Disparition : trop loin, tombé dans le vide, ou hostile en plein jour loin.
      const dx = mob.position.x - player.position.x;
      const dz = mob.position.z - player.position.z;
      const far = dx * dx + dz * dz > 80 * 80;
      const burn = mob.hostile && !this.ctx.isNight() && dx * dx + dz * dz > 24 * 24;
      if (mob.dead || mob.position.y < -6 || far || burn) {
        this._remove(i);
      }
    }
  }

  // --- IA + physique d'un mob ---------------------------------------------

  _updateMob(mob, dt) {
    const player = this.ctx.player;
    mob.wanderTimer -= dt;
    mob.fleeTimer -= dt;
    mob.attackCd -= dt;

    let moving = false;

    if (mob.fleeTimer > 0) {
      // Fuite : cap opposé au joueur, vitesse pleine.
      this._headAway(mob, player.position.x, player.position.z);
      this._applyHeading(mob, mob.speed);
      moving = true;
    } else if (mob.hostile) {
      const d2 = this._dist2(mob, player.position);
      if (d2 < AGGRO_RANGE * AGGRO_RANGE) mob.aggro = true;
      if (mob.aggro && d2 < 40 * 40) {
        this._headToward(mob, player.position.x, player.position.z);
        this._applyHeading(mob, mob.speed);
        moving = true;
        // Attaque au contact.
        if (d2 < 2.0 * 2.0 && mob.attackCd <= 0) {
          player.damage(mob.def.attack);
          mob.attackCd = 1.0;
        }
      } else {
        moving = this._wander(mob);
      }
    } else if (mob.def.villager) {
      // Villageois : reste près de son ancrage.
      const hx = mob.position.x - mob.homeX;
      const hz = mob.position.z - mob.homeZ;
      if (hx * hx + hz * hz > 12 * 12) {
        this._headToward(mob, mob.homeX, mob.homeZ);
        this._applyHeading(mob, mob.speed);
        moving = true;
      } else {
        moving = this._wander(mob);
      }
    } else {
      moving = this._wander(mob);
    }

    // Gravité + saut d'obstacle.
    mob.velocity.y -= GRAVITY * dt;
    if (mob.velocity.y < -55) mob.velocity.y = -55;
    if (moving && mob.onGround && this._blockedAhead(mob)) mob.velocity.y = JUMP;

    if (!moving) { mob.velocity.x = 0; mob.velocity.z = 0; }

    mob.onGround = moveBox(this.ctx.world, mob.position, mob.velocity, dt, mob.hw, mob.height);
    mob.moving = moving && (Math.abs(mob.velocity.x) + Math.abs(mob.velocity.z) > 0.05);

    mob.model.animate(dt, mob.moving);
    mob.syncModel();
  }

  // Errance : change de cap aléatoirement, alterne marche / repos.
  _wander(mob) {
    if (mob.wanderTimer <= 0) {
      mob.wanderTimer = 2 + Math.random() * 4;
      mob._idle = Math.random() < 0.35;
      if (!mob._idle) mob.yaw = Math.random() * Math.PI * 2;
    }
    if (mob._idle) return false;
    this._applyHeading(mob, mob.speed * 0.5);
    return true;
  }

  _applyHeading(mob, spd) {
    mob.velocity.x = -Math.sin(mob.yaw) * spd;
    mob.velocity.z = -Math.cos(mob.yaw) * spd;
  }

  _headToward(mob, tx, tz) {
    mob.yaw = Math.atan2(-(tx - mob.position.x), -(tz - mob.position.z));
  }

  _headAway(mob, tx, tz) {
    mob.yaw = Math.atan2(-(mob.position.x - tx), -(mob.position.z - tz));
  }

  // Y a-t-il un bloc solide juste devant, à hauteur des pieds ?
  _blockedAhead(mob) {
    const hx = -Math.sin(mob.yaw);
    const hz = -Math.cos(mob.yaw);
    const fx = Math.floor(mob.position.x + hx * 0.5);
    const fz = Math.floor(mob.position.z + hz * 0.5);
    const fy = Math.floor(mob.position.y);
    const world = this.ctx.world;
    return isSolid(world.getBlock(fx, fy, fz)) && !isSolid(world.getBlock(fx, fy + 1, fz));
  }

  _dist2(mob, p) {
    const dx = mob.position.x - p.x;
    const dz = mob.position.z - p.z;
    return dx * dx + dz * dz;
  }

  // --- Apparition ----------------------------------------------------------

  _trySpawn() {
    const counts = { passive: 0, hostile: 0, villager: 0 };
    for (const m of this.mobs) {
      if (m.def.villager) counts.villager++;
      else if (m.hostile) counts.hostile++;
      else counts.passive++;
    }

    const night = this.ctx.isNight();

    // Villageois près d'un village proche.
    if (counts.villager < VILLAGER_CAP) this._trySpawnVillager();

    if (night && counts.hostile < HOSTILE_CAP) {
      this._spawnNearPlayer('zombie', 14, 36);
    } else if (!night && counts.passive < PASSIVE_CAP) {
      const type = PASSIVE_TYPES[(Math.random() * PASSIVE_TYPES.length) | 0];
      this._spawnNearPlayer(type, 12, 40, true);
    }
  }

  _trySpawnVillager() {
    const villages = this.ctx.villages;
    if (!villages) return;
    const p = this.ctx.player.position;
    const near = villages.villagesNear(p.x, p.z, 60);
    if (near.length === 0) return;
    const v = near[(Math.random() * near.length) | 0];
    const x = v.cx + (Math.random() - 0.5) * 12;
    const z = v.cz + (Math.random() - 0.5) * 12;
    const y = this._findGround(x, z, false); // sol du village (planches/chemin), pas l'herbe
    if (y == null) return;
    this._add(new Mob('villager', new THREE.Vector3(Math.floor(x) + 0.5, y, Math.floor(z) + 0.5)));
  }

  // Apparition dans un anneau [rMin,rMax] autour du joueur.
  _spawnNearPlayer(type, rMin, rMax, needGrass = false) {
    const p = this.ctx.player.position;
    const ang = Math.random() * Math.PI * 2;
    const r = rMin + Math.random() * (rMax - rMin);
    const x = p.x + Math.cos(ang) * r;
    const z = p.z + Math.sin(ang) * r;
    const y = this._findGround(x, z, needGrass);
    if (y == null) return;
    this._add(new Mob(type, new THREE.Vector3(Math.floor(x) + 0.5, y, Math.floor(z) + 0.5)));
  }

  // Trouve un sol solide libre ; renvoie l'altitude des pieds ou null.
  _findGround(x, z, needGrass) {
    const fx = Math.floor(x);
    const fz = Math.floor(z);
    const world = this.ctx.world;
    const chunk = world.getChunk(Math.floor(fx / 16), Math.floor(fz / 16));
    if (!chunk || !chunk.generated) return null;

    let y = CHUNK_HEIGHT - 1;
    while (y > 1 && !isSolid(world.getBlock(fx, y, fz))) y--;
    if (y <= 1) return null;

    const top = world.getBlock(fx, y, fz);
    if (isWater(top)) return null;
    if (needGrass && top !== 1) return null; // animaux : sur l'herbe
    // Deux blocs d'air au-dessus.
    if (isSolid(world.getBlock(fx, y + 1, fz)) || isSolid(world.getBlock(fx, y + 2, fz))) return null;
    return y + 1;
  }

  _add(mob) {
    this.mobs.push(mob);
    this.ctx.scene.add(mob.model.group);
  }

  _remove(i) {
    const mob = this.mobs[i];
    this.ctx.scene.remove(mob.model.group);
    mob.dispose();
    this.mobs.splice(i, 1);
  }

  // --- Combat --------------------------------------------------------------

  // Premier mob touché par le rayon (eye, dir) dans la portée, ou null.
  raycast(eye, dir, reach) {
    let best = null;
    let bestT = reach;
    for (const mob of this.mobs) {
      const t = this._rayHit(eye, dir, mob);
      if (t != null && t < bestT) { bestT = t; best = mob; }
    }
    return best ? { mob: best, dist: bestT } : null;
  }

  // Intersection rayon / AABB (méthode des « slabs »).
  _rayHit(eye, dir, mob) {
    const minX = mob.position.x - mob.hw, maxX = mob.position.x + mob.hw;
    const minY = mob.position.y, maxY = mob.position.y + mob.height;
    const minZ = mob.position.z - mob.hw, maxZ = mob.position.z + mob.hw;

    let tmin = 0, tmax = 1e9;
    for (const [o, d, lo, hi] of [
      [eye.x, dir.x, minX, maxX],
      [eye.y, dir.y, minY, maxY],
      [eye.z, dir.z, minZ, maxZ],
    ]) {
      if (Math.abs(d) < 1e-8) {
        if (o < lo || o > hi) return null;
      } else {
        let t1 = (lo - o) / d, t2 = (hi - o) / d;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    return tmin;
  }

  // Le joueur frappe un mob.
  attackMob(mob) {
    mob.health -= PLAYER_ATTACK;
    // Recul + petit saut.
    const p = this.ctx.player.position;
    const dx = mob.position.x - p.x, dz = mob.position.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    mob.velocity.x += (dx / len) * 6;
    mob.velocity.z += (dz / len) * 6;
    mob.velocity.y = 4;

    if (mob.hostile) mob.aggro = true;
    else mob.fleeTimer = 5;

    this.ctx.sound.playHit();
    this.ctx.particles.emit(mob.position.x, mob.position.y + mob.height * 0.6, mob.position.z, '#c0392b', 5, 2);

    if (mob.health <= 0) this._die(mob);
  }

  _die(mob) {
    mob.dead = true;
    const c = itemColor(mob.def.drop) || '#888';
    this.ctx.particles.emit(mob.position.x, mob.position.y + mob.height * 0.5, mob.position.z, c, 14);
    this.ctx.sound.playMobDeath();
    // Le butin tombe au sol (ramassable).
    if (mob.def.drop != null) {
      this.ctx.drops.spawn(mob.def.drop, mob.position.x, mob.position.y + mob.height * 0.5, mob.position.z, 1);
    }
  }

  get count() {
    return this.mobs.length;
  }
}
