// Diagnostic : pour chaque station restée sans services, que contient le GTFS ?
// À lancer après build-services-by-station.mjs.
// Usage : node scripts/diagnose-missing-stations.mjs

import fs from "node:fs";
import readline from "node:readline";

// --- Réglages : chemins des fichiers ---
const gtfsFolder = "gtfs";
const stationsFile = "public/data/Estaciones_Troncales_de_TRANSMILENIO.geojson";
const servicesFile = "public/data/servicios-por-estacion.json";

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

// Simplifie un nom pour le comparer (minuscules, sans accents ni ponctuation).
function normalizeName(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function main() {
  const stations = JSON.parse(fs.readFileSync(stationsFile, "utf8")).features.map(
    (feature) => feature.properties
  );
  const servicesByCode = JSON.parse(fs.readFileSync(servicesFile, "utf8"));
  const missingStations = stations.filter((station) => !servicesByCode[station.cod_nodo]);

  // Lit stops.txt : nom de chaque arrêt, et liste des quais de chaque station.
  const stopById = new Map();
  const platformsByStation = new Map();
  await readCsv("stops.txt", (row) => {
    const stopId = String(Number(row.stop_id));
    stopById.set(stopId, { name: row.stop_name, location_type: row.location_type });
    if (row.parent_station) {
      const parentId = String(Number(row.parent_station));
      if (!platformsByStation.has(parentId)) platformsByStation.set(parentId, []);
      platformsByStation.get(parentId).push(stopId);
    }
  });

  // Lit stop_times.txt : quels arrêts sont réellement desservis.
  const usedStopIds = new Set();
  await readCsv("stop_times.txt", (row) => {
    usedStopIds.add(String(Number(row.stop_id)));
  });

  console.log(`Stations sans services : ${missingStations.length}\n`);

  for (const station of missingStations) {
    const code = String(Number(station.cod_nodo));
    const platforms = platformsByStation.get(code) ?? [];
    const usedPlatforms = platforms.filter((id) => usedStopIds.has(id));

    console.log(`${station.nom_est} (code ${code})`);
    console.log(`  dans stops.txt : ${stopById.has(code) ? "oui" : "NON"}`);
    console.log(`  quais rattachés : ${platforms.length}, dont desservis : ${usedPlatforms.length}`);
    console.log(`  desservi directement : ${usedStopIds.has(code) ? "oui" : "non"}`);

    // Arrêts du GTFS dont le nom ressemble (utile si le code est absent).
    const wanted = normalizeName(station.nom_est);
    const similar = [...stopById]
      .filter(([, stop]) => {
        const name = normalizeName(stop.name);
        return name && (name.includes(wanted) || wanted.includes(name));
      })
      .slice(0, 3)
      .map(([id, stop]) => `${id} "${stop.name}"`);
    if (similar.length > 0) console.log(`  noms proches : ${similar.join(" ; ")}`);
    console.log("");
  }
}

main();
