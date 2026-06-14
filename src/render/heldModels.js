import * as THREE from 'three';
import { itemColor, SWORD, PICKAXE, BOW, ARROW, STICK } from '../blocks/BlockRegistry.js';

// Modèles 3D des objets tenus en main (outils, armes…), faits de boîtes. Rendus
// dans la scène de la vue première personne, animés par le balancement/coup.
const box = (w, h, d, color) => new THREE.Mesh(
  new THREE.BoxGeometry(w, h, d),
  new THREE.MeshLambertMaterial({ color })
);

export function buildHeldItem(id) {
  const g = new THREE.Group();
  switch (id) {
    case SWORD: {
      const blade = box(0.06, 0.55, 0.02, 0xd8dee4);
      blade.position.y = 0.28; g.add(blade);
      const tip = box(0.06, 0.1, 0.02, 0xeaeef2);
      tip.position.y = 0.58; g.add(tip);
      const guard = box(0.26, 0.06, 0.07, 0xc9a227);
      guard.position.y = 0.0; g.add(guard);
      const handle = box(0.06, 0.2, 0.06, 0x5a3a1e);
      handle.position.y = -0.13; g.add(handle);
      break;
    }
    case PICKAXE: {
      const handle = box(0.06, 0.62, 0.06, 0x6a4a2a);
      g.add(handle);
      const head = box(0.5, 0.1, 0.09, 0x9aa0a6);
      head.position.y = 0.3; g.add(head);
      break;
    }
    case BOW: {
      const mid = box(0.05, 0.45, 0.05, 0x6a4a2a);
      g.add(mid);
      const top = box(0.05, 0.2, 0.05, 0x6a4a2a);
      top.position.set(0, 0.3, -0.07); top.rotation.x = 0.6; g.add(top);
      const bot = box(0.05, 0.2, 0.05, 0x6a4a2a);
      bot.position.set(0, -0.3, -0.07); bot.rotation.x = -0.6; g.add(bot);
      const string = box(0.012, 0.7, 0.012, 0xeeeeee);
      string.position.z = -0.04; g.add(string);
      // Flèche nockée (cachée tant qu'on ne bande pas l'arc).
      const arrow = new THREE.Group();
      const shaft = box(0.025, 0.5, 0.025, 0xcbb88f); shaft.rotation.x = Math.PI / 2; arrow.add(shaft);
      const tip = box(0.05, 0.05, 0.05, 0x999999); tip.position.z = -0.27; arrow.add(tip);
      arrow.visible = false;
      g.add(arrow);
      // Refs pour l'animation de bandage.
      g.userData = { string, arrow };
      break;
    }
    case ARROW: {
      const shaft = box(0.03, 0.6, 0.03, 0xcbb88f);
      g.add(shaft);
      const tip = box(0.08, 0.08, 0.08, 0x999999);
      tip.position.y = 0.33; g.add(tip);
      const feather = box(0.12, 0.1, 0.01, 0xf0f0f0);
      feather.position.y = -0.28; g.add(feather);
      break;
    }
    case STICK: {
      g.add(box(0.05, 0.5, 0.05, 0x8a6233));
      break;
    }
    default: {
      // Objet générique : petite pastille colorée (viande, plume, poudre…).
      g.add(box(0.3, 0.3, 0.12, itemColor(id)));
    }
  }
  return g;
}
