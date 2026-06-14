import * as THREE from 'three';
import { EYE_HEIGHT } from '../core/constants.js';
import { isSolid, isWater } from '../blocks/BlockRegistry.js';
import { moveWithCollisions } from './Physics.js';

const WALK_SPEED = 4.5;
const SPRINT_MULT = 1.6;
const FLY_SPEED = 10;
const JUMP_SPEED = 8.5;
const GRAVITY = 26;
const BASE_SENS = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.01;
const THIRD_PERSON_DIST = 4.5;

// Le joueur : état, caméra FPS/3e personne et logique de déplacement. La
// résolution des collisions est déléguée à Physics.
export class Player {
  constructor(camera, spawn) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ'; // yaw (Y) puis pitch (X) : pas de roll

    this.position = new THREE.Vector3(spawn.x, spawn.y, spawn.z); // pieds
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.yaw = 0;
    this.pitch = 0;

    this.flying = false;
    this.creative = false; // mode créatif : vol, blocs infinis, pas de dégâts
    this.onGround = false;
    this.inWater = false;
    this.moving = false;            // intention de déplacement (pour les anims)
    this.cameraMode = 'first';      // 'first' | 'third'
    this.mouseSensitivity = BASE_SENS;
    this.invertY = false;

    // Vie / dégâts de chute.
    this.spawn = spawn.clone();
    this.maxHealth = 20;
    this.health = 20;
    this.maxHunger = 20;
    this.hunger = 20;
    this.justDamaged = 0;           // quantité de dégâts subis cette frame (UI)
    this._hungerTimer = 0;
    this._starveTimer = 0;

    this._prevFly = false;
    this._airPeakY = spawn.y;       // point le plus haut atteint en l'air
    this._wasAir = false;
    this._regenTimer = 0;           // temps écoulé depuis le dernier dégât
    this._regenAcc = 0;

    this.syncCamera();
  }

  // Bloc à hauteur des pieds, pour détecter l'eau.
  _feetBlock(world) {
    return world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.2), Math.floor(this.position.z));
  }

  damage(amount) {
    if (amount <= 0 || this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.justDamaged += amount;
    this._regenTimer = 0;
  }

  respawn() {
    this.position.copy(this.spawn);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this._airPeakY = this.spawn.y;
    this.syncCamera();
  }

  // Manger : restaure de la faim.
  eat(value) {
    if (this.hunger >= this.maxHunger) return false;
    this.hunger = Math.min(this.maxHunger, this.hunger + value);
    return true;
  }

  setSensitivity(mult) {
    this.mouseSensitivity = BASE_SENS * mult;
  }

  toggleCamera() {
    this.cameraMode = this.cameraMode === 'first' ? 'third' : 'first';
  }

  update(input, world, dt) {
    this.handleLook(input);
    this.handleFlyToggle(input);

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const forward = { x: -sin, z: -cos };
    const right = { x: cos, z: -sin };

    let mx = 0;
    let mz = 0;
    if (input.isDown('KeyW')) { mx += forward.x; mz += forward.z; }
    if (input.isDown('KeyS')) { mx -= forward.x; mz -= forward.z; }
    if (input.isDown('KeyD')) { mx += right.x; mz += right.z; }
    if (input.isDown('KeyA')) { mx -= right.x; mz -= right.z; }

    const len = Math.hypot(mx, mz);
    this.moving = len > 0;
    if (len > 0) { mx /= len; mz /= len; }

    this.inWater = isWater(this._feetBlock(world));

    if (this.flying) this.updateFlying(input, mx, mz);
    else if (this.inWater) this.updateSwimming(input, mx, mz, dt);
    else this.updateWalking(input, mx, mz, dt);

    this.onGround = moveWithCollisions(world, this.position, this.velocity, dt);
    this._updateFallAndRegen(dt);
    this.syncCamera(world);
  }

  // Dégâts de chute (selon la distance) + régénération lente.
  _updateFallAndRegen(dt) {
    // Créatif : invulnérable, jamais affamé.
    if (this.creative) {
      this.health = this.maxHealth;
      this.hunger = this.maxHunger;
      this._wasAir = !this.onGround;
      this._airPeakY = this.position.y;
      return;
    }

    if (!this.onGround) {
      this._airPeakY = Math.max(this._airPeakY, this.position.y);
    } else {
      if (this._wasAir && !this.flying && !this.inWater) {
        const fall = this._airPeakY - this.position.y;
        if (fall > 3.5) this.damage(Math.floor(fall - 3.5));
      }
      this._airPeakY = this.position.y;
    }
    this._wasAir = !this.onGround;

    // Faim : se vide avec le temps (plus vite en mouvement).
    this._hungerTimer += dt * (this.moving ? 1.7 : 1);
    if (this._hungerTimer > 8) {
      this._hungerTimer = 0;
      if (this.hunger > 0) this.hunger--;
    }
    // Famine : si la faim est vide, on perd des PV (sans descendre sous 1).
    if (this.hunger <= 0 && this.health > 1) {
      this._starveTimer += dt;
      if (this._starveTimer > 4) { this._starveTimer = 0; this.damage(1); }
    }

    // Régénération : 1 PV toutes les 1.5 s après 5 s sans dégât, si bien nourri.
    this._regenTimer += dt;
    if (this._regenTimer > 5 && this.hunger >= 18 && this.health > 0 && this.health < this.maxHealth) {
      this._regenAcc += dt;
      if (this._regenAcc >= 1.5) { this.health += 1; this._regenAcc = 0; }
    }
  }

  handleLook(input) {
    const [dx, dy] = input.consumeMouse();
    this.yaw -= dx * this.mouseSensitivity;
    this.pitch -= dy * this.mouseSensitivity * (this.invertY ? -1 : 1);
    if (this.pitch > MAX_PITCH) this.pitch = MAX_PITCH;
    if (this.pitch < -MAX_PITCH) this.pitch = -MAX_PITCH;
  }

  handleFlyToggle(input) {
    const f = input.isDown('KeyF');
    // Le vol n'est disponible qu'en mode créatif.
    if (f && !this._prevFly && this.creative) {
      this.flying = !this.flying;
      this.velocity.y = 0;
    }
    this._prevFly = f;
  }

  updateWalking(input, mx, mz, dt) {
    const sprint = input.isDown('ShiftLeft') ? SPRINT_MULT : 1;
    const speed = WALK_SPEED * sprint;
    this.velocity.x = mx * speed;
    this.velocity.z = mz * speed;

    this.velocity.y -= GRAVITY * dt;
    if (this.velocity.y < -55) this.velocity.y = -55;

    if (this.onGround && input.isDown('Space')) this.velocity.y = JUMP_SPEED;
  }

  updateFlying(input, mx, mz) {
    this.velocity.x = mx * FLY_SPEED;
    this.velocity.z = mz * FLY_SPEED;
    let vy = 0;
    if (input.isDown('Space')) vy += FLY_SPEED;
    if (input.isDown('ShiftLeft')) vy -= FLY_SPEED;
    this.velocity.y = vy;
  }

  // Nage : déplacement ralenti, flottabilité, montée avec Espace.
  updateSwimming(input, mx, mz, dt) {
    const speed = WALK_SPEED * 0.6;
    this.velocity.x = mx * speed;
    this.velocity.z = mz * speed;

    this.velocity.y -= GRAVITY * 0.25 * dt; // coulage lent
    if (this.velocity.y < -4) this.velocity.y = -4;
    if (input.isDown('Space')) this.velocity.y = 4; // remonter
  }

  // Position des yeux (origine du raycast d'interaction).
  getEyePosition(target = new THREE.Vector3()) {
    return target.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }

  // Direction de visée, calculée depuis yaw/pitch (indépendante du mode caméra,
  // donc valable aussi en 3e personne).
  getDirection(target = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return target.set(-cp * Math.sin(this.yaw), Math.sin(this.pitch), -cp * Math.cos(this.yaw));
  }

  // Compat : l'origine du raycast = les yeux.
  getEye() {
    return this.getEyePosition(this._eyeTmp || (this._eyeTmp = new THREE.Vector3()));
  }

  syncCamera(world) {
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    const eye = this.getEyePosition(this._camTmp || (this._camTmp = new THREE.Vector3()));

    if (this.cameraMode === 'first' || !world) {
      this.camera.position.copy(eye);
      return;
    }

    // 3e personne : recule la caméra derrière les yeux, le long de l'opposé du
    // regard, en s'arrêtant avant un bloc solide (anti-clipping).
    const dir = this.getDirection(this._dirTmp || (this._dirTmp = new THREE.Vector3()));
    let dist = THIRD_PERSON_DIST;
    for (let t = 0.3; t <= THIRD_PERSON_DIST; t += 0.2) {
      const bx = Math.floor(eye.x - dir.x * t);
      const by = Math.floor(eye.y - dir.y * t);
      const bz = Math.floor(eye.z - dir.z * t);
      if (isSolid(world.getBlock(bx, by, bz))) {
        dist = Math.max(0.5, t - 0.3);
        break;
      }
    }
    this.camera.position.set(
      eye.x - dir.x * dist,
      eye.y - dir.y * dist,
      eye.z - dir.z * dist
    );
  }
}
