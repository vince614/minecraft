import * as THREE from 'three';
import { EYE_HEIGHT } from '../core/constants.js';
import { moveWithCollisions } from './Physics.js';

const WALK_SPEED = 4.5;
const SPRINT_MULT = 1.6;
const FLY_SPEED = 10;
const JUMP_SPEED = 8.5;
const GRAVITY = 26;
const MOUSE_SENS = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.01;

// Le joueur : état, caméra FPS et logique de déplacement. La résolution des
// collisions est déléguée à Physics.
export class Player {
  constructor(camera, spawn) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ'; // yaw (Y) puis pitch (X) : pas de roll

    // Position = pieds du joueur.
    this.position = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.yaw = 0;   // rotation horizontale
    this.pitch = 0; // rotation verticale

    this.flying = false;   // mode créatif (vol)
    this.onGround = false;
    this._prevFly = false;  // pour détecter l'appui sur F (front montant)

    this.syncCamera();
  }

  update(input, world, dt) {
    this.handleLook(input);
    this.handleFlyToggle(input);

    // Direction horizontale visée (repère caméra projeté au sol).
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

    // Normalise pour éviter le « speed boost » en diagonale.
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }

    if (this.flying) {
      this.updateFlying(input, mx, mz);
    } else {
      this.updateWalking(input, mx, mz, dt);
    }

    this.onGround = moveWithCollisions(world, this.position, this.velocity, dt);
    this.syncCamera();
  }

  handleLook(input) {
    const [dx, dy] = input.consumeMouse();
    this.yaw -= dx * MOUSE_SENS;
    this.pitch -= dy * MOUSE_SENS;
    if (this.pitch > MAX_PITCH) this.pitch = MAX_PITCH;
    if (this.pitch < -MAX_PITCH) this.pitch = -MAX_PITCH;
  }

  handleFlyToggle(input) {
    const f = input.isDown('KeyF');
    if (f && !this._prevFly) {
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

    // Gravité.
    this.velocity.y -= GRAVITY * dt;
    if (this.velocity.y < -55) this.velocity.y = -55; // vitesse terminale

    // Saut.
    if (this.onGround && input.isDown('Space')) {
      this.velocity.y = JUMP_SPEED;
    }
  }

  updateFlying(input, mx, mz) {
    this.velocity.x = mx * FLY_SPEED;
    this.velocity.z = mz * FLY_SPEED;
    let vy = 0;
    if (input.isDown('Space')) vy += FLY_SPEED;
    if (input.isDown('ShiftLeft')) vy -= FLY_SPEED;
    this.velocity.y = vy;
  }

  syncCamera() {
    this.camera.position.set(
      this.position.x,
      this.position.y + EYE_HEIGHT,
      this.position.z
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  // Origine et direction du regard, pour le raycast d'interaction.
  getEye() {
    return this.camera.position;
  }

  getDirection(target = new THREE.Vector3()) {
    this.camera.getWorldDirection(target);
    return target;
  }
}
