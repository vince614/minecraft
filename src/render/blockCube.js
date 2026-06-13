import * as THREE from 'three';
import { tileFor } from '../blocks/BlockRegistry.js';

// Construit la géométrie d'un cube unitaire (1x1x1, centré) texturé comme un
// bloc donné, en réutilisant le material voxel (DataArrayTexture). On part d'une
// BoxGeometry (UV et winding corrects fournis par Three.js) et on ajoute juste
// l'attribut `layer` par sommet, déduit de la normale de chaque face.
export function buildBlockCubeGeometry(blockId) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const normal = geo.attributes.normal;
  const layers = new Float32Array(normal.count);

  for (let i = 0; i < normal.count; i++) {
    const ny = normal.getY(i);
    const faceDir = ny > 0.5 ? 'top' : ny < -0.5 ? 'bottom' : 'side';
    layers[i] = tileFor(blockId, faceDir);
  }

  geo.setAttribute('layer', new THREE.BufferAttribute(layers, 1));
  return geo;
}
