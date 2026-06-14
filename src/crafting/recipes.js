import { STICK, SWORD, PICKAXE, BOW, ARROW, POWDER, TNT, isTool, maxDurabilityOf } from '../blocks/BlockRegistry.js';

// Recettes « sans forme » (shapeless) : seul le contenu de la grille compte,
// pas la disposition. Une recette correspond si l'ensemble des objets posés
// dans la grille est EXACTEMENT celui des ingrédients (mêmes ids, mêmes
// quantités). Ce modèle léger évite la gestion des motifs/positions tout en
// rendant le craft fonctionnel.
//
// ingredients : map id -> quantité requise.
// output      : { id, count } produit.
export const RECIPES = [
  { ingredients: { 6: 1 }, output: { id: 8, count: 4 } },        // 1 bûche -> 4 planches
  { ingredients: { 8: 2 }, output: { id: STICK, count: 4 } },    // 2 planches -> 4 bâtons
  { ingredients: { 8: 4 }, output: { id: 11, count: 1 } },       // 4 planches -> 1 établi
  { ingredients: { 5: 4 }, output: { id: 10, count: 1 } },       // 4 sable -> 1 verre
  { ingredients: { 9: 8 }, output: { id: 3, count: 8 } },        // 8 pavés -> 8 pierres (démo)

  // Outils, armes et explosifs.
  { ingredients: { 8: 2, [STICK]: 1 }, output: { id: SWORD, count: 1 } },
  { ingredients: { 8: 3, [STICK]: 2 }, output: { id: PICKAXE, count: 1 } },
  { ingredients: { [STICK]: 3, 102: 3 }, output: { id: BOW, count: 1 } },
  { ingredients: { [STICK]: 1, 102: 1 }, output: { id: ARROW, count: 4 } },
  { ingredients: { 5: 4, [POWDER]: 1 }, output: { id: TNT, count: 1 } },
];

// Construit la map id -> total à partir des slots de la grille de craft.
function gridCounts(grid) {
  const counts = {};
  for (const slot of grid) {
    if (!slot) continue;
    counts[slot.id] = (counts[slot.id] || 0) + slot.count;
  }
  return counts;
}

// Deux maps de comptes sont-elles strictement égales ?
function sameCounts(a, b) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

// L'inventaire contient-il tous les ingrédients d'une recette ?
export function inventoryHas(inventory, recipe) {
  for (const id in recipe.ingredients) {
    if (inventory.countOf(+id) < recipe.ingredients[id]) return false;
  }
  return true;
}

// Craft direct depuis l'inventaire (guide « 1 clic ») : consomme les
// ingrédients et ajoute le résultat. Retourne true si réussi.
export function craftFromInventory(inventory, recipe) {
  if (!inventoryHas(inventory, recipe)) return false;
  for (const id in recipe.ingredients) inventory.remove(+id, recipe.ingredients[id]);
  inventory.add(recipe.output.id, recipe.output.count);
  return true;
}

// Réparation : deux outils identiques dans la grille -> un outil réparé dont la
// durabilité est la somme (+ bonus 10%), plafonnée au maximum.
export function matchRepair(grid) {
  const items = grid.filter(Boolean);
  if (items.length !== 2) return null;
  const [a, b] = items;
  if (a.id !== b.id || !isTool(a.id) || a.dur == null || b.dur == null) return null;
  const max = maxDurabilityOf(a.id);
  const dur = Math.min(max, a.dur + b.dur + Math.floor(max * 0.1));
  return { id: a.id, count: 1, dur, repair: true };
}

// Retourne l'output { id, count } correspondant au contenu de la grille, ou null.
export function matchRecipe(grid) {
  const counts = gridCounts(grid);
  if (Object.keys(counts).length === 0) return null;
  for (const recipe of RECIPES) {
    if (sameCounts(counts, recipe.ingredients)) {
      return { ...recipe.output };
    }
  }
  return null;
}
