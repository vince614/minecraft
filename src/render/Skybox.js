import * as THREE from 'three';
import { RENDER_DISTANCE, CHUNK_SIZE } from '../core/constants.js';

// Met en place le ciel, le brouillard de distance et l'éclairage de la scène.
// Le material des blocs gère son propre éclairage diffus dans son shader ; on
// ajoute ici un éclairage Three.js standard pour les éventuels meshes annexes
// (highlight, etc.) et le rendu général.
export function setupSky(scene) {
  const skyColor = 0x87ceeb;
  scene.background = new THREE.Color(skyColor);

  // Brouillard pour masquer le « pop » des chunks à la limite de rendu.
  const far = RENDER_DISTANCE * CHUNK_SIZE;
  scene.fog = new THREE.Fog(skyColor, far * 0.55, far * 0.95);

  // Lumière directionnelle (soleil) + lumière ambiante douce.
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(0.6, 1.0, 0.4).multiplyScalar(100);
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  return { sun, ambient };
}
