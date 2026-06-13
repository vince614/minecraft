import { TILE } from './tiles.js';

// Définition des types de blocs. Le reste du moteur ne manipule que des id
// numériques (compacts, rapides) ; ce registre est la seule table qui sait ce
// qu'un id « signifie » (solidité, transparence, tuiles par face).
//
// Conventions :
//   - id 0 = air (jamais rendu, jamais solide)
//   - `tiles` : index de couche pour { top, bottom, side }
//   - `transparent` : le bloc laisse passer la lumière / ne cache pas ses
//     voisins (verre, feuilles). Sert au face culling.
//   - `color` : couleur représentative pour la pastille de la hotbar.

export const AIR = 0;

const B = (id, name, opts) => ({ id, name, solid: true, transparent: false, ...opts });

// Table indexée par id. L'index 0 est l'air.
export const BLOCKS = [
  { id: AIR, name: 'air', solid: false, transparent: true },
  B(1, 'Herbe', { tiles: { top: TILE.grass_top, bottom: TILE.dirt, side: TILE.grass_side }, color: '#5c9a3c' }),
  B(2, 'Terre', { tiles: { top: TILE.dirt, bottom: TILE.dirt, side: TILE.dirt }, color: '#866043' }),
  B(3, 'Pierre', { tiles: { top: TILE.stone, bottom: TILE.stone, side: TILE.stone }, color: '#808082' }),
  B(4, 'Bedrock', { tiles: { top: TILE.bedrock, bottom: TILE.bedrock, side: TILE.bedrock }, color: '#37373a' }),
  B(5, 'Sable', { tiles: { top: TILE.sand, bottom: TILE.sand, side: TILE.sand }, color: '#dbcd96' }),
  B(6, 'Bois', { tiles: { top: TILE.log_top, bottom: TILE.log_top, side: TILE.log_side }, color: '#6f4e2c' }),
  B(7, 'Feuilles', { tiles: { top: TILE.leaves, bottom: TILE.leaves, side: TILE.leaves }, color: '#346e2a', transparent: true }),
  B(8, 'Planches', { tiles: { top: TILE.planks, bottom: TILE.planks, side: TILE.planks }, color: '#a07c4a' }),
  B(9, 'Pavé', { tiles: { top: TILE.cobble, bottom: TILE.cobble, side: TILE.cobble }, color: '#78787a' }),
  B(10, 'Verre', { tiles: { top: TILE.glass, bottom: TILE.glass, side: TILE.glass }, color: '#c8e1eb', transparent: true }),
  B(11, 'Établi', { tiles: { top: TILE.craft_top, bottom: TILE.planks, side: TILE.craft_side }, color: '#9a6f3c', interactive: true }),
];

// Objets non-plaçables (id >= 100) : ils existent dans l'inventaire et servent
// au craft mais ne sont pas des blocs du monde. Ex : les bâtons.
export const STICK = 100;
export const ITEMS = {
  [STICK]: { id: STICK, name: 'Bâton', color: '#8a6233', placeable: false },
};

// Accès unifié bloc OU objet par id.
export function getItem(id) {
  if (id >= 100) return ITEMS[id];
  return BLOCKS[id];
}

export function itemName(id) {
  const it = getItem(id);
  return it ? it.name : '?';
}

export function itemColor(id) {
  const it = getItem(id);
  return it ? it.color : '#ff00ff';
}

// Un id peut-il être posé dans le monde ? (bloc solide, pas un objet pur)
export function isPlaceable(id) {
  return id > AIR && id < 100;
}

// Le bloc déclenche-t-il une interaction au clic droit (ex : établi) ?
export function isInteractive(id) {
  return id > AIR && id < 100 && !!BLOCKS[id].interactive;
}

export function getBlock(id) {
  return BLOCKS[id];
}

export function isSolid(id) {
  return id !== AIR && BLOCKS[id].solid;
}

export function isTransparent(id) {
  return id === AIR || BLOCKS[id].transparent;
}

// Un bloc « opaque » cache complètement ses voisins (utilisé par le face culling).
export function isOpaque(id) {
  return id !== AIR && !BLOCKS[id].transparent;
}

// Retourne l'index de couche de texture pour une face donnée.
// faceDir ∈ { 'top', 'bottom', 'side' }.
export function tileFor(id, faceDir) {
  return BLOCKS[id].tiles[faceDir];
}

// Inventaire de départ : on garnit quelques slots pour pouvoir construire et
// crafter immédiatement. Chaque entrée = { id, count } ou null (slot vide).
export const STARTER_INVENTORY = [
  { id: 6, count: 16 },   // Bois
  { id: 8, count: 32 },   // Planches
  { id: 3, count: 32 },   // Pierre
  { id: 9, count: 16 },   // Pavé
  { id: 5, count: 16 },   // Sable
  { id: 10, count: 16 },  // Verre
  { id: 11, count: 4 },   // Établi
  { id: 1, count: 16 },   // Herbe
  { id: 7, count: 16 },   // Feuilles
];
