import { listWorlds, createWorld, deleteWorld, loadSettings, saveSettings } from '../persistence/WorldStore.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Convertit une seed texte en entier déterministe (ou aléatoire si vide).
function parseSeed(str) {
  str = (str || '').trim();
  if (!str) return Math.floor(Math.random() * 0xffffffff) >>> 0;
  if (/^\d+$/.test(str)) return parseInt(str, 10) >>> 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) >>> 0;
  return h;
}

// Gère tous les écrans de menu (accueil, mondes, création, multijoueur,
// options) et le menu pause. Communique avec le jeu via des callbacks.
export class Menu {
  constructor(cb) {
    this.cb = cb; // { onPlayWorld, onResume, onQuit, onSettings, onUiClick, onHost, onJoin }
    this.menu = $('menu');
    this.pause = $('pause');
    this.views = {
      main: $('mv-main'), worlds: $('mv-worlds'), create: $('mv-create'),
      multi: $('mv-multi'), options: $('mv-options'),
    };
    this.settings = loadSettings();
    this.createMode = 'survival';
    this.optionsReturn = 'main';

    this._bindButtons();
    this._bindSegments();
    this._bindTabs();
    this._bindOptions();
    this._initOptionControls();
  }

  // --- Câblage --------------------------------------------------------------

  _click(action) {
    this.cb.onUiClick?.();
    switch (action) {
      case 'solo': this.showWorlds(); break;
      case 'multi': this.showMulti(); break;
      case 'options': this.showOptions('main'); break;
      case 'back-main': this.showMain(); break;
      case 'create': this.showCreate(); break;
      case 'back-worlds': this.showWorlds(); break;
      case 'create-confirm': this._createAndPlay(); break;
      case 'host': this._host(); break;
      case 'join': this._join(); break;
      case 'options-back': this.optionsReturn === 'pause' ? this.showPause() : this.showMain(); break;
      case 'resume': this.cb.onResume(); break;
      case 'pause-options': this.showOptions('pause'); break;
      case 'quit': this.cb.onQuit(); break;
    }
  }

  _bindButtons() {
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => this._click(btn.getAttribute('data-action')));
    });
  }

  _bindSegments() {
    // Mode de création.
    $('cw-mode').querySelectorAll('.seg-btn').forEach((b) => {
      b.addEventListener('click', () => {
        this.createMode = b.dataset.mode;
        this._setSeg('cw-mode', 'mode', this.createMode);
      });
    });
    // Difficulté.
    $('opt-diff').querySelectorAll('.seg-btn').forEach((b) => {
      b.addEventListener('click', () => {
        this.settings.difficulty = b.dataset.diff;
        this._setSeg('opt-diff', 'diff', this.settings.difficulty);
        this._applyOptions();
      });
    });
  }

  _setSeg(containerId, attr, value) {
    $(containerId).querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset[attr] === value);
    });
  }

  _bindTabs() {
    document.querySelectorAll('.otab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.otab').forEach((t) => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.opt-panel').forEach((p) => {
          p.classList.toggle('hidden', p.dataset.panel !== tab.dataset.tab);
        });
      });
    });
  }

  _bindOptions() {
    const ids = ['opt-rd', 'opt-fov', 'opt-bright', 'opt-fog', 'opt-vol', 'opt-sens', 'opt-invy', 'opt-day', 'opt-weather'];
    ids.forEach((id) => {
      const el = $(id);
      const ev = el.type === 'checkbox' ? 'change' : 'input';
      el.addEventListener(ev, () => this._applyOptions());
    });
  }

  _initOptionControls() {
    const s = this.settings;
    $('opt-rd').value = s.renderDistance;
    $('opt-fov').value = s.fov;
    $('opt-bright').value = s.brightness;
    $('opt-fog').checked = s.fog;
    $('opt-vol').value = s.volume;
    $('opt-sens').value = s.sensitivity;
    $('opt-invy').checked = s.invertY;
    $('opt-day').value = s.dayLength;
    $('opt-weather').checked = s.weather;
    this._setSeg('opt-diff', 'diff', s.difficulty);
    this._applyOptions();
  }

  _applyOptions() {
    const s = this.settings;
    s.renderDistance = +$('opt-rd').value;
    s.fov = +$('opt-fov').value;
    s.brightness = +$('opt-bright').value;
    s.fog = $('opt-fog').checked;
    s.volume = +$('opt-vol').value;
    s.sensitivity = +$('opt-sens').value;
    s.invertY = $('opt-invy').checked;
    s.dayLength = +$('opt-day').value;
    s.weather = $('opt-weather').checked;

    $('opt-rd-val').textContent = s.renderDistance;
    $('opt-fov-val').textContent = s.fov;
    $('opt-bright-val').textContent = Math.round(s.brightness * 100) + '%';
    $('opt-vol-val').textContent = Math.round(s.volume * 100) + '%';
    $('opt-sens-val').textContent = s.sensitivity.toFixed(1);
    $('opt-day-val').textContent = s.dayLength + ' s';

    saveSettings(s);
    this.cb.onSettings(s);
  }

  // --- Mondes ---------------------------------------------------------------

  buildWorldList() {
    const el = $('world-list');
    const worlds = listWorlds();
    if (!worlds.length) {
      el.innerHTML = '<div class="world-empty">Aucun monde pour l\'instant. Crée ton premier monde !</div>';
      return;
    }
    el.innerHTML = '';
    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'world-row';
      const date = new Date(w.lastPlayed).toLocaleString();
      row.innerHTML =
        `<div class="wr-info"><div class="wr-name">${esc(w.name)}</div>` +
        `<div class="wr-meta">seed ${w.seed} · ${date}</div></div>` +
        `<span class="wr-badge ${w.mode}">${w.mode === 'creative' ? 'Créatif' : 'Survie'}</span>` +
        `<button class="btn mini play">Jouer</button>` +
        `<button class="btn mini del">✕</button>`;
      row.querySelector('.play').addEventListener('click', () => { this.cb.onUiClick?.(); this.cb.onPlayWorld(w); });
      row.querySelector('.del').addEventListener('click', () => { deleteWorld(w.id); this.buildWorldList(); });
      el.appendChild(row);
    }
  }

  _createAndPlay() {
    const name = $('cw-name').value || 'Monde ' + (listWorlds().length + 1);
    const seed = parseSeed($('cw-seed').value);
    const world = createWorld(name, seed, this.createMode);
    this.cb.onPlayWorld(world);
  }

  // --- Multijoueur ----------------------------------------------------------

  showMulti() {
    const sel = $('mp-host-world');
    const worlds = listWorlds();
    sel.innerHTML = worlds.length
      ? worlds.map((w) => `<option value="${w.id}">${esc(w.name)} (${w.mode === 'creative' ? 'Créatif' : 'Survie'})</option>`).join('')
      : '<option value="">— Crée d\'abord un monde —</option>';
    $('mp-host-info').textContent = '';
    $('mp-join-info').textContent = '';
    this._show('multi');
  }

  _host() {
    const id = $('mp-host-world').value;
    const world = listWorlds().find((w) => w.id === id);
    if (!world) { $('mp-host-info').textContent = 'Crée un monde solo d\'abord.'; return; }
    if (this.cb.onHost) this.cb.onHost(world);
  }

  _join() {
    const code = $('mp-code').value.trim();
    if (!code) { $('mp-join-info').textContent = 'Entre un code de salon.'; return; }
    if (this.cb.onJoin) this.cb.onJoin(code);
  }

  // Affichage d'infos multijoueur (appelé par le jeu).
  setHostInfo(html) { $('mp-host-info').innerHTML = html; }
  setJoinInfo(html) { $('mp-join-info').innerHTML = html; }

  // --- Navigation -----------------------------------------------------------

  _show(name) {
    this.menu.classList.remove('hidden');
    this.pause.classList.add('hidden');
    for (const k in this.views) this.views[k].classList.toggle('hidden', k !== name);
  }

  showMain() { this._show('main'); }
  showWorlds() { this.buildWorldList(); this._show('worlds'); }
  showCreate() {
    $('cw-name').value = '';
    $('cw-seed').value = '';
    this.createMode = 'survival';
    this._setSeg('cw-mode', 'mode', 'survival');
    this._show('create');
  }
  showOptions(returnTo) { this.optionsReturn = returnTo; this._show('options'); }
  showPause() { this.menu.classList.add('hidden'); this.pause.classList.remove('hidden'); }
  hideAll() { this.menu.classList.add('hidden'); this.pause.classList.add('hidden'); }
}
