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
| Inventaire / craft | `E` |
| Vue 3ᵉ personne | `F5` |
| Pause | `Échap` |

> Casser un bloc se fait en **maintenant** le clic gauche : la durée dépend de
> la dureté du bloc (instantané en mode créatif). Sous l'eau, on **nage**
> (`Espace` pour remonter).

## Fonctionnalités

- **Monde** : terrain procédural infini (bruit de simplex), biomes (plaines,
  forêt, désert), arbres, **grottes** (bruit 3D), **minerais** en profondeur
  (charbon, fer, or, diamant), **eau** (niveau de mer, plages, rendu translucide).
- **Cycle jour/nuit** : soleil et lune mobiles, couleur du ciel et brouillard
  dynamiques, **étoiles** la nuit, **nuages** dérivants ; l'éclairage du monde
  varie avec l'heure.
- **Interaction** : minage progressif (barre de progression selon la dureté),
  pose de blocs, **particules** à la casse/pose, surlignage du bloc visé.
- **Inventaire & craft** : inventaire avec quantités (casser récupère, poser
  consomme), **établi** (grille 3×3) et inventaire 2×2 (`E`), recettes
  (bûche→planches, planches→bâtons/établi, sable→verre…).
- **Survie** : barre de vie, **dégâts de chute**, régénération, réapparition,
  voile de dégâts / sous l'eau.
- **Caméra** : 1ʳᵉ personne (main + bloc tenu animés) et 3ᵉ personne (avatar
  animé, anti-clipping).
- **Sons** : effets synthétisés (Web Audio) par matériau — casser, poser, pas,
  craft, interface — réglables via le volume.
- **Sauvegarde** : monde modifié + inventaire + position persistés dans
  `localStorage` (auto-sauvegarde périodique et à la fermeture).
- **Menu** : écran titre, options en direct (distance de rendu, sensibilité,
  FOV, volume), menu pause.

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
│   ├── Sky.js              Cycle jour/nuit, soleil/lune, étoiles, nuages
│   ├── BlockMaterial.js    DataArrayTexture + materials blocs/eau
│   ├── blockCube.js        Cube texturé (main / 3e personne)
│   └── ViewModel.js        Main + bloc tenu (1re personne)
├── world/
│   ├── World.js            Chunks, load/unload, getBlock/setBlock, edits
│   ├── Chunk.js            Stockage des voxels d'une colonne
│   ├── ChunkMesher.js      Greedy meshing (passes solide + eau)
│   └── TerrainGenerator.js Bruit simplex, biomes, arbres, grottes, minerais
├── player/
│   ├── Player.js           Caméra, déplacement, vol, nage, vie
│   ├── PlayerModel.js      Avatar 3e personne animé
│   └── Physics.js          Gravité + collision AABB balayée
├── input/
│   └── InputManager.js     Pointer lock, clavier, souris, molette
├── interaction/
│   ├── VoxelRaycaster.js   Traversée DDA (Amanatides & Woo)
│   └── BlockInteraction.js Minage progressif / pose / surlignage
├── inventory/
│   └── Inventory.js        Slots, quantités, sélection
├── crafting/
│   └── recipes.js          Recettes (correspondance par ingrédients)
├── effects/
│   └── Particles.js        Particules de blocs (pool)
├── audio/
│   └── SoundManager.js     Effets sonores synthétisés (Web Audio)
├── persistence/
│   └── Save.js             Sauvegarde / chargement (localStorage)
└── ui/
    ├── Hotbar.js           Barre d'inventaire
    ├── Menu.js             Menu principal / options / pause
    └── InventoryUI.js      Écran inventaire + craft (clic-déplacer)
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
