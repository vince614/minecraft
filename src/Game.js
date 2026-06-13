import * as THREE from 'three';
import { RENDER_DISTANCE, CHUNK_SIZE } from './core/constants.js';
import { createRenderer } from './render/createRenderer.js';
import { Sky } from './render/Sky.js';
import { createMaterials } from './render/BlockMaterial.js';
import { isWater, itemColor } from './blocks/BlockRegistry.js';
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
import { Particles } from './effects/Particles.js';
import { MobManager } from './entities/MobManager.js';
import { DropManager } from './entities/DropManager.js';
import { saveGame, loadGame } from './persistence/Save.js';

const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSE: 'pause', INVENTORY: 'inventory' };

// Orchestrateur principal : crée et câble tous les modules, gère les états
// d'écran et fait tourner la boucle de jeu.
export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = STATE.MENU;

    this.renderer = createRenderer(canvas);
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      RENDER_DISTANCE * CHUNK_SIZE * 1.5
    );

    // Materials partagés (blocs opaques + eau translucide).
    const { blockMaterial, waterMaterial } = createMaterials();
    this.material = blockMaterial;
    this.waterMaterial = waterMaterial;

    this.world = new World(this.scene, blockMaterial, waterMaterial, 1337);
    this.sky = new Sky(this.scene, { blockMaterial, waterMaterial }, this.camera);

    // Joueur + apparition au-dessus du sol.
    const groundH = this.world.generator.heightAt(0, 0);
    const spawn = new THREE.Vector3(0.5, groundH + 2, 0.5);
    this.player = new Player(this.camera, spawn);
    this.playerModel = new PlayerModel(this.scene);

    this.inventory = new Inventory();
    this.sound = new SoundManager();
    this.particles = new Particles(this.scene);

    // Objets lâchés au sol (ramassables).
    this.drops = new DropManager({
      scene: this.scene,
      world: this.world,
      player: this.player,
      inventory: this.inventory,
      sound: this.sound,
      blockMaterial: this.material,
    });

    // Créatures (animaux, hostiles, villageois).
    this.mobManager = new MobManager({
      scene: this.scene,
      world: this.world,
      player: this.player,
      particles: this.particles,
      sound: this.sound,
      drops: this.drops,
      isNight: () => this.sky.time < 0.25 || this.sky.time > 0.75,
      villages: this.world.generator.villages,
    });

    this.input = new InputManager(canvas);
    this.hotbar = new Hotbar(document.getElementById('hotbar'), this.inventory);
    this.inventoryUI = new InventoryUI(this.inventory, () => this.sound.playCraft());
    this.viewModel = new ViewModel(this.material);

    this.interaction = new BlockInteraction(this.scene, this.world, this.player, this.inventory, {
      onOpenCraft: (n) => this.openInventory(n),
      onBreak: (id, x, y, z) => {
        this.viewModel.triggerSwing();
        this.sound.playBreak(id);
        this.particles.emit(x + 0.5, y + 0.5, z + 0.5, itemColor(id), 12);
        // L'objet tombe au sol (sauf en créatif).
        if (!this.player.flying) this.drops.spawn(id, x + 0.5, y + 0.5, z + 0.5, 1);
      },
      onPlace: (id, x, y, z) => {
        this.viewModel.triggerSwing();
        this.sound.playPlace(id);
        this.particles.emit(x + 0.5, y + 0.5, z + 0.5, itemColor(id), 6, 2);
      },
      onMineProgress: (f) => this._setMineBar(f),
    });
    this.interaction.mobManager = this.mobManager;

    this.menu = new Menu({
      onPlay: () => this.enterPlaying(),
      onResume: () => this.enterPlaying(),
      onQuit: () => this.toMainMenu(),
      onSettings: (s) => this.applySettings(s),
      onUiClick: () => { this.sound.resume(); this.sound.playUi(); },
    });

    // Références UI.
    this.hud = document.getElementById('hud');
    this.healthEl = document.getElementById('health');
    this.mineProgress = document.getElementById('mine-progress');
    this.mineBar = this.mineProgress.firstElementChild;
    this.dmgFlash = document.getElementById('damage-flash');
    this.underwater = document.getElementById('underwater');

    // État bruits de pas / divers.
    this._stepTimer = 0;
    this._wasOnGround = true;
    this._flash = 0;
    this._healthShown = -1;
    this._saveTimer = 0;
    this._eyeTmp = new THREE.Vector3();

    this._setupPointerLock();
    this._setupResize();
    this._setupAutosave();
    this.menu.showMain();

    // Charge une éventuelle sauvegarde (modifie world.edits, inventaire, joueur).
    loadGame(this);

    // Préchargement des chunks proches (avec les modifs réappliquées).
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

  // --- États ----------------------------------------------------------------

  enterPlaying() {
    this.state = STATE.PLAYING;
    this.menu.hideAll();
    if (this.inventoryUI.isOpen) this.inventoryUI.close();
    this.sound.resume();
    this.input.requestLock();
  }

  toMainMenu() {
    saveGame(this);
    this.state = STATE.MENU;
    if (this.inventoryUI.isOpen) this.inventoryUI.close();
    if (document.pointerLockElement) document.exitPointerLock();
    this.menu.showMain();
  }

  openPause() {
    this.state = STATE.PAUSE;
    this.menu.showPause();
    saveGame(this);
  }

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
        this.openPause();
      }
    });

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

  _setupAutosave() {
    window.addEventListener('beforeunload', () => saveGame(this));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveGame(this);
    });
  }

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
      this.interaction.update(dt, this.input);
      this.mobManager.update(dt);
      this._handleFootsteps(dt);
    } else {
      this._setMineBar(0);
    }

    // Ciel, particules, objets au sol : animés en continu.
    this.sky.update(dt);
    this.particles.update(dt);
    this.drops.update(dt);

    // Vue main / avatar 3e personne.
    const firstPerson = this.player.cameraMode === 'first';
    this.viewModel.setHeld(this.inventory.selectedId());
    this.viewModel.update(dt, this.player.moving);
    this.playerModel.setVisible(!firstPerson);
    if (!firstPerson) {
      this.playerModel.update(dt, this.player.position, this.player.yaw, this.player.pitch, this.player.moving);
    }

    this.world.update(this.player.position.x, this.player.position.z);
    this.hotbar.refresh();
    this._updateStatusUI(dt);

    // Sauvegarde périodique.
    this._saveTimer += dt;
    if (this._saveTimer > 12) { this._saveTimer = 0; saveGame(this); }

    // Rendu : monde puis, en 1re personne, la main par-dessus.
    this.renderer.render(this.scene, this.camera);
    if (firstPerson) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.viewModel.scene, this.viewModel.camera);
      this.renderer.autoClear = true;
    }

    this._updateHud(dt);
  }

  _handleFootsteps(dt) {
    const p = this.player;
    const blockBelow = () =>
      this.world.getBlock(Math.floor(p.position.x), Math.floor(p.position.y) - 1, Math.floor(p.position.z));

    if (p.onGround && !this._wasOnGround) {
      this.sound.playStep(blockBelow());
      this._stepTimer = 0;
    } else if (p.onGround && p.moving && !p.flying) {
      this._stepTimer += dt;
      if (this._stepTimer >= 0.34) { this._stepTimer = 0; this.sound.playStep(blockBelow()); }
    } else {
      this._stepTimer = 0.34;
    }
    this._wasOnGround = p.onGround;
  }

  _handleGlobalKeys() {
    if (this.input.consumeInventoryToggle()) {
      if (this.state === STATE.PLAYING) this.openInventory(2);
      else if (this.state === STATE.INVENTORY) this.closeInventory();
    }
    if (this.input.consumeCameraToggle()) {
      if (this.state === STATE.PLAYING) this.player.toggleCamera();
    }
    if (this.input.consumeEscape()) {
      if (this.state === STATE.INVENTORY) this.closeInventory();
    }
  }

  _setMineBar(frac) {
    if (frac > 0 && frac < 1) {
      this.mineProgress.style.display = 'block';
      this.mineBar.style.width = `${(frac * 100).toFixed(0)}%`;
    } else {
      this.mineProgress.style.display = 'none';
    }
  }

  // Vie, voile dégâts/eau, respawn.
  _updateStatusUI(dt) {
    const p = this.player;

    if (p.health <= 0) p.respawn(); // mort -> réapparition

    if (p.justDamaged > 0) { this._flash = 0.9; p.justDamaged = 0; }
    this._flash = Math.max(0, this._flash - dt * 1.5);
    this.dmgFlash.style.opacity = this._flash.toFixed(2);

    const eye = p.getEyePosition(this._eyeTmp);
    const eyeInWater = isWater(this.world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z)));
    this.underwater.style.opacity = eyeInWater ? '1' : '0';

    if (p.health !== this._healthShown) {
      this._healthShown = p.health;
      let html = '';
      for (let i = 0; i < 10; i++) {
        const full = i * 2 + 1 <= p.health;
        html += `<span class="heart ${full ? '' : 'empty'}">❤</span>`;
      }
      this.healthEl.innerHTML = html;
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
    const clock = `${String(Math.floor(this.sky.time * 24)).padStart(2, '0')}h`;
    this.hud.innerHTML =
      `FPS ${this._fps} · ${clock}<br>` +
      `XYZ ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}<br>` +
      `Chunks ${this.world.meshedCount} · Mobs ${this.mobManager.count} · ${view}<br>` +
      `Mode ${this.player.flying ? 'Créatif (vol)' : 'Survie'}${this.player.inWater ? ' · 🌊' : ''}`;
  }
}
