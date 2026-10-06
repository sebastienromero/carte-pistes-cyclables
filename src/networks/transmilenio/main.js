// Ce fichier gère l'affichage de la carte TransMilenio.
// Il utilise le fond de carte commun et ajoute les couches spécifiques :
// 1. Les tracés des troncales (lignes)
// 2. Les stations (points) avec des popups d'information.

import maplibregl from "maplibre-gl";
import "../../shared/style.css";
import "./style.css";
import { createBaseMap } from "../../shared/map.js";

const mapElement = document.querySelector("#map");

// Couleur de chaque troncale, selon sa lettre (champ "le_troncal" du fichier).
// Modifier une couleur ici suffit : le reste du code n'a pas à changer.
const troncalColors = {
  A: "#00398B", // Caracas
  B: "#95B734", // Autopista Norte
  C: "#EABF3B", // Suba
  D: "#7B6CA7", // Calle 80
  E: "#9C6C0C", // NQS Central
  F: "#BB0615", // Américas
  G: "#3D9CD7", // NQS Sur
  H: "#D88C00", // Caracas Sur
  J: "#D0A2AA", // Eje Ambiental
  K: "#CAB07C", // Calle 26
  L: "#00949C", // Carrera 10
  M: "#8A0079", // Carrera 7
  Z: "#6B7280"  // Avenida Ciudad de Cali (couleur provisoire)
};

// Couleur utilisée quand une troncale n'est pas reconnue.
const defaultLineColor = "#808080";

// Lettre de troncale de chaque tracé (id_trazado -> le_troncal).
// Cette table vient du fichier Trazados_Troncales_de_TRANSMILENIO.geojson.
const troncalLetterByTrazadoId = {
  TZ001: "A",
  TZ002: "B",
  TZ003: "C",
  TZ004: "C",
  TZ005: "D",
  TZ006: "D",
  TZ007: "E",
  TZ008: "E",
  TZ009: "F",
  TZ010: "G",
  TZ011: "G",
  TZ012: "H",
  TZ013: "H",
  TZ014: "H",
  TZ015: "J",
  TZ016: "K",
  TZ017: "K",
  TZ018: "L",
  TZ019: "M",
  TZ020: "M",
  TZ022: "Z",
  TZ022A: "Z"
};

// Construit l'expression MapLibre qui associe chaque id_trazado à la couleur de sa troncale.
// Elle sert aux lignes ET aux stations, pour qu'elles aient les mêmes couleurs.
function buildTroncalColorExpression() {
  const expression = ["match", ["get", "id_trazado"]];
  for (const [trazadoId, letter] of Object.entries(troncalLetterByTrazadoId)) {
    expression.push(trazadoId, troncalColors[letter]);
  }
  expression.push(defaultLineColor); // valeur par défaut, obligatoire en dernier
  return expression;
}

// Choisit un texte noir ou blanc selon la luminosité du fond, pour rester lisible.
function getReadableTextColor(hexColor) {
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 150 ? "#000000" : "#ffffff";
}

// Fabrique le petit carré coloré d'un service (couleur selon la première lettre du code).
function buildServiceBadge(serviceCode) {
  const backgroundColor = troncalColors[serviceCode[0]] ?? defaultLineColor;
  const textColor = getReadableTextColor(backgroundColor);
  return `<span class="service-badge" style="background:${backgroundColor};color:${textColor}">${serviceCode}</span>`;
}

// Ajoute les lignes des troncales sur la carte.
function addTroncales(map) {
  // Déclare la source de données GeoJSON contenant les tracés.
  map.addSource("troncales", {
    type: "geojson",
    data: "/data/Trazados_Troncales_de_TRANSMILENIO.geojson"
  });

  // Ajoute la couche visuelle pour dessiner les lignes.
  map.addLayer({
    id: "troncales-lines",
    type: "line",
    source: "troncales",
    paint: {
      // Couleur de la troncale selon l'identifiant du tracé.
      "line-color": buildTroncalColorExpression(),
      // Ajuste l'épaisseur de la ligne selon le niveau de zoom.
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        6, 2,
        12, 5
      ],
      "line-opacity": 0.8
    }
  });
}

// Ajoute les stations sous forme de points cliquables.
function addStations(map) {
  // Charge la liste des services qui s'arrêtent à chaque station (clé = code cod_nodo).
  // Ce fichier est produit par le script scripts/build-services-by-station.mjs.
  let servicesByStation = {};
  fetch("/data/servicios-por-estacion.json")
    .then((response) => response.json())
    .then((data) => {
      servicesByStation = data;
    });

  // Déclare la source de données GeoJSON contenant les stations.
  map.addSource("stations", {
    type: "geojson",
    data: "/data/Estaciones_Troncales_de_TRANSMILENIO.geojson"
  });

  // Affiche les stations comme des cercles.
  map.addLayer({
    id: "stations-points",
    type: "circle",
    source: "stations",
    paint: {
      // Les portails sont plus grands (rayon 8) que les stations classiques (rayon 5).
      "circle-radius": [
        "case",
        ["==", ["slice", ["get", "nom_est"], 0, 6], "Portal"],
        8,
        5
      ],
      "circle-color": "#ffffff",
      "circle-stroke-width": 2,
      // Couleur du contour identique à la couleur de la troncale correspondante.
      "circle-stroke-color": buildTroncalColorExpression()
    }
  });

  // Ajoute les noms des portails sur la carte de manière permanente.
  map.addLayer({
    id: "portals-labels",
    type: "symbol",
    source: "stations",
    // Ne filtre que les entités dont le nom commence par "Portal".
    filter: ["==", ["slice", ["get", "nom_est"], 0, 6], "Portal"],
    layout: {
      "text-field": ["get", "nom_est"],
      "text-size": 12,
      "text-offset": [0, 1.5],
      "text-anchor": "top"
    },
    paint: {
      "text-color": "#000"
    }
  });

  // Gestion du clic sur une station pour afficher les infos.
  map.on("click", "stations-points", (e) => {
    const feature = e.features[0];

    // Services de la station, ou un message si elle n'est pas dans le fichier.
    const services = servicesByStation[feature.properties.cod_nodo];
    const servicesHtml = services
      ? services.map(buildServiceBadge).join("")
      : "information non disponible";

    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <strong>${feature.properties.nom_est}</strong><br>
        Arrêt de : ${servicesHtml}<br>
        Adresse: ${feature.properties.ub_est}
      `)
      .addTo(map);
  });

  // Change le curseur en pointeur (la main) lorsqu'il survole une station.
  map.on("mouseenter", "stations-points", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "stations-points", () => map.getCanvas().style.cursor = "");
}

// Fonction principale qui initialise la carte et ajoute les couches.
function createTransmilenioMap() {
  const map = createBaseMap(mapElement);

  map.on("load", () => {
    addTroncales(map);
    addStations(map);
  });
}

if (mapElement) {
  createTransmilenioMap();
}
// // Ce fichier gère l'affichage de la carte TransMilenio.
// // Il utilise le fond de carte commun et ajoute les couches spécifiques :
// // 1. Les tracés des troncales (lignes)
// // 2. Les stations (points) avec des popups d'information.

// import maplibregl from "maplibre-gl";
// import "../../shared/style.css";
// import "./style.css";
// import { createBaseMap } from "../../shared/map.js";

// const mapElement = document.querySelector("#map");

// // Couleur de chaque troncale, selon sa lettre (champ "le_troncal" du fichier).
// // Modifier une couleur ici suffit : le reste du code n'a pas à changer.
// const troncalColors = {
//   A: "#00398B", // Caracas
//   B: "#95B734", // Autopista Norte
//   C: "#EABF3B", // Suba
//   D: "#7B6CA7", // Calle 80
//   E: "#9C6C0C", // NQS Central
//   F: "#BB0615", // Américas
//   G: "#3D9CD7", // NQS Sur
//   H: "#D88C00", // Caracas Sur
//   J: "#D0A2AA", // Eje Ambiental
//   K: "#CAB07C", // Calle 26
//   L: "#00949C", // Carrera 10
//   M: "#8A0079", // Carrera 7
//   Z: "#6B7280"  // Avenida Ciudad de Cali (couleur provisoire)
// };

// // Couleur utilisée quand une troncale n'est pas reconnue.
// const defaultLineColor = "#808080";

// // Lettre de troncale de chaque tracé (id_trazado -> le_troncal).
// // Cette table vient du fichier Trazados_Troncales_de_TRANSMILENIO.geojson.
// const troncalLetterByTrazadoId = {
//   TZ001: "A",
//   TZ002: "B",
//   TZ003: "C",
//   TZ004: "C",
//   TZ005: "D",
//   TZ006: "D",
//   TZ007: "E",
//   TZ008: "E",
//   TZ009: "F",
//   TZ010: "G",
//   TZ011: "G",
//   TZ012: "H",
//   TZ013: "H",
//   TZ014: "H",
//   TZ015: "J",
//   TZ016: "K",
//   TZ017: "K",
//   TZ018: "L",
//   TZ019: "M",
//   TZ020: "M",
//   TZ022: "Z",
//   TZ022A: "Z"
// };

// // Construit l'expression MapLibre qui associe chaque id_trazado à la couleur de sa troncale.
// // Elle sert aux lignes ET aux stations, pour qu'elles aient les mêmes couleurs.
// function buildTroncalColorExpression() {
//   const expression = ["match", ["get", "id_trazado"]];
//   for (const [trazadoId, letter] of Object.entries(troncalLetterByTrazadoId)) {
//     expression.push(trazadoId, troncalColors[letter]);
//   }
//   expression.push(defaultLineColor); // valeur par défaut, obligatoire en dernier
//   return expression;
// }

// // Ajoute les lignes des troncales sur la carte.
// function addTroncales(map) {
//   // Déclare la source de données GeoJSON contenant les tracés.
//   map.addSource("troncales", {
//     type: "geojson",
//     data: "/data/Trazados_Troncales_de_TRANSMILENIO.geojson"
//   });

//   // Ajoute la couche visuelle pour dessiner les lignes.
//   map.addLayer({
//     id: "troncales-lines",
//     type: "line",
//     source: "troncales",
//     paint: {
//       // Couleur de la troncale selon l'identifiant du tracé.
//       "line-color": buildTroncalColorExpression(),
//       // Ajuste l'épaisseur de la ligne selon le niveau de zoom.
//       "line-width": [
//         "interpolate",
//         ["linear"],
//         ["zoom"],
//         6, 2,
//         12, 5
//       ],
//       "line-opacity": 0.8
//     }
//   });
// }

// // Ajoute les stations sous forme de points cliquables.
// function addStations(map) {
//   // Charge la liste des services qui s'arrêtent à chaque station (clé = code cod_nodo).
//   // Ce fichier est produit par le script scripts/build-services-by-station.mjs.
//   let servicesByStation = {};
//   fetch("/data/servicios-por-estacion.json")
//     .then((response) => response.json())
//     .then((data) => {
//       servicesByStation = data;
//     });

//   // Déclare la source de données GeoJSON contenant les stations.
//   map.addSource("stations", {
//     type: "geojson",
//     data: "/data/Estaciones_Troncales_de_TRANSMILENIO.geojson"
//   });

//   // Affiche les stations comme des cercles.
//   map.addLayer({
//     id: "stations-points",
//     type: "circle",
//     source: "stations",
//     paint: {
//       // Les portails sont plus grands (rayon 8) que les stations classiques (rayon 5).
//       "circle-radius": [
//         "case",
//         ["==", ["slice", ["get", "nom_est"], 0, 6], "Portal"],
//         8,
//         5
//       ],
//       "circle-color": "#ffffff",
//       "circle-stroke-width": 2,
//       // Couleur du contour identique à la couleur de la troncale correspondante.
//       "circle-stroke-color": buildTroncalColorExpression()
//     }
//   });

//   // Ajoute les noms des portails sur la carte de manière permanente.
//   map.addLayer({
//     id: "portals-labels",
//     type: "symbol",
//     source: "stations",
//     // Ne filtre que les entités dont le nom commence par "Portal".
//     filter: ["==", ["slice", ["get", "nom_est"], 0, 6], "Portal"],
//     layout: {
//       "text-field": ["get", "nom_est"],
//       "text-size": 12,
//       "text-offset": [0, 1.5],
//       "text-anchor": "top"
//     },
//     paint: {
//       "text-color": "#000"
//     }
//   });

//   // Gestion du clic sur une station pour afficher les infos.
//   map.on("click", "stations-points", (e) => {
//     const feature = e.features[0];

//     // Services de la station, ou un message si elle n'est pas dans le fichier.
//     const services = servicesByStation[feature.properties.cod_nodo];
//     const servicesText = services ? services.join(", ") : "information non disponible";

//     new maplibregl.Popup()
//       .setLngLat(e.lngLat)
//       .setHTML(`
//         <strong>${feature.properties.nom_est}</strong><br>
//         Arrêt de : ${servicesText}<br>
//         Adresse: ${feature.properties.ub_est}
//       `)
//       .addTo(map);
//   });

//   // Change le curseur en pointeur (la main) lorsqu'il survole une station.
//   map.on("mouseenter", "stations-points", () => map.getCanvas().style.cursor = "pointer");
//   map.on("mouseleave", "stations-points", () => map.getCanvas().style.cursor = "");
// }

// // Fonction principale qui initialise la carte et ajoute les couches.
// function createTransmilenioMap() {
//   const map = createBaseMap(mapElement);

//   map.on("load", () => {
//     addTroncales(map);
//     addStations(map);
//   });
// }

// if (mapElement) {
//   createTransmilenioMap();
// }
// // Ce fichier gère l'affichage de la carte TransMilenio.
// // Il utilise le fond de carte commun et ajoute les couches spécifiques :
// // 1. Les tracés des troncales (lignes)
// // 2. Les stations (points) avec des popups d'information.

// import maplibregl from "maplibre-gl";
// import "../../shared/style.css";
// import "./style.css";
// import { createBaseMap } from "../../shared/map.js";

// const mapElement = document.querySelector("#map");

// // Couleur de chaque troncale, selon sa lettre (champ "le_troncal" du fichier).
// // Modifier une couleur ici suffit : le reste du code n'a pas à changer.
// const troncalColors = {
//   A: "#2c3b7b", //"#00398B", // Caracas
//   B: "#82b44e", //"#95B734", // Autopista Norte
//   C: "#f3b53d", //"#EABF3B", // Suba
//   D: "#6c6097", //"#7B6CA7", // Calle 80
//   E: "#886029", //"#9C6C0C", // NQS Central
//   F: "#ab262d", //"#BB0615", // Américas
//   G: "#2f8fc2", //"#3D9CD7", // NQS Sur
//   H: "#e9812c", //"#D88C00", // Caracas Sur
//   J: "#d2939a",// "#D0A2AA", // Eje Ambiental
//   K: "#b9a173", // "#CAB07C", // Calle 26
//   L: "#22938e", // "#00949C", // Carrera 10
//   M: "#22938e", // "#8A0079", // Carrera 7
//   Z: "#ab262d", //"#808080"  // Avenida Ciudad de Cali (couleur provisoire)
// };

// // Couleur utilisée quand une troncale n'est pas reconnue.
// const defaultLineColor = "#808080";

// // Lettre de troncale de chaque tracé (id_trazado -> le_troncal).
// // Cette table vient du fichier Trazados_Troncales_de_TRANSMILENIO.geojson.
// const troncalLetterByTrazadoId = {
//   TZ001: "A",
//   TZ002: "B",
//   TZ003: "C",
//   TZ004: "C",
//   TZ005: "D",
//   TZ006: "D",
//   TZ007: "E",
//   TZ008: "E",
//   TZ009: "F",
//   TZ010: "G",
//   TZ011: "G",
//   TZ012: "H",
//   TZ013: "H",
//   TZ014: "H",
//   TZ015: "J",
//   TZ016: "K",
//   TZ017: "K",
//   TZ018: "L",
//   TZ019: "M",
//   TZ020: "M",
//   TZ022: "Z",
//   TZ022A: "Z"
// };

// // Construit l'expression MapLibre qui associe chaque id_trazado à la couleur de sa troncale.
// // Elle sert aux lignes ET aux stations, pour qu'elles aient les mêmes couleurs.
// function buildTroncalColorExpression() {
//   const expression = ["match", ["get", "id_trazado"]];
//   for (const [trazadoId, letter] of Object.entries(troncalLetterByTrazadoId)) {
//     expression.push(trazadoId, troncalColors[letter]);
//   }
//   expression.push(defaultLineColor); // valeur par défaut, obligatoire en dernier
//   return expression;
// }

// // Ajoute les lignes des troncales sur la carte.
// function addTroncales(map) {
//   // Déclare la source de données GeoJSON contenant les tracés.
//   map.addSource("troncales", {
//     type: "geojson",
//     data: "/data/Trazados_Troncales_de_TRANSMILENIO.geojson"
//   });

//   // Ajoute la couche visuelle pour dessiner les lignes.
//   map.addLayer({
//     id: "troncales-lines",
//     type: "line",
//     source: "troncales",
//     paint: {
//       // Couleur de la troncale selon l'identifiant du tracé.
//       "line-color": buildTroncalColorExpression(),
//       // Ajuste l'épaisseur de la ligne selon le niveau de zoom.
//       "line-width": [
//         "interpolate",
//         ["linear"],
//         ["zoom"],
//         6, 2,
//         12, 5
//       ],
//       "line-opacity": 0.8
//     }
//   });
// }

// // Ajoute les stations sous forme de points cliquables.
// function addStations(map) {
//   // Déclare la source de données GeoJSON contenant les stations.
//   map.addSource("stations", {
//     type: "geojson",
//     data: "/data/Estaciones_Troncales_de_TRANSMILENIO.geojson"
//   });

//   // Affiche les stations comme des cercles.
//   map.addLayer({
//     id: "stations-points",
//     type: "circle",
//     source: "stations",
//     paint: {
//       // Les portails sont plus grands (rayon 8) que les stations classiques (rayon 5).
//       "circle-radius": [
//         "case",
//         ["==", ["slice", ["get", "nom_est"], 0, 6], "Portal"],
//         8,
//         5
//       ],
//       "circle-color": "#ffffff",
//       "circle-stroke-width": 2,
//       // Couleur du contour identique à la couleur de la troncale correspondante.
//       "circle-stroke-color": buildTroncalColorExpression()
//     }
//   });

//   // Ajoute les noms des portails sur la carte de manière permanente.
//   map.addLayer({
//     id: "portals-labels",
//     type: "symbol",
//     source: "stations",
//     // Ne filtre que les entités dont le nom commence par "Portal".
//     filter: ["==", ["slice", ["get", "nom_est"], 0, 6], "Portal"],
//     layout: {
//       "text-field": ["get", "nom_est"],
//       "text-size": 12,
//       "text-offset": [0, 1.5],
//       "text-anchor": "top"
//     },
//     paint: {
//       "text-color": "#000"
//     }
//   });

//   // Gestion du clic sur une station pour afficher les infos.
//   map.on("click", "stations-points", (e) => {
//     const feature = e.features[0];
//     new maplibregl.Popup()
//       .setLngLat(e.lngLat)
//       .setHTML(`
//         <strong>${feature.properties.nom_est}</strong><br>
//         Troncale: ${feature.properties.id_trazado}<br>
//         Adresse: ${feature.properties.ub_est}
//       `)
//       .addTo(map);
//   });

//   // Change le curseur en pointeur (la main) lorsqu'il survole une station.
//   map.on("mouseenter", "stations-points", () => map.getCanvas().style.cursor = "pointer");
//   map.on("mouseleave", "stations-points", () => map.getCanvas().style.cursor = "");
// }

// // Fonction principale qui initialise la carte et ajoute les couches.
// function createTransmilenioMap() {
//   const map = createBaseMap(mapElement);

//   map.on("load", () => {
//     addTroncales(map);
//     addStations(map);
//   });
// }

// if (mapElement) {
//   createTransmilenioMap();
// }