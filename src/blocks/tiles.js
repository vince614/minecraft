// Catalogue des tuiles de texture (16x16) dessinées par programme : aucune
// ressource binaire à charger. L'ordre de ce tableau DÉTERMINE l'index de
// couche dans la DataArrayTexture (voir BlockMaterial.js) — donc l'ordre est
// la source de vérité partagée entre la texture et le BlockRegistry.

export const TILE_SIZE = 16;

export const TILE_NAMES = [
  'grass_top',  // 0
  'grass_side', // 1
  'dirt',       // 2
  'stone',      // 3
  'bedrock',    // 4
  'sand',       // 5
  'log_top',    // 6
  'log_side',   // 7
  'leaves',     // 8
  'planks',     // 9
  'cobble',     // 10
  'glass',      // 11
  'craft_top',  // 12
  'craft_side', // 13
];

// Map nom -> index de couche, pratique pour le BlockRegistry.
export const TILE = TILE_NAMES.reduce((acc, name, i) => {
  acc[name] = i;
  return acc;
}, {});

// --- Helpers de dessin -----------------------------------------------------

// Bruit déterministe léger pour donner du grain aux textures. On évite
// Math.random() pour que les textures soient stables d'un chargement à l'autre.
function noise(x, y, seed) {
  const n = Math.sin((x * 12.9898 + y * 78.233 + seed * 37.719)) * 43758.5453;
  return n - Math.floor(n); // [0,1)
}

function px(ctx, x, y, r, g, b, a = 255) {
  ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${(a / 255).toFixed(3)})`;
  ctx.fillRect(x, y, 1, 1);
}

// Remplit toute la tuile avec une couleur de base bruitée (+/- variation).
function fillNoisy(ctx, base, variation, seed) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const v = (noise(x, y, seed) - 0.5) * 2 * variation;
      px(ctx, x, y, base[0] + v, base[1] + v, base[2] + v);
    }
  }
}

// Dessine une tuile par son nom dans un contexte 2D 16x16.
export function drawTile(name, ctx) {
  switch (name) {
    case 'grass_top':
      fillNoisy(ctx, [86, 150, 60], 22, 1);
      break;

    case 'grass_side': {
      // Terre en bas, bande d'herbe en haut. NB : la DataArrayTexture n'inverse
      // pas l'axe Y, donc « haut de la tuile » = haut du bloc une fois mappé.
      fillNoisy(ctx, [134, 96, 67], 16, 2);
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          // Frange irrégulière sur les ~4 premières lignes.
          const limit = 4 + Math.floor(noise(x, 0, 3) * 2);
          if (y < limit) {
            const v = (noise(x, y, 4) - 0.5) * 2 * 20;
            px(ctx, x, y, 86 + v, 150 + v, 60 + v);
          }
        }
      }
      break;
    }

    case 'dirt':
      fillNoisy(ctx, [134, 96, 67], 18, 5);
      break;

    case 'stone':
      fillNoisy(ctx, [128, 128, 130], 16, 6);
      break;

    case 'bedrock':
      fillNoisy(ctx, [55, 55, 58], 30, 7);
      break;

    case 'sand':
      fillNoisy(ctx, [219, 205, 150], 14, 8);
      break;

    case 'log_top': {
      fillNoisy(ctx, [150, 111, 66], 10, 9);
      // Anneaux concentriques.
      const c = 7.5;
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const d = Math.sqrt((x - c) ** 2 + (y - c) ** 2);
          if (Math.floor(d) % 2 === 0) px(ctx, x, y, 120, 86, 50);
        }
      }
      break;
    }

    case 'log_side':
      // Écorce : stries verticales.
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const stripe = Math.sin(x * 1.6) * 18;
          const v = (noise(x, y, 10) - 0.5) * 14;
          px(ctx, x, y, 96 + stripe + v, 67 + stripe + v, 40 + stripe + v);
        }
      }
      break;

    case 'leaves':
      // Feuillage : vert sombre avec quelques pixels transparents (effet ajouré).
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          if (noise(x, y, 11) < 0.16) {
            px(ctx, x, y, 0, 0, 0, 0); // trou transparent
          } else {
            const v = (noise(x, y, 12) - 0.5) * 2 * 26;
            px(ctx, x, y, 52 + v, 110 + v, 42 + v);
          }
        }
      }
      break;

    case 'planks':
      // Planches : lattes horizontales.
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const plank = y % 4 === 0 ? -22 : 0; // joint entre lattes
          const v = (noise(x, y, 13) - 0.5) * 10;
          px(ctx, x, y, 160 + plank + v, 124 + plank + v, 74 + plank + v);
        }
      }
      break;

    case 'cobble':
      // Pavés : taches grises de tailles variées.
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const cell = noise(Math.floor(x / 4), Math.floor(y / 4), 14);
          const v = (cell - 0.5) * 2 * 40 + (noise(x, y, 15) - 0.5) * 14;
          px(ctx, x, y, 120 + v, 120 + v, 122 + v);
        }
      }
      break;

    case 'glass':
      // Verre : presque transparent, juste un cadre et quelques reflets.
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const edge = x === 0 || y === 0 || x === TILE_SIZE - 1 || y === TILE_SIZE - 1;
          if (edge) px(ctx, x, y, 200, 225, 235, 200);
          else if ((x + y) % 7 === 0) px(ctx, x, y, 220, 240, 250, 70); // reflet léger
          else px(ctx, x, y, 0, 0, 0, 0); // transparent
        }
      }
      break;

    case 'craft_top': {
      // Dessus de l'établi : planches + grille de craft 3x3.
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const v = (noise(x, y, 16) - 0.5) * 8;
          px(ctx, x, y, 150 + v, 116 + v, 70 + v);
        }
      }
      // Lignes de grille (cadre + croix interne).
      for (let i = 0; i < TILE_SIZE; i++) {
        px(ctx, i, 1, 80, 58, 32); px(ctx, i, 14, 80, 58, 32);
        px(ctx, 1, i, 80, 58, 32); px(ctx, 14, i, 80, 58, 32);
        px(ctx, i, 5, 96, 70, 40); px(ctx, i, 10, 96, 70, 40);
        px(ctx, 5, i, 96, 70, 40); px(ctx, 10, i, 96, 70, 40);
      }
      break;
    }

    case 'craft_side': {
      // Côté de l'établi : planches avec une silhouette d'outils sombre.
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const plank = y % 4 === 0 ? -22 : 0;
          const v = (noise(x, y, 17) - 0.5) * 8;
          px(ctx, x, y, 150 + plank + v, 116 + plank + v, 70 + plank + v);
        }
      }
      // Bande d'outils foncée en haut.
      for (let x = 2; x < 14; x++) {
        if (x % 3 !== 0) { px(ctx, x, 3, 70, 50, 30); px(ctx, x, 4, 60, 42, 26); }
      }
      break;
    }

    default:
      fillNoisy(ctx, [255, 0, 255], 0, 0); // magenta = tuile manquante
  }
}
