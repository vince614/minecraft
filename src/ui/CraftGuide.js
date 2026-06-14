import { RECIPES, inventoryHas, craftFromInventory } from '../crafting/recipes.js';
import { itemName } from '../blocks/BlockRegistry.js';
import { iconStyle } from '../blocks/icons.js';

// Guide de craft : liste toutes les recettes (ingrédients → résultat). Une
// recette dont on possède les ingrédients est mise en évidence et CLIQUABLE :
// le clic la fabrique directement (consomme les ingrédients, ajoute le
// résultat), sans passer par la grille. Pratique pour les outils.
export class CraftGuide {
  constructor(inventory, onCraft) {
    this.inventory = inventory;
    this.onCraft = onCraft; // appelé après un craft réussi
    this.screen = document.getElementById('guide');
    this.list = document.getElementById('guide-list');
    this.isOpen = false;
    this.rows = [];
    this._build();
  }

  _build() {
    this.list.innerHTML = '';
    this.rows = RECIPES.map((recipe) => {
      const row = document.createElement('div');
      row.className = 'recipe';

      const ings = Object.entries(recipe.ingredients)
        .map(([id, n]) => this._item(+id, n))
        .join('');
      row.innerHTML =
        `<span class="ings">${ings}</span>` +
        `<span class="r-arrow">➜</span>` +
        `<span class="result">${this._item(recipe.output.id, recipe.output.count)}` +
        `<span class="r-name">${itemName(recipe.output.id)}</span></span>`;

      row.addEventListener('click', () => {
        if (craftFromInventory(this.inventory, recipe)) {
          if (this.onCraft) this.onCraft();
          this.render();
        }
      });
      this.list.appendChild(row);
      return { row, recipe };
    });
  }

  _item(id, count) {
    return (
      `<span class="g-item">` +
      `<span class="g-sw" style="${iconStyle(id)}" title="${itemName(id)}"></span>` +
      `<span class="g-n">${count}</span></span>`
    );
  }

  // Met à jour la disponibilité (recettes réalisables surlignées).
  render() {
    for (const { row, recipe } of this.rows) {
      row.classList.toggle('craftable', inventoryHas(this.inventory, recipe));
    }
  }

  open() {
    this.isOpen = true;
    this.screen.classList.remove('hidden');
    this.render();
  }

  close() {
    this.isOpen = false;
    this.screen.classList.add('hidden');
  }
}
