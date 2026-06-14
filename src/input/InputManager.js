// Centralise toutes les entrées : pointer lock, clavier, souris, molette.
// Les autres modules LISENT cet état ; l'InputManager n'appelle personne, ce
// qui découple proprement la logique d'entrée du reste du moteur.
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();        // codes des touches enfoncées
    this.locked = false;          // pointer lock actif ?

    // Boutons souris maintenus (pour le minage continu / la pose répétée).
    this.leftDown = false;
    this.rightDown = false;
    this.leftClicked = false; // front montant du clic gauche (attaque de mob)

    // Deltas souris accumulés depuis la dernière consommation.
    this.mouseDX = 0;
    this.mouseDY = 0;

    // Événements ponctuels mis en file (consommés par frame).
    this.clicks = [];   // 'break' | 'place'
    this.wheel = 0;     // somme des crans molette
    this.slotKey = null; // 1..9 si une touche chiffre a été pressée

    // Événements ponctuels (front montant, ignorent l'auto-répétition clavier).
    this.pendingInventory = false; // touche E
    this.pendingCamera = false;    // touche F5
    this.pendingEscape = false;    // touche Échap
    this.pendingGuide = false;     // touche C (guide de craft)

    this._bind();
  }

  _bind() {
    const canvas = this.canvas;

    // Demande le verrouillage du pointeur au clic sur le canvas.
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return; // le clic qui (re)lock est géré par l'overlay
      if (e.button === 0) { this.leftDown = true; this.leftClicked = true; }
      else if (e.button === 2) this.rightDown = true;
    });

    // Relâchements suivis au niveau du document (le pointeur est verrouillé).
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.leftDown = false;
      else if (e.button === 2) this.rightDown = false;
    });

    // Empêche le menu contextuel sur clic droit.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      // À la perte du verrouillage (menu/inventaire), on arrête les actions.
      if (!this.locked) { this.leftDown = false; this.rightDown = false; }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    window.addEventListener('keydown', (e) => {
      // F5 déclenche le rechargement du navigateur : on l'empêche pour s'en
      // servir comme bascule de caméra.
      if (e.code === 'F5') e.preventDefault();

      this.keys.add(e.code);
      // Sélection de slot par chiffre.
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) this.slotKey = n - 1;
      }
      // Événements ponctuels (on ignore l'auto-répétition).
      if (!e.repeat) {
        if (e.code === 'KeyE') this.pendingInventory = true;
        if (e.code === 'KeyC') this.pendingGuide = true;
        if (e.code === 'F5') this.pendingCamera = true;
        if (e.code === 'Escape') this.pendingEscape = true;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    window.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
  }

  requestLock() {
    // requestPointerLock peut échouer (geste utilisateur expiré, contexte non
    // autorisé) en lançant une exception OU en rejetant une promesse selon le
    // navigateur : on absorbe les deux pour ne pas polluer la console.
    try {
      const r = this.canvas.requestPointerLock();
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch (_) {
      /* ignoré : l'utilisateur pourra recliquer le canvas */
    }
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

  consumeInventoryToggle() {
    const v = this.pendingInventory;
    this.pendingInventory = false;
    return v;
  }

  consumeCameraToggle() {
    const v = this.pendingCamera;
    this.pendingCamera = false;
    return v;
  }

  consumeEscape() {
    const v = this.pendingEscape;
    this.pendingEscape = false;
    return v;
  }

  consumeLeftClick() {
    const v = this.leftClicked;
    this.leftClicked = false;
    return v;
  }

  consumeGuideToggle() {
    const v = this.pendingGuide;
    this.pendingGuide = false;
    return v;
  }
}
