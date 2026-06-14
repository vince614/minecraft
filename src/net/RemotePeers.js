import * as THREE from 'three';
import { PlayerModel } from '../player/PlayerModel.js';
import { buildMobModel } from '../entities/mobModels.js';

// Affiche les autres joueurs (avatars) et les mobs reçus du réseau, avec un
// lissage (lerp) des positions pour un rendu fluide malgré le faible débit.
export class RemotePeers {
  constructor(scene, blockMaterial) {
    this.scene = scene;
    this.mat = blockMaterial;
    this.players = new Map(); // peerId -> { model, target, yaw, pitch, item, moving }
    this.mobs = new Map();    // k -> { type, model, target, yaw, moving }
  }

  updatePlayer(id, msg) {
    let r = this.players.get(id);
    if (!r) {
      const model = new PlayerModel(this.scene, this.mat);
      model.setVisible(true);
      r = { model, target: new THREE.Vector3(msg.x, msg.y, msg.z), yaw: 0, pitch: 0, item: 0, moving: false };
      this.players.set(id, r);
    }
    r.target.set(msg.x, msg.y, msg.z);
    r.yaw = msg.yaw; r.pitch = msg.pitch; r.item = msg.item; r.moving = msg.moving;
  }

  removePlayer(id) {
    const r = this.players.get(id);
    if (r) { this.scene.remove(r.model.root); this.players.delete(id); }
  }

  updateMobs(list) {
    const seen = new Set();
    for (const m of list) {
      seen.add(m.k);
      let r = this.mobs.get(m.k);
      if (!r || r.type !== m.type) {
        if (r) this.scene.remove(r.model.group);
        const model = buildMobModel(m.type);
        this.scene.add(model.group);
        r = { type: m.type, model, target: new THREE.Vector3(m.x, m.y, m.z), yaw: 0, moving: false };
        this.mobs.set(m.k, r);
      }
      r.target.set(m.x, m.y, m.z); r.yaw = m.yaw; r.moving = m.moving;
    }
    for (const [k, r] of this.mobs) {
      if (!seen.has(k)) { this.scene.remove(r.model.group); this.mobs.delete(k); }
    }
  }

  update(dt) {
    const a = Math.min(1, dt * 10);
    for (const r of this.players.values()) {
      r.model.setHeld(r.item);
      r.model.root.position.lerp(r.target, a);
      r.model.update(dt, r.model.root.position, r.yaw, r.pitch, r.moving);
    }
    for (const r of this.mobs.values()) {
      r.model.group.position.lerp(r.target, a);
      r.model.group.rotation.y = r.yaw;
      r.model.animate(dt, r.moving);
    }
  }

  clear() {
    for (const r of this.players.values()) this.scene.remove(r.model.root);
    for (const r of this.mobs.values()) this.scene.remove(r.model.group);
    this.players.clear();
    this.mobs.clear();
  }
}
