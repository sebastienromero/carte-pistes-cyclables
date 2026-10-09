// Propose, pour chaque station restée sans services, des arrêts du GTFS candidats :
// proches de la station (distance), avec leur nom et les services qui y passent.
// C'est à toi de valider chaque proposition : rien n'est ajouté automatiquement.
// À lancer après build-services-by-station.mjs.
// Usage : node scripts/find-missing-stations.mjs

import fs from "node:fs";
import readline from "node:readline";

// --- Réglages ---
const gtfsFolder = "gtfs";
const stationsFile = "public/data/Estaciones_Troncales_de_TRANSMILENIO.geojson";
const servicesFile = "public/data/servicios-por-estacion.json";
const searchRadiusMeters = 200; // distance maximale entre la station et un arrêt candidat
const maxCandidatesPerStation = 6; // nombre de candidats affichés par station
const maxServicesShown = 12; // nombre de services affichés par candidat

// Découpe une ligne CSV en colonnes, en gérant les valeurs entre guillemets.
function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;
  for (const char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

// Lit un fichier CSV ligne par ligne et appelle onRow avec { colonne: valeur }.
async function readCsv(fileName, onRow) {
  const lines = readline.createInterface({
    input: fs.createReadStream(`${gtfsFolder}/${fileName}`, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  let columns = null;
  for await (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF/, "");
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    if (!columns) {
      columns = values;
      continue;
    }
    const row = {};
    columns.forEach((name, index) => {
      row[name] = values[index];
    });
    onRow(row);
  }
}

// Distance en mètres entre deux points (formule de haversine).
function distanceInMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

async function main() {
  // 1. Les stations restées sans services.
  const stations = JSON.parse(fs.readFileSync(stationsFile, "utf8")).features.map(
    (feature) => feature.properties
  );
  const servicesByCode = JSON.parse(fs.readFileSync(servicesFile, "utf8"));
  const missingStations = stations.filter((station) => !servicesByCode[station.cod_nodo]);

  // 2. Tous les arrêts du GTFS, avec leur position et leur station parente éventuelle.
  const allStops = [];
  const parentIdByStopId = new Map();
  await readCsv("stops.txt", (row) => {
    const stopId = String(Number(row.stop_id));
    allStops.push({
      id: stopId,
      name: row.stop_name,
      lat: Number(row.stop_lat),
      lon: Number(row.stop_lon)
    });
    if (row.parent_station) parentIdByStopId.set(stopId, String(Number(row.parent_station)));
  });

  // 3. Pour chaque station manquante, les arrêts situés dans le rayon de recherche.
  const nearbyStopsByStation = new Map();
  const candidateIds = new Set();
  for (const station of missingStations) {
    const nearbyStops = allStops
      .map((stop) => ({
        ...stop,
        distance: distanceInMeters(station.latitud, station.longitud, stop.lat, stop.lon)
      }))
      .filter((stop) => stop.distance <= searchRadiusMeters)
      .sort((a, b) => a.distance - b.distance);
    nearbyStopsByStation.set(station.cod_nodo, nearbyStops);
    nearbyStops.forEach((stop) => candidateIds.add(stop.id));
  }

  // 4. Codes de service de chaque ligne (routes.txt et trips.txt).
  const routeCodeById = new Map();
  await readCsv("routes.txt", (row) => {
    routeCodeById.set(row.route_id, row.route_short_name);
  });
  const routeIdByTrip = new Map();
  await readCsv("trips.txt", (row) => {
    routeIdByTrip.set(row.trip_id, row.route_id);
  });

  // 5. Services qui passent par chaque arrêt candidat (le quai compte pour sa station parente).
  const servicesByStopId = new Map();
  await readCsv("stop_times.txt", (row) => {
    const platformId = String(Number(row.stop_id));
    const parentId = parentIdByStopId.get(platformId);
    const concernedIds = [platformId, parentId].filter((id) => id && candidateIds.has(id));
    if (concernedIds.length === 0) return;

    const code = routeCodeById.get(routeIdByTrip.get(row.trip_id));
    if (!code) return;
    for (const id of concernedIds) {
      if (!servicesByStopId.has(id)) servicesByStopId.set(id, new Set());
      servicesByStopId.get(id).add(code);
    }
  });

  // 6. Affichage des candidats, à valider à la main.
  console.log(`Stations sans services : ${missingStations.length}`);
  console.log(`Rayon de recherche : ${searchRadiusMeters} m\n`);

  for (const station of missingStations) {
    console.log(`${station.nom_est} (code ${station.cod_nodo})`);

    const candidates = nearbyStopsByStation
      .get(station.cod_nodo)
      .filter((stop) => servicesByStopId.has(stop.id))
      .slice(0, maxCandidatesPerStation);

    if (candidates.length === 0) {
      console.log("  aucun arrêt desservi à proximité\n");
      continue;
    }

    for (const stop of candidates) {
      const services = [...servicesByStopId.get(stop.id)].sort((a, b) =>
        a.localeCompare(b, "es", { numeric: true })
      );
      // Indice (pas une preuve) : les services troncaux ont un code du type B16, H15...
      const troncalLike = services.filter((code) => /^[A-Z]\d{1,2}$/.test(code)).length;
      console.log(
        `  ${stop.id} "${stop.name}" à ${Math.round(stop.distance)} m, ` +
          `${services.length} services (type troncal : ${troncalLike})`
      );
      console.log(`      ${services.slice(0, maxServicesShown).join(", ")}`);
    }
    console.log("");
  }
}

main();
