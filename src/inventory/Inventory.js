import { STARTER_INVENTORY, isTool, maxDurabilityOf } from '../blocks/BlockRegistry.js';

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

    // Garnissage initial (les outils reçoivent leur durabilité).
    STARTER_INVENTORY.forEach((entry, i) => {
      if (!entry || i >= INVENTORY_SIZE) return;
      const s = { id: entry.id, count: entry.count };
      if (isTool(entry.id)) { s.count = 1; s.dur = maxDurabilityOf(entry.id); }
      this.slots[i] = s;
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
    // Outils : non empilables, chacun dans son slot avec sa durabilité.
    if (isTool(id)) {
      for (let i = 0; i < this.slots.length && count > 0; i++) {
        if (!this.slots[i]) {
          this.slots[i] = { id, count: 1, dur: maxDurabilityOf(id) };
          count--;
        }
      }
      this.touch();
      return count;
    }

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

  // Retire `count` objets `id` où qu'ils soient. Retourne le reste non retiré.
  remove(id, count = 1) {
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const n = Math.min(s.count, count);
        s.count -= n;
        count -= n;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this.touch();
    return count;
  }

  // Use l'outil sélectionné : réduit sa durabilité ; le retire s'il casse.
  // Retourne 'broke', 'ok' ou null (pas d'outil sélectionné).
  damageSelectedTool() {
    const s = this.slots[this.selected];
    if (!s || s.dur == null) return null;
    // Enchantement Solidité : chance de ne pas consommer de durabilité.
    const u = (s.ench && s.ench.unbreaking) || 0;
    if (u > 0 && Math.random() < u / (u + 1)) return 'ok';
    s.dur--;
    if (s.dur <= 0) {
      this.slots[this.selected] = null;
      this.touch();
      return 'broke';
    }
    this.touch();
    return 'ok';
  }

  // Combien d'un id donné l'inventaire contient-il au total ?
  countOf(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }
}
