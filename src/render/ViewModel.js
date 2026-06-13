import * as THREE from 'three';
import { isPlaceable } from '../blocks/BlockRegistry.js';
import { buildBlockCubeGeometry } from './blockCube.js';

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
    this.swingT = 0; // 1 -> 0 pendant un coup
  }

  // Met à jour le bloc tenu si la sélection a changé.
  setHeld(itemId) {
    if (itemId === this.heldId) return;
    this.heldId = itemId;

    if (this.heldMesh) {
      this.group.remove(this.heldMesh);
      this.heldMesh.geometry.dispose();
      this.heldMesh = null;
    }
    // On n'affiche un cube que pour les blocs plaçables (les objets purs comme
    // les bâtons restent « en main » sans modèle dédié).
    if (isPlaceable(itemId)) {
      const geo = buildBlockCubeGeometry(itemId);
      const mesh = new THREE.Mesh(geo, this.blockMaterial);
      mesh.scale.setScalar(0.42);
      mesh.position.set(0.28, 0.05, -0.1);
      mesh.rotation.set(0.2, -0.5, 0.1);
      this.group.add(mesh);
      this.heldMesh = mesh;
    }
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

    // Animation de coup : arc rapide qui décroît.
    if (this.swingT > 0) this.swingT = Math.max(0, this.swingT - dt * 5);
    const swing = Math.sin(this.swingT * Math.PI); // 0 -> 1 -> 0
    const swingRotX = swing * -0.9;
    const swingPosY = swing * -0.12;

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
