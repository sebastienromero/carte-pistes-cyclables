import maplibregl from "maplibre-gl";
import "../../shared/style.css";
import "./style.css";
import { createBaseMap } from "../../shared/map.js";

const mapElement = document.querySelector("#map");

// Palette provisoire pour les troncales
const troncalColors = {
  "TZ002": "#FF5733", // Autopista Norte
  "TZ008": "#33FF57", // NQS Central
  "TZ009": "#3357FF", // Americas
  "TZ015": "#F333FF", // Eje Ambiental
  "TZ018": "#FF33A8", // Carrera 10
  "default": "#808080"
};

function addTroncales(map) {
  map.addSource("troncales", {
    type: "geojson",
    data: "/data/Trazados_Troncales_de_TRANSMILENIO.geojson"
  });

  map.addLayer({
    id: "troncales-lines",
    type: "line",
    source: "troncales",
    paint: {
      "line-color": [
        "match",
        ["get", "id_trazado"],
        "TZ002", troncalColors["TZ002"],
        "TZ008", troncalColors["TZ008"],
        "TZ009", troncalColors["TZ009"],
        "TZ015", troncalColors["TZ015"],
        "TZ018", troncalColors["TZ018"],
        troncalColors["default"]
      ],
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

function addStations(map) {
  map.addSource("stations", {
    type: "geojson",
    data: "/data/Estaciones_Troncales_de_TRANSMILENIO.geojson"
  });

  // Points des stations
  map.addLayer({
    id: "stations-points",
    type: "circle",
    source: "stations",
    paint: {
      "circle-radius": [
        "case",
        ["==", ["slice", ["get", "nom_est"], 0, 6], "Portal"],
        8,
        5
      ],
      "circle-color": "#ffffff",
      "circle-stroke-width": 2,
      "circle-stroke-color": [
        "match",
        ["get", "id_trazado"],
        "TZ002", troncalColors["TZ002"],
        "TZ008", troncalColors["TZ008"],
        "TZ009", troncalColors["TZ009"],
        "TZ015", troncalColors["TZ015"],
        "TZ018", troncalColors["TZ018"],
        troncalColors["default"]
      ]
    }
  });

  // Noms des portails (toujours visibles)
  map.addLayer({
    id: "portals-labels",
    type: "symbol",
    source: "stations",
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

  // Popup au clic
  map.on("click", "stations-points", (e) => {
    const feature = e.features[0];
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <strong>${feature.properties.nom_est}</strong><br>
        Troncale: ${feature.properties.id_trazado}<br>
        Adresse: ${feature.properties.ub_est}
      `)
      .addTo(map);
  });

  // Curseur interactif
  map.on("mouseenter", "stations-points", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "stations-points", () => map.getCanvas().style.cursor = "");
}

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
