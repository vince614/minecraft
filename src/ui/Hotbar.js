import { HOTBAR_SIZE } from '../inventory/Inventory.js';
import { itemColor, itemName } from '../blocks/BlockRegistry.js';

// Barre d'inventaire : affiche les 9 premiers slots de l'inventaire (id +
// quantité) et la sélection courante. La sélection est stockée dans
// l'inventaire (partagée avec le reste du jeu).
export class Hotbar {
  constructor(container, inventory) {
    this.container = container;
    this.inventory = inventory;
    this.slots = [];
    this._lastVersion = -1;
    this._lastSelected = -1;
    this._build();
    this.refresh();
  }

  _build() {
    this.container.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      this.container.appendChild(slot);
      this.slots.push(slot);
    }
  }

  // Redessine seulement si l'inventaire ou la sélection a changé.
  refresh() {
    if (this.inventory.version === this._lastVersion && this.inventory.selected === this._lastSelected) {
      return;
    }
    this._lastVersion = this.inventory.version;
    this._lastSelected = this.inventory.selected;

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = this.slots[i];
      const stack = this.inventory.slots[i];
      el.classList.toggle('active', i === this.inventory.selected);
      el.innerHTML = `<span class="key">${i + 1}</span>`;
      if (stack) {
        el.innerHTML +=
          `<span class="swatch" style="background:${itemColor(stack.id)}"></span>` +
          `<span class="count">${stack.count > 1 ? stack.count : ''}</span>` +
          `<span class="name">${itemName(stack.id)}</span>`;
      }
    }
  }

  select(i) {
    if (i < 0 || i >= HOTBAR_SIZE) return;
    this.inventory.selected = i;
    this.refresh();
  }

  scroll(delta) {
    this.inventory.selected = (this.inventory.selected + delta + HOTBAR_SIZE) % HOTBAR_SIZE;
    this.refresh();
  }

  selectedBlockId() {
    return this.inventory.selectedId();
  }
}
