import * as THREE from 'three';
import { RENDER_DISTANCE, CHUNK_SIZE } from './core/constants.js';
import { createRenderer } from './render/createRenderer.js';
import { Sky } from './render/Sky.js';
import { createMaterials } from './render/BlockMaterial.js';
import { isWater, itemColor, isBow, isFood, foodValue, ARROW } from './blocks/BlockRegistry.js';
import { World } from './world/World.js';
import { Player } from './player/Player.js';
import { PlayerModel } from './player/PlayerModel.js';
import { InputManager } from './input/InputManager.js';
import { BlockInteraction } from './interaction/BlockInteraction.js';
import { Inventory } from './inventory/Inventory.js';
import { Hotbar } from './ui/Hotbar.js';
import { Menu } from './ui/Menu.js';
import { InventoryUI } from './ui/InventoryUI.js';
import { CraftGuide } from './ui/CraftGuide.js';
import { EnchantUI } from './ui/EnchantUI.js';
import { ViewModel } from './render/ViewModel.js';
import { SoundManager } from './audio/SoundManager.js';
import { Particles } from './effects/Particles.js';
import { MobManager } from './entities/MobManager.js';
import { DropManager } from './entities/DropManager.js';
import { TntManager } from './entities/TntManager.js';
import { ProjectileManager } from './entities/ProjectileManager.js';
import { explode } from './effects/explode.js';
import { saveWorldData, loadWorldData, loadSettings } from './persistence/WorldStore.js';
import { Inventory as InventoryClass } from './inventory/Inventory.js';
import { Network } from './net/Network.js';

const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSE: 'pause', INVENTORY: 'inventory', GUIDE: 'guide', ENCHANT: 'enchant' };

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
    this.playerModel = new PlayerModel(this.scene, this.material);
    this._bowCharge = 0;

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

    // Projectiles (flèches) + TNT, et liaison avec les mobs.
    this.projectiles = new ProjectileManager({
      scene: this.scene, world: this.world, player: this.player, mobs: this.mobManager,
    });
    this.tnt = new TntManager({
      scene: this.scene, world: this.world, blockMaterial: this.material,
      explodeAt: (x, y, z, p) => this._explode(x, y, z, p),
    });
    this.mobManager.ctx.projectiles = this.projectiles;
    this.mobManager.ctx.explode = (x, y, z, p) => this._explode(x, y, z, p);
    this._shake = 0;

    this.input = new InputManager(canvas);
    this.hotbar = new Hotbar(document.getElementById('hotbar'), this.inventory);
    this.inventoryUI = new InventoryUI(this.inventory, () => this.sound.playCraft());
    this.craftGuide = new CraftGuide(this.inventory, () => { this.sound.playCraft(); this.hotbar.refresh(); });
    this.enchantUI = new EnchantUI(this.inventory, () => { this.sound.playCraft(); this.hotbar.refresh(); });
    document.getElementById('open-guide-btn').addEventListener('click', () => this.openGuide());
    this.viewModel = new ViewModel(this.material);

    this.interaction = new BlockInteraction(this.scene, this.world, this.player, this.inventory, {
      onOpenCraft: (n) => this.openInventory(n),
      onBreak: (id, x, y, z) => {
        this.viewModel.triggerSwing();
        this.sound.playBreak(id);
        this.particles.emit(x + 0.5, y + 0.5, z + 0.5, itemColor(id), 12);
        // L'objet tombe au sol (sauf en créatif).
        if (!this.player.creative) this.drops.spawn(id, x + 0.5, y + 0.5, z + 0.5, 1);
      },
      onPlace: (id, x, y, z) => {
        this.viewModel.triggerSwing();
        this.sound.playPlace(id);
        this.particles.emit(x + 0.5, y + 0.5, z + 0.5, itemColor(id), 6, 2);
      },
      onMineProgress: (f) => this._setMineBar(f),
      onIgnite: (x, y, z) => this.tnt.ignite(x, y, z),
      onUseItem: (id) => this._useItem(id),
      onToolBroke: () => { this.sound.playHit(); },
      onOpenChest: (x, y, z) => this.openChest(x, y, z),
      onOpenEnchant: () => this.openEnchant(),
      onChestBroken: (slots, x, y, z) => {
        for (const s of slots) if (s) this.drops.spawn(s.id, x + 0.5, y + 0.5, z + 0.5, s.count);
      },
    });
    this.interaction.mobManager = this.mobManager;

    this.menu = new Menu({
      onPlayWorld: (w) => this.loadWorld(w),
      onResume: () => this.enterPlaying(),
      onQuit: () => this.toMainMenu(),
      onSettings: (s) => this.applySettings(s),
      onUiClick: () => { this.sound.resume(); this.sound.playUi(); },
      onHost: (w) => this.startHost(w),
      onJoin: (code) => this.startJoin(code),
    });

    // Références UI.
    this.hud = document.getElementById('hud');
    this.healthEl = document.getElementById('health');
    this.hungerEl = document.getElementById('hunger');
    this.mineProgress = document.getElementById('mine-progress');
    this.mineBar = this.mineProgress.firstElementChild;
    this.dmgFlash = document.getElementById('damage-flash');
    this.underwater = document.getElementById('underwater');

    // État bruits de pas / divers.
    this._stepTimer = 0;
    this._wasOnGround = true;
    this._flash = 0;
    this._healthShown = -1;
    this._hungerShown = -1;
    this._saveTimer = 0;
    this._eyeTmp = new THREE.Vector3();

    this.currentWorldId = null; // monde en cours (null = menu)
    this.net = null;            // session multijoueur (phase suivante)

    this._setupPointerLock();
    this._setupResize();
    this._setupAutosave();
    this.applySettings(loadSettings()); // réglages globaux au démarrage
    this.menu.showMain();

    // Décor du menu : on génère quelques chunks autour du spawn par défaut.
    for (let i = 0; i < 8; i++) {
      this.world.update(this.player.position.x, this.player.position.z);
    }

    this._frames = 0;
    this._fpsTimer = 0;
    this._fps = 0;
    this._lastTime = performance.now();
    this._frameInterval = 1000 / 60; // plafond à 60 images par seconde

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // --- États ----------------------------------------------------------------

  enterPlaying() {
    this.state = STATE.PLAYING;
    this.menu.hideAll();
    if (this.inventoryUI.isOpen) this.inventoryUI.close();
    if (this.craftGuide.isOpen) this.craftGuide.close();
    if (this.enchantUI.isOpen) this.enchantUI.close();
    this.sound.resume();
    this.input.requestLock();
  }

  // Lance (ou recharge) un monde donné. config = { id, seed, mode }.
  loadWorld(config) {
    this.currentWorldId = config.id || null;
    this.world.reset(config.seed >>> 0 || 1);

    // Instantané fourni (client multijoueur) : appliqué avant le préchargement
    // pour que les modifications soient régénérées correctement.
    if (config.edits) this.world.edits = new Map(config.edits);
    if (config.chests) this.world.chests = new Map(config.chests);

    // Inventaire neuf (sera écrasé si une sauvegarde existe).
    this.inventory.slots = new InventoryClass().slots;
    this.inventory.selected = 0;
    this.inventory.touch();

    // Mode de jeu.
    this.player.creative = config.mode === 'creative';
    this.player.flying = this.player.creative;
    this.player.health = this.player.maxHealth;
    this.player.hunger = this.player.maxHunger;

    // Point d'apparition au-dessus du sol.
    const groundH = this.world.generator.heightAt(0, 0);
    this.player.spawn.set(0.5, groundH + 2, 0.5);
    this.player.position.copy(this.player.spawn);
    this.player.velocity.set(0, 0, 0);
    this.player.yaw = 0; this.player.pitch = 0;

    // Données sauvegardées éventuelles (édits, coffres, inventaire, joueur…).
    loadWorldData(this.currentWorldId, this);

    // Nettoie les entités transitoires.
    for (let i = this.mobManager.mobs.length - 1; i >= 0; i--) this.mobManager._remove(i);
    while (this.drops.drops.length) this.drops._remove(0);

    if (config.time != null && this.sky) this.sky.time = config.time;

    // Préchargement autour du joueur.
    for (let i = 0; i < 14; i++) this.world.update(this.player.position.x, this.player.position.z);

    this.enterPlaying();
  }

  // Multijoueur P2P (WebRTC via PeerJS).
  startHost(world) {
    this.sound.resume();
    if (this.net) this.net.dispose();
    this.net = new Network(this);
    this.menu.setHostInfo('Connexion au broker…');
    this.net.host(world);
  }
  startJoin(code) {
    this.sound.resume();
    if (this.net) this.net.dispose();
    this.net = new Network(this);
    this.menu.setJoinInfo('Connexion au broker…');
    this.net.join(code);
  }

  toMainMenu() {
    if (this.currentWorldId) saveWorldData(this.currentWorldId, this);
    if (this.net) { this.net.dispose(); this.net = null; }
    this.currentWorldId = null;
    this.state = STATE.MENU;
    if (this.inventoryUI.isOpen) this.inventoryUI.close();
    if (this.craftGuide.isOpen) this.craftGuide.close();
    if (this.enchantUI.isOpen) this.enchantUI.close();
    if (document.pointerLockElement) document.exitPointerLock();
    this.menu.showMain();
  }

  openPause() {
    this.state = STATE.PAUSE;
    this.menu.showPause();
    if (this.currentWorldId) saveWorldData(this.currentWorldId, this);
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

  openGuide() {
    if (this.state !== STATE.PLAYING && this.state !== STATE.INVENTORY) return;
    if (this.inventoryUI.isOpen) this.inventoryUI.close();
    this.state = STATE.GUIDE;
    if (document.pointerLockElement) document.exitPointerLock();
    this.craftGuide.open();
  }

  closeGuide() {
    this.craftGuide.close();
    this.enterPlaying();
  }

  // Ouvre un coffre (réutilise l'écran d'inventaire en mode coffre).
  openChest(x, y, z) {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.INVENTORY;
    if (document.pointerLockElement) document.exitPointerLock();
    this.inventoryUI.openChest(this.world.getChest(x, y, z));
  }

  openEnchant() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.ENCHANT;
    if (document.pointerLockElement) document.exitPointerLock();
    this.enchantUI.open();
  }

  closeEnchant() {
    this.enchantUI.close();
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
    const save = () => { if (this.currentWorldId) saveWorldData(this.currentWorldId, this); };
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') save();
    });
  }

  applySettings(s) {
    this.settings = s;
    this.world.setRenderDistance(s.renderDistance);
    this.player.setSensitivity(s.sensitivity);
    this.player.invertY = !!s.invertY;
    this.sound.setVolume(s.volume);
    this.camera.fov = s.fov;

    const far = s.renderDistance * CHUNK_SIZE;
    this.camera.far = far * 1.6;
    this.camera.updateProjectionMatrix();

    // Ciel : luminosité, brouillard, durée du jour, météo.
    this.sky.brightness = s.brightness;
    this.sky.fogEnabled = s.fog;
    this.sky.dayLength = s.dayLength;
    this.sky.weatherEnabled = s.weather;
    this.sky.setFogDistance(far);

    // Difficulté : pas d'hostiles en mode paisible.
    this.mobManager.peaceful = s.difficulty === 'peaceful';
  }

  // --- Boucle ---------------------------------------------------------------

  _loop() {
    requestAnimationFrame(this._loop);

    // Plafond à 60 FPS : on saute la frame si elle arrive trop tôt (utile sur
    // les écrans 120/144 Hz). Le temps non consommé est reporté à la frame
    // suivante pour garder une cadence régulière.
    const now = performance.now();
    const since = now - this._lastTime;
    if (since < this._frameInterval - 0.5) return;

    let dt = since / 1000;
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
      // En multijoueur, seul l'hôte simule les mobs (autorité).
      if (!this.net || this.net.isHost) this.mobManager.update(dt);
      this._updateBow(dt);
      this._handleFootsteps(dt);
    } else {
      this._setMineBar(0);
      this._bowCharge = 0;
      this.viewModel.setBowDraw(0);
    }

    // Ciel, particules, objets au sol, TNT, projectiles : animés en continu.
    this.sky.update(dt);
    this.particles.update(dt);
    this.drops.update(dt);
    this.tnt.update(dt);
    this.projectiles.update(dt);
    if (this.net) this.net.update(dt); // synchro multijoueur + avatars distants

    // Vue main / avatar 3e personne.
    const firstPerson = this.player.cameraMode === 'first';
    const mining = this.state === STATE.PLAYING && this.input.locked && this.interaction.mining;
    this.viewModel.setHeld(this.inventory.selectedId());
    this.viewModel.setMining(mining);
    this.viewModel.update(dt, this.player.moving);
    this.playerModel.setVisible(!firstPerson);
    if (!firstPerson) {
      this.playerModel.setHeld(this.inventory.selectedId());
      this.playerModel.update(dt, this.player.position, this.player.yaw, this.player.pitch, this.player.moving, mining);
    } else {
      this.playerModel.setHeld(0);
    }

    this.world.update(this.player.position.x, this.player.position.z);
    this.hotbar.refresh();
    if (this.state === STATE.GUIDE) this.craftGuide.render();
    this._updateStatusUI(dt);

    // Sauvegarde périodique.
    this._saveTimer += dt;
    if (this._saveTimer > 12) {
      this._saveTimer = 0;
      if (this.currentWorldId) saveWorldData(this.currentWorldId, this);
    }

    // Secousse de caméra (explosions).
    if (this._shake > 0) {
      this._shake = Math.max(0, this._shake - dt * 2.5);
      const s = this._shake * 0.4;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }

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
    if (this.input.consumeGuideToggle()) {
      if (this.state === STATE.PLAYING || this.state === STATE.INVENTORY) this.openGuide();
      else if (this.state === STATE.GUIDE) this.closeGuide();
    }
    if (this.input.consumeCameraToggle()) {
      if (this.state === STATE.PLAYING) this.player.toggleCamera();
    }
    if (this.input.consumeEscape()) {
      if (this.state === STATE.INVENTORY) this.closeInventory();
      else if (this.state === STATE.GUIDE) this.closeGuide();
      else if (this.state === STATE.ENCHANT) this.closeEnchant();
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

  // Déclenche une explosion (TNT, creeper).
  _explode(x, y, z, power) {
    explode({
      world: this.world, particles: this.particles, sound: this.sound, drops: this.drops,
      player: this.player, mobs: this.mobManager,
      shake: (a) => { this._shake = Math.max(this._shake, a); },
      igniteTnt: (bx, by, bz, fuse) => this.tnt.ignite(bx, by, bz, fuse),
    }, x, y, z, power);
  }

  // Usage d'un objet en main (clic droit ponctuel) : nourriture. L'arc est géré
  // séparément (maintien = bandage).
  _useItem(id) {
    if (isFood(id)) this._eat(id);
  }

  // Arc : maintenir le clic droit bande l'arc (charge) ; relâcher tire.
  _updateBow(dt) {
    const sel = this.inventory.selectedId();
    const isBowSel = isBow(sel);
    const canDraw = isBowSel && this.input.rightDown && this.inventory.countOf(ARROW) > 0;
    if (canDraw) {
      this._bowCharge = Math.min(1, this._bowCharge + dt * 1.7);
    } else {
      if (isBowSel && this._bowCharge > 0.2) this._releaseArrow(this._bowCharge);
      this._bowCharge = 0;
    }
    this.viewModel.setBowDraw(isBowSel ? this._bowCharge : 0);
  }

  _releaseArrow(charge) {
    if (this.inventory.countOf(ARROW) <= 0) return;
    this.inventory.remove(ARROW, 1);
    const eye = this.player.getEyePosition(new THREE.Vector3());
    const dir = this.player.getDirection(new THREE.Vector3());
    const stack = this.inventory.getSelected();
    const power = (stack && stack.ench && stack.ench.power) || 0;
    this.projectiles.spawn(eye, dir, { fromPlayer: true, damage: 5 + Math.round(charge * 5) + power * 2, speed: 24 + charge * 26 });
    this.sound.playShoot();
    this.viewModel.triggerSwing();
    if (this.inventory.damageSelectedTool() === 'broke') this.sound.playHit();
  }

  _eat(id) {
    if (this.player.eat(foodValue(id))) {
      this.inventory.consumeSelected(1);
      this.sound.playEat();
      this.viewModel.triggerEat();
    }
  }

  // Vie, faim, voile dégâts/eau, respawn.
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

    const hungerShown = Math.ceil(p.hunger);
    if (hungerShown !== this._hungerShown) {
      this._hungerShown = hungerShown;
      let html = '';
      for (let i = 0; i < 10; i++) {
        const full = i * 2 + 1 <= p.hunger;
        html += `<span class="drum ${full ? '' : 'empty'}">🍗</span>`;
      }
      this.hungerEl.innerHTML = html;
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
      `Mode ${this.player.flying ? 'Créatif (vol)' : 'Survie'}` +
      `${this.player.inWater ? ' · 🌊' : ''}${this.sky.raining ? ' · 🌧️' : ''}`;
  }
}
