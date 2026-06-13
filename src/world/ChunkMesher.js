import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../core/constants.js';
import { AIR, isSolid, isOpaque, isWater, tileFor, WATER } from '../blocks/BlockRegistry.js';

// ---------------------------------------------------------------------------
// GREEDY MESHING
// ---------------------------------------------------------------------------
// On ne génère JAMAIS les faces internes/cachées, et on FUSIONNE les faces
// coplanaires identiques en grands quads (gros gain de triangles).
//
// Deux passes produisent deux géométries :
//   - « solide » : tous les blocs opaques/solides (rendu opaque).
//   - « eau »    : uniquement les faces d'eau exposées à l'air (rendu
//                  translucide, material séparé avec blending).
//
// Clé de face entière encodée par cellule du masque :
//   key = (layer+1)  -> face avant (normale +axe) ; key = -(layer+1) -> arrière.
// Deux faces fusionnent si leur clé est égale. layer = |key|-1, back = key<0.

const DIMS = [CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE];

// Une face de `self` (solide) vers `other` est visible si `other` ne la cache
// pas : non-opaque (air/verre/feuilles/eau) ET d'un type différent.
function faceVisible(self, other) {
  return !isOpaque(other) && other !== self;
}

// Passe solide : faces des blocs solides (l'eau n'est pas solide, donc exclue).
function solidFaceKey(a, b, d) {
  if (isSolid(a) && faceVisible(a, b)) {
    const faceDir = d === 1 ? 'top' : 'side';
    return tileFor(a, faceDir) + 1;
  }
  if (isSolid(b) && faceVisible(b, a)) {
    const faceDir = d === 1 ? 'bottom' : 'side';
    return -(tileFor(b, faceDir) + 1);
  }
  return 0;
}

// Passe eau : seulement les faces d'eau exposées à l'air (surface et bords).
function waterFaceKey(a, b, d) {
  const layer = tileFor(WATER, 'top');
  if (isWater(a) && b === AIR) return layer + 1;
  if (isWater(b) && a === AIR) return -(layer + 1);
  return 0;
}

// Construit les deux géométries d'un chunk.
// sample(x,y,z) -> id du bloc (voisins / air hors-bornes).
export function buildChunkGeometry(chunk, sample) {
  if (chunk.empty) return { solid: null, water: null };
  return {
    solid: meshPass(sample, solidFaceKey),
    water: meshPass(sample, waterFaceKey),
  };
}

// Cœur du greedy meshing, paramétré par la fonction de clé de face.
function meshPass(sample, faceKey) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const layers = [];

  const x = [0, 0, 0];
  const q = [0, 0, 0];

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const du = DIMS[u];
    const dv = DIMS[v];
    const dd = DIMS[d];

    q[0] = q[1] = q[2] = 0;
    q[d] = 1;

    const mask = new Int32Array(du * dv);

    for (x[d] = -1; x[d] < dd; ) {
      // 1) Masque de la tranche.
      let n = 0;
      for (x[v] = 0; x[v] < dv; x[v]++) {
        for (x[u] = 0; x[u] < du; x[u]++) {
          const a = sample(x[0], x[1], x[2]);
          const b = sample(x[0] + q[0], x[1] + q[1], x[2] + q[2]);
          mask[n++] = faceKey(a, b, d);
        }
      }

      x[d]++;

      // 2) Extraction gloutonne de rectangles.
      n = 0;
      for (let j = 0; j < dv; j++) {
        for (let i = 0; i < du; ) {
          const key = mask[n];
          if (key === 0) { i++; n++; continue; }

          let w = 1;
          while (i + w < du && mask[n + w] === key) w++;

          let h = 1;
          let stop = false;
          while (j + h < dv) {
            for (let k = 0; k < w; k++) {
              if (mask[n + k + h * du] !== key) { stop = true; break; }
            }
            if (stop) break;
            h++;
          }

          x[u] = i;
          x[v] = j;
          const dU = [0, 0, 0]; dU[u] = w;
          const dV = [0, 0, 0]; dV[v] = h;

          const layer = Math.abs(key) - 1;
          const back = key < 0;
          emitQuad(positions, normals, uvs, layers, x, dU, dV, q, back, layer, w, h);

          for (let l = 0; l < h; l++) {
            for (let k = 0; k < w; k++) mask[n + k + l * du] = 0;
          }
          i += w;
          n += w;
        }
      }
    }
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('layer', new THREE.Float32BufferAttribute(layers, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function emitQuad(positions, normals, uvs, layers, base, dU, dV, q, back, layer, w, h) {
  const p1 = [base[0], base[1], base[2]];
  const p2 = [base[0] + dU[0], base[1] + dU[1], base[2] + dU[2]];
  const p3 = [base[0] + dU[0] + dV[0], base[1] + dU[1] + dV[1], base[2] + dU[2] + dV[2]];
  const p4 = [base[0] + dV[0], base[1] + dV[1], base[2] + dV[2]];

  const nx = back ? -q[0] : q[0];
  const ny = back ? -q[1] : q[1];
  const nz = back ? -q[2] : q[2];

  const uv1 = [0, 0];
  const uv2 = [w, 0];
  const uv3 = [w, h];
  const uv4 = [0, h];

  let tris;
  if (!back) {
    tris = [[p1, uv1], [p2, uv2], [p3, uv3], [p1, uv1], [p3, uv3], [p4, uv4]];
  } else {
    tris = [[p1, uv1], [p3, uv3], [p2, uv2], [p1, uv1], [p4, uv4], [p3, uv3]];
  }

  for (const [p, uv] of tris) {
    positions.push(p[0], p[1], p[2]);
    normals.push(nx, ny, nz);
    uvs.push(uv[0], uv[1]);
    layers.push(layer);
  }
}
