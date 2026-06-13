import * as THREE from 'three';
import { TILE_NAMES, TILE_SIZE, drawTile } from '../blocks/tiles.js';

// Construit la texture et le material UNIQUE partagés par tous les chunks.
//
// Choix clé : on utilise une THREE.DataArrayTexture (texture array WebGL2)
// plutôt qu'un atlas 2D. Raison : avec le greedy meshing, un quad fusionné est
// étiré sur N blocs et on veut une UV qui va de 0 à N et se RÉPÈTE (tiling).
// Sur un atlas 2D classique, ce dépassement « bave » sur les tuiles voisines
// (texture bleeding). Avec une texture array, chaque tuile est une couche
// indépendante : le shader fait fract(uv) pour répéter proprement, sans bavure.
// Cela reste un seul material pour tous les blocs.

function buildTextureArray() {
  const depth = TILE_NAMES.length;
  const size = TILE_SIZE;
  // RGBA, couches empilées : la couche L occupe [L*size*size*4 .. ].
  const data = new Uint8Array(size * size * depth * 4);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  for (let layer = 0; layer < depth; layer++) {
    ctx.clearRect(0, 0, size, size);
    drawTile(TILE_NAMES[layer], ctx);
    const img = ctx.getImageData(0, 0, size, size).data;
    data.set(img, layer * size * size * 4);
  }

  const texture = new THREE.DataArrayTexture(data, size, size, depth);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.magFilter = THREE.NearestFilter; // rendu « pixel art » net
  texture.minFilter = THREE.NearestFilter; // pas de mipmaps -> pas de seams entre couches
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

const vertexShader = /* glsl */ `
  // position / normal / uv sont injectés automatiquement par THREE pour un
  // ShaderMaterial. On ajoute juste l'attribut custom 'layer'.
  in float layer;

  out vec2 vUv;
  out float vLayer;
  out vec3 vNormal;

  void main() {
    vUv = uv;
    vLayer = layer;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  precision highp sampler2DArray;

  uniform sampler2DArray uTex;
  uniform vec3 uLightDir;   // direction de la lumière (vers la source)
  uniform float uAmbient;

  in vec2 vUv;
  in float vLayer;
  in vec3 vNormal;

  out vec4 fragColor;

  void main() {
    // fract(vUv) => répétition de la tuile sur les quads greedy étirés.
    vec4 tex = texture(uTex, vec3(fract(vUv), vLayer));
    if (tex.a < 0.5) discard; // découpe alpha (verre / feuilles ajourées)

    vec3 n = normalize(vNormal);
    float diff = max(dot(n, normalize(uLightDir)), 0.0);
    float light = uAmbient + (1.0 - uAmbient) * diff;

    fragColor = vec4(tex.rgb * light, 1.0);
  }
`;

export function createBlockMaterial() {
  const texture = buildTextureArray();

  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uTex: { value: texture },
      uLightDir: { value: new THREE.Vector3(0.6, 1.0, 0.4).normalize() },
      uAmbient: { value: 0.45 },
    },
    vertexShader,
    fragmentShader,
  });

  return material;
}
