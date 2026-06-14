import { BLOCKS, itemColor, tileFor, SWORD, PICKAXE, BOW, ARROW, STICK, MEAT, FEATHER } from './BlockRegistry.js';
import { TILE_NAMES, TILE_SIZE, drawTile } from './tiles.js';

// Génère une petite icône (data URL) représentative de chaque objet :
//   - blocs : la vraie tuile de texture (face latérale), agrandie
//   - outils/objets : un dessin pixel reconnaissable (épée, pioche, arc…)
// Les icônes sont mises en cache. Utilisées partout dans l'UI (hotbar,
// inventaire, guide, curseur) à la place des aplats de couleur.

const cache = new Map();

export function iconUrl(id) {
  if (cache.has(id)) return cache.get(id);
  const url = id < 100 && BLOCKS[id] ? blockIcon(id) : itemIcon(id);
  cache.set(id, url);
  return url;
}

// Style CSS prêt à coller sur un .swatch.
export function iconStyle(id) {
  return `background-image:url('${iconUrl(id)}');background-size:cover;image-rendering:pixelated;`;
}

// Icône d'un bloc : sa tuile latérale rendue puis agrandie.
function blockIcon(id) {
  const tileName = TILE_NAMES[tileFor(id, 'side')];
  const small = document.createElement('canvas');
  small.width = small.height = TILE_SIZE;
  drawTile(tileName, small.getContext('2d', { willReadFrequently: true }));

  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, 32, 32);
  return c.toDataURL();
}

function newCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

// Icône d'un objet : dessin vectoriel simple selon le type.
function itemIcon(id) {
  const { c, ctx } = newCanvas();
  switch (id) {
    case SWORD:
      ctx.save(); ctx.translate(16, 16); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#cdd4da'; ctx.fillRect(-2, -13, 4, 19);
      ctx.fillStyle = '#eef3f7'; ctx.fillRect(-1, -13, 1, 19);
      ctx.fillStyle = '#c9a227'; ctx.fillRect(-5, 5, 10, 3);     // garde
      ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-2, 8, 4, 6);      // manche
      ctx.restore();
      break;
    case PICKAXE: {
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(14, 7, 4, 19);     // manche
      ctx.fillStyle = '#9aa0a6';
      ctx.beginPath();
      ctx.moveTo(3, 9); ctx.quadraticCurveTo(16, 2, 29, 9);
      ctx.lineTo(27, 12); ctx.quadraticCurveTo(16, 6, 5, 12);
      ctx.closePath(); ctx.fill();
      break;
    }
    case BOW:
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(20, 16, 12, Math.PI * 0.55, Math.PI * 1.45); ctx.stroke();
      ctx.strokeStyle = '#eeeeee'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(13.5, 5.5); ctx.lineTo(13.5, 26.5); ctx.stroke();
      break;
    case ARROW:
      ctx.save(); ctx.translate(16, 16); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#cbb88f'; ctx.fillRect(-1, -12, 2, 24);   // hampe
      ctx.fillStyle = '#9a9a9a';                                  // pointe
      ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(-3, -10); ctx.lineTo(3, -10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f0f0f0'; ctx.fillRect(-3, 9, 6, 4);      // empennage
      ctx.restore();
      break;
    case STICK:
      ctx.save(); ctx.translate(16, 16); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#8a6233'; ctx.fillRect(-1.5, -10, 3, 20);
      ctx.restore();
      break;
    case MEAT:
      ctx.fillStyle = '#d06a6a';
      ctx.beginPath(); ctx.ellipse(18, 16, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0e8e0'; ctx.fillRect(5, 13, 7, 6);      // os
      ctx.beginPath(); ctx.arc(5, 13, 3, 0, Math.PI * 2); ctx.arc(5, 19, 3, 0, Math.PI * 2); ctx.fill();
      break;
    case FEATHER:
      ctx.save(); ctx.translate(16, 16); ctx.rotate(-Math.PI / 5);
      ctx.fillStyle = '#f2f2f2'; ctx.beginPath();
      ctx.ellipse(0, 0, 4, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c8c8c8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 13); ctx.stroke();
      ctx.restore();
      break;
    default: {
      // Objet générique : pastille arrondie de la couleur de l'objet.
      ctx.fillStyle = itemColor(id);
      ctx.beginPath();
      const r = 7;
      ctx.moveTo(8 + r, 8);
      ctx.arcTo(24, 8, 24, 24, r); ctx.arcTo(24, 24, 8, 24, r);
      ctx.arcTo(8, 24, 8, 8, r); ctx.arcTo(8, 8, 24, 8, r);
      ctx.fill();
    }
  }
  return c.toDataURL();
}
