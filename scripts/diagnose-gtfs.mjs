// Diagnostic : vérifie si les codes des stations (cod_nodo) existent dans le GTFS.
// Usage : node scripts/diagnose-gtfs.mjs

import fs from "node:fs";
import readline from "node:readline";

// --- Réglages : chemins des fichiers ---
const gtfsFolder = "/Users/sromero/Documents/Code/Projets-velo/Cartes-Bogota/gtfs";
const stationsFile = "public/data/Estaciones_Troncales_de_TRANSMILENIO.geojson";

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
  const stationNameByCode = new Map(
    stations.map((station) => [String(Number(station.cod_nodo)), station.nom_est])
  );

  // A. Les codes des stations existent-ils dans stops.txt ?
  const stopNameById = new Map();
  await readCsv("stops.txt", (row) => {
    stopNameById.set(String(Number(row.stop_id)), row.stop_name);
  });
  let foundInStops = 0;
  const examples = [];
  for (const [code, stationName] of stationNameByCode) {
    if (stopNameById.has(code)) {
      foundInStops++;
      if (examples.length < 5) {
        examples.push(`${code} : station "${stationName}" / GTFS "${stopNameById.get(code)}"`);
      }
    }
  }
  console.log(`A. Codes de stations présents dans stops.txt : ${foundInStops} sur ${stationNameByCode.size}`);
  examples.forEach((example) => console.log("   ", example));

  // B. Les codes des stations existent-ils dans stop_times.txt ?
  const stopIdsInTimes = new Set();
  let rowCount = 0;
  await readCsv("stop_times.txt", (row) => {
    rowCount++;
    stopIdsInTimes.add(String(Number(row.stop_id)));
  });
  let foundInTimes = 0;
  for (const code of stationNameByCode.keys()) {
    if (stopIdsInTimes.has(code)) foundInTimes++;
  }
  console.log(`B. Codes de stations présents dans stop_times.txt : ${foundInTimes} sur ${stationNameByCode.size}`);
  console.log(`   stop_times.txt : ${rowCount} lignes, ${stopIdsInTimes.size} arrêts différents`);

  // C. Arrêts du GTFS dont le NOM ressemble à celui d'une station.
  const stationNames = new Set([...stationNameByCode.values()].map(normalizeName));
  const nameMatches = [];
  for (const [stopId, stopName] of stopNameById) {
    if (stationNames.has(normalizeName(stopName))) nameMatches.push([stopId, stopName]);
  }
  console.log(`C. Arrêts de stops.txt dont le nom correspond à une station : ${nameMatches.length}`);
  nameMatches.slice(0, 8).forEach(([stopId, stopName]) => {
    const used = stopIdsInTimes.has(stopId) ? "oui" : "non";
    console.log(`    stop_id=${stopId} "${stopName}" (utilisé dans stop_times : ${used})`);
  });
}

main();
