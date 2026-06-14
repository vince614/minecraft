import * as THREE from 'three';
import { isPlaceable, BOW } from '../blocks/BlockRegistry.js';
import { buildBlockCubeGeometry } from './blockCube.js';
import { buildHeldItem } from './heldModels.js';

const TOOL_BASE_POS = [0.46, 0.16, -0.32];
const TOOL_BASE_ROT = [-0.3, -0.5, -0.35];
const BOW_AIM_POS = [0.18, 0.0, -0.5];

// Modèle « vue première personne » : la main du joueur et le bloc/objet tenu,
// affichés par-dessus le monde. Rendu dans une scène séparée avec sa propre
// caméra, dessinée après la scène principale (depth nettoyé) pour ne jamais
// être occulté par le terrain. Inclut un balancement à la marche (bob) et une
// animation de coup (swing) déclenchée quand on casse/pose.
export class ViewModel {
  constructor(blockMaterial) {
    this.blockMaterial = blockMaterial;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);

    // Éclairage simple propre à la vue (le bras est en Lambert).
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(0.5, 1, 0.8);
    this.scene.add(dir);

    // Groupe positionné en bas à droite de l'écran.
    this.group = new THREE.Group();
    this.basePos = new THREE.Vector3(0.62, -0.55, -1.0);
    this.group.position.copy(this.basePos);
    this.scene.add(this.group);

    // Bras (boîte couleur peau), légèrement incliné vers le centre.
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.95, 0.28),
      new THREE.MeshLambertMaterial({ color: 0xe0ac86 })
    );
    arm.position.set(0.1, -0.15, 0.15);
    arm.rotation.set(-0.5, 0.2, -0.25);
    this.group.add(arm);
    this.arm = arm;

    // Bloc tenu (mis à jour selon la sélection).
    this.heldMesh = null;
    this.heldId = -1;

    // État d'animation.
    this.time = 0;
    this.swingT = 0;  // 1 -> 0 pendant un coup ponctuel
    this.mining = false; // minage en cours (oscillation continue)
    this.eatT = 0;    // animation de « manger » en cours
    this._bow = null; // refs { string, arrow } si l'objet tenu est un arc
  }

  setMining(on) {
    this.mining = on;
  }

  triggerEat() {
    this.eatT = 0.55;
  }

  // Met à jour l'objet tenu si la sélection a changé : cube texturé pour les
  // blocs, modèle 3D dédié pour les outils/objets.
  setHeld(itemId) {
    if (itemId === this.heldId) return;
    this.heldId = itemId;

    if (this.heldMesh) {
      this.group.remove(this.heldMesh);
      this.heldMesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material !== this.blockMaterial) o.material.dispose?.();
      });
      this.heldMesh = null;
    }

    if (itemId <= 0) return; // main vide

    if (isPlaceable(itemId)) {
      const mesh = new THREE.Mesh(buildBlockCubeGeometry(itemId), this.blockMaterial);
      mesh.scale.setScalar(0.42);
      mesh.position.set(0.28, 0.05, -0.1);
      mesh.rotation.set(0.2, -0.5, 0.1);
      this.group.add(mesh);
      this.heldMesh = mesh;
    } else {
      // Outil / objet : modèle 3D orienté comme tenu en main, remonté au-dessus
      // du poing pour rester bien visible.
      const tool = buildHeldItem(itemId);
      tool.scale.setScalar(0.9);
      tool.position.set(...TOOL_BASE_POS);
      tool.rotation.set(...TOOL_BASE_ROT);
      this.group.add(tool);
      this.heldMesh = tool;
      this._bow = itemId === BOW ? tool.userData : null;
    }
  }

  // Anime le bandage de l'arc (frac 0→1) : l'arc se centre/se pointe vers
  // l'avant et la corde + la flèche se tendent vers l'arrière.
  setBowDraw(frac) {
    if (!this._bow || !this.heldMesh) return;
    const lerp = (a, b) => a + (b - a) * frac;
    this.heldMesh.position.set(
      lerp(TOOL_BASE_POS[0], BOW_AIM_POS[0]),
      lerp(TOOL_BASE_POS[1], BOW_AIM_POS[1]),
      lerp(TOOL_BASE_POS[2], BOW_AIM_POS[2])
    );
    this.heldMesh.rotation.set(
      lerp(TOOL_BASE_ROT[0], 0),
      lerp(TOOL_BASE_ROT[1], 0),
      lerp(TOOL_BASE_ROT[2], 0)
    );
    const pull = frac * 0.16;
    this._bow.string.position.z = -0.04 + pull;
    this._bow.arrow.visible = frac > 0.05;
    this._bow.arrow.position.z = pull;
  }

  // Déclenche l'animation de coup.
  triggerSwing() {
    this.swingT = 1;
  }

  update(dt, moving) {
    this.time += dt;

    // Balancement (bob) à la marche.
    const bobAmp = moving ? 1 : 0.15;
    const bobX = Math.cos(this.time * 6) * 0.012 * bobAmp;
    const bobY = Math.sin(this.time * 12) * 0.012 * bobAmp;

    // Manger : prioritaire — main vers la bouche + mastication.
    if (this.eatT > 0) {
      this.eatT -= dt;
      const chew = Math.sin(this.time * 30) * 0.03;
      this.group.position.set(this.basePos.x - 0.12, this.basePos.y + 0.1 + chew, this.basePos.z + 0.05);
      this.group.rotation.x = -0.5;
      return;
    }

    // Minage : oscillation continue (coups répétés) ; sinon coup ponctuel.
    let swingRotX, swingPosY;
    if (this.mining) {
      this.swingT = 0;
      const chop = Math.abs(Math.sin(this.time * 11));
      swingRotX = chop * -0.95;
      swingPosY = chop * -0.1;
    } else {
      if (this.swingT > 0) this.swingT = Math.max(0, this.swingT - dt * 5);
      const swing = Math.sin(this.swingT * Math.PI); // 0 -> 1 -> 0
      swingRotX = swing * -0.9;
      swingPosY = swing * -0.12;
    }

    this.group.position.set(
      this.basePos.x + bobX,
      this.basePos.y + bobY + swingPosY,
      this.basePos.z
    );
    this.group.rotation.x = swingRotX;
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
