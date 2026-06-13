import { isSolid } from '../blocks/BlockRegistry.js';

// Traversée de voxels par l'algorithme « fast voxel traversal » d'Amanatides &
// Woo. Bien plus efficace qu'un THREE.Raycaster pour une grille de voxels : on
// avance de cellule en cellule le long du rayon jusqu'au premier bloc solide.
//
// Retourne { x, y, z, nx, ny, nz } où (x,y,z) est le bloc touché et (nx,ny,nz)
// la normale de la face traversée (utile pour savoir OÙ poser un bloc), ou null.
export function raycastVoxels(world, origin, dir, maxDist) {
  // Cellule de départ.
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = Math.sign(dir.x);
  const stepY = Math.sign(dir.y);
  const stepZ = Math.sign(dir.z);

  // Distance (en t) pour franchir une cellule complète sur chaque axe.
  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  // Distance (en t) jusqu'au premier franchissement de frontière sur chaque axe.
  const tMax = { x: 0, y: 0, z: 0 };
  tMax.x = dir.x !== 0 ? boundaryDist(origin.x, dir.x) : Infinity;
  tMax.y = dir.y !== 0 ? boundaryDist(origin.y, dir.y) : Infinity;
  tMax.z = dir.z !== 0 ? boundaryDist(origin.z, dir.z) : Infinity;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;

  // Le bloc d'origine peut déjà être solide (tête dans un bloc) : on l'ignore
  // en partant et on s'appuie sur la traversée.
  while (t <= maxDist) {
    if (isSolid(world.getBlock(x, y, z))) {
      return { x, y, z, nx, ny, nz };
    }

    // Avance vers la prochaine frontière, sur l'axe le plus proche.
    if (tMax.x < tMax.y && tMax.x < tMax.z) {
      x += stepX;
      t = tMax.x;
      tMax.x += tDeltaX;
      nx = -stepX; ny = 0; nz = 0;
    } else if (tMax.y < tMax.z) {
      y += stepY;
      t = tMax.y;
      tMax.y += tDeltaY;
      nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ;
      t = tMax.z;
      tMax.z += tDeltaZ;
      nx = 0; ny = 0; nz = -stepZ;
    }
  }

  return null;
}

// Distance t jusqu'à la prochaine frontière de cellule sur un axe.
function boundaryDist(p, d) {
  const cell = Math.floor(p);
  // Position de la frontière visée selon le sens du déplacement.
  const next = d > 0 ? cell + 1 : cell;
  return (next - p) / d;
}
