import { Game } from './Game.js';

// Point d'entrée : instancie le jeu sur le canvas une fois le DOM prêt.
const canvas = document.getElementById('app');
new Game(canvas);
