import { STARTER_INVENTORY } from '../blocks/BlockRegistry.js';

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36; // 9 (hotbar) + 27 (sac)
export const MAX_STACK = 64;

// Inventaire « léger » : un tableau de slots, chaque slot vaut null ou
// { id, count }. Les 9 premiers slots forment la hotbar. La sélection courante
// (molette / touches 1-9) désigne un slot de la hotbar.
export class Inventory {
  constructor() {
    this.slots = new Array(INVENTORY_SIZE).fill(null);
    this.selected = 0;

    // Garnissage initial.
    STARTER_INVENTORY.forEach((entry, i) => {
      if (entry && i < INVENTORY_SIZE) this.slots[i] = { id: entry.id, count: entry.count };
    });

    // Compteur de version : incrémenté à chaque changement pour que l'UI sache
    // quand se redessiner sans diff coûteux.
    this.version = 0;
  }

  touch() {
    this.version++;
  }

  getSelected() {
    return this.slots[this.selected];
  }

  selectedId() {
    const s = this.slots[this.selected];
    return s ? s.id : 0;
  }

  // Ajoute `count` objets `id`, en complétant d'abord les stacks existants puis
  // les slots vides. Retourne le reste non casé (0 si tout est rentré).
  add(id, count = 1) {
    // 1) compléter les stacks existants
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < MAX_STACK) {
        const room = MAX_STACK - s.count;
        const n = Math.min(room, count);
        s.count += n;
        count -= n;
      }
    }
    // 2) remplir les slots vides
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(MAX_STACK, count);
        this.slots[i] = { id, count: n };
        count -= n;
      }
    }
    this.touch();
    return count;
  }

  // Retire un objet du slot sélectionné (utilisé quand on pose un bloc).
  consumeSelected(count = 1) {
    const s = this.slots[this.selected];
    if (!s) return false;
    s.count -= count;
    if (s.count <= 0) this.slots[this.selected] = null;
    this.touch();
    return true;
  }

  // Combien d'un id donné l'inventaire contient-il au total ?
  countOf(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }
}
