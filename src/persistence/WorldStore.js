// Gestion de plusieurs mondes sauvegardés + réglages globaux, dans localStorage.
//   - mc-worlds        : liste des mondes [{id,name,seed,mode,created,lastPlayed}]
//   - mc-world-<id>    : données d'un monde (edits, chests, inventaire, joueur, heure)
//   - mc-settings      : réglages globaux (graphismes, audio, contrôles, jeu)

const WORLDS_KEY = 'mc-worlds';
const SETTINGS_KEY = 'mc-settings';
const dataKey = (id) => `mc-world-${id}`;

export const DEFAULT_SETTINGS = {
  renderDistance: 8,
  fov: 75,
  brightness: 1.0,
  fog: true,
  volume: 0.7,
  sensitivity: 1.0,
  invertY: false,
  difficulty: 'normal', // 'peaceful' = pas d'hostiles
  dayLength: 180,
  weather: true,
};

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota */ }
}

// --- Réglages -------------------------------------------------------------

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
}
export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

// --- Mondes ---------------------------------------------------------------

export function listWorlds() {
  const list = read(WORLDS_KEY, []);
  return Array.isArray(list) ? list.sort((a, b) => b.lastPlayed - a.lastPlayed) : [];
}
function saveList(list) {
  write(WORLDS_KEY, list);
}

export function createWorld(name, seed, mode) {
  const list = read(WORLDS_KEY, []);
  const id = 'w' + Math.random().toString(36).slice(2, 9);
  const world = {
    id,
    name: (name || 'Nouveau monde').slice(0, 40),
    seed: (seed >>> 0) || 1,
    mode: mode === 'creative' ? 'creative' : 'survival',
    created: Date.now(),
    lastPlayed: Date.now(),
  };
  list.push(world);
  saveList(list);
  return world;
}

export function getWorld(id) {
  return listWorlds().find((w) => w.id === id) || null;
}

export function deleteWorld(id) {
  saveList(read(WORLDS_KEY, []).filter((w) => w.id !== id));
  try { localStorage.removeItem(dataKey(id)); } catch (e) { /* ignore */ }
}

export function touchWorld(id) {
  const list = read(WORLDS_KEY, []);
  const w = list.find((x) => x.id === id);
  if (w) { w.lastPlayed = Date.now(); saveList(list); }
}

// --- Données d'un monde ---------------------------------------------------

export function saveWorldData(id, game) {
  if (!id) return;
  write(dataKey(id), {
    edits: Array.from(game.world.edits.entries()),
    chests: Array.from(game.world.chests.entries()),
    inventory: game.inventory.slots,
    selected: game.inventory.selected,
    player: {
      x: game.player.position.x, y: game.player.position.y, z: game.player.position.z,
      yaw: game.player.yaw, pitch: game.player.pitch,
      health: game.player.health, hunger: game.player.hunger, flying: game.player.flying,
    },
    time: game.sky ? game.sky.time : 0.3,
  });
  touchWorld(id);
}

// Applique les données d'un monde au jeu. Retourne true si des données existaient.
export function loadWorldData(id, game) {
  const data = read(dataKey(id), null);
  if (!data) return false;

  if (Array.isArray(data.edits)) game.world.edits = new Map(data.edits);
  if (Array.isArray(data.chests)) game.world.chests = new Map(data.chests);
  if (Array.isArray(data.inventory)) { game.inventory.slots = data.inventory; game.inventory.touch(); }
  if (typeof data.selected === 'number') game.inventory.selected = data.selected;
  if (data.player) {
    const p = data.player;
    game.player.position.set(p.x, p.y, p.z);
    game.player.spawn.set(p.x, p.y, p.z);
    game.player.yaw = p.yaw || 0;
    game.player.pitch = p.pitch || 0;
    game.player.health = p.health != null ? p.health : game.player.maxHealth;
    game.player.hunger = p.hunger != null ? p.hunger : game.player.maxHunger;
    if (p.flying != null) game.player.flying = p.flying;
  }
  if (game.sky && typeof data.time === 'number') game.sky.time = data.time;
  return true;
}
