import { Game } from "../models/games.model";
import { ensureGameEmbedding, ensureGameVectorIndex } from "../vector-search";

const BATCH_SIZE = Number(process.env.EMBEDDING_BACKFILL_BATCH_SIZE || "25");
const DELAY_MS = Number(process.env.EMBEDDING_BACKFILL_DELAY_MS || "200");

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const main = async () => {
	console.log("[vector-backfill] Iniciando generación de embeddings para juegos sin vector...");
	await ensureGameVectorIndex();

	const cursor = Game.find({
		$or: [
			{ embedding: { $exists: false } },
			{ embedding: { $size: 0 } },
		],
	})
		.select("_id appid name data embedding")
		.lean()
		.cursor();

	let processed = 0;
	let updated = 0;

	for await (const game of cursor) {
		processed += 1;
		const label = typeof game.appid === "number" ? game.appid : String(game._id);
		try {
			const result = await ensureGameEmbedding(game);
			if (result?.vector?.length) {
				updated += 1;
				console.log(`[vector-backfill] Juego ${label} actualizado`);
			}
		} catch (error) {
			console.error(`[vector-backfill] Error al generar embedding para ${label}:`, error);
		}
		if (DELAY_MS > 0) {
			await sleep(DELAY_MS);
		}
		if (BATCH_SIZE > 0 && processed % BATCH_SIZE === 0) {
			console.log(`[vector-backfill] Progreso: procesados=${processed} actualizados=${updated}`);
		}
	}

	console.log(`[vector-backfill] Finalizado. Procesados=${processed} actualizados=${updated}`);
	process.exit(0);
};

void main().catch((error) => {
	console.error("[vector-backfill] Error fatal", error);
	process.exit(1);
});
