import * as THREE from 'three';
import { LEATHER, FEATHER, MEAT, ROTTEN, POWDER, ARROW } from '../blocks/BlockRegistry.js';
import { buildMobModel } from './mobModels.js';

// Caractéristiques par type de mob. hostile = attaque le joueur ; drop = objet
// lâché à la mort (par le joueur) ; villager = reste près du village.
export const MOB_DEFS = {
  cow:      { hw: 0.45, height: 1.3, speed: 1.6, health: 10, hostile: false, drop: MEAT },
  pig:      { hw: 0.45, height: 0.9, speed: 1.8, health: 10, hostile: false, drop: MEAT },
  sheep:    { hw: 0.45, height: 1.2, speed: 1.7, health: 8,  hostile: false, drop: MEAT },
  chicken:  { hw: 0.25, height: 0.6, speed: 1.6, health: 4,  hostile: false, drop: FEATHER },
  zombie:   { hw: 0.3,  height: 1.9, speed: 2.6, health: 16, hostile: true,  attack: 3, drop: ROTTEN },
  creeper:  { hw: 0.3,  height: 1.7, speed: 2.4, health: 14, hostile: true,  creeper: true, drop: POWDER },
  skeleton: { hw: 0.3,  height: 1.9, speed: 2.2, health: 14, hostile: true,  ranged: true, drop: ARROW },
  villager: { hw: 0.3,  height: 1.9, speed: 1.4, health: 12, hostile: false, villager: true },
};

export const PASSIVE_TYPES = ['cow', 'pig', 'sheep', 'chicken'];
export const HOSTILE_TYPES = ['zombie', 'zombie', 'creeper', 'skeleton']; // zombie plus fréquent

export class Mob {
  constructor(type, position) {
    const def = MOB_DEFS[type];
    this.type = type;
    this.def = def;
    this.hw = def.hw;
    this.height = def.height;
    this.speed = def.speed;
    this.maxHealth = def.health;
    this.health = def.health;
    this.hostile = def.hostile;

    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.onGround = false;
    this.moving = false;
    this.dead = false;

    // Mémoire d'IA.
    this.wanderTimer = 0;     // temps avant de changer de cap
    this.fleeTimer = 0;       // temps de fuite restant
    this.attackCd = 0;        // cooldown d'attaque (zombie)
    this.aggro = false;       // zombie a repéré le joueur
    this.homeX = position.x;  // ancrage (villageois)
    this.homeZ = position.z;

    this.fuse = 0;            // mèche du creeper
    this.love = false;       // mode reproduction (animaux nourris)
    this.loveTimer = 0;
    this.breedCd = 0;        // anti-spam après reproduction
    this.isBaby = false;     // bébé (plus petit, grandit)
    this.growTimer = 0;
    this.rangedCd = 0;       // cooldown de tir (squelette)

    this.model = buildMobModel(type);
    this.model.group.position.copy(position);
    this.model.group.rotation.y = this.yaw;
  }

  // Centre de la boîte de collision (pour le raycast d'attaque).
  center(out = new THREE.Vector3()) {
    return out.set(this.position.x, this.position.y + this.height / 2, this.position.z);
  }

  syncModel() {
    this.model.group.position.copy(this.position);
    this.model.group.rotation.y = this.yaw;
  }

  // Libère les géométries du modèle (à la suppression).
  dispose() {
    this.model.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}
