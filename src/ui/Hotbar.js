import { BLOCKS, HOTBAR_BLOCKS } from '../blocks/BlockRegistry.js';

// Barre d'inventaire : 9 emplacements, sélection au clavier (1-9) et molette.
export class Hotbar {
  constructor(container) {
    this.container = container;
    this.blocks = HOTBAR_BLOCKS;
    this.selected = 0;
    this.slots = [];
    this._build();
    this._render();
  }

  _build() {
    this.container.innerHTML = '';
    this.blocks.forEach((id, i) => {
      const block = BLOCKS[id];
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML = `
        <span class="key">${i + 1}</span>
        <span class="swatch" style="background:${block.color}"></span>
        <span class="name">${block.name}</span>
      `;
      this.container.appendChild(slot);
      this.slots.push(slot);
    });
  }

  _render() {
    this.slots.forEach((s, i) => s.classList.toggle('active', i === this.selected));
  }

  select(i) {
    if (i < 0 || i >= this.blocks.length) return;
    this.selected = i;
    this._render();
  }

  // Décale la sélection (molette) avec bouclage.
  scroll(delta) {
    const n = this.blocks.length;
    this.selected = (this.selected + delta + n) % n;
    this._render();
  }

  selectedBlockId() {
    return this.blocks[this.selected];
  }
}
