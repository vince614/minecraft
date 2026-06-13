import * as THREE from 'three';
import { REACH, PLAYER_HALF_WIDTH, PLAYER_HEIGHT } from '../core/constants.js';
import { AIR, isPlaceable, isInteractive } from '../blocks/BlockRegistry.js';
import { raycastVoxels } from './VoxelRaycaster.js';

const BEDROCK = 4; // indestructible

// Gère le ciblage, le surlignage du bloc visé, et les actions casser/poser.
// Relié à l'inventaire : casser un bloc le récupère, poser en consomme un
// (sauf en mode vol créatif où les blocs sont infinis).
export class BlockInteraction {
  constructor(scene, world, player, inventory, hooks = {}) {
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.hooks = hooks; // { onOpenCraft(gridSize), onAction() }
    this.target = null;

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
    this._eye = new THREE.Vector3();
  }

  update(clicks) {
    const eye = this.player.getEyePosition(this._eye);
    const dir = this.player.getDirection(this._dir);
    this.target = raycastVoxels(this.world, eye, dir, REACH);

    if (this.target) {
      this.highlight.visible = true;
      this.highlight.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
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
    const id = this.world.getBlock(this.target.x, this.target.y, this.target.z);
    if (id === AIR || id === BEDROCK) return;

    this.world.setBlock(this.target.x, this.target.y, this.target.z, AIR);
    // En survie, le bloc cassé rejoint l'inventaire.
    if (!this.player.flying) this.inventory.add(id, 1);
    if (this.hooks.onBreak) this.hooks.onBreak(id);
  }

  placeBlock() {
    if (!this.target) return;

    // Clic droit sur un bloc interactif (établi) -> ouvre le craft 3x3.
    const targetId = this.world.getBlock(this.target.x, this.target.y, this.target.z);
    if (isInteractive(targetId)) {
      if (this.hooks.onOpenCraft) this.hooks.onOpenCraft(3);
      return;
    }

    const id = this.inventory.selectedId();
    if (!isPlaceable(id)) return; // rien de plaçable sélectionné

    const px = this.target.x + this.target.nx;
    const py = this.target.y + this.target.ny;
    const pz = this.target.z + this.target.nz;
    if (this.intersectsPlayer(px, py, pz)) return;

    // En survie, on consomme un objet ; en créatif (vol), blocs infinis.
    if (!this.player.flying) {
      const stack = this.inventory.getSelected();
      if (!stack || stack.count <= 0) return;
      this.inventory.consumeSelected(1);
    }

    this.world.setBlock(px, py, pz, id);
    if (this.hooks.onPlace) this.hooks.onPlace(id);
  }

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
