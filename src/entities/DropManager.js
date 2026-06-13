import * as THREE from 'three';
import { isSolid, isPlaceable, itemColor } from '../blocks/BlockRegistry.js';
import { buildBlockCubeGeometry } from '../render/blockCube.js';

// Objets lâchés au sol (par les blocs cassés ou les mobs tués). Ils tombent,
// se posent, tournent/flottent, et sont ramassés quand le joueur passe à
// proximité. Les drops proches de même type fusionnent pour limiter le nombre
// d'entités.
const GRAVITY = 20;
const PICKUP_RADIUS = 1.4;
const PICKUP_DELAY = 0.4;     // délai avant ramassage (l'objet « gicle »)
const MERGE_DIST = 1.2;
const ITEM_GEO = new THREE.BoxGeometry(0.28, 0.28, 0.28);

export class DropManager {
  constructor(ctx) {
    // ctx = { scene, world, player, inventory, sound, blockMaterial }
    this.ctx = ctx;
    this.drops = [];
    this._time = 0;
  }

  // Crée un objet lâché (ou fusionne avec un proche identique).
  spawn(id, x, y, z, count = 1) {
    for (const d of this.drops) {
      if (d.id === id) {
        const dx = d.pos.x - x, dz = d.pos.z - z, dy = d.pos.y - y;
        if (dx * dx + dy * dy + dz * dz < MERGE_DIST * MERGE_DIST) {
          d.count += count;
          return;
        }
      }
    }

    let mesh;
    if (isPlaceable(id)) {
      mesh = new THREE.Mesh(buildBlockCubeGeometry(id), this.ctx.blockMaterial);
      mesh.scale.setScalar(0.3);
    } else {
      mesh = new THREE.Mesh(ITEM_GEO, new THREE.MeshLambertMaterial({ color: itemColor(id) }));
    }
    mesh.position.set(x, y, z);
    this.ctx.scene.add(mesh);

    this.drops.push({
      id,
      count,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3((Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2),
      mesh,
      age: 0,
      onGround: false,
    });
  }

  update(dt) {
    this._time += dt;
    const player = this.ctx.player;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;

      // Physique : chute jusqu'au sol.
      if (!d.onGround) {
        d.vel.y -= GRAVITY * dt;
        d.pos.x += d.vel.x * dt;
        d.pos.z += d.vel.z * dt;
        const ny = d.pos.y + d.vel.y * dt;
        if (d.vel.y < 0 && isSolid(this.ctx.world.getBlock(Math.floor(d.pos.x), Math.floor(ny), Math.floor(d.pos.z)))) {
          d.pos.y = Math.floor(ny) + 1;
          d.vel.set(0, 0, 0);
          d.onGround = true;
        } else {
          d.pos.y = ny;
        }
      }

      // Rendu : flottement + rotation.
      d.mesh.position.set(d.pos.x, d.pos.y + 0.15 + Math.sin(this._time * 3 + i) * 0.07, d.pos.z);
      d.mesh.rotation.y += dt * 1.5;

      // Ramassage.
      const dx = d.pos.x - player.position.x;
      const dy = d.pos.y - (player.position.y + 0.9);
      const dz = d.pos.z - player.position.z;
      if (d.age > PICKUP_DELAY && dx * dx + dy * dy + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS) {
        this.ctx.inventory.add(d.id, d.count);
        if (this.ctx.sound) this.ctx.sound.playUi();
        this._remove(i);
        continue;
      }

      // Disparition si très loin du joueur.
      if (dx * dx + dz * dz > 70 * 70) this._remove(i);
    }
  }

  _remove(i) {
    const d = this.drops[i];
    this.ctx.scene.remove(d.mesh);
    // Bloc : géométrie unique (à libérer), material partagé. Objet : géométrie
    // partagée, material unique (à libérer).
    if (isPlaceable(d.id)) d.mesh.geometry.dispose();
    else d.mesh.material.dispose();
    this.drops.splice(i, 1);
  }

  get count() {
    return this.drops.length;
  }
}
