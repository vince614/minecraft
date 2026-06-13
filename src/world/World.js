import * as THREE from 'three';
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  RENDER_DISTANCE,
  GEN_BUDGET,
  MESH_BUDGET,
} from '../core/constants.js';
import { AIR } from '../blocks/BlockRegistry.js';
import { Chunk } from './Chunk.js';
import { TerrainGenerator } from './TerrainGenerator.js';
import { buildChunkGeometry } from './ChunkMesher.js';

const key = (cx, cz) => `${cx},${cz}`;

// Le World orchestre les chunks : génération, (re)meshing, chargement et
// déchargement dynamiques autour du joueur. C'est aussi le point d'accès aux
// blocs en coordonnées MONDE (utilisé par la physique et l'interaction).
export class World {
  constructor(scene, material, seed = 1337) {
    this.scene = scene;
    this.material = material;
    this.chunks = new Map(); // "cx,cz" -> Chunk
    this.generator = new TerrainGenerator(seed);

    // Files de travail, traitées avec un budget par frame.
    this.dirty = new Set();   // chunks à (re)mailler (clés)
    this.toGenerate = [];     // [{cx,cz}] à générer, triés par distance

    // Distance de rendu modifiable via les options.
    this.renderDistance = RENDER_DISTANCE;
  }

  setRenderDistance(r) {
    this.renderDistance = r;
  }

  getChunk(cx, cz) {
    return this.chunks.get(key(cx, cz));
  }

  // --- Accès en coordonnées monde -----------------------------------------

  worldToChunk(wx, wz) {
    return [Math.floor(wx / CHUNK_SIZE), Math.floor(wz / CHUNK_SIZE)];
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return AIR;
    const [cx, cz] = this.worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return AIR;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    return chunk.get(lx, wy, lz);
  }

  // Pose/casse un bloc et marque le(s) chunk(s) impacté(s) à remailler.
  setBlock(wx, wy, wz, id) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const [cx, cz] = this.worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    chunk.set(lx, wy, lz, id);

    this.markDirty(cx, cz);
    // Si le bloc touche un bord, le chunk voisin doit aussi recalculer ses
    // faces de couture.
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
  }

  markDirty(cx, cz) {
    const k = key(cx, cz);
    if (this.chunks.has(k)) this.dirty.add(k);
  }

  // --- Boucle de mise à jour ----------------------------------------------

  // Charge/décharge les chunks autour de la position du joueur, puis traite un
  // budget de génération et de meshing.
  update(playerX, playerZ) {
    const [pcx, pcz] = this.worldToChunk(playerX, playerZ);

    this.ensureChunksAround(pcx, pcz);
    this.unloadFarChunks(pcx, pcz);
    this.processGeneration(GEN_BUDGET);
    this.processMeshing(MESH_BUDGET);
  }

  ensureChunksAround(pcx, pcz) {
    const R = this.renderDistance;
    const pending = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > R * R) continue; // disque de rayon R
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (this.chunks.has(key(cx, cz))) continue;
        pending.push({ cx, cz, d: dx * dx + dz * dz });
      }
    }
    if (pending.length === 0) return;
    // Les plus proches d'abord.
    pending.sort((a, b) => a.d - b.d);
    // Crée les Chunk vides immédiatement (léger) ; la génération du contenu se
    // fait ensuite via la file budgétée.
    for (const p of pending) {
      const chunk = new Chunk(p.cx, p.cz);
      this.chunks.set(key(p.cx, p.cz), chunk);
      this.toGenerate.push(p);
    }
  }

  unloadFarChunks(pcx, pcz) {
    const R = this.renderDistance + 1; // hystérésis pour éviter le yo-yo en bordure
    for (const [k, chunk] of this.chunks) {
      const dx = chunk.cx - pcx;
      const dz = chunk.cz - pcz;
      if (dx * dx + dz * dz <= R * R) continue;
      // Décharge : retire le mesh de la scène et libère la géométrie.
      if (chunk.mesh) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
      }
      this.chunks.delete(k);
      this.dirty.delete(k);
    }
  }

  processGeneration(budget) {
    let done = 0;
    while (this.toGenerate.length && done < budget) {
      const { cx, cz } = this.toGenerate.shift();
      const chunk = this.getChunk(cx, cz);
      if (!chunk || chunk.generated) continue;
      this.generator.generate(chunk);
      chunk.generated = true;
      chunk.dirty = true;
      this.dirty.add(key(cx, cz));
      // Les voisins déjà maillés doivent recalculer leurs faces de couture
      // maintenant que ce chunk existe.
      for (const [ncx, ncz] of [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]]) {
        this.markDirty(ncx, ncz);
      }
      done++;
    }
  }

  processMeshing(budget) {
    if (this.dirty.size === 0) return;
    let done = 0;
    for (const k of this.dirty) {
      if (done >= budget) break;
      const chunk = this.chunks.get(k);
      if (!chunk || !chunk.generated) continue;
      this.remeshChunk(chunk);
      this.dirty.delete(k);
      done++;
    }
  }

  // (Re)construit la géométrie d'un chunk et remplace son mesh dans la scène.
  remeshChunk(chunk) {
    const sample = this.makeSampler(chunk);
    const geometry = buildChunkGeometry(chunk, sample);

    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    if (!geometry) return; // chunk vide / invisible

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
    chunk.mesh = mesh;
    this.scene.add(mesh);
  }

  // Crée une fonction d'échantillonnage des blocs en coordonnées LOCALES au
  // chunk, qui consulte les 4 voisins de face pour les coordonnées hors-bornes
  // (afin de culler correctement les faces de couture). Renvoie AIR au-delà du
  // monde vertical. On capture les voisins une fois pour éviter des lookups de
  // Map dans la boucle interne du mesher.
  makeSampler(chunk) {
    const self = chunk;
    const west = this.getChunk(chunk.cx - 1, chunk.cz);
    const east = this.getChunk(chunk.cx + 1, chunk.cz);
    const north = this.getChunk(chunk.cx, chunk.cz - 1);
    const south = this.getChunk(chunk.cx, chunk.cz + 1);

    return (x, y, z) => {
      if (y < 0 || y >= CHUNK_HEIGHT) return AIR;
      if (x < 0) return west ? west.get(x + CHUNK_SIZE, y, z) : AIR;
      if (x >= CHUNK_SIZE) return east ? east.get(x - CHUNK_SIZE, y, z) : AIR;
      if (z < 0) return north ? north.get(x, y, z + CHUNK_SIZE) : AIR;
      if (z >= CHUNK_SIZE) return south ? south.get(x, y, z - CHUNK_SIZE) : AIR;
      return self.get(x, y, z);
    };
  }

  // Nombre de chunks ayant un mesh (pour le HUD).
  get meshedCount() {
    let n = 0;
    for (const c of this.chunks.values()) if (c.mesh) n++;
    return n;
  }
}
