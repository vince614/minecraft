import * as THREE from 'three';
import { RENDER_DISTANCE, CHUNK_SIZE } from './core/constants.js';
import { createRenderer } from './render/createRenderer.js';
import { setupSky } from './render/Skybox.js';
import { createBlockMaterial } from './render/BlockMaterial.js';
import { World } from './world/World.js';
import { Player } from './player/Player.js';
import { PlayerModel } from './player/PlayerModel.js';
import { InputManager } from './input/InputManager.js';
import { BlockInteraction } from './interaction/BlockInteraction.js';
import { Inventory } from './inventory/Inventory.js';
import { Hotbar } from './ui/Hotbar.js';
import { Menu } from './ui/Menu.js';
import { InventoryUI } from './ui/InventoryUI.js';
import { ViewModel } from './render/ViewModel.js';
import { SoundManager } from './audio/SoundManager.js';

// États d'interface possibles.
const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSE: 'pause', INVENTORY: 'inventory' };

// Orchestrateur principal : crée et câble tous les modules, gère les états
// d'écran et fait tourner la boucle de jeu.
export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = STATE.MENU;

    this.renderer = createRenderer(canvas);
    this.scene = new THREE.Scene();
    setupSky(this.scene);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      RENDER_DISTANCE * CHUNK_SIZE * 1.5
    );

    this.material = createBlockMaterial();
    this.world = new World(this.scene, this.material, 1337);

    // Joueur + apparition au-dessus du sol.
    const groundH = this.world.generator.heightAt(0, 0);
    const spawn = new THREE.Vector3(0.5, groundH + 2, 0.5);
    this.player = new Player(this.camera, spawn);
    this.playerModel = new PlayerModel(this.scene);

    // Inventaire partagé (hotbar + sac + craft).
    this.inventory = new Inventory();

    this.sound = new SoundManager();

    this.input = new InputManager(canvas);
    this.hotbar = new Hotbar(document.getElementById('hotbar'), this.inventory);
    this.inventoryUI = new InventoryUI(this.inventory, () => this.sound.playCraft());
    this.viewModel = new ViewModel(this.material);

    this.interaction = new BlockInteraction(this.scene, this.world, this.player, this.inventory, {
      onOpenCraft: (n) => this.openInventory(n),
      onBreak: (id) => { this.viewModel.triggerSwing(); this.sound.playBreak(id); },
      onPlace: (id) => { this.viewModel.triggerSwing(); this.sound.playPlace(id); },
    });

    this.menu = new Menu({
      onPlay: () => this.enterPlaying(),
      onResume: () => this.enterPlaying(),
      onQuit: () => this.toMainMenu(),
      onSettings: (s) => this.applySettings(s),
      onUiClick: () => { this.sound.resume(); this.sound.playUi(); },
    });

    // État pour les bruits de pas / atterrissage.
    this._stepTimer = 0;
    this._wasOnGround = true;

    this.hud = document.getElementById('hud');

    this._setupPointerLock();
    this._setupResize();
    this.menu.showMain();

    // Préchargement des chunks proches pour avoir un sol au démarrage.
    for (let i = 0; i < 12; i++) {
      this.world.update(this.player.position.x, this.player.position.z);
    }

    this._frames = 0;
    this._fpsTimer = 0;
    this._fps = 0;
    this._lastTime = performance.now();

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // --- Gestion des états ----------------------------------------------------

  enterPlaying() {
    this.state = STATE.PLAYING;
    this.menu.hideAll();
    if (this.inventoryUI.isOpen) this.inventoryUI.close();
    this.sound.resume(); // réveille l'audio sur ce geste utilisateur
    this.input.requestLock();
  }

  toMainMenu() {
    this.state = STATE.MENU;
    if (this.inventoryUI.isOpen) this.inventoryUI.close();
    if (document.pointerLockElement) document.exitPointerLock();
    this.menu.showMain();
  }

  openPause() {
    this.state = STATE.PAUSE;
    this.menu.showPause();
  }

  // Ouvre l'inventaire (gridSize 2) ou l'établi (gridSize 3).
  openInventory(gridSize) {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.INVENTORY;
    if (document.pointerLockElement) document.exitPointerLock();
    this.inventoryUI.open(gridSize);
  }

  closeInventory() {
    this.inventoryUI.close();
    this.enterPlaying();
  }

  _setupPointerLock() {
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked) {
        this.state = STATE.PLAYING;
        this.menu.hideAll();
      } else if (this.state === STATE.PLAYING) {
        // Perte du verrouillage en jeu (Échap ou focus perdu) -> pause.
        this.openPause();
      }
    });

    // Filet de sécurité : si le re-verrouillage programmatique a échoué,
    // cliquer sur le canvas le redemande (geste utilisateur direct).
    this.canvas.addEventListener('click', () => {
      this.sound.resume();
      if (this.state === STATE.PLAYING && !this.input.locked) this.input.requestLock();
    });
  }

  _setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.viewModel.resize();
    });
  }

  // Applique les réglages des options en direct.
  applySettings(s) {
    this.world.setRenderDistance(s.renderDistance);
    this.player.setSensitivity(s.sensitivity);
    this.sound.setVolume(s.volume);
    this.camera.fov = s.fov;

    const far = s.renderDistance * CHUNK_SIZE;
    this.camera.far = far * 1.5;
    this.camera.updateProjectionMatrix();
    if (this.scene.fog) {
      this.scene.fog.near = far * 0.55;
      this.scene.fog.far = far * 0.95;
    }
  }

  // --- Boucle ---------------------------------------------------------------

  _loop() {
    requestAnimationFrame(this._loop);

    const now = performance.now();
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    if (dt > 0.05) dt = 0.05;

    this._handleGlobalKeys();

    if (this.state === STATE.PLAYING && this.input.locked) {
      const slot = this.input.consumeSlotKey();
      if (slot !== null) { this.hotbar.select(slot); this.sound.playUi(); }
      const wheel = this.input.consumeWheel();
      if (wheel !== 0) { this.hotbar.scroll(wheel); this.sound.playUi(); }

      this.player.update(this.input, this.world, dt);
      this.interaction.update(this.input.consumeClicks());
      this._handleFootsteps(dt);
    }

    // Vue main (1re personne) / avatar (3e personne).
    const firstPerson = this.player.cameraMode === 'first';
    this.viewModel.setHeld(this.inventory.selectedId());
    this.viewModel.update(dt, this.player.moving);
    this.playerModel.setVisible(!firstPerson);
    if (!firstPerson) {
      this.playerModel.update(dt, this.player.position, this.player.yaw, this.player.pitch, this.player.moving);
    }

    // Streaming du monde autour du joueur.
    this.world.update(this.player.position.x, this.player.position.z);

    this.hotbar.refresh();

    // Rendu : monde puis, en 1re personne, la main par-dessus (depth nettoyé).
    this.renderer.render(this.scene, this.camera);
    if (firstPerson) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.viewModel.scene, this.viewModel.camera);
      this.renderer.autoClear = true;
    }

    this._updateHud(dt);
  }

  // Bruits de pas réguliers en marchant au sol, + son à l'atterrissage.
  _handleFootsteps(dt) {
    const p = this.player;
    const blockBelow = () =>
      this.world.getBlock(Math.floor(p.position.x), Math.floor(p.position.y) - 1, Math.floor(p.position.z));

    if (p.onGround && !this._wasOnGround) {
      this.sound.playStep(blockBelow()); // atterrissage
      this._stepTimer = 0;
    } else if (p.onGround && p.moving && !p.flying) {
      this._stepTimer += dt;
      if (this._stepTimer >= 0.34) {
        this._stepTimer = 0;
        this.sound.playStep(blockBelow());
      }
    } else {
      this._stepTimer = 0.34; // prêt à jouer un pas dès le prochain mouvement
    }
    this._wasOnGround = p.onGround;
  }

  // Touches globales : inventaire (E), caméra (F5), Échap.
  _handleGlobalKeys() {
    if (this.input.consumeInventoryToggle()) {
      if (this.state === STATE.PLAYING) this.openInventory(2);
      else if (this.state === STATE.INVENTORY) this.closeInventory();
    }
    if (this.input.consumeCameraToggle()) {
      if (this.state === STATE.PLAYING) this.player.toggleCamera();
    }
    if (this.input.consumeEscape()) {
      // Échap ne sert qu'à fermer l'inventaire (la pause se gère via le
      // verrouillage du pointeur ; reprendre se fait avec le bouton).
      if (this.state === STATE.INVENTORY) this.closeInventory();
    }
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
    const view = this.player.cameraMode === 'first' ? '1re pers.' : '3e pers.';
    this.hud.innerHTML =
      `FPS ${this._fps}<br>` +
      `XYZ ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}<br>` +
      `Chunks ${this.world.meshedCount} · ${view}<br>` +
      `Mode ${this.player.flying ? 'Créatif (vol)' : 'Survie'}`;
  }
}
