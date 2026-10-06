// Ce script lit le GTFS de TransMilenio et produit, pour chaque station troncale,
// la liste des services (ex. H15, J74) qui s'y arrêtent.
// Usage : node scripts/build-services-by-station.mjs

import fs from "node:fs";
import readline from "node:readline";

// --- Réglages : chemins des fichiers ---
const gtfsFolder = "gtfs"; // dossier du GTFS décompressé
const stationsFile = "public/data/Estaciones_Troncales_de_TRANSMILENIO.geojson";
const outputFile = "public/data/servicios-por-estacion.json";

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

// Lit un fichier CSV ligne par ligne (sans tout charger en mémoire).
// Pour chaque ligne, appelle onRow avec un objet { nomDeColonne: valeur }.
async function readCsv(fileName, onRow) {
  const lines = readline.createInterface({
    input: fs.createReadStream(`${gtfsFolder}/${fileName}`, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  let columns = null; // la première ligne contient les noms des colonnes
  for await (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF/, ""); // retire un éventuel marqueur invisible (BOM)
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

async function main() {
  // 1. route_id -> code du service (ex. 10039 -> "M47")
  const routeCodeById = new Map();
  await readCsv("routes.txt", (row) => {
    routeCodeById.set(row.route_id, row.route_short_name);
  });

  // 2. trip_id -> route_id (un trajet appartient à une ligne)
  const routeIdByTrip = new Map();
  await readCsv("trips.txt", (row) => {
    routeIdByTrip.set(row.trip_id, row.route_id);
  });

  // 3. Quai -> station parente. Les bus sont enregistrés sur les quais (arrêts "enfants"),
  // qui indiquent leur station dans la colonne parent_station.
  const stationIdByStopId = new Map();
  await readCsv("stops.txt", (row) => {
    if (row.parent_station) {
      stationIdByStopId.set(String(Number(row.stop_id)), String(Number(row.parent_station)));
    }
  });

  // 4. Les stations qui nous intéressent (identifiant = cod_nodo, comparé au stop_id du GTFS).
  const stationsGeojson = JSON.parse(fs.readFileSync(stationsFile, "utf8"));
  const stations = stationsGeojson.features.map((feature) => feature.properties);
  const wantedStopIds = new Set(stations.map((station) => String(Number(station.cod_nodo))));

  // 5. Pour chaque station voulue, collecte les codes de service qui y passent.
  const servicesByStopId = new Map();
  await readCsv("stop_times.txt", (row) => {
    const platformId = String(Number(row.stop_id));
    // Si l'arrêt est un quai, on le rattache à sa station ; sinon on garde son code.
    const stopId = stationIdByStopId.get(platformId) ?? platformId;
    if (!wantedStopIds.has(stopId)) return;

    const code = routeCodeById.get(routeIdByTrip.get(row.trip_id));
    if (!code) return;

    if (!servicesByStopId.has(stopId)) servicesByStopId.set(stopId, new Set());
    servicesByStopId.get(stopId).add(code);
  });

  // 6. Construit le résultat, clé = cod_nodo de la station.
  const result = {};
  const stationsWithoutServices = [];
  for (const station of stations) {
    const services = servicesByStopId.get(String(Number(station.cod_nodo)));
    if (services) {
      // Tri naturel : B2, B10, B16...
      result[station.cod_nodo] = [...services].sort((a, b) =>
        a.localeCompare(b, "es", { numeric: true })
      );
    } else {
      stationsWithoutServices.push(station.nom_est);
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

  // Rapport pour vérifier que la jointure fonctionne.
  console.log(`Stations dans le fichier : ${stations.length}`);
  console.log(`Stations avec des services : ${Object.keys(result).length}`);
  console.log(`Stations sans correspondance : ${stationsWithoutServices.length}`);
  if (stationsWithoutServices.length > 0) {
    console.log("Exemples :", stationsWithoutServices.slice(0, 10).join(", "));
  }
  console.log(`Fichier écrit : ${outputFile}`);
}

main();
