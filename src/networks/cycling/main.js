// Ce fichier démarre la carte cyclable et contient ses couches spécifiques.
// Il intervient au chargement de la page et réutilise le fond commun de shared/map.js.

import "../../shared/style.css";
import "./style.css";
import { createBaseMap } from "../../shared/map.js";

// Épaisseur du contour des pistes lorsque la carte est suffisamment zoomée.
const cyclingRouteLineWidth = 2.5;

// Épaissit les pistes quand on dézoome pour qu'elles restent visibles.
// Chaque paire indique un niveau de zoom puis l'épaisseur correspondante en pixels.
const cyclingRouteZoomedOutLineWidth = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6, 5,
  9, 3.5,
  12, cyclingRouteLineWidth
];

const mapElement = document.querySelector("#map"); // Élément HTML dans lequel MapLibre dessinera la carte.

// Ajoute les données GeoJSON et les deux couches visuelles des pistes cyclables.
function addCyclingRoutes(map) {
  map.addSource("cycling-routes", {
    type: "geojson", // Indique à MapLibre que les données sont au format GeoJSON.
    data: "/data/Ciclorruta.geojson", // Chemin public vers les données officielles de Bogotá.
    tolerance: 0 // Désactive la simplification de la géométrie.
  });

  // Cette couche remplit l'intérieur des emprises cyclables avec une couleur noire.
  map.addLayer({
    id: "cycling-routes-fill", // Nom interne permettant d'identifier cette couche.
    type: "fill", // Demande à MapLibre de remplir l'intérieur des polygones.
    source: "cycling-routes", // Réutilise la source déclarée juste au-dessus.
    paint: {
      "fill-color": "#000000", // Couleur de l'intérieur : noir.
      "fill-opacity": 1, // Opacité de 0 à 1 : 0 est invisible et 1 est totalement opaque.
      "fill-outline-color": "#000000" // Couleur du contour généré par la couche de remplissage.
    }
  });

  // Cette couche dessine un contour supplémentaire pour renforcer la visibilité des pistes.
  map.addLayer({
    id: "cycling-routes-outline", // Nom interne permettant d'identifier cette couche.
    type: "line", // Demande à MapLibre de dessiner les bords sous forme de lignes.
    source: "cycling-routes", // Utilise les mêmes polygones que la couche précédente.
    paint: {
      "line-color": "#000000", // Couleur du contour : noir.
      "line-width": cyclingRouteZoomedOutLineWidth, // Épaisseur réglable selon le niveau de zoom.
      "line-opacity": 1 // Rend le contour presque complètement opaque.
    }
  });
}

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
