import * as THREE from 'three';
import { isPlaceable } from '../blocks/BlockRegistry.js';
import { buildBlockCubeGeometry } from '../render/blockCube.js';
import { buildHeldItem } from '../render/heldModels.js';

// Avatar « blocky » du joueur, visible uniquement à la 3e personne. Construit à
// partir de boîtes (jambes, torse, bras, tête). Les membres pivotent depuis leur
// articulation (groupes-pivots) pour une animation de marche simple. Tient
// aussi l'objet sélectionné dans la main droite.
export class PlayerModel {
  constructor(scene, blockMaterial) {
    this.blockMaterial = blockMaterial;
    this._heldId = -1;
    this.heldModel = null;
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);

    const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac86 });
    const shirt = new THREE.MeshLambertMaterial({ color: 0x3aa0c0 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x3a4a8c });

    // Torse.
    const torso = box(0.5, 0.75, 0.25, shirt);
    torso.position.y = 1.125; // de 0.75 à 1.5
    this.root.add(torso);

    // Tête.
    const head = box(0.5, 0.5, 0.5, skin);
    head.position.y = 1.75; // de 1.5 à 2.0
    this.headPivot = new THREE.Group();
    this.headPivot.position.y = 1.5;
    head.position.y = 0.25;
    this.headPivot.add(head);
    this.root.add(this.headPivot);

    // Bras et jambes via pivots placés à l'articulation (épaule / hanche).
    this.armL = limb(-0.375, 1.5, shirt, this.root); // épaule gauche
    this.armR = limb(0.375, 1.5, shirt, this.root);
    this.legL = limb(-0.125, 0.75, pants, this.root); // hanche gauche
    this.legR = limb(0.125, 0.75, pants, this.root);

    this.time = 0;
  }

  setVisible(v) {
    this.root.visible = v;
  }

  // Objet tenu dans la main droite (suit le balancement du bras).
  setHeld(itemId) {
    if (itemId === this._heldId) return;
    this._heldId = itemId;
    if (this.heldModel) {
      this.armR.remove(this.heldModel);
      this.heldModel.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material !== this.blockMaterial) o.material.dispose?.();
      });
      this.heldModel = null;
    }
    if (itemId <= 0) return;

    let model;
    if (isPlaceable(itemId)) {
      model = new THREE.Mesh(buildBlockCubeGeometry(itemId), this.blockMaterial);
      model.scale.setScalar(0.4);
    } else {
      model = buildHeldItem(itemId);
      model.scale.setScalar(0.55);
    }
    // Au bout du bras, pointant vers le haut/avant : l'objet se dresse à côté du
    // corps (et se lève bien quand le bras frappe en minant).
    model.position.set(0.06, -0.64, -0.14);
    model.rotation.set(-0.7, 0, -0.25);
    this.armR.add(model);
    this.heldModel = model;
  }

  // Place et anime l'avatar. pos = pieds du joueur ; yaw = orientation ;
  // moving = se déplace-t-il ; pitch incline légèrement la tête.
  update(dt, pos, yaw, pitch, moving, mining = false) {
    this.time += dt;
    this.root.position.set(pos.x, pos.y, pos.z);
    this.root.rotation.y = yaw;
    this.headPivot.rotation.x = THREE.MathUtils.clamp(pitch, -0.6, 0.6);

    const swing = moving ? Math.sin(this.time * 10) * 0.6 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing;
    // Bras droit : frappe répétée en minant, sinon balancement de marche.
    this.armR.rotation.x = mining ? -0.7 - Math.abs(Math.sin(this.time * 11)) * 0.6 : swing;
  }
}

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

// Crée un membre (bras/jambe) : un pivot à l'articulation + une boîte pendante.
function limb(x, pivotY, material, parent) {
  const pivot = new THREE.Group();
  pivot.position.set(x, pivotY, 0);
  const mesh = box(0.25, 0.75, 0.25, material);
  mesh.position.y = -0.375; // pend sous le pivot
  pivot.add(mesh);
  parent.add(pivot);
  return pivot;
}
