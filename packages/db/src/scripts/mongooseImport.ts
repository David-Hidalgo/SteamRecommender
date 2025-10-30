import { file, inspect } from "bun";
import { client } from "../index";
import { Game as GameModel } from "../models/games.model";

// Tipos mínimos para la API de Steam
type SteamApp = { appid: number; name: string };
type AppDetailsData = { type?: string } & Record<string, unknown>;
type AppDetailsResponse = Record<
	string,
	{ success: boolean; data?: AppDetailsData }
>;

// --- CONFIGURACIÓN ---
const STEAM_API_URL = "https://api.steampowered.com/ISteamApps/GetAppList/v2/";
// --------------------

/**
 * Función principal que orquesta todo el proceso de importación.
 */
export const importarJuegosDeSteam = async () => {
	console.log("🚀 Iniciando la importación de juegos de Steam...");

	try {
		// 0. Probar conexión a MongoDB (ping) y hacer una query simple
		console.log("🔌 Probando conexión a MongoDB...");
		try {
			await client.command({ ping: 1 });
			const existing = await client
				.collection("game")
				.estimatedDocumentCount()
				.catch(() => 0);
			console.log(`✅ Conexión OK. Documentos actuales en 'game': ${existing}`);
		} catch (err) {
			console.error(
				"❌ No se pudo conectar a MongoDB. Revisa DATABASE_URL/DB_NAME y que el server esté activo:",
				err,
			);
			return;
		}

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

		//agarro unos juegos al azar para probar
		const cuantos = 30;
		console.log(
			`2. Filtrando y preparando ${cuantos} juegos para insertar en la base de datos...`,
		);
		for (let index = 0; index < cuantos; index++) {
			const appsArr = Array.from(aplicaciones);
			if (appsArr.length === 0) break;
			const randomIndex = Math.floor(Math.random() * appsArr.length);
			const app = appsArr[randomIndex];
			if (!app) continue;
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
			// console.log(inspect(data, { depth: 1, colors: true }));
			if (!data?.type || data.type !== "game") {
				console.log(`❌ El juego ${app.name} no es un juego válido.`);
				aplicaciones.delete(app);
				continue;
			}
			// Aquí podrías transformar y guardar los detalles del juego en la base de datos
			const nuevoJuego = new GameModel({
				appid: app.appid,
				name: app.name,
				data: data,
				// Agrega aquí los demás campos que necesites
			});
			await nuevoJuego.save();
			console.log(`✅ Juego guardado en la base de datos: ${app.name}`);
			aplicaciones.delete(app);
			file("./steam_apps.json").write(JSON.stringify(Array.from(aplicaciones)));
		}
	} catch (error: unknown) {
		if (error instanceof Error) {
			console.error("❌ Ocurrió un error durante el proceso:", error);
		} else {
			console.error("❌ Ocurrió un error durante el proceso:", error);
		}
	}
};
