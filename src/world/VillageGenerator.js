import { CHUNK_HEIGHT } from '../core/constants.js';

// Génération de villages, déterministe et indépendante des chunks. Le monde est
// découpé en cellules de CELL blocs ; certaines contiennent un village (centre
// déterministe). Lors de la génération d'un chunk, on écrit les structures des
// villages voisins qui le recoupent (comme les arbres, mais en plus grand).

const CELL = 256;
const VILLAGE_PROB = 0.32;
const REACH = 26; // portée max d'un village autour de son centre (blocs)
const SEA_LEVEL = 28;

// Blocs utilisés.
const PLANKS = 8, COBBLE = 9, LOG = 6, GLASS = 10, WATER = 12, AIR = 0, PATH = 9;

function hash2(x, z, salt) {
  let h = (x * 73856093) ^ (z * 19349663) ^ (salt * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return h / 4294967296;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class VillageGenerator {
  constructor(seed = 1337) {
    this.seed = seed;
    this._cellCache = new Map();
    this._bldCache = new Map();
  }

  // Y a-t-il un village dans la cellule (ci,cj) ? Renvoie {cx,cz,vseed} ou null.
  villageInCell(ci, cj) {
    const key = `${ci},${cj}`;
    if (this._cellCache.has(key)) return this._cellCache.get(key);
    let v = null;
    if (hash2(ci, cj, this.seed) < VILLAGE_PROB) {
      const cx = ci * CELL + 64 + Math.floor(hash2(ci, cj, this.seed + 1) * 128);
      const cz = cj * CELL + 64 + Math.floor(hash2(ci, cj, this.seed + 2) * 128);
      const vseed = Math.floor(hash2(ci, cj, this.seed + 3) * 0xffffffff);
      v = { cx, cz, vseed };
    }
    this._cellCache.set(key, v);
    return v;
  }

  // Liste déterministe des maisons d'un village (cachée).
  buildings(v) {
    if (this._bldCache.has(v.vseed)) return this._bldCache.get(v.vseed);
    const rng = mulberry32(v.vseed);
    const n = 3 + Math.floor(rng() * 4); // 3..6 maisons
    const list = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.7;
      const r = 9 + rng() * 9;
      const w = 4 + Math.floor(rng() * 3);
      const d = 4 + Math.floor(rng() * 3);
      const h = 3 + Math.floor(rng() * 2);
      const x = Math.round(v.cx + Math.cos(ang) * r) - Math.floor(w / 2);
      const z = Math.round(v.cz + Math.sin(ang) * r) - Math.floor(d / 2);
      list.push({ x, z, w, d, h });
    }
    this._bldCache.set(v.vseed, list);
    return list;
  }

  // Centres de villages à portée de (x,z) (pour l'apparition des villageois).
  villagesNear(x, z, radius) {
    const out = [];
    const ci0 = Math.floor((x - radius) / CELL), ci1 = Math.floor((x + radius) / CELL);
    const cj0 = Math.floor((z - radius) / CELL), cj1 = Math.floor((z + radius) / CELL);
    for (let ci = ci0; ci <= ci1; ci++) {
      for (let cj = cj0; cj <= cj1; cj++) {
        const v = this.villageInCell(ci, cj);
        if (v && (v.cx - x) ** 2 + (v.cz - z) ** 2 <= radius * radius) out.push(v);
      }
    }
    return out;
  }

  // Écrit les structures de village recoupant ce chunk.
  apply(chunk, generator) {
    const baseX = chunk.cx * 16, baseZ = chunk.cz * 16;
    const ci0 = Math.floor((baseX - REACH) / CELL), ci1 = Math.floor((baseX + 16 + REACH) / CELL);
    const cj0 = Math.floor((baseZ - REACH) / CELL), cj1 = Math.floor((baseZ + 16 + REACH) / CELL);

    for (let ci = ci0; ci <= ci1; ci++) {
      for (let cj = cj0; cj <= cj1; cj++) {
        const v = this.villageInCell(ci, cj);
        if (!v) continue;
        const baseY = Math.floor(generator.heightAt(v.cx, v.cz));
        if (baseY <= SEA_LEVEL) continue; // pas de village dans l'eau

        const ctx = { chunk, baseX, baseZ };
        this._well(ctx, v.cx, v.cz, baseY);
        for (const b of this.buildings(v)) {
          this._path(ctx, v.cx, v.cz, b.x + Math.floor(b.w / 2), b.z, baseY);
          this._house(ctx, b, baseY);
        }
      }
    }
  }

  // Écrit un bloc s'il tombe dans le chunk courant.
  _put(ctx, wx, wy, wz, id) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    if (wx < ctx.baseX || wx >= ctx.baseX + 16 || wz < ctx.baseZ || wz >= ctx.baseZ + 16) return;
    ctx.chunk.set(wx - ctx.baseX, wy, wz - ctx.baseZ, id);
  }

  _house(ctx, b, baseY) {
    const { x, z, w, d, h } = b;

    // Fondation + sol + dégagement intérieur.
    for (let ix = 0; ix <= w; ix++) {
      for (let iz = 0; iz <= d; iz++) {
        const wx = x + ix, wz = z + iz;
        this._put(ctx, wx, baseY - 1, wz, COBBLE);
        this._put(ctx, wx, baseY - 2, wz, COBBLE);
        this._put(ctx, wx, baseY, wz, PLANKS); // sol
        for (let yy = baseY + 1; yy <= baseY + h + 2; yy++) this._put(ctx, wx, yy, wz, AIR);
      }
    }

    // Murs.
    for (let yy = baseY + 1; yy <= baseY + h; yy++) {
      for (let ix = 0; ix <= w; ix++) {
        for (let iz = 0; iz <= d; iz++) {
          const edge = ix === 0 || ix === w || iz === 0 || iz === d;
          if (!edge) continue;
          const corner = (ix === 0 || ix === w) && (iz === 0 || iz === d);
          const id = corner ? LOG : yy === baseY + 1 ? COBBLE : PLANKS;
          this._put(ctx, x + ix, yy, z + iz, id);
        }
      }
    }

    // Porte (côté z = z, centrée).
    const doorX = x + Math.floor(w / 2);
    this._put(ctx, doorX, baseY + 1, z, AIR);
    this._put(ctx, doorX, baseY + 2, z, AIR);

    // Fenêtres en verre à mi-hauteur.
    const wy = baseY + 2;
    for (let ix = 1; ix < w; ix += 2) {
      this._put(ctx, x + ix, wy, z, GLASS);
      this._put(ctx, x + ix, wy, z + d, GLASS);
    }
    for (let iz = 1; iz < d; iz += 2) {
      this._put(ctx, x, wy, z + iz, GLASS);
      this._put(ctx, x + w, wy, z + iz, GLASS);
    }

    // Toit plat.
    for (let ix = 0; ix <= w; ix++) {
      for (let iz = 0; iz <= d; iz++) this._put(ctx, x + ix, baseY + h + 1, z + iz, PLANKS);
    }
  }

  _well(ctx, cx, cz, baseY) {
    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        this._put(ctx, cx + ix, baseY, cz + iz, COBBLE);
      }
    }
    // Trou d'eau central.
    this._put(ctx, cx, baseY, cz, WATER);
    this._put(ctx, cx, baseY - 1, cz, WATER);
    // Poteaux + toit du puits.
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      this._put(ctx, cx + dx, baseY + 1, cz + dz, LOG);
      this._put(ctx, cx + dx, baseY + 2, cz + dz, LOG);
    }
    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) this._put(ctx, cx + ix, baseY + 3, cz + iz, PLANKS);
    }
  }

  // Chemin (ligne) du centre vers une maison, au niveau du sol du village.
  _path(ctx, x0, z0, x1, z1, baseY) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const wx = Math.round(x0 + (x1 - x0) * t);
      const wz = Math.round(z0 + (z1 - z0) * t);
      this._put(ctx, wx, baseY, wz, PATH);
    }
  }
}
