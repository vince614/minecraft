// Gère les écrans menu principal / options / pause et le panneau de réglages.
// Communique avec le jeu via des callbacks ; les réglages sont appliqués en
// direct (onSettings) à chaque mouvement de curseur.
export class Menu {
  constructor(callbacks) {
    this.cb = callbacks;

    this.menu = document.getElementById('menu');
    this.pause = document.getElementById('pause');
    this.viewMain = document.getElementById('menu-main');
    this.viewOptions = document.getElementById('menu-options');

    this.optionsReturn = 'main'; // d'où on est venu vers les options

    this.settings = {
      renderDistance: 8,
      sensitivity: 1.0, // multiplicateur
      fov: 75,
      volume: 0.7,
    };

    this._bindButtons();
    this._bindSliders();
  }

  _bindButtons() {
    const handlers = {
      play: () => this.cb.onPlay(),
      options: () => this.showOptions('main'),
      'options-back': () => (this.optionsReturn === 'pause' ? this.showPause() : this.showMain()),
      resume: () => this.cb.onResume(),
      'pause-options': () => this.showOptions('pause'),
      quit: () => this.cb.onQuit(),
    };
    document.querySelectorAll('[data-action]').forEach((btn) => {
      const action = btn.getAttribute('data-action');
      if (handlers[action]) {
        btn.addEventListener('click', () => {
          if (this.cb.onUiClick) this.cb.onUiClick();
          handlers[action]();
        });
      }
    });
  }

  _bindSliders() {
    const rd = document.getElementById('opt-rd');
    const rdVal = document.getElementById('opt-rd-val');
    const sens = document.getElementById('opt-sens');
    const sensVal = document.getElementById('opt-sens-val');
    const fov = document.getElementById('opt-fov');
    const fovVal = document.getElementById('opt-fov-val');
    const vol = document.getElementById('opt-vol');
    const volVal = document.getElementById('opt-vol-val');

    const apply = () => {
      this.settings.renderDistance = parseInt(rd.value, 10);
      this.settings.sensitivity = parseFloat(sens.value);
      this.settings.fov = parseInt(fov.value, 10);
      this.settings.volume = parseFloat(vol.value);
      rdVal.textContent = rd.value;
      sensVal.textContent = parseFloat(sens.value).toFixed(1);
      fovVal.textContent = fov.value;
      volVal.textContent = `${Math.round(parseFloat(vol.value) * 100)}%`;
      this.cb.onSettings(this.settings);
    };

    [rd, sens, fov, vol].forEach((el) => el.addEventListener('input', apply));
  }

  showMain() {
    this.menu.classList.remove('hidden');
    this.pause.classList.add('hidden');
    this.viewMain.classList.remove('hidden');
    this.viewOptions.classList.add('hidden');
  }

  showPause() {
    this.menu.classList.add('hidden');
    this.pause.classList.remove('hidden');
  }

  showOptions(returnTo) {
    this.optionsReturn = returnTo;
    this.menu.classList.remove('hidden');
    this.pause.classList.add('hidden');
    this.viewMain.classList.add('hidden');
    this.viewOptions.classList.remove('hidden');
  }

  hideAll() {
    this.menu.classList.add('hidden');
    this.pause.classList.add('hidden');
  }
}
