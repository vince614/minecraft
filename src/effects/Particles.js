import * as THREE from 'three';

// Petites particules cubiques projetées quand on casse/pose un bloc. Pool de
// meshes réutilisés (pas d'allocation par frame). Couleur tirée du bloc.
const GRAVITY = 18;
const SHARED_GEO = new THREE.BoxGeometry(1, 1, 1);

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];   // particules libres
    this.active = [];
  }

  _obtain() {
    let p = this.pool.pop();
    if (!p) {
      const mesh = new THREE.Mesh(SHARED_GEO, new THREE.MeshLambertMaterial());
      p = { mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0, size: 0.12 };
    }
    return p;
  }

  // Émet `count` particules autour du centre (cx,cy,cz) avec une couleur.
  emit(cx, cy, cz, colorHex, count = 10, spread = 3.5) {
    for (let i = 0; i < count; i++) {
      const p = this._obtain();
      p.size = 0.08 + Math.random() * 0.08;
      p.mesh.scale.setScalar(p.size);
      p.mesh.material.color.set(colorHex);
      p.mesh.position.set(
        cx + (Math.random() - 0.5) * 0.6,
        cy + (Math.random() - 0.5) * 0.6,
        cz + (Math.random() - 0.5) * 0.6
      );
      p.vel.set(
        (Math.random() - 0.5) * spread,
        Math.random() * spread * 0.8 + 1,
        (Math.random() - 0.5) * spread
      );
      p.maxLife = 0.5 + Math.random() * 0.4;
      p.life = p.maxLife;
      this.scene.add(p.mesh);
      this.active.push(p);
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.active.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      p.vel.y -= GRAVITY * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      // Rétrécit en fin de vie.
      p.mesh.scale.setScalar(p.size * (p.life / p.maxLife));
    }
  }
}
