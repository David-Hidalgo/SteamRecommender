import { inspect } from "bun";
// --- CONFIGURACIÓN ---
const STEAM_API_URL = 'https://api.steampowered.com/ISteamApps/GetAppList/v2/';
const DB_NAME = 'recomendador_juegos';
// --------------------

/**
 * Función principal que orquesta todo el proceso de importación.
 */
async function importarJuegosDeSteam() {
    console.log('🚀 Iniciando la importación de juegos de Steam...');

    try {
        // 1. OBTENER DATOS DE LA API DE STEAM
        console.log('1. Descargando lista de aplicaciones desde la API de Steam...');
        const respuesta = await fetch(STEAM_API_URL);
		console.log(respuesta);
		if (!respuesta.ok) {
			throw new Error(`HTTP ${respuesta.status} - ${respuesta.statusText}`);
		}
		const data: any= await respuesta.json();
		console.log(data);

        const aplicaciones:Array<any> = data.applist.apps;
        console.log(`✅ Se encontraron ${aplicaciones.length} aplicaciones en total.`);

        // 2. FILTRAR Y TRANSFORMAR LOS DATOS
        // La API de Steam devuelve TODO (software, DLCs, demos, etc.).
        // Filtramos para quedarnos solo con las que tienen un nombre, que suelen ser los juegos.
        const juegosParaInsertar = 
		aplicaciones.filter(app => app.name && app.name.trim() !== '') // Nos aseguramos de que tenga nombre
        if (juegosParaInsertar.length === 0) {
            console.log('No se encontraron juegos para insertar. Proceso terminado.');
            return;
        }
		//agarro unos juegos al azar para probar
		const cuantos = 10;
		console.log(`2. Filtrando y preparando ${cuantos} juegos para insertar en la base de datos...`);
		for (let index = 0; index < cuantos; index++) {
			
			const randomIndex = Math.floor(Math.random() * juegosParaInsertar.length);

			const element = juegosParaInsertar[randomIndex];
			console.log(`🎮 Preparando juego: ID ${element.appid} - Nombre: ${element.name}`);
			// hace fetch a la api de steam para obtener mas datos del juego
			const detallesRespuesta = await fetch(`https://store.steampowered.com/api/appdetails?appids=${element.appid}`);
			if (!detallesRespuesta.ok) {
				throw new Error(`HTTP ${detallesRespuesta.status} - ${detallesRespuesta.statusText}`);
			}
			const detallesData: any = await detallesRespuesta.json();
			const detalles = detallesData[element.appid]?.data;
			console.log(inspect(detallesData, { depth: 5 ,colors:true}));

		}
		
		
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('❌ Ocurrió un error durante el proceso:', error.message);
        } else {
            console.error('❌ Ocurrió un error durante el proceso:', error);
        }
    }
}

// Ejecutamos la función principal
importarJuegosDeSteam();


console.log("Colección 'Juegos' creada con éxito.");