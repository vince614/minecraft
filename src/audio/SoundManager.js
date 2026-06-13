// Effets sonores générés entièrement par synthèse (Web Audio API) : aucun
// fichier audio à charger. Chaque son est un mélange de bruit filtré et/ou
// d'oscillateurs avec une enveloppe, le timbre variant selon le matériau du
// bloc. L'AudioContext démarre « suspendu » (politique d'autoplay) et doit être
// réveillé par un geste utilisateur via resume().

// Catégorie sonore d'un bloc, d'après son id.
function categoryOf(id) {
  switch (id) {
    case 3:  // pierre
    case 4:  // bedrock
    case 9:  // pavé
      return 'stone';
    case 6:  // bois
    case 8:  // planches
    case 11: // établi
      return 'wood';
    case 5:  // sable
      return 'sand';
    case 10: // verre
      return 'glass';
    default: // herbe, terre, feuilles…
      return 'soft';
  }
}

export class SoundManager {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.volume = 0.7;
  }

  setVolume(v) {
    this.volume = v;
    this.master.gain.value = v;
  }

  // À appeler sur un geste utilisateur pour (ré)activer l'audio.
  resume() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // --- Briques de synthèse -------------------------------------------------

  // Salve de bruit blanc filtrée, avec enveloppe attaque/déclin.
  _noise(dur, { type = 'lowpass', freq = 1000, q = 1, gain = 0.4 } = {}) {
    const ctx = this.ctx;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;

    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  // Note d'oscillateur avec glissando et déclin.
  _tone(freq, dur, { type = 'triangle', gain = 0.25, freqEnd = freq } = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    const g = ctx.createGain();
    const t = ctx.currentTime;

    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  // --- Sons de jeu ---------------------------------------------------------

  playBreak(id) {
    switch (categoryOf(id)) {
      case 'stone':
        this._noise(0.16, { type: 'lowpass', freq: 1300, q: 0.8, gain: 0.5 });
        this._tone(170, 0.12, { type: 'square', gain: 0.06, freqEnd: 80 });
        break;
      case 'wood':
        this._tone(200, 0.16, { type: 'triangle', gain: 0.28, freqEnd: 110 });
        this._noise(0.1, { type: 'lowpass', freq: 1800, gain: 0.15 });
        break;
      case 'sand':
        this._noise(0.22, { type: 'lowpass', freq: 950, q: 0.5, gain: 0.45 });
        break;
      case 'glass':
        this._noise(0.18, { type: 'highpass', freq: 3500, gain: 0.4 });
        this._tone(2400, 0.12, { type: 'sine', gain: 0.12, freqEnd: 3000 });
        this._tone(3200, 0.16, { type: 'sine', gain: 0.08, freqEnd: 2600 });
        break;
      default: // soft
        this._noise(0.18, { type: 'lowpass', freq: 700, q: 0.7, gain: 0.5 });
    }
  }

  // Poser : version plus brève et douce de la casse.
  playPlace(id) {
    switch (categoryOf(id)) {
      case 'stone':
        this._noise(0.1, { type: 'lowpass', freq: 1100, gain: 0.35 });
        break;
      case 'wood':
        this._tone(180, 0.1, { type: 'triangle', gain: 0.2, freqEnd: 120 });
        break;
      case 'glass':
        this._noise(0.08, { type: 'highpass', freq: 3000, gain: 0.25 });
        break;
      default:
        this._noise(0.1, { type: 'lowpass', freq: 650, gain: 0.35 });
    }
  }

  // Pas : salve très courte et discrète, hauteur légèrement aléatoire.
  playStep(id) {
    const jitter = 0.85 + Math.random() * 0.3;
    const base = { stone: 1100, wood: 800, sand: 700, glass: 1500, soft: 500 };
    const freq = (base[categoryOf(id)] || 500) * jitter;
    this._noise(0.07, { type: 'lowpass', freq, q: 0.6, gain: 0.18 });
  }

  // Craft réussi : deux petites notes ascendantes.
  playCraft() {
    this._tone(520, 0.09, { type: 'square', gain: 0.12, freqEnd: 540 });
    setTimeout(() => this._tone(700, 0.11, { type: 'square', gain: 0.12, freqEnd: 720 }), 70);
  }

  // Clic d'interface.
  playUi() {
    this._tone(660, 0.05, { type: 'sine', gain: 0.12 });
  }

  // Coup porté à un mob (impact sourd).
  playHit() {
    this._noise(0.12, { type: 'lowpass', freq: 500, gain: 0.4 });
    this._tone(140, 0.1, { type: 'square', gain: 0.12, freqEnd: 80 });
  }

  // Mort d'un mob (descente rapide).
  playMobDeath() {
    this._tone(300, 0.25, { type: 'sawtooth', gain: 0.18, freqEnd: 90 });
    this._noise(0.18, { type: 'lowpass', freq: 800, gain: 0.2 });
  }
}
