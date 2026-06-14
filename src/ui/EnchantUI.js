import { enchantsFor, itemName } from '../blocks/BlockRegistry.js';
import { iconStyle } from '../blocks/icons.js';

const DIAMOND = 16; // monnaie d'enchantement

// Table d'enchantement : enchante l'outil SÉLECTIONNÉ dans la hotbar, en
// dépensant des diamants. Chaque enchantement a un niveau (★) et un maximum.
export class EnchantUI {
  constructor(inventory, onChange) {
    this.inventory = inventory;
    this.onChange = onChange;
    this.screen = document.getElementById('enchant');
    this.toolEl = document.getElementById('ench-tool');
    this.listEl = document.getElementById('ench-list');
    this.isOpen = false;
    this.screen.addEventListener('contextmenu', (e) => e.preventDefault());
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

  render() {
    const stack = this.inventory.getSelected();
    const diamonds = this.inventory.countOf(DIAMOND);
    this.listEl.innerHTML = '';

    if (!stack || stack.dur == null) {
      this.toolEl.innerHTML = '<span class="ench-msg">Sélectionne un outil (épée, pioche, arc) dans la hotbar (1–9).</span>';
      return;
    }

    this.toolEl.innerHTML =
      `<span class="swatch" style="${iconStyle(stack.id)}"></span>` +
      `<span class="ench-name">${itemName(stack.id)}</span>` +
      `<span class="ench-dia">💎 ${diamonds}</span>`;

    const ench = stack.ench || {};
    for (const e of enchantsFor(stack.id)) {
      const lvl = ench[e.key] || 0;
      const maxed = lvl >= e.max;
      const can = !maxed && diamonds >= e.cost;
      const row = document.createElement('div');
      row.className = 'ench-row' + (can ? ' ok' : '');
      row.innerHTML =
        `<span class="er-name">${e.name} ` +
        `<span class="er-stars">${'★'.repeat(lvl)}${'☆'.repeat(e.max - lvl)}</span></span>` +
        `<span class="er-cost">${maxed ? 'MAX' : e.cost + ' 💎'}</span>`;
      if (can) row.addEventListener('click', () => this._apply(stack, e));
      this.listEl.appendChild(row);
    }
  }

  _apply(stack, e) {
    if ((stack.ench?.[e.key] || 0) >= e.max) return;
    if (this.inventory.countOf(DIAMOND) < e.cost) return;
    this.inventory.remove(DIAMOND, e.cost);
    stack.ench = stack.ench || {};
    stack.ench[e.key] = (stack.ench[e.key] || 0) + 1;
    this.inventory.touch();
    if (this.onChange) this.onChange();
    this.render();
  }
}
