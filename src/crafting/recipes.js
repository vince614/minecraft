import { STICK } from '../blocks/BlockRegistry.js';

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
