import { createNoise2D } from 'simplex-noise';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../core/constants.js';

// Génération procédurale du terrain par bruit de simplex.
//
// Couches (du bas vers le haut) :
//   y == 0                : bedrock (socle indestructible)
//   y < hauteur-3         : pierre
//   hauteur-3 .. hauteur-1: terre (ou sable en biome désert)
//   y == hauteur          : herbe (ou sable en désert)
//   au-dessus             : air
//
// Biomes simples pilotés par un bruit basse fréquence : plaines, forêt, désert.

const SEA_LEVEL = 28;

// PRNG déterministe (mulberry32) pour semer simplex-noise sans dépendance.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash déterministe 2D -> [0,1), utilisé pour décider du placement des arbres.
function hash2(x, z, salt) {
  let h = (x * 73856093) ^ (z * 19349663) ^ (salt * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  h = (Math.imul(h, 1274126177)) >>> 0;
  return h / 4294967296;
}

export class TerrainGenerator {
  constructor(seed = 1337) {
    const rng = mulberry32(seed);
    // Plusieurs canaux de bruit indépendants.
    this.continent = createNoise2D(rng); // relief général
    this.detail = createNoise2D(rng);    // petites variations
    this.biome = createNoise2D(rng);     // sélection de biome
    this.seed = seed;
  }

  // Hauteur du sol (index du bloc de surface) pour une colonne monde (wx,wz).
  heightAt(wx, wz) {
    const c = this.continent(wx * 0.008, wz * 0.008);     // -1..1, large
    const d = this.detail(wx * 0.04, wz * 0.04);          // -1..1, fin
    let h = SEA_LEVEL + 6 + c * 18 + d * 4;
    h = Math.floor(h);
    if (h < 1) h = 1;
    if (h > CHUNK_HEIGHT - 2) h = CHUNK_HEIGHT - 2;
    return h;
  }

  // Biome de la colonne : 'desert', 'forest' ou 'plains'.
  biomeAt(wx, wz) {
    const b = this.biome(wx * 0.004, wz * 0.004);
    if (b > 0.35) return 'desert';
    if (b < -0.3) return 'forest';
    return 'plains';
  }

  // Remplit un chunk : terrain puis arbres.
  generate(chunk) {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    // 1) Terrain colonne par colonne.
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const h = this.heightAt(wx, wz);
        const biome = this.biomeAt(wx, wz);
        const desert = biome === 'desert';

        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) {
            id = 4; // bedrock
          } else if (y < h - 3) {
            id = 3; // pierre
          } else if (y < h) {
            id = desert ? 5 : 2; // sable ou terre
          } else {
            // Surface : sable en désert, sinon herbe (ou sable près de l'eau).
            id = desert ? 5 : h <= SEA_LEVEL ? 5 : 1;
          }
          chunk.set(lx, y, lz, id);
        }
      }
    }

    // 2) Arbres : uniquement plaines/forêt, et seulement si l'arbre tient
    //    entièrement à l'intérieur du chunk (marge de 2) pour ne pas écrire
    //    chez les voisins (qui peuvent ne pas exister encore).
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const biome = this.biomeAt(wx, wz);
        if (biome === 'desert') continue;

        const density = biome === 'forest' ? 0.06 : 0.012;
        if (hash2(wx, wz, this.seed) > density) continue;

        const h = this.heightAt(wx, wz);
        if (h <= SEA_LEVEL || h > CHUNK_HEIGHT - 8) continue;

        this.placeTree(chunk, lx, h + 1, lz, wx, wz);
      }
    }
  }

  // Petit arbre : tronc de 4-5 blocs + canopée sphérique de feuilles.
  placeTree(chunk, lx, baseY, lz, wx, wz) {
    const trunkH = 4 + Math.floor(hash2(wx, wz, this.seed + 7) * 2); // 4 ou 5
    const top = baseY + trunkH;

    // Canopée (avant le tronc pour que le tronc reste visible au centre).
    const r = 2;
    for (let dy = -2; dy <= 1; dy++) {
      const ly = top + dy;
      if (ly < 0 || ly >= CHUNK_HEIGHT) continue;
      const layerR = dy >= 0 ? 1 : r; // resserrement au sommet
      for (let dz = -layerR; dz <= layerR; dz++) {
        for (let dx = -layerR; dx <= layerR; dx++) {
          // Coins arrondis : on saute les angles les plus éloignés.
          if (Math.abs(dx) === layerR && Math.abs(dz) === layerR && layerR > 1) continue;
          const cx = lx + dx;
          const cz = lz + dz;
          if (cx < 0 || cx >= CHUNK_SIZE || cz < 0 || cz >= CHUNK_SIZE) continue;
          if (chunk.get(cx, ly, cz) === 0) chunk.set(cx, ly, cz, 7); // feuilles
        }
      }
    }

    // Tronc.
    for (let y = baseY; y < top; y++) {
      if (y >= 0 && y < CHUNK_HEIGHT) chunk.set(lx, y, lz, 6); // bois
    }
  }
}
