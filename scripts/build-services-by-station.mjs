// Ce script lit le GTFS de TransMilenio et produit, pour chaque station troncale,
// la liste des services (ex. H15, J74) qui s'y arrêtent.
// Usage : node scripts/build-services-by-station.mjs

import fs from "node:fs";
import readline from "node:readline";

// --- Réglages : chemins des fichiers ---
const gtfsFolder = "gtfs"; // dossier du GTFS décompressé
const stationsFile = "public/data/Estaciones_Troncales_de_TRANSMILENIO.geojson";
const outputFile = "public/data/servicios-por-estacion.json";

// Correspondances validées à la main : code de la station (cod_nodo) -> codes d'arrêts du GTFS
// dont les services sont ajoutés à cette station. Reste vide tant que rien n'est validé.
// Exemple : { "3011": ["54616", "54617"] }
const manualStopIdsByStation = {
  "4100": ["61497", "61492", "61491", "61496", "61498"], // Granja - Kr 77 (quais "Granja - Cra. 77 ...")
  "3011": ["90007"], // Suba - Calle 100 (station parente de 73599 et 73600)
  "5011": ["90009"], // Tibanica - Primavera
  "5010": ["90010"], // Los Laureles
  "5009": ["90011"], // Islandia
  "9000": ["90004"], // Portal Usme (contient aussi des services alimentateurs, ex. 3-2)
  "12003": ["61589", "61585", "61587", "61591"], // Ricaurte - CL 13 (quais D et E ; F-3 à vérifier)
  "9005": ["90008"] // Danubio (station parente de 4 quais : 73874 à 73877)
};

// Services vérifiés à la main sur les cartes officielles : ils REMPLACENT le résultat du GTFS.
// Clé = code de la station (cod_nodo), valeur = liste des services.
// Exemple : { "9120": ["C15", "H15", "K86"] }
const manualServicesByStation = {
  // Stations ouvertes, listes vérifiées à la main
  "4100": ["6", "B10", "D10", "D20", "D21", "D22", "D24", "G22", "H20", "H21", "J24"], // Granja - Kr 77
  "3011": ["7", "C17", "C19", "F19", "H17"], // Suba - Calle 100
  "12003": ["5", "A60", "F23", "F51", "F60", "J23", "M51"], // Ricaurte - CL 13
  "5011": ["A61", "F63", "G45", "G46"], // Tibanica - Primavera
  "5010": ["A61", "F63", "G45", "G46"], // Los Laureles
  "5009": ["A61", "F63", "G45", "G46"], // Islandia
  "9000": ["3", "8", "B75", "C17", "D20", "D21", "H17", "H20", "H21", "H54", "H72", "H75", "K54", "M83"], // Portal Usme
  "9005": ["3", "8", "B75", "C17", "D21", "H17", "H21", "H75"], // Danubio
  "7009": ["4", "B11", "G11", "G43", "G47", "K43", "M47"], // SENA

  // Stations temporaires ouvertes
  "9115": ["6", "8", "A60", "B18", "F60", "H13"], // Temporal Calle 34
  "14003": ["5", "F23", "F70", "J23", "J70", "J74"], // Temporal AV. Jiménez

  // Stations fermées : listes conservées pour mémoire, mais le popup affiche "Station fermée"
  "9109": ["1", "3", "8", "H13", "H15", "L10", "L18", "M47"], // Tercer Milenio
  "9108": ["3", "8", "B72", "H61", "H72", "L41"], // Hospital
  "9111": ["3", "8", "B74", "C15", "C19", "F19", "F62", "H15", "H74", "J74"], // Calle 19
  "9117": ["6", "8", "A60", "B18", "C15", "F60", "G11", "H15", "H21"], // Calle 45 - American School Way
  "9120": ["6", "8", "A60", "B18", "C15", "F60", "G11", "H15", "H21"], // Calle 63
  "9123": ["6", "8", "A61", "B13", "B18", "B27", "B74", "B75", "C15", "C17", "F61", "G11", "H13", "H17", "H27", "H75", "J74"] // Calle 76 - San Felipe
};

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

  // Table inverse des correspondances manuelles : arrêt GTFS -> code de la station.
  const stationCodeByManualStopId = new Map();
  for (const [stationCode, stopIds] of Object.entries(manualStopIdsByStation)) {
    for (const stopId of stopIds) {
      stationCodeByManualStopId.set(String(Number(stopId)), String(Number(stationCode)));
    }
  }

  // 5. Pour chaque station voulue, collecte les codes de service qui y passent.
  const servicesByStopId = new Map();
  await readCsv("stop_times.txt", (row) => {
    const platformId = String(Number(row.stop_id));
    const parentId = stationIdByStopId.get(platformId);
    // Priorité aux correspondances validées à la main, puis à la station parente du quai,
    // sinon on garde le code de l'arrêt lui-même.
    const stopId =
      stationCodeByManualStopId.get(platformId) ??
      stationCodeByManualStopId.get(parentId) ??
      parentId ??
      platformId;
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
    const manualServices = manualServicesByStation[station.cod_nodo];
    const services = servicesByStopId.get(String(Number(station.cod_nodo)));
    if (manualServices) {
      // Les services saisis à la main remplacent ceux du GTFS.
      result[station.cod_nodo] = manualServices;
    } else if (services) {
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

// // Ce script lit le GTFS de TransMilenio et produit, pour chaque station troncale,
// // la liste des services (ex. H15, J74) qui s'y arrêtent.
// // Usage : node scripts/build-services-by-station.mjs

// import fs from "node:fs";
// import readline from "node:readline";

// // --- Réglages : chemins des fichiers ---
// const gtfsFolder = "gtfs"; // dossier du GTFS décompressé
// const stationsFile = "public/data/Estaciones_Troncales_de_TRANSMILENIO.geojson";
// const outputFile = "public/data/servicios-por-estacion.json";

// // Correspondances validées à la main : code de la station (cod_nodo) -> codes d'arrêts du GTFS
// // dont les services sont ajoutés à cette station. Reste vide tant que rien n'est validé.
// // Exemple : { "3011": ["54616", "54617"] }
// const manualStopIdsByStation = {
//   "4100": ["61497", "61492", "61491", "61496", "61498"], // Granja - Kr 77 (quais "Granja - Cra. 77 ...")
//   "3011": ["90007"], // Suba - Calle 100 (station parente de 73599 et 73600)
//   "5011": ["90009"], // Tibanica - Primavera
//   "5010": ["90010"], // Los Laureles
//   "5009": ["90011"], // Islandia
//   "9000": ["90004"], // Portal Usme (contient aussi des services alimentateurs, ex. 3-2)
//   "12003": ["61589", "61585", "61587", "61591"] // Ricaurte - CL 13 (quais D et E ; F-3 à vérifier)
// };

// // Découpe une ligne CSV en colonnes, en gérant les valeurs entre guillemets.
// function parseCsvLine(line) {
//   const values = [];
//   let current = "";
//   let insideQuotes = false;
//   for (const char of line) {
//     if (char === '"') {
//       insideQuotes = !insideQuotes;
//     } else if (char === "," && !insideQuotes) {
//       values.push(current);
//       current = "";
//     } else {
//       current += char;
//     }
//   }
//   values.push(current);
//   return values;
// }

// // Lit un fichier CSV ligne par ligne (sans tout charger en mémoire).
// // Pour chaque ligne, appelle onRow avec un objet { nomDeColonne: valeur }.
// async function readCsv(fileName, onRow) {
//   const lines = readline.createInterface({
//     input: fs.createReadStream(`${gtfsFolder}/${fileName}`, { encoding: "utf8" }),
//     crlfDelay: Infinity
//   });

//   let columns = null; // la première ligne contient les noms des colonnes
//   for await (const rawLine of lines) {
//     const line = rawLine.replace(/^\uFEFF/, ""); // retire un éventuel marqueur invisible (BOM)
//     if (!line.trim()) continue;

//     const values = parseCsvLine(line);
//     if (!columns) {
//       columns = values;
//       continue;
//     }

//     const row = {};
//     columns.forEach((name, index) => {
//       row[name] = values[index];
//     });
//     onRow(row);
//   }
// }

// async function main() {
//   // 1. route_id -> code du service (ex. 10039 -> "M47")
//   const routeCodeById = new Map();
//   await readCsv("routes.txt", (row) => {
//     routeCodeById.set(row.route_id, row.route_short_name);
//   });

//   // 2. trip_id -> route_id (un trajet appartient à une ligne)
//   const routeIdByTrip = new Map();
//   await readCsv("trips.txt", (row) => {
//     routeIdByTrip.set(row.trip_id, row.route_id);
//   });

//   // 3. Quai -> station parente. Les bus sont enregistrés sur les quais (arrêts "enfants"),
//   // qui indiquent leur station dans la colonne parent_station.
//   const stationIdByStopId = new Map();
//   await readCsv("stops.txt", (row) => {
//     if (row.parent_station) {
//       stationIdByStopId.set(String(Number(row.stop_id)), String(Number(row.parent_station)));
//     }
//   });

//   // 4. Les stations qui nous intéressent (identifiant = cod_nodo, comparé au stop_id du GTFS).
//   const stationsGeojson = JSON.parse(fs.readFileSync(stationsFile, "utf8"));
//   const stations = stationsGeojson.features.map((feature) => feature.properties);
//   const wantedStopIds = new Set(stations.map((station) => String(Number(station.cod_nodo))));

//   // Table inverse des correspondances manuelles : arrêt GTFS -> code de la station.
//   const stationCodeByManualStopId = new Map();
//   for (const [stationCode, stopIds] of Object.entries(manualStopIdsByStation)) {
//     for (const stopId of stopIds) {
//       stationCodeByManualStopId.set(String(Number(stopId)), String(Number(stationCode)));
//     }
//   }

//   // 5. Pour chaque station voulue, collecte les codes de service qui y passent.
//   const servicesByStopId = new Map();
//   await readCsv("stop_times.txt", (row) => {
//     const platformId = String(Number(row.stop_id));
//     const parentId = stationIdByStopId.get(platformId);
//     // Priorité aux correspondances validées à la main, puis à la station parente du quai,
//     // sinon on garde le code de l'arrêt lui-même.
//     const stopId =
//       stationCodeByManualStopId.get(platformId) ??
//       stationCodeByManualStopId.get(parentId) ??
//       parentId ??
//       platformId;
//     if (!wantedStopIds.has(stopId)) return;

//     const code = routeCodeById.get(routeIdByTrip.get(row.trip_id));
//     if (!code) return;

//     if (!servicesByStopId.has(stopId)) servicesByStopId.set(stopId, new Set());
//     servicesByStopId.get(stopId).add(code);
//   });

//   // 6. Construit le résultat, clé = cod_nodo de la station.
//   const result = {};
//   const stationsWithoutServices = [];
//   for (const station of stations) {
//     const services = servicesByStopId.get(String(Number(station.cod_nodo)));
//     if (services) {
//       // Tri naturel : B2, B10, B16...
//       result[station.cod_nodo] = [...services].sort((a, b) =>
//         a.localeCompare(b, "es", { numeric: true })
//       );
//     } else {
//       stationsWithoutServices.push(station.nom_est);
//     }
//   }

//   fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

//   // Rapport pour vérifier que la jointure fonctionne.
//   console.log(`Stations dans le fichier : ${stations.length}`);
//   console.log(`Stations avec des services : ${Object.keys(result).length}`);
//   console.log(`Stations sans correspondance : ${stationsWithoutServices.length}`);
//   if (stationsWithoutServices.length > 0) {
//     console.log("Exemples :", stationsWithoutServices.slice(0, 10).join(", "));
//   }
//   console.log(`Fichier écrit : ${outputFile}`);
// }

// main();


// // // Ce script lit le GTFS de TransMilenio et produit, pour chaque station troncale,
// // // la liste des services (ex. H15, J74) qui s'y arrêtent.
// // // Usage : node scripts/build-services-by-station.mjs

// // import fs from "node:fs";
// // import readline from "node:readline";

// // // --- Réglages : chemins des fichiers ---
// // const gtfsFolder = "gtfs"; // dossier du GTFS décompressé
// // const stationsFile = "public/data/Estaciones_Troncales_de_TRANSMILENIO.geojson";
// // const outputFile = "public/data/servicios-por-estacion.json";

// // // Découpe une ligne CSV en colonnes, en gérant les valeurs entre guillemets.
// // function parseCsvLine(line) {
// //   const values = [];
// //   let current = "";
// //   let insideQuotes = false;
// //   for (const char of line) {
// //     if (char === '"') {
// //       insideQuotes = !insideQuotes;
// //     } else if (char === "," && !insideQuotes) {
// //       values.push(current);
// //       current = "";
// //     } else {
// //       current += char;
// //     }
// //   }
// //   values.push(current);
// //   return values;
// // }

// // // Lit un fichier CSV ligne par ligne (sans tout charger en mémoire).
// // // Pour chaque ligne, appelle onRow avec un objet { nomDeColonne: valeur }.
// // async function readCsv(fileName, onRow) {
// //   const lines = readline.createInterface({
// //     input: fs.createReadStream(`${gtfsFolder}/${fileName}`, { encoding: "utf8" }),
// //     crlfDelay: Infinity
// //   });

// //   let columns = null; // la première ligne contient les noms des colonnes
// //   for await (const rawLine of lines) {
// //     const line = rawLine.replace(/^\uFEFF/, ""); // retire un éventuel marqueur invisible (BOM)
// //     if (!line.trim()) continue;

// //     const values = parseCsvLine(line);
// //     if (!columns) {
// //       columns = values;
// //       continue;
// //     }

// //     const row = {};
// //     columns.forEach((name, index) => {
// //       row[name] = values[index];
// //     });
// //     onRow(row);
// //   }
// // }

// // async function main() {
// //   // 1. route_id -> code du service (ex. 10039 -> "M47")
// //   const routeCodeById = new Map();
// //   await readCsv("routes.txt", (row) => {
// //     routeCodeById.set(row.route_id, row.route_short_name);
// //   });

// //   // 2. trip_id -> route_id (un trajet appartient à une ligne)
// //   const routeIdByTrip = new Map();
// //   await readCsv("trips.txt", (row) => {
// //     routeIdByTrip.set(row.trip_id, row.route_id);
// //   });

// //   // 3. Quai -> station parente. Les bus sont enregistrés sur les quais (arrêts "enfants"),
// //   // qui indiquent leur station dans la colonne parent_station.
// //   const stationIdByStopId = new Map();
// //   await readCsv("stops.txt", (row) => {
// //     if (row.parent_station) {
// //       stationIdByStopId.set(String(Number(row.stop_id)), String(Number(row.parent_station)));
// //     }
// //   });

// //   // 4. Les stations qui nous intéressent (identifiant = cod_nodo, comparé au stop_id du GTFS).
// //   const stationsGeojson = JSON.parse(fs.readFileSync(stationsFile, "utf8"));
// //   const stations = stationsGeojson.features.map((feature) => feature.properties);
// //   const wantedStopIds = new Set(stations.map((station) => String(Number(station.cod_nodo))));

// //   // 5. Pour chaque station voulue, collecte les codes de service qui y passent.
// //   const servicesByStopId = new Map();
// //   await readCsv("stop_times.txt", (row) => {
// //     const platformId = String(Number(row.stop_id));
// //     // Si l'arrêt est un quai, on le rattache à sa station ; sinon on garde son code.
// //     const stopId = stationIdByStopId.get(platformId) ?? platformId;
// //     if (!wantedStopIds.has(stopId)) return;

// //     const code = routeCodeById.get(routeIdByTrip.get(row.trip_id));
// //     if (!code) return;

// //     if (!servicesByStopId.has(stopId)) servicesByStopId.set(stopId, new Set());
// //     servicesByStopId.get(stopId).add(code);
// //   });

// //   // 6. Construit le résultat, clé = cod_nodo de la station.
// //   const result = {};
// //   const stationsWithoutServices = [];
// //   for (const station of stations) {
// //     const services = servicesByStopId.get(String(Number(station.cod_nodo)));
// //     if (services) {
// //       // Tri naturel : B2, B10, B16...
// //       result[station.cod_nodo] = [...services].sort((a, b) =>
// //         a.localeCompare(b, "es", { numeric: true })
// //       );
// //     } else {
// //       stationsWithoutServices.push(station.nom_est);
// //     }
// //   }

// //   fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

// //   // Rapport pour vérifier que la jointure fonctionne.
// //   console.log(`Stations dans le fichier : ${stations.length}`);
// //   console.log(`Stations avec des services : ${Object.keys(result).length}`);
// //   console.log(`Stations sans correspondance : ${stationsWithoutServices.length}`);
// //   if (stationsWithoutServices.length > 0) {
// //     console.log("Exemples :", stationsWithoutServices.slice(0, 10).join(", "));
// //   }
// //   console.log(`Fichier écrit : ${outputFile}`);
// // }

// // main();
