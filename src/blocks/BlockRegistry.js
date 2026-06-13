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
  // Eau : non solide (on peut nager au travers) et transparente.
  B(12, 'Eau', { tiles: { top: TILE.water, bottom: TILE.water, side: TILE.water }, color: '#2f6fd0', solid: false, transparent: true }),
  // Minerais (dans la pierre) : opaques, plus durs à miner.
  B(13, 'Charbon', { tiles: { top: TILE.coal_ore, bottom: TILE.coal_ore, side: TILE.coal_ore }, color: '#2c2c30', hardness: 1.4 }),
  B(14, 'Fer', { tiles: { top: TILE.iron_ore, bottom: TILE.iron_ore, side: TILE.iron_ore }, color: '#c89878', hardness: 1.6 }),
  B(15, 'Or', { tiles: { top: TILE.gold_ore, bottom: TILE.gold_ore, side: TILE.gold_ore }, color: '#e6cd46', hardness: 1.8 }),
  B(16, 'Diamant', { tiles: { top: TILE.diamond_ore, bottom: TILE.diamond_ore, side: TILE.diamond_ore }, color: '#6edce6', hardness: 2.2 }),
];

export const WATER = 12;
export function isWater(id) {
  return id === WATER;
}

// Dureté (secondes de minage). Par défaut selon une heuristique simple.
const DEFAULT_HARDNESS = {
  1: 0.5, 2: 0.5, 5: 0.5, 7: 0.3,   // herbe, terre, sable, feuilles
  3: 1.2, 9: 1.2,                    // pierre, pavé
  6: 0.7, 8: 0.7, 11: 0.7,          // bois, planches, établi
  10: 0.3,                           // verre
};
export function hardnessOf(id) {
  const b = BLOCKS[id];
  if (!b) return 0.5;
  if (b.hardness != null) return b.hardness;
  return DEFAULT_HARDNESS[id] != null ? DEFAULT_HARDNESS[id] : 0.5;
}

// Objets non-plaçables (id >= 100) : ils existent dans l'inventaire et servent
// au craft mais ne sont pas des blocs du monde. Ex : les bâtons.
export const STICK = 100;
export const LEATHER = 101;
export const FEATHER = 102;
export const MEAT = 103;
export const ROTTEN = 104;
export const ITEMS = {
  [STICK]: { id: STICK, name: 'Bâton', color: '#8a6233', placeable: false },
  [LEATHER]: { id: LEATHER, name: 'Cuir', color: '#9a6b3f', placeable: false },
  [FEATHER]: { id: FEATHER, name: 'Plume', color: '#eaeaea', placeable: false },
  [MEAT]: { id: MEAT, name: 'Viande', color: '#d06a6a', placeable: false },
  [ROTTEN]: { id: ROTTEN, name: 'Chair putréfiée', color: '#6a8a4a', placeable: false },
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

// Un id peut-il être posé dans le monde ? (bloc solide, pas un objet pur ni
// un fluide non solide comme l'eau)
export function isPlaceable(id) {
  return id > AIR && id < 100 && BLOCKS[id].solid !== false;
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
