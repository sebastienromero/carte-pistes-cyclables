// Ce fichier initialise MapLibre, charge les pistes locales et gère les contrôles de la carte.

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";

const mapElement = document.querySelector("#map"); // Élément HTML dans lequel MapLibre dessinera la carte.

// MapLibre attend les coordonnées dans cet ordre : longitude, puis latitude.
const bogotaCenter = [-74.0721, 4.6486]; // Centre initial de la carte, à Bogotá.

// Définit l'épaisseur habituelle du contour noir des pistes, en pixels.
// Cette valeur reste utilisée quand la carte est suffisamment zoomée.
const cyclingRouteLineWidth = 2.5;

// Garde les pistes visibles quand on dézoome en épaississant temporairement leur contour.
// Les valeurs correspondent à : niveau de zoom, puis épaisseur en pixels.
const cyclingRouteZoomedOutLineWidth = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6, 5,
  9, 3.5,
  12, cyclingRouteLineWidth
];

// Ajoute la source GeoJSON officielle et les deux couches visuelles des emprises cyclables.
function addCyclingRoutes(map) {
  map.addSource("cycling-routes", {
    type: "geojson", // Indique à MapLibre que les données sont au format GeoJSON.
    data: "/data/Ciclorruta.geojson", // Chemin public vers les données officielles de Bogotá.
    tolerance: 0// désactive la simplification
  });

  // Cette couche remplit l'intérieur des emprises cyclables avec une couleur noire.
  map.addLayer({
    id: "cycling-routes-fill", // Nom interne permettant d'identifier cette couche.
    type: "fill", // Demande à MapLibre de remplir l'intérieur des polygones.
    source: "cycling-routes", // Réutilise la source GeoJSON déclarée juste au-dessus.
    paint: {
      "fill-color": "#000000", // Couleur de l'intérieur : noir.
      "fill-opacity": 1, // Opacité de 0 à 1 : 0 est invisible et 1 est totalement opaque.
      "fill-outline-color": "#000000" // Couleur du contour généré par la couche de remplissage.
    }
  });

  // Cette couche dessine un contour supplémentaire pour renforcer la visibilité des pistes.
  map.addLayer({
    id: "cycling-routes-outline", // Nom interne de la couche de contour.
    type: "line", // Demande à MapLibre de dessiner les bords sous forme de lignes.
    source: "cycling-routes", // Utilise les mêmes polygones que la couche précédente.
    paint: {
      "line-color": "#000000", // Couleur du contour : noir.
      "line-width": cyclingRouteZoomedOutLineWidth, // Épaisseur réglable selon le niveau de zoom.
      "line-opacity": 1 // Rend le contour presque complètement opaque.
    }
  });
}

// Crée la carte centrée sur Bogotá avec un fond libre.
function createMap() {
  const map = new maplibregl.Map({
    container: mapElement, // Élément HTML qui recevra la carte.
    style: "https://tiles.openfreemap.org/styles/liberty", // Style visuel libre utilisé pour le fond de carte.
    center: bogotaCenter, // Position initiale définie plus haut.
    zoom: 11.5, // Niveau de zoom initial : plus le nombre est grand, plus on zoome.
    attributionControl: { compact: true } // Affiche les crédits obligatoires du fond cartographique.
  });
  
  // Ajoute les boutons de zoom et de déplacement dans le coin supérieur droit.
  map.addControl(new maplibregl.NavigationControl(), "top-right");

  // Ajoute un bouton qui peut centrer la carte sur la position actuelle de l'utilisateur.
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true }, // Demande au navigateur la position la plus précise possible.
      trackUserLocation: true, // Continue de suivre l'utilisateur lorsqu'il se déplace.
      showUserHeading: true // Affiche la direction vers laquelle l'utilisateur regarde.
    }),
    "top-right" // Place le bouton sous les autres contrôles en haut à droite.
  );

  // Attend que le fond de carte soit prêt avant d'ajouter les pistes par-dessus.
  map.on("load", () => {
    addCyclingRoutes(map); // Ajoute les données officielles et leurs styles.
  });

  // Referme le « i » une fois la carte chargée.
  map.on("idle", () => {
    const attribution = document.querySelector(".maplibregl-ctrl-attrib");
    if (!attribution) return;
    attribution.removeAttribute("open");
    attribution.classList.remove("maplibregl-compact-show");
  });
}

// Évite une erreur JavaScript si le HTML ne contient pas la zone de carte.
if (mapElement) {
  createMap(); // Lance la création de la carte seulement si sa structure HTML existe.
}