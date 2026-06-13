import { CHUNK_SIZE, CHUNK_HEIGHT } from './constants.js';

// Indexation linéaire d'un voxel dans le Uint8Array d'un chunk.
//
// On range les voxels avec X le plus « rapide », puis Z, puis Y :
//   index = (y * CHUNK_SIZE + z) * CHUNK_SIZE + x
//
// Choix : parcourir une couche horizontale (un Y donné) revient à balayer une
// tranche contiguë en mémoire, ce qui est efficace pour la génération et le
// meshing qui travaillent souvent couche par couche.
export function voxelIndex(x, y, z) {
  return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
}

// Vrai si (x,y,z) est à l'intérieur des bornes d'un chunk.
export function inChunkBounds(x, y, z) {
  return (
    x >= 0 && x < CHUNK_SIZE &&
    z >= 0 && z < CHUNK_SIZE &&
    y >= 0 && y < CHUNK_HEIGHT
  );
}
