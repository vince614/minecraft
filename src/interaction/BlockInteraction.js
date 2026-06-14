import * as THREE from 'three';
import { REACH, PLAYER_HALF_WIDTH, PLAYER_HEIGHT } from '../core/constants.js';
import {
  AIR, isPlaceable, isInteractive, hardnessOf,
  attackDamageOf, miningMultiplier, isFood, isContainer, isEnchantTable,
} from '../blocks/BlockRegistry.js';
import { raycastVoxels } from './VoxelRaycaster.js';

const BEDROCK = 4; // indestructible
const TNT_ID = 17;

// Ciblage, surlignage, et actions casser/poser. Le minage est PROGRESSIF :
// maintenir le clic gauche accumule des dégâts selon la dureté du bloc ; en
// créatif (vol) la casse est quasi instantanée. Le clic droit pose des blocs
// (répétition avec cooldown) ou ouvre l'établi.
export class BlockInteraction {
  constructor(scene, world, player, inventory, hooks = {}) {
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.hooks = hooks; // { onOpenCraft, onBreak(id,x,y,z), onPlace(id,x,y,z), onMineProgress(frac) }
    this.target = null;
    this.mobManager = null; // défini par le jeu (attaque des mobs)

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

    // État de minage / pose.
    this._mineKey = null;
    this._mineProgress = 0;
    this._breakCd = 0;
    this._placeCd = 0;
    this._prevRight = false;
    this.mining = false; // true tant qu'on casse activement un bloc (anim)
  }

  update(dt, input) {
    this.mining = false;
    const eye = this.player.getEyePosition(this._eye);
    const dir = this.player.getDirection(this._dir);
    this.target = raycastVoxels(this.world, eye, dir, REACH);

    // On consomme le front de clic gauche à chaque frame (sert à frapper un mob).
    const clicked = input.consumeLeftClick();

    // Un mob est-il visé, et plus proche que le bloc ?
    const mobHit = this.mobManager ? this.mobManager.raycast(eye, dir, REACH) : null;
    const blockDist = this.target ? this.target.dist : Infinity;
    if (mobHit && mobHit.dist < blockDist) {
      this.highlight.visible = false;
      this._setProgress(0);
      this._mineKey = null;
      this._mineProgress = 0;
      const sel = this.inventory.selectedId();
      if (clicked) {
        const stack = this.inventory.getSelected();
        const sharp = (stack && stack.ench && stack.ench.sharpness) || 0;
        this.mobManager.attackMob(mobHit.mob, attackDamageOf(sel) + sharp * 2);
        if (this.inventory.damageSelectedTool() === 'broke' && this.hooks.onToolBroke) this.hooks.onToolBroke();
      }
      // Nourrir un animal (clic droit en tenant de la nourriture).
      const rightEdge = input.rightDown && !this._prevRight;
      if (rightEdge && isFood(sel) && this.mobManager.feed(mobHit.mob)) {
        this.inventory.consumeSelected(1);
      }
      this._prevRight = input.rightDown;
      return;
    }

    if (this.target) {
      this.highlight.visible = true;
      this.highlight.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    } else {
      this.highlight.visible = false;
    }

    this._updateMining(dt, input);
    this._updatePlacing(dt, input);
  }

  _updateMining(dt, input) {
    const t = this.target;
    const id = t ? this.world.getBlock(t.x, t.y, t.z) : AIR;
    const breakable = t && id !== AIR && id !== BEDROCK;

    if (!input.leftDown || !breakable) {
      this._mineKey = null;
      this._mineProgress = 0;
      this._breakCd = 0;
      this._setProgress(0);
      return;
    }

    this.mining = true; // on frappe le bloc (anim de minage)
    const key = `${t.x},${t.y},${t.z}`;
    if (key !== this._mineKey) {
      this._mineKey = key;
      this._mineProgress = 0;
    }

    if (this.player.creative) {
      // Créatif : casse quasi instantanée, avec un petit délai entre blocs.
      this._breakCd -= dt;
      if (this._breakCd <= 0) {
        this._doBreak(id);
        this._breakCd = 0.18;
        this._mineKey = null;
      }
      this._setProgress(0);
      return;
    }

    // Survie : progression selon la dureté (accélérée par pioche + Efficacité).
    this._mineProgress += dt;
    const stack = this.inventory.getSelected();
    const eff = (stack && stack.ench && stack.ench.efficiency) || 0;
    const need = hardnessOf(id) / (miningMultiplier(this.inventory.selectedId()) + eff);
    this._setProgress(Math.min(1, this._mineProgress / need));
    if (this._mineProgress >= need) {
      this._doBreak(id);
      this._mineProgress = 0;
      this._mineKey = null;
    }
  }

  _updatePlacing(dt, input) {
    this._placeCd -= dt;
    const t = this.target;
    const rightEdge = input.rightDown && !this._prevRight;
    const targetId = t ? this.world.getBlock(t.x, t.y, t.z) : AIR;
    const sel = this.inventory.selectedId();

    if (t && rightEdge && isInteractive(targetId)) {
      if (this.hooks.onOpenCraft) this.hooks.onOpenCraft(3); // établi
    } else if (t && rightEdge && isContainer(targetId)) {
      if (this.hooks.onOpenChest) this.hooks.onOpenChest(t.x, t.y, t.z); // coffre
    } else if (t && rightEdge && isEnchantTable(targetId)) {
      if (this.hooks.onOpenEnchant) this.hooks.onOpenEnchant(); // table d'enchantement
    } else if (t && rightEdge && targetId === TNT_ID) {
      if (this.hooks.onIgnite) this.hooks.onIgnite(t.x, t.y, t.z); // amorce la TNT
    } else if (rightEdge && sel >= 100) {
      if (this.hooks.onUseItem) this.hooks.onUseItem(sel); // arc, nourriture…
    } else if (isPlaceable(sel) && input.rightDown && this._placeCd <= 0) {
      if (this._doPlace()) this._placeCd = 0.22;
    }
    this._prevRight = input.rightDown;
  }

  _setProgress(frac) {
    if (this.hooks.onMineProgress) this.hooks.onMineProgress(frac);
  }

  _doBreak(id) {
    const { x, y, z } = this.target;
    // Un coffre cassé lâche tout son contenu.
    if (isContainer(id)) {
      const slots = this.world.removeChest(x, y, z);
      if (this.hooks.onChestBroken) this.hooks.onChestBroken(slots, x, y, z);
    }
    this.world.setBlock(x, y, z, AIR);
    // L'objet n'est plus ajouté directement : il tombe au sol (géré par le
    // hook onBreak via le DropManager).
    if (this.hooks.onBreak) this.hooks.onBreak(id, x, y, z);
    // Usure de l'outil tenu (en survie).
    if (!this.player.creative && this.inventory.damageSelectedTool() === 'broke' && this.hooks.onToolBroke) {
      this.hooks.onToolBroke();
    }
  }

  _doPlace() {
    if (!this.target) return false;
    const id = this.inventory.selectedId();
    if (!isPlaceable(id)) return false;

    const px = this.target.x + this.target.nx;
    const py = this.target.y + this.target.ny;
    const pz = this.target.z + this.target.nz;
    if (this.intersectsPlayer(px, py, pz)) return false;
    // On ne pose pas dans un bloc déjà solide.
    if (this.world.getBlock(px, py, pz) !== AIR && this.world.getBlock(px, py, pz) !== 12) return false;

    if (!this.player.creative) {
      const stack = this.inventory.getSelected();
      if (!stack || stack.count <= 0) return false;
      this.inventory.consumeSelected(1);
    }

    this.world.setBlock(px, py, pz, id);
    if (this.hooks.onPlace) this.hooks.onPlace(id, px, py, pz);
    return true;
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
