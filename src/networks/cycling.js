// Ce module définit les données et les couches visuelles du réseau cyclable.
// main.js l'appelle lorsque le fond de carte est prêt.

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

// Ajoute les données GeoJSON et les deux couches visuelles des pistes cyclables.
export function addCyclingRoutes(map) {
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