import * as THREE from 'three';

// Construction des modèles « blocky » des mobs à partir de boîtes. Chaque
// builder renvoie { group, animate(dt, moving) } où les membres pivotent à la
// marche. Les pieds sont à y = 0 (le groupe est placé sur la position du mob).

function box(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
}

// Membre articulé : pivot à l'articulation + boîte pendante.
function limb(parent, x, y, z, w, h, d, color) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const mesh = box(w, h, d, color);
  mesh.position.y = -h / 2;
  pivot.add(mesh);
  parent.add(pivot);
  return pivot;
}

// Quadrupède générique (vache, cochon, mouton).
function makeQuadruped({ body, head: headColor, bodyW, bodyH, bodyL, legH, legW = 0.22 }) {
  const group = new THREE.Group();
  const bodyY = legH + bodyH / 2;

  const torso = box(bodyW, bodyH, bodyL, body);
  torso.position.y = bodyY;
  group.add(torso);

  const head = box(bodyW * 0.8, bodyH * 0.9, bodyH * 0.8, headColor);
  head.position.set(0, legH + bodyH * 0.9, -bodyL / 2 - bodyH * 0.4);
  group.add(head);

  const lx = bodyW / 2 - legW / 2;
  const lz = bodyL / 2 - legW / 2;
  const legs = [
    limb(group, -lx, legH, -lz, legW, legH, legW, body), // avant gauche
    limb(group, lx, legH, -lz, legW, legH, legW, body),  // avant droite
    limb(group, -lx, legH, lz, legW, legH, legW, body),  // arrière gauche
    limb(group, lx, legH, lz, legW, legH, legW, body),   // arrière droite
  ];

  let time = 0;
  return {
    group,
    animate(dt, moving) {
      time += dt;
      const a = moving ? Math.sin(time * 8) * 0.5 : 0;
      legs[0].rotation.x = a; legs[3].rotation.x = a;   // diagonale
      legs[1].rotation.x = -a; legs[2].rotation.x = -a;
    },
  };
}

// Humanoïde (zombie, villageois).
function makeHumanoid({ skin, shirt, pants, armsForward = false, nose = null }) {
  const group = new THREE.Group();

  const torso = box(0.5, 0.75, 0.28, shirt);
  torso.position.y = 1.13;
  group.add(torso);

  const headPivot = new THREE.Group();
  headPivot.position.y = 1.5;
  const head = box(0.5, 0.5, 0.5, skin);
  head.position.y = 0.25;
  headPivot.add(head);
  if (nose) {
    const n = box(0.12, 0.2, 0.18, nose);
    n.position.set(0, 0.22, -0.3);
    headPivot.add(n);
  }
  group.add(headPivot);

  const armL = limb(group, -0.37, 1.45, 0, 0.22, 0.7, 0.22, shirt);
  const armR = limb(group, 0.37, 1.45, 0, 0.22, 0.7, 0.22, shirt);
  const legL = limb(group, -0.13, 0.72, 0, 0.24, 0.72, 0.24, pants);
  const legR = limb(group, 0.13, 0.72, 0, 0.24, 0.72, 0.24, pants);

  if (armsForward) { armL.rotation.x = -Math.PI / 2; armR.rotation.x = -Math.PI / 2; }

  let time = 0;
  return {
    group,
    animate(dt, moving) {
      time += dt;
      const a = moving ? Math.sin(time * 9) * 0.6 : 0;
      legL.rotation.x = a; legR.rotation.x = -a;
      if (!armsForward) { armL.rotation.x = -a; armR.rotation.x = a; }
    },
  };
}

// Poule : petit corps, bec, crête, deux pattes.
function makeChicken() {
  const group = new THREE.Group();
  const bodyColor = 0xf2f2f2;
  const bodybox = box(0.35, 0.35, 0.4, bodyColor);
  bodybox.position.y = 0.45;
  group.add(bodybox);
  const head = box(0.25, 0.3, 0.25, bodyColor);
  head.position.set(0, 0.7, -0.2);
  group.add(head);
  const beak = box(0.12, 0.1, 0.12, 0xe0a020);
  beak.position.set(0, 0.66, -0.36);
  group.add(beak);
  const comb = box(0.1, 0.12, 0.16, 0xc83030);
  comb.position.set(0, 0.86, -0.18);
  group.add(comb);
  const legL = limb(group, -0.1, 0.28, 0.05, 0.08, 0.28, 0.08, 0xe0a020);
  const legR = limb(group, 0.1, 0.28, 0.05, 0.08, 0.28, 0.08, 0xe0a020);

  let time = 0;
  return {
    group,
    animate(dt, moving) {
      time += dt;
      const a = moving ? Math.sin(time * 12) * 0.6 : 0;
      legL.rotation.x = a; legR.rotation.x = -a;
    },
  };
}

// Creeper : corps vert dressé, 4 pattes courtes, pas de bras.
function makeCreeper() {
  const group = new THREE.Group();
  const green = 0x4f9a3a;
  const body = box(0.5, 0.85, 0.35, green);
  body.position.y = 0.65;
  group.add(body);
  const head = box(0.5, 0.5, 0.5, 0x5aa845);
  head.position.y = 1.3;
  group.add(head);
  // yeux/bouche sombres
  const face = box(0.52, 0.2, 0.1, 0x153015);
  face.position.set(0, 1.32, -0.21);
  group.add(face);
  const legs = [
    limb(group, -0.15, 0.22, -0.12, 0.18, 0.22, 0.18, green),
    limb(group, 0.15, 0.22, -0.12, 0.18, 0.22, 0.18, green),
    limb(group, -0.15, 0.22, 0.12, 0.18, 0.22, 0.18, green),
    limb(group, 0.15, 0.22, 0.12, 0.18, 0.22, 0.18, green),
  ];
  let time = 0;
  return {
    group,
    animate(dt, moving) {
      time += dt;
      const a = moving ? Math.sin(time * 8) * 0.4 : 0;
      legs[0].rotation.x = a; legs[3].rotation.x = a;
      legs[1].rotation.x = -a; legs[2].rotation.x = -a;
    },
  };
}

// Fabrique le modèle correspondant à un type de mob.
export function buildMobModel(type) {
  switch (type) {
    case 'cow':
      return makeQuadruped({ body: 0x5b4636, head: 0x4a3829, bodyW: 0.7, bodyH: 0.7, bodyL: 1.2, legH: 0.6 });
    case 'pig':
      return makeQuadruped({ body: 0xe89aa8, head: 0xe089a0, bodyW: 0.62, bodyH: 0.55, bodyL: 1.0, legH: 0.4 });
    case 'sheep':
      return makeQuadruped({ body: 0xe8e6e0, head: 0xd8c8b0, bodyW: 0.7, bodyH: 0.7, bodyL: 1.0, legH: 0.5 });
    case 'chicken':
      return makeChicken();
    case 'zombie':
      return makeHumanoid({ skin: 0x4f7a3a, shirt: 0x3a6a8a, pants: 0x33408c, armsForward: true });
    case 'villager':
      return makeHumanoid({ skin: 0xc99a6a, shirt: 0x6a4a34, pants: 0x4a3424, nose: 0xb98a5a });
    case 'creeper':
      return makeCreeper();
    case 'skeleton':
      return makeHumanoid({ skin: 0xd8d8d0, shirt: 0xc4c4bc, pants: 0xb0b0a8, armsForward: true });
    default:
      return makeQuadruped({ body: 0xff00ff, head: 0xff00ff, bodyW: 0.6, bodyH: 0.6, bodyL: 1, legH: 0.5 });
  }
}
