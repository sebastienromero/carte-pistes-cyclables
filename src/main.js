// Ce fichier initialise la carte cyclable et charge ses pistes.

import "./style.css";
import { addCyclingRoutes } from "./networks/cycling.js";
import { createBaseMap } from "./shared/map.js";

const mapElement = document.querySelector("#map"); // Élément HTML dans lequel MapLibre dessinera la carte.

// Crée la carte cyclable puis y ajoute les couches propres à ce réseau.
function createCyclingMap() {
  const map = createBaseMap(mapElement); // Réutilise le fond et les contrôles communs.

  // Attend que le fond de carte soit prêt avant d'ajouter les pistes par-dessus.
  map.on("load", () => {
    addCyclingRoutes(map); // Ajoute les données officielles et leurs styles.
  });
}

// Évite une erreur JavaScript si le HTML ne contient pas la zone de carte.
if (mapElement) {
  createCyclingMap(); // Lance la carte seulement si sa structure HTML existe.
}