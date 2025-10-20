import { file, inspect } from "bun";
import { client } from "../index";

// Tipos mínimos para la API de Steam
type SteamApp = { appid: number; name: string };
type AppDetailsData = { type?: string } & Record<string, unknown>;
type AppDetailsResponse = Record<string, { success: boolean; data?: AppDetailsData }>;

// --- CONFIGURACIÓN ---
const STEAM_API_URL = "https://api.steampowered.com/ISteamApps/GetAppList/v2/";
// --------------------

/**
 * Función principal que orquesta todo el proceso de importación.
 */
async function importarJuegosDeSteam() {
	console.log("🚀 Iniciando la importación de juegos de Steam...");

	try {
	    let aplicaciones: Set<SteamApp>;
		const fileExists = await file("./steam_apps.json").exists();
		if (fileExists) {
		    const arr = (await file("./steam_apps.json").json()) as SteamApp[];
		    aplicaciones = new Set<SteamApp>(arr);
		} else {
			// 1. OBTENER DATOS DE LA API DE STEAM
			console.log(
				"1. Descargando lista de aplicaciones desde la API de Steam...",
			);
			const respuesta = await fetch(STEAM_API_URL);
			console.log(respuesta);
			if (!respuesta.ok) {
				throw new Error(`HTTP ${respuesta.status} - ${respuesta.statusText}`);
			}
			const data = (await respuesta.json()) as {
				applist: { apps: SteamApp[] };
			};
			console.log(data);

			aplicaciones = new Set(data.applist.apps);
			// 2. FILTRAR Y TRANSFORMAR LOS DATOS
			// La API de Steam devuelve TODO (software, DLCs, demos, etc.).
			// Filtramos para quedarnos solo con las que tienen un nombre, que suelen ser los juegos.
			// Eliminar del Set todas las apps sin nombre
			for (const app of Array.from(aplicaciones)) {
				if (!app.name || app.name.trim() === "") {
					aplicaciones.delete(app);
				}
			}
		}
		console.log(
			`✅ Se encontraron ${aplicaciones.size} aplicaciones en total.`,
		);

		// Usar cliente nativo de Mongo para operar con la colección
		const collection = client.collection("game");
		await collection.createIndex({ appid: 1 }, { unique: true }).catch(() => {
			// índice ya existe o condición de carrera; ignoramos
		});

		//agarro unos juegos al azar para probar
		const cuantos = 10;
		console.log(
			`2. Filtrando y preparando ${cuantos} juegos para insertar en la base de datos...`,
		);
		for (let index = 0; index < cuantos; index++) {
			const appsArr = Array.from(aplicaciones);
			if (appsArr.length === 0) {
				break;
			}
			const randomIndex = Math.floor(Math.random() * appsArr.length);
			const app = appsArr[randomIndex];
			if (!app) {
				continue;
			}
			console.log(`🎮 Preparando juego: ID ${app.appid} - Nombre: ${app.name}`);
			// hace fetch a la api de steam para obtener mas datos del juego
			const respuesta = await fetch(
				`https://store.steampowered.com/api/appdetails?appids=${app.appid}`,
			);
			if (!respuesta.ok) {
				throw new Error(`HTTP ${respuesta.status} - ${respuesta.statusText}`);
			}
			const detallesData = (await respuesta.json()) as AppDetailsResponse;
			const data = detallesData[String(app.appid)]?.data;
			console.log(inspect(detallesData, { depth: 5, colors: true }));
			if (!data?.type || data.type !== "game") {
				console.log(`❌ El juego ${app.name} no es un juego válido.`);
				aplicaciones.delete(app);
				await file("./steam_apps.json").write(
					JSON.stringify(Array.from(aplicaciones)),
				);
				continue;
			}
			// Guardar/actualizar con cliente nativo (upsert)
			await collection.updateOne(
				{ appid: app.appid },
				{ $set: { name: app.name, data }, $setOnInsert: { appid: app.appid } },
				{ upsert: true },
			);
			console.log(`✅ Juego insertado/actualizado: ${app.name}`);
			aplicaciones.delete(app);
			await file("./steam_apps.json").write(
				JSON.stringify(Array.from(aplicaciones)),
			);
		}
	} catch (error: unknown) {
		if (error instanceof Error) {
			console.error("❌ Ocurrió un error durante el proceso:", error);
		} else {
			console.error("❌ Ocurrió un error durante el proceso:", error);
		}
	}
}

// Ejecutamos la función principal
importarJuegosDeSteam();

console.log("Colección 'Juegos' creada con éxito.");
