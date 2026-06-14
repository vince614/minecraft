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
| Guide de craft | `C` |
| Ouvrir coffre / établi / enchantement | Clic droit sur le bloc |
| Vue 3ᵉ personne | `F5` |
| Pause | `Échap` |

> Casser un bloc se fait en **maintenant** le clic gauche : la durée dépend de
> la dureté du bloc (instantané en mode créatif). **Frapper** un animal ou un
> zombie = clic gauche en le visant. Les objets cassés / le butin des mobs
> **tombent au sol** et se ramassent en passant dessus. Sous l'eau, on **nage**
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
  consomme), **établi** (grille 3×3) et inventaire 2×2 (`E`). **Guide de craft**
  (`C` ou bouton) listant toutes les recettes avec leurs ingrédients, et
  **fabrication en 1 clic** des recettes réalisables.
- **Icônes d'objets** : l'inventaire, la hotbar et le guide affichent de vraies
  **icônes texturées** — la tuile réelle pour les blocs, un dessin dédié pour
  les outils/objets (épée, pioche, arc, flèche, viande…).
- **Outils en main** : l'objet tenu apparaît en 3D dans la main (cube texturé
  pour les blocs, modèle dédié pour épée / pioche / arc / flèche…), avec
  animation de coup et de balancement à la marche, **arc qui se bande**
  (maintien du clic → corde tendue, relâcher tire plus fort) ; l'objet est aussi
  tenu par l'avatar en **3ᵉ personne**.
- **Durabilité & réparation** : les outils (épée, pioche, arc) ont une **barre
  d'usure** et **cassent** à l'usage ; combiner **deux outils identiques** dans
  la grille de craft les **répare** (durabilités cumulées + bonus).
- **Coffres** : bloc de stockage (clic droit) avec **27 emplacements** ; le
  contenu est **persisté** (sauvegarde) et **lâché au sol** si on casse le coffre.
- **Enchantements** : **table d'enchantement** (clic droit) pour améliorer
  l'outil sélectionné contre des **diamants** — Efficacité (minage), Tranchant
  (dégâts), Puissance (arc), Solidité (réduit l'usure). Niveaux ★ cumulables.
- **Animations de main** : **minage** (l'outil frappe en boucle tant qu'on casse
  un bloc), **coup** ponctuel (pose/attaque), **manger** (main portée à la
  bouche), **bandage de l'arc**, balancement à la marche — en 1ʳᵉ personne, et
  le bras de l'avatar frappe aussi en 3ᵉ personne.
- **Créatures** : animaux passifs (vache, cochon, mouton, poule) qui errent et
  fuient ; **zombies** hostiles qui apparaissent la nuit, poursuivent et
  attaquent le joueur ; **villageois** dans les villages. IA d'errance /
  poursuite / fuite, physique et sauts d'obstacle.
- **Combat & butin** : frapper les mobs (clic gauche), recul, barres de vie ;
  les mobs lâchent des objets **au sol** (viande, cuir, plume, chair…),
  ramassables.
- **Villages** : générés dans le monde (maisons en pavé/planches/verre avec
  porte et fenêtres, **puits** central, **chemins**), peuplés de villageois.
- **Explosifs** : bloc de **TNT** (clic droit pour l'amorcer → mèche puis
  explosion qui détruit les blocs, blesse les entités, secoue la caméra et
  déclenche les TNT voisines en chaîne).
- **Combat avancé** : **épée** (plus de dégâts), **arc + flèches** (tir de
  projectiles), **creepers** qui gonflent et explosent, **squelettes** qui
  tirent à distance.
- **Outils** : **pioche** (minage accéléré) ; recettes pour épée, pioche, arc,
  flèches et TNT.
- **Élevage** : nourrir deux animaux (clic droit avec de la viande) les met en
  amour → naissance d'un **bébé** qui grandit.
- **Faim** : barre de faim qui se vide, **manger** (clic droit avec de la
  nourriture) pour la remplir ; la régénération dépend d'être bien nourri,
  famine si elle atteint zéro.
- **Météo** : épisodes de **pluie** (gouttes, ciel assombri).
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
│   ├── heldModels.js       Modèles 3D des outils tenus en main
│   └── ViewModel.js        Main + objet tenu animé (1re personne)
├── world/
│   ├── World.js            Chunks, load/unload, getBlock/setBlock, edits
│   ├── Chunk.js            Stockage des voxels d'une colonne
│   ├── ChunkMesher.js      Greedy meshing (passes solide + eau)
│   ├── TerrainGenerator.js Bruit simplex, biomes, arbres, grottes, minerais
│   └── VillageGenerator.js Villages déterministes (maisons, puits, chemins)
├── entities/
│   ├── Mob.js              Définitions + état des créatures
│   ├── mobModels.js        Modèles « blocky » animés (animaux, humanoïdes, creeper)
│   ├── MobManager.js       Spawn/despawn, IA, combat, élevage, butin
│   ├── DropManager.js      Objets lâchés au sol (chute + ramassage)
│   ├── TntManager.js       TNT amorcées (mèche + explosion en chaîne)
│   └── ProjectileManager.js Flèches en vol (arc, squelettes)
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
│   ├── Particles.js        Particules de blocs (pool)
│   └── explode.js          Logique d'explosion (TNT, creeper)
├── audio/
│   └── SoundManager.js     Effets sonores synthétisés (Web Audio)
├── persistence/
│   └── Save.js             Sauvegarde / chargement (localStorage)
└── ui/
    ├── Hotbar.js           Barre d'inventaire
    ├── Menu.js             Menu principal / options / pause
    ├── InventoryUI.js      Écran inventaire / craft / coffre (clic-déplacer)
    ├── CraftGuide.js       Guide de recettes + craft en 1 clic
    └── EnchantUI.js        Table d'enchantement (bonus contre diamants)
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
