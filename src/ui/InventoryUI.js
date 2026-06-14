import { MAX_STACK } from '../inventory/Inventory.js';
import { itemName } from '../blocks/BlockRegistry.js';
import { iconStyle } from '../blocks/icons.js';
import { durBarHtml } from './Hotbar.js';
import { matchRecipe, matchRepair } from '../crafting/recipes.js';

// Écran d'inventaire + craft. Interaction « à la Minecraft » au clic :
//   - clic gauche : prendre / déposer / fusionner la pile entière (ou échanger)
//   - clic droit  : déposer un objet (ou prendre la moitié d'une pile)
// La pile « tenue » suit le curseur (#cursor-stack).
//
// La grille de craft est un état interne (this.craftGrid) ; les slots inventaire
// pointent directement vers inventory.slots. À la fermeture, tout est rendu à
// l'inventaire pour ne rien perdre.
export class InventoryUI {
  constructor(inventory, onCraft = null) {
    this.inventory = inventory;
    this.onCraft = onCraft; // appelé quand une recette est exécutée
    this.mode = 'craft';        // 'craft' (grille + résultat) ou 'chest' (27 slots)
    this.gridSize = 2;          // 2x2 (E) ou 3x3 (établi)
    this.craftGrid = [];        // slots de craft (null | {id,count})
    this.chestSlots = null;     // référence vers le contenu du coffre ouvert
    this.cursor = null;         // pile tenue par le curseur

    this.screen = document.getElementById('inventory');
    this.heading = document.getElementById('inv-heading');
    this.gridEl = document.getElementById('craft-grid');
    this.resultEl = document.getElementById('craft-result');
    this.arrowEl = this.screen.querySelector('.craft-arrow');
    this.mainEl = document.getElementById('inv-main');
    this.hotbarEl = document.getElementById('inv-hotbar');
    this.cursorEl = document.getElementById('cursor-stack');

    this.isOpen = false;
    this.currentResult = null;

    // Le curseur suit la souris quand l'écran est ouvert.
    document.addEventListener('mousemove', (e) => {
      if (!this.isOpen) return;
      this.cursorEl.style.left = `${e.clientX}px`;
      this.cursorEl.style.top = `${e.clientY}px`;
    });
    // Empêche le menu contextuel (on utilise le clic droit).
    this.screen.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  open(gridSize = 2) {
    this.mode = 'craft';
    this.gridSize = gridSize;
    this.craftGrid = new Array(gridSize * gridSize).fill(null);
    this.heading.textContent = gridSize === 3 ? 'Établi' : 'Inventaire';
    this.gridEl.style.gridTemplateColumns = `repeat(${gridSize}, 46px)`;
    this.resultEl.style.display = '';
    this.arrowEl.style.display = '';
    this.isOpen = true;
    this.screen.classList.remove('hidden');
    this._buildSlots();
    this._render();
  }

  // Ouvre un coffre : la grille du haut devient les 27 slots du coffre.
  openChest(chestSlots) {
    this.mode = 'chest';
    this.chestSlots = chestSlots;
    this.heading.textContent = 'Coffre';
    this.gridEl.style.gridTemplateColumns = 'repeat(9, 46px)';
    this.resultEl.style.display = 'none';
    this.arrowEl.style.display = 'none';
    this.isOpen = true;
    this.screen.classList.remove('hidden');
    this._buildSlots();
    this._render();
  }

  close() {
    // En mode craft, on rend les ingrédients restants ; le coffre, lui, garde
    // son contenu (référencé). La pile tenue retourne toujours à l'inventaire.
    if (this.mode === 'craft') {
      for (const s of this.craftGrid) if (s) this.inventory.add(s.id, s.count);
      this.craftGrid = [];
    }
    this.chestSlots = null;
    if (this.cursor) { this.inventory.add(this.cursor.id, this.cursor.count); this.cursor = null; }
    this.isOpen = false;
    this.screen.classList.add('hidden');
    this.cursorEl.style.display = 'none';
  }

  // (Re)crée tous les éléments de slot avec leurs écouteurs.
  _buildSlots() {
    this.gridEl.innerHTML = '';
    this.mainEl.innerHTML = '';
    this.hotbarEl.innerHTML = '';
    this.resultEl.innerHTML = '';
    this.topEls = [];

    if (this.mode === 'chest') {
      this.topEls = this.chestSlots.map((_, i) => this._makeSlot('chest', i, this.gridEl));
    } else {
      this.topEls = this.craftGrid.map((_, i) => this._makeSlot('craft', i, this.gridEl));
      this.resultSlot = document.createElement('div');
      this.resultSlot.className = 'iv-slot result-slot';
      this.resultSlot.addEventListener('click', () => this._craft());
      this.resultEl.appendChild(this.resultSlot);
    }

    // Inventaire principal = slots 9..35 ; hotbar = slots 0..8.
    this.mainEls = [];
    for (let i = 9; i < 36; i++) this.mainEls.push(this._makeSlot('inv', i, this.mainEl));
    this.hotbarEls = [];
    for (let i = 0; i < 9; i++) this.hotbarEls.push(this._makeSlot('inv', i, this.hotbarEl));
  }

  _makeSlot(zone, index, parent) {
    const el = document.createElement('div');
    el.className = 'iv-slot';
    el.addEventListener('click', (e) => { e.preventDefault(); this._click(zone, index, false); });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); this._click(zone, index, true); });
    parent.appendChild(el);
    return el;
  }

  _stackOf(zone, index) {
    if (zone === 'craft') return this.craftGrid[index];
    if (zone === 'chest') return this.chestSlots[index];
    return this.inventory.slots[index];
  }

  _setStack(zone, index, stack) {
    if (zone === 'craft') this.craftGrid[index] = stack;
    else if (zone === 'chest') this.chestSlots[index] = stack;
    else this.inventory.slots[index] = stack;
  }

  // Gère un clic sur un slot inventaire/craft.
  _click(zone, index, right) {
    const cell = this._stackOf(zone, index);

    if (!right) {
      // --- Clic gauche : pile entière ---
      if (this.cursor && cell && cell.id === this.cursor.id) {
        const room = MAX_STACK - cell.count;
        const n = Math.min(room, this.cursor.count);
        cell.count += n;
        this.cursor.count -= n;
        if (this.cursor.count <= 0) this.cursor = null;
      } else {
        // échange pile tenue <-> slot
        this._setStack(zone, index, this.cursor);
        this.cursor = cell || null;
      }
    } else {
      // --- Clic droit : un objet / moitié ---
      if (this.cursor) {
        if (!cell) {
          this._setStack(zone, index, { id: this.cursor.id, count: 1 });
          this.cursor.count--;
        } else if (cell.id === this.cursor.id && cell.count < MAX_STACK) {
          cell.count++;
          this.cursor.count--;
        }
        if (this.cursor && this.cursor.count <= 0) this.cursor = null;
      } else if (cell) {
        const half = Math.ceil(cell.count / 2);
        this.cursor = { id: cell.id, count: half };
        cell.count -= half;
        if (cell.count <= 0) this._setStack(zone, index, null);
      }
    }

    this.inventory.touch();
    this._render();
  }

  // Clique sur le slot résultat : exécute la recette (ou la réparation).
  _craft() {
    const result = this.currentResult;
    if (!result) return;
    const isTool = result.dur != null;
    if (this.cursor) {
      if (isTool) return; // on ne fusionne pas les outils
      if (this.cursor.id !== result.id) return;
      if (this.cursor.count + result.count > MAX_STACK) return;
    }
    // La grille contient pile les ingrédients (ou les 2 outils) -> on la vide.
    this.craftGrid = this.craftGrid.map(() => null);
    if (this.cursor) this.cursor.count += result.count;
    else this.cursor = { ...result };

    if (this.onCraft) this.onCraft();
    this.inventory.touch();
    this._render();
  }

  _render() {
    this.mainEls.forEach((el, i) => this._paint(el, this.inventory.slots[9 + i]));
    this.hotbarEls.forEach((el, i) => this._paint(el, this.inventory.slots[i]));

    if (this.mode === 'chest') {
      this.topEls.forEach((el, i) => this._paint(el, this.chestSlots[i]));
    } else {
      this.topEls.forEach((el, i) => this._paint(el, this.craftGrid[i]));
      // Résultat (aperçu) : recette ou réparation.
      this.currentResult = matchRecipe(this.craftGrid) || matchRepair(this.craftGrid);
      this._paint(this.resultSlot, this.currentResult);
    }

    // Pile tenue par le curseur.
    if (this.cursor) {
      this.cursorEl.style.display = 'block';
      this.cursorEl.querySelector('.swatch').style.cssText = iconStyle(this.cursor.id);
      this.cursorEl.querySelector('.count').textContent = this.cursor.count > 1 ? this.cursor.count : '';
    } else {
      this.cursorEl.style.display = 'none';
    }
  }

  _paint(el, stack) {
    if (!stack) { el.innerHTML = ''; el.title = ''; return; }
    el.innerHTML =
      `<span class="swatch" style="${iconStyle(stack.id)}"></span>` +
      (stack.count > 1 ? `<span class="count">${stack.count}</span>` : '') +
      durBarHtml(stack);
    el.title = itemName(stack.id);
  }
}
