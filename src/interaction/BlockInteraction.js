import * as THREE from 'three';
import { REACH, PLAYER_HALF_WIDTH, PLAYER_HEIGHT } from '../core/constants.js';
import { AIR } from '../blocks/BlockRegistry.js';
import { raycastVoxels } from './VoxelRaycaster.js';

// Gère le ciblage, le surlignage du bloc visé, et les actions casser/poser.
export class BlockInteraction {
  constructor(scene, world, player, getSelectedBlock) {
    this.world = world;
    this.player = player;
    this.getSelectedBlock = getSelectedBlock;
    this.target = null; // dernier résultat de raycast

    // Cadre de surlignage : arêtes d'un cube légèrement agrandi.
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(box);
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })
    );
    this.highlight.visible = false;
    this.highlight.renderOrder = 999;
    scene.add(this.highlight);

    this._dir = new THREE.Vector3();
  }

  // Met à jour le bloc visé et exécute les clics mis en file ce frame.
  update(clicks) {
    const eye = this.player.getEye();
    const dir = this.player.getDirection(this._dir);
    this.target = raycastVoxels(this.world, eye, dir, REACH);

    if (this.target) {
      this.highlight.visible = true;
      this.highlight.position.set(
        this.target.x + 0.5,
        this.target.y + 0.5,
        this.target.z + 0.5
      );
    } else {
      this.highlight.visible = false;
    }

    for (const action of clicks) {
      if (action === 'break') this.breakBlock();
      else if (action === 'place') this.placeBlock();
    }
  }

  breakBlock() {
    if (!this.target) return;
    this.world.setBlock(this.target.x, this.target.y, this.target.z, AIR);
  }

  placeBlock() {
    if (!this.target) return;
    // On pose dans la cellule adjacente à la face visée.
    const px = this.target.x + this.target.nx;
    const py = this.target.y + this.target.ny;
    const pz = this.target.z + this.target.nz;

    // Empêche de poser un bloc dans le joueur (sinon on se coince).
    if (this.intersectsPlayer(px, py, pz)) return;

    this.world.setBlock(px, py, pz, this.getSelectedBlock());
  }

  // La cellule (vx,vy,vz) chevauche-t-elle la boîte du joueur ?
  intersectsPlayer(vx, vy, vz) {
    const p = this.player.position;
    const minX = p.x - PLAYER_HALF_WIDTH;
    const maxX = p.x + PLAYER_HALF_WIDTH;
    const minY = p.y;
    const maxY = p.y + PLAYER_HEIGHT;
    const minZ = p.z - PLAYER_HALF_WIDTH;
    const maxZ = p.z + PLAYER_HALF_WIDTH;
    return (
      vx + 1 > minX && vx < maxX &&
      vy + 1 > minY && vy < maxY &&
      vz + 1 > minZ && vz < maxZ
    );
  }
}
