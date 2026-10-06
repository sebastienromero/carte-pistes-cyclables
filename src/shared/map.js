// Ce module crée le fond de carte commun et ses contrôles MapLibre.
// Chaque page de réseau l'appelle avec son élément HTML de carte.

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// L'URL du style libre et le centre initial restent identiques aux cartes actuelles.
const baseMapStyleUrl = "https://tiles.openfreemap.org/styles/liberty";
const bogotaCenter = [-74.0721, 4.6486]; // Coordonnées longitude, latitude de Bogotá.
const initialZoom = 11.5;

// Crée un fond de carte avec les contrôles, le centrage et les crédits communs.
export function createBaseMap(mapElement) {
  const map = new maplibregl.Map({
    container: mapElement, // Élément HTML dans lequel MapLibre dessine la carte.
    style: baseMapStyleUrl, // Style visuel libre utilisé comme fond de carte.
    center: bogotaCenter, // Centre initial partagé par les cartes du projet.
    zoom: initialZoom, // Niveau de zoom initial; un nombre plus grand rapproche la vue.
    attributionControl: { compact: true } // Affiche les crédits obligatoires du fond cartographique.
  });

  // Bouton retour accueil
  const backButton = document.createElement("button");
  backButton.innerHTML = "← Accueil";
  backButton.style.position = "absolute";
  backButton.style.top = "10px";
  backButton.style.left = "10px";
  backButton.style.zIndex = "1";
  backButton.style.padding = "10px";
  backButton.style.cursor = "pointer";
  backButton.onclick = () => window.location.href = "/";
  mapElement.parentElement.appendChild(backButton);

  // Ajoute les boutons de zoom et de déplacement dans le coin supérieur droit.
  map.addControl(new maplibregl.NavigationControl(), "top-right");

  // Ajoute le bouton qui centre la carte sur la position actuelle de l'utilisateur.
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true }, // Demande la position la plus précise au navigateur.
      trackUserLocation: true, // Continue de suivre l'utilisateur lorsqu'il se déplace.
      showUserHeading: true // Affiche la direction vers laquelle l'utilisateur regarde.
    }),
    "top-right" // Place le bouton sous les autres contrôles.
  );

  // Referme le bouton compact des crédits après le chargement de la carte.
  map.on("idle", () => {
    const attribution = mapElement.querySelector(".maplibregl-ctrl-attrib");
    if (!attribution) return;
    attribution.removeAttribute("open");
    attribution.classList.remove("maplibregl-compact-show");
  });

  return map; // Laisse chaque réseau ajouter ensuite ses propres sources et couches.
}
