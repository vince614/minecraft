// Sauvegarde / chargement dans localStorage. On ne sauve PAS le monde entier
// (infini) mais seulement les blocs modifiés par le joueur (un diff), plus
// l'inventaire, la position et l'heure du jour. À la régénération d'un chunk,
// le World réapplique ces modifications.

const KEY = 'minecraft-clone-save';

export function saveGame(game) {
  try {
    const data = {
      edits: Array.from(game.world.edits.entries()), // [["wx,wy,wz", id], ...]
      inventory: game.inventory.slots,
      selected: game.inventory.selected,
      player: {
        x: game.player.position.x,
        y: game.player.position.y,
        z: game.player.position.z,
        yaw: game.player.yaw,
        pitch: game.player.pitch,
        health: game.player.health,
        flying: game.player.flying,
      },
      time: game.sky ? game.sky.time : 0.3,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(game) {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);

    if (Array.isArray(data.edits)) {
      game.world.edits = new Map(data.edits);
    }
    if (Array.isArray(data.inventory)) {
      game.inventory.slots = data.inventory;
      game.inventory.touch();
    }
    if (typeof data.selected === 'number') game.inventory.selected = data.selected;

    if (data.player) {
      const p = data.player;
      game.player.position.set(p.x, p.y, p.z);
      game.player.yaw = p.yaw || 0;
      game.player.pitch = p.pitch || 0;
      game.player.health = p.health != null ? p.health : game.player.maxHealth;
      game.player.flying = !!p.flying;
    }
    if (game.sky && typeof data.time === 'number') game.sky.time = data.time;

    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* ignoré */
  }
}
