import { CHUNK_VOLUME } from '../core/constants.js';
import { voxelIndex } from '../core/voxelIndex.js';
import { AIR } from '../blocks/BlockRegistry.js';

// Une colonne de voxels (16 x 16 x 128). Ne connaît ni le rendu ni la
// génération : ce n'est qu'un conteneur de données + un peu d'état.
export class Chunk {
  constructor(cx, cz) {
    this.cx = cx; // coordonnée chunk en X (en chunks, pas en blocs)
    this.cz = cz;

    // 1 octet par voxel = id du bloc. Initialisé à 0 (air).
    this.voxels = new Uint8Array(CHUNK_VOLUME);

    this.mesh = null;       // THREE.Mesh courant (ou null si vide)
    this.dirty = true;      // doit être (re)maillé
    this.generated = false; // le terrain a-t-il été généré ?
    this.empty = true;      // true tant qu'aucun bloc solide n'a été posé
  }

  get(x, y, z) {
    return this.voxels[voxelIndex(x, y, z)];
  }

  set(x, y, z, id) {
    this.voxels[voxelIndex(x, y, z)] = id;
    if (id !== AIR) this.empty = false;
  }
}
