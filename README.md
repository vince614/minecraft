# Minecraft Clone — Three.js

Un clone de Minecraft jouable dans le navigateur : moteur voxel en **Three.js**
et **JavaScript vanilla** (aucun framework UI), bundlé avec **Vite**.

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir l'URL affichée (par défaut http://localhost:5173).
Cliquer sur l'écran pour capturer la souris et commencer à jouer.

Build de production :

```bash
npm run build
npm run preview
```

## Contrôles

| Action | Touche |
| --- | --- |
| Se déplacer | `W` `A` `S` `D` |
| Regarder | Souris |
| Sauter | `Espace` |
| Sprint | `Shift` (gauche) |
| Casser un bloc | Clic gauche |
| Poser un bloc | Clic droit |
| Choisir un bloc | `1`–`9` ou molette |
| Mode vol (créatif) | `F` (puis `Espace` / `Shift` pour monter/descendre) |
| Pause | `Échap` |

## Architecture

Code modulaire, une responsabilité par module :

```
src/
├── main.js                 Point d'entrée
├── Game.js                 Orchestrateur : scène, boucle, câblage
├── core/
│   ├── constants.js        Dimensions, distances, budgets
│   └── voxelIndex.js       Indexation (x,y,z) <-> tableau linéaire
├── blocks/
│   ├── tiles.js            Textures dessinées par programme (16x16)
│   └── BlockRegistry.js    Types de blocs (solidité, transparence, faces)
├── render/
│   ├── createRenderer.js   WebGLRenderer
│   ├── Skybox.js           Ciel, brouillard, lumières
│   └── BlockMaterial.js    DataArrayTexture + ShaderMaterial unique
├── world/
│   ├── World.js            Gestion des chunks, load/unload, getBlock/setBlock
│   ├── Chunk.js            Stockage des voxels d'une colonne
│   ├── ChunkMesher.js      Greedy meshing -> BufferGeometry
│   └── TerrainGenerator.js Bruit de simplex, couches, biomes, arbres
├── player/
│   ├── Player.js           Caméra FPS, déplacement, mode vol
│   └── Physics.js          Gravité + collision AABB balayée
├── input/
│   └── InputManager.js     Pointer lock, clavier, souris, molette
├── interaction/
│   ├── VoxelRaycaster.js   Traversée DDA (Amanatides & Woo)
│   └── BlockInteraction.js Casser / poser / surligner
└── ui/
    └── Hotbar.js           Barre d'inventaire
```

## Choix techniques notables

- **Greedy meshing** (`ChunkMesher.js`) : les faces internes/cachées ne sont
  jamais générées, et les faces coplanaires identiques sont fusionnées en grands
  quads. C'est le point critique de performance.
- **Texture array** (`THREE.DataArrayTexture`) plutôt qu'un atlas 2D : permet le
  *tiling* répété sur les quads greedy étirés sans *texture bleeding*, tout en
  gardant **un seul material** pour tous les blocs (shader maison court).
- **Chunks 16×16×128**, chargement/déchargement dynamique autour du joueur, avec
  un budget de génération et de meshing par frame pour éviter les freezes.
- **Remesh par colonne** : modifier un bloc ne reconstruit que le chunk concerné
  (et son voisin si le bloc est sur un bord), jamais le monde entier.
- Génération et meshing sur le **thread principal** (budgétés). Les Web Workers
  pourront être ajoutés plus tard si le profiling le justifie, sans changer
  l'architecture des modules.

## Dépendances

- [`three`](https://threejs.org/) — rendu 3D
- [`simplex-noise`](https://github.com/jwagner/simplex-noise.js) — bruit procédural
- [`vite`](https://vitejs.dev/) — serveur de dev / bundler
