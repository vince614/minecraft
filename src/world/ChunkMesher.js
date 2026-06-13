import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../core/constants.js';
import { AIR, isSolid, isOpaque, tileFor } from '../blocks/BlockRegistry.js';

// ---------------------------------------------------------------------------
// GREEDY MESHING
// ---------------------------------------------------------------------------
// On ne génère JAMAIS les faces internes : une face n'existe que si elle est
// exposée à un bloc non-opaque (air, verre, feuilles...). De plus, on FUSIONNE
// les faces coplanaires adjacentes de même apparence en grands quads, ce qui
// réduit fortement le nombre de triangles (gros gain sur les surfaces planes).
//
// Algorithme (variante classique de Lysenko) : pour chacun des 3 axes, on
// balaie le volume tranche par tranche. Pour chaque tranche on construit un
// « masque » 2D décrivant les faces visibles entre la tranche courante et la
// suivante, puis on extrait gloutonnement des rectangles maximaux de faces
// identiques.
//
// Le masque encode chaque face par une clé entière :
//   key = (layer+1)   pour une face « avant »  (normale = +axe)
//   key = -(layer+1)  pour une face « arrière » (normale = -axe)
// Deux faces fusionnent seulement si leur clé est identique (même tuile ET
// même orientation). On en déduit layer = |key|-1 et back = key<0.

const DIMS = [CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE];

// Une face de `self` vers `other` est visible si `other` ne la cache pas.
// other non-opaque (air/verre/feuilles) ET d'un type différent de self.
function faceVisible(self, other) {
  return !isOpaque(other) && other !== self;
}

// Retourne la clé de face pour la frontière entre les blocs a (côté -axe) et
// b (côté +axe), ou 0 si aucune face visible. `d` est l'axe courant (0=X,1=Y,2=Z).
function faceKey(a, b, d) {
  if (isSolid(a) && faceVisible(a, b)) {
    // Face « avant » de a (normale vers +axe).
    const faceDir = d === 1 ? 'top' : 'side';
    return tileFor(a, faceDir) + 1;
  }
  if (isSolid(b) && faceVisible(b, a)) {
    // Face « arrière » de b (normale vers -axe).
    const faceDir = d === 1 ? 'bottom' : 'side';
    return -(tileFor(b, faceDir) + 1);
  }
  return 0;
}

// Construit la BufferGeometry d'un chunk.
//   sample(x,y,z) -> id du bloc, y compris hors du chunk (voisins / air).
// Retourne null si le chunk ne produit aucune géométrie.
export function buildChunkGeometry(chunk, sample) {
  if (chunk.empty) return null;

  const positions = [];
  const normals = [];
  const uvs = [];
  const layers = [];

  const x = [0, 0, 0]; // position de balayage
  const q = [0, 0, 0]; // vecteur normal de l'axe courant

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const du = DIMS[u];
    const dv = DIMS[v];
    const dd = DIMS[d];

    q[0] = q[1] = q[2] = 0;
    q[d] = 1;

    const mask = new Int32Array(du * dv);

    // On balaie les plans de séparation, de -1 à dd-1 (inclus) : à x[d]=-1 on
    // compare l'air/voisin extérieur avec la première tranche, à x[d]=dd-1 la
    // dernière tranche avec l'extérieur. Le sampler gère le hors-bornes.
    for (x[d] = -1; x[d] < dd; ) {
      // 1) Construire le masque de la tranche courante.
      let n = 0;
      for (x[v] = 0; x[v] < dv; x[v]++) {
        for (x[u] = 0; x[u] < du; x[u]++) {
          const a = sample(x[0], x[1], x[2]);
          const b = sample(x[0] + q[0], x[1] + q[1], x[2] + q[2]);
          mask[n++] = faceKey(a, b, d);
        }
      }

      x[d]++; // le plan de faces se situe maintenant à la coordonnée x[d]

      // 2) Extraire gloutonnement les rectangles du masque.
      n = 0;
      for (let j = 0; j < dv; j++) {
        for (let i = 0; i < du; ) {
          const key = mask[n];
          if (key === 0) {
            i++;
            n++;
            continue;
          }

          // Largeur du rectangle (le long de u).
          let w = 1;
          while (i + w < du && mask[n + w] === key) w++;

          // Hauteur du rectangle (le long de v) : on étend tant que toute la
          // ligne suivante a la même clé.
          let h = 1;
          let stop = false;
          while (j + h < dv) {
            for (let k = 0; k < w; k++) {
              if (mask[n + k + h * du] !== key) {
                stop = true;
                break;
              }
            }
            if (stop) break;
            h++;
          }

          // Émettre le quad (i,j) -> (i+w, j+h) sur le plan x[d].
          x[u] = i;
          x[v] = j;
          const dU = [0, 0, 0];
          dU[u] = w;
          const dV = [0, 0, 0];
          dV[v] = h;

          const layer = Math.abs(key) - 1;
          const back = key < 0;
          emitQuad(positions, normals, uvs, layers, x, dU, dV, q, back, layer, w, h);

          // Effacer la zone consommée.
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

// Ajoute les deux triangles d'un quad fusionné.
// base = coin de départ ; dU/dV = vecteurs des côtés (longueurs w/h) ;
// q = axe de la normale ; back = la normale pointe vers -q ; layer = tuile ;
// w/h = dimensions pour le tiling des UV.
function emitQuad(positions, normals, uvs, layers, base, dU, dV, q, back, layer, w, h) {
  const p1 = [base[0], base[1], base[2]];
  const p2 = [base[0] + dU[0], base[1] + dU[1], base[2] + dU[2]];
  const p3 = [base[0] + dU[0] + dV[0], base[1] + dU[1] + dV[1], base[2] + dU[2] + dV[2]];
  const p4 = [base[0] + dV[0], base[1] + dV[1], base[2] + dV[2]];

  const nx = back ? -q[0] : q[0];
  const ny = back ? -q[1] : q[1];
  const nz = back ? -q[2] : q[2];

  // UV étirées sur (w,h) ; fract() dans le shader assure la répétition.
  const uv1 = [0, 0];
  const uv2 = [w, 0];
  const uv3 = [w, h];
  const uv4 = [0, h];

  // Ordre des sommets selon l'orientation pour un culling correct (faces
  // arrière supprimées). dU×dV pointe vers +q ; on inverse l'ordre si back.
  let tris;
  if (!back) {
    tris = [
      [p1, uv1], [p2, uv2], [p3, uv3],
      [p1, uv1], [p3, uv3], [p4, uv4],
    ];
  } else {
    tris = [
      [p1, uv1], [p3, uv3], [p2, uv2],
      [p1, uv1], [p4, uv4], [p3, uv3],
    ];
  }

  for (const [p, uv] of tris) {
    positions.push(p[0], p[1], p[2]);
    normals.push(nx, ny, nz);
    uvs.push(uv[0], uv[1]);
    layers.push(layer);
  }
}
