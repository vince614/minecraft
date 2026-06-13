import * as THREE from 'three';
import { RENDER_DISTANCE, CHUNK_SIZE } from './core/constants.js';
import { createRenderer } from './render/createRenderer.js';
import { setupSky } from './render/Skybox.js';
import { createBlockMaterial } from './render/BlockMaterial.js';
import { World } from './world/World.js';
import { Player } from './player/Player.js';
import { InputManager } from './input/InputManager.js';
import { BlockInteraction } from './interaction/BlockInteraction.js';
import { Hotbar } from './ui/Hotbar.js';

// Orchestrateur principal : crée et câble tous les modules, puis fait tourner
// la boucle de jeu.
export class Game {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = createRenderer(canvas);
    this.scene = new THREE.Scene();
    setupSky(this.scene);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      RENDER_DISTANCE * CHUNK_SIZE * 1.5
    );

    // Monde + material partagé.
    this.material = createBlockMaterial();
    this.world = new World(this.scene, this.material, 1337);

    // Point d'apparition : au-dessus du sol en (0,0).
    const groundH = this.world.generator.heightAt(0, 0);
    const spawn = new THREE.Vector3(0.5, groundH + 2, 0.5);
    this.player = new Player(this.camera, spawn);

    this.input = new InputManager(canvas);
    this.hotbar = new Hotbar(document.getElementById('hotbar'));
    this.interaction = new BlockInteraction(
      this.scene,
      this.world,
      this.player,
      () => this.hotbar.selectedBlockId()
    );

    this.hud = document.getElementById('hud');
    this.overlay = document.getElementById('overlay');

    this._setupOverlay();
    this._setupResize();

    // Préchargement : génère les chunks les plus proches pour que le joueur ait
    // un sol sous les pieds dès le départ (le reste se charge en streaming).
    for (let i = 0; i < 12; i++) {
      this.world.update(this.player.position.x, this.player.position.z);
    }

    // Compteurs FPS / HUD.
    this._frames = 0;
    this._fpsTimer = 0;
    this._fps = 0;
    this._lastTime = performance.now();

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _setupOverlay() {
    this.overlay.addEventListener('click', () => this.input.requestLock());
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      this.overlay.classList.toggle('hidden', locked);
    });
  }

  _setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _loop() {
    requestAnimationFrame(this._loop);

    const now = performance.now();
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    if (dt > 0.05) dt = 0.05; // borne le pas pour stabiliser la physique

    const locked = this.input.locked;

    if (locked) {
      // Sélection de bloc (clavier + molette).
      const slot = this.input.consumeSlotKey();
      if (slot !== null) this.hotbar.select(slot);
      const wheel = this.input.consumeWheel();
      if (wheel !== 0) this.hotbar.scroll(wheel);

      this.player.update(this.input, this.world, dt);
      this.interaction.update(this.input.consumeClicks());
    }

    // Le monde se charge/décharge en continu autour du joueur.
    this.world.update(this.player.position.x, this.player.position.z);

    this.renderer.render(this.scene, this.camera);
    this._updateHud(dt);
  }

  _updateHud(dt) {
    this._frames++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.5) {
      this._fps = Math.round(this._frames / this._fpsTimer);
      this._frames = 0;
      this._fpsTimer = 0;
    }
    const p = this.player.position;
    this.hud.innerHTML =
      `FPS ${this._fps}<br>` +
      `XYZ ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}<br>` +
      `Chunks ${this.world.meshedCount}<br>` +
      `Mode ${this.player.flying ? 'Créatif (vol)' : 'Survie'}`;
  }
}
