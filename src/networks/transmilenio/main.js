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
// Ces couleurs sont celles du champ "color" des tracés de l'API de TransMilenio
// (api.buscador-rutas.transmilenio.gov.co, couche trazados_troncal).
// Modifier une couleur ici suffit : le reste du code n'a pas à changer.
const troncalColors = {
  A: "#26358C", // Caracas
  B: "#80BA27", // Autopista Norte
  C: "#FCBD1B", // Suba
  D: "#8064A9", // Calle 80
  E: "#AE6B00", // NQS Central
  F: "#DC0814", // Américas
  G: "#009CDE", // NQS Sur
  H: "#F18500", // Caracas Sur
  J: "#E1A2AC", // Eje Ambiental
  K: "#D5B079", // Calle 26
  L: "#009A9D", // Carrera 10
  M: "#009A9D", // Carrera 7 (même couleur que la Carrera 10 dans l'API)
  Z: "#BD202A"  // Avenida Ciudad de Cali
};

// Couleur utilisée quand une troncale n'est pas reconnue.
const defaultLineColor = "#808080";

// Stations fermées à cause des travaux du métro (code cod_nodo de la station).
// Pour fermer une station, ajoute son code ici ; pour la rouvrir, retire-le.
const closedStationCodes = [
  9109, // Tercer Milenio
  9108, // Hospital
  9111, // Calle 19
  9117, // Calle 45 - American School Way
  9120, // Calle 63
  9123  // Calle 76 - San Felipe
];

// Stations temporaires ouvertes pendant les travaux du métro (code cod_nodo).
const temporaryStationCodes = [
  9115,  // Temporal Calle 34
  14003  // Temporal AV. Jiménez - Inter Eléctricas
];

// Couleurs d'une station fermée : point gris clair, contour gris.
const closedStationFillColor = "#d1d5db";
const closedStationStrokeColor = "#9ca3af";

// Condition MapLibre : vraie quand le nom de la station commence par "Portal" (6 premières lettres).
const isPortalExpression = ["==", ["slice", ["get", "nom_est"], 0, 6], "Portal"];

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

// Fabrique le contenu du popup d'une station selon son état (fermée, temporaire ou ouverte).
// "properties" contient les champs de la station ; "services" est sa liste de services (ou undefined).
function buildStationPopupHtml(properties, services) {
  const stationCode = Number(properties.cod_nodo);
  const nameHtml = `<strong>${properties.nom_est}</strong>`;
  const addressHtml = `Adresse: ${properties.ub_est}`;

  // Station fermée : on n'affiche pas de services, puisque aucun bus ne s'y arrête.
  if (closedStationCodes.includes(stationCode)) {
    return `${nameHtml}<br>Station fermée (travaux du métro)<br>${addressHtml}`;
  }

  const temporaryHtml = temporaryStationCodes.includes(stationCode) ? " (station temporaire)" : "";
  const servicesHtml = services
    ? services.map(buildServiceBadge).join("")
    : "information non disponible";

  return `${nameHtml}${temporaryHtml}<br>Arrêt de : ${servicesHtml}<br>${addressHtml}`;
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
        12,
        8
      ],
      // Une station fermée est grisée, un portail est rempli de la couleur de sa troncale,
      // les autres stations sont blanches.
      "circle-color": [
        "case",
        ["in", ["get", "cod_nodo"], ["literal", closedStationCodes]],
        closedStationFillColor,
        isPortalExpression,
        buildTroncalColorExpression(),
        "#ffffff"
      ],
      "circle-stroke-width": 2,
      // Contour : gris pour une station fermée, sinon la couleur de la troncale.
      "circle-stroke-color": [
        "case",
        ["in", ["get", "cod_nodo"], ["literal", closedStationCodes]],
        closedStationStrokeColor,
        buildTroncalColorExpression()
      ]
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
    const services = servicesByStation[feature.properties.cod_nodo];

    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(buildStationPopupHtml(feature.properties, services))
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
// // Ces couleurs sont celles du champ "color" des tracés de l'API de TransMilenio
// // (api.buscador-rutas.transmilenio.gov.co, couche trazados_troncal).
// // Modifier une couleur ici suffit : le reste du code n'a pas à changer.
// const troncalColors = {
//   A: "#26358C", // Caracas
//   B: "#80BA27", // Autopista Norte
//   C: "#FCBD1B", // Suba
//   D: "#8064A9", // Calle 80
//   E: "#AE6B00", // NQS Central
//   F: "#DC0814", // Américas
//   G: "#009CDE", // NQS Sur
//   H: "#F18500", // Caracas Sur
//   J: "#E1A2AC", // Eje Ambiental
//   K: "#D5B079", // Calle 26
//   L: "#009A9D", // Carrera 10
//   M: "#009A9D", // Carrera 7 (même couleur que la Carrera 10 dans l'API)
//   Z: "#BD202A"  // Avenida Ciudad de Cali
// };

// // Couleur utilisée quand une troncale n'est pas reconnue.
// const defaultLineColor = "#808080";

// // Stations fermées à cause des travaux du métro (code cod_nodo de la station).
// // Pour fermer une station, ajoute son code ici ; pour la rouvrir, retire-le.
// const closedStationCodes = [
//   9109, // Tercer Milenio
//   9108, // Hospital
//   9111, // Calle 19
//   9117, // Calle 45 - American School Way
//   9120, // Calle 63
//   9123  // Calle 76 - San Felipe
// ];

// // Stations temporaires ouvertes pendant les travaux du métro (code cod_nodo).
// const temporaryStationCodes = [
//   9115,  // Temporal Calle 34
//   14003  // Temporal AV. Jiménez - Inter Eléctricas
// ];

// // Couleurs d'une station fermée : point gris clair, contour gris.
// const closedStationFillColor = "#d1d5db";
// const closedStationStrokeColor = "#9ca3af";

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

// // Choisit un texte noir ou blanc selon la luminosité du fond, pour rester lisible.
// function getReadableTextColor(hexColor) {
//   const red = parseInt(hexColor.slice(1, 3), 16);
//   const green = parseInt(hexColor.slice(3, 5), 16);
//   const blue = parseInt(hexColor.slice(5, 7), 16);
//   const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
//   return brightness > 150 ? "#000000" : "#ffffff";
// }

// // Fabrique le petit carré coloré d'un service (couleur selon la première lettre du code).
// function buildServiceBadge(serviceCode) {
//   const backgroundColor = troncalColors[serviceCode[0]] ?? defaultLineColor;
//   const textColor = getReadableTextColor(backgroundColor);
//   return `<span class="service-badge" style="background:${backgroundColor};color:${textColor}">${serviceCode}</span>`;
// }

// // Fabrique le contenu du popup d'une station selon son état (fermée, temporaire ou ouverte).
// // "properties" contient les champs de la station ; "services" est sa liste de services (ou undefined).
// function buildStationPopupHtml(properties, services) {
//   const stationCode = Number(properties.cod_nodo);
//   const nameHtml = `<strong>${properties.nom_est}</strong>`;
//   const addressHtml = `Adresse: ${properties.ub_est}`;

//   // Station fermée : on n'affiche pas de services, puisque aucun bus ne s'y arrête.
//   if (closedStationCodes.includes(stationCode)) {
//     return `${nameHtml}<br>Station fermée (travaux du métro)<br>${addressHtml}`;
//   }

//   const temporaryHtml = temporaryStationCodes.includes(stationCode) ? " (station temporaire)" : "";
//   const servicesHtml = services
//     ? services.map(buildServiceBadge).join("")
//     : "information non disponible";

//   return `${nameHtml}${temporaryHtml}<br>Arrêt de : ${servicesHtml}<br>${addressHtml}`;
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
//         12,
//         7
//       ],
//       // Une station fermée est grisée ; les autres sont blanches.
//       "circle-color": [
//         "case",
//         ["in", ["get", "cod_nodo"], ["literal", closedStationCodes]],
//         closedStationFillColor,
//         "#ffffff"
//       ],
//       "circle-stroke-width": 2,
//       // Contour : gris pour une station fermée, sinon la couleur de la troncale.
//       "circle-stroke-color": [
//         "case",
//         ["in", ["get", "cod_nodo"], ["literal", closedStationCodes]],
//         closedStationStrokeColor,
//         buildTroncalColorExpression()
//       ]
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
//     const services = servicesByStation[feature.properties.cod_nodo];

//     new maplibregl.Popup()
//       .setLngLat(e.lngLat)
//       .setHTML(buildStationPopupHtml(feature.properties, services))
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