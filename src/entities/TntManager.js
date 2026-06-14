import * as THREE from 'three';
import { AIR } from '../blocks/BlockRegistry.js';
import { buildBlockCubeGeometry } from '../render/blockCube.js';

const TNT_ID = 17;
const TNT_POWER = 4;

// TNT amorcées : un bloc de TNG allumé devient une entité qui clignote pendant
// sa mèche puis explose. ctx = { scene, world, blockMaterial, explodeAt }.
export class TntManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.active = [];
    this._geo = buildBlockCubeGeometry(TNT_ID);
  }

  // Amorce la TNT au bloc (x,y,z). Le bloc disparaît au profit de l'entité.
  ignite(x, y, z, fuse = 2.2) {
    this.ctx.world.setBlock(x, y, z, AIR);
    const mesh = new THREE.Mesh(this._geo, this.ctx.blockMaterial);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.ctx.scene.add(mesh);
    this.active.push({ x, y, z, fuse, mesh });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = this.active[i];
      t.fuse -= dt;
      // Clignotement : pulse d'échelle de plus en plus rapide.
      const s = 1 + 0.12 * Math.abs(Math.sin(t.fuse * (8 + (2.2 - t.fuse) * 6)));
      t.mesh.scale.setScalar(s);
      if (t.fuse <= 0) {
        this.ctx.scene.remove(t.mesh);
        this.active.splice(i, 1);
        this.ctx.explodeAt(t.x + 0.5, t.y + 0.5, t.z + 0.5, TNT_POWER);
      }
    }
  }

  get count() {
    return this.active.length;
  }
}
