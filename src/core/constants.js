// Dimensions d'un chunk. Une « colonne » fait 16x16 en horizontal et 128 en hauteur.
export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;

// Nombre de voxels dans une colonne complète.
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;

// Distance de rendu en chunks autour du joueur (rayon).
export const RENDER_DISTANCE = 8;

// Budgets par frame pour éviter les freezes (génération/meshing sur le thread principal).
export const GEN_BUDGET = 4;   // chunks générés au max par frame
export const MESH_BUDGET = 3;  // chunks (re)maillés au max par frame

// Hauteur des yeux du joueur par rapport à ses pieds.
export const EYE_HEIGHT = 1.62;

// Boîte de collision du joueur (demi-largeur, hauteur totale).
export const PLAYER_HALF_WIDTH = 0.3;
export const PLAYER_HEIGHT = 1.8;

// Portée du raycast d'interaction (casser/poser), en blocs.
export const REACH = 6;
