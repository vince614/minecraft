// Centralise toutes les entrées : pointer lock, clavier, souris, molette.
// Les autres modules LISENT cet état ; l'InputManager n'appelle personne, ce
// qui découple proprement la logique d'entrée du reste du moteur.
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();        // codes des touches enfoncées
    this.locked = false;          // pointer lock actif ?

    // Deltas souris accumulés depuis la dernière consommation.
    this.mouseDX = 0;
    this.mouseDY = 0;

    // Événements ponctuels mis en file (consommés par frame).
    this.clicks = [];   // 'break' | 'place'
    this.wheel = 0;     // somme des crans molette
    this.slotKey = null; // 1..9 si une touche chiffre a été pressée

    this._bind();
  }

  _bind() {
    const canvas = this.canvas;

    // Demande le verrouillage du pointeur au clic sur le canvas.
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return; // le clic qui (re)lock est géré par l'overlay
      if (e.button === 0) this.clicks.push('break');
      else if (e.button === 2) this.clicks.push('place');
    });

    // Empêche le menu contextuel sur clic droit.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      // Sélection de slot par chiffre.
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) this.slotKey = n - 1;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    window.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
  }

  requestLock() {
    this.canvas.requestPointerLock();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Récupère et remet à zéro le delta souris accumulé.
  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return [dx, dy];
  }

  consumeClicks() {
    const c = this.clicks;
    this.clicks = [];
    return c;
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  consumeSlotKey() {
    const s = this.slotKey;
    this.slotKey = null;
    return s;
  }
}
