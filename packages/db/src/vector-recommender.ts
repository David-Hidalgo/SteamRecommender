import { inspect } from "bun";
import mongoose from "mongoose";
import { client } from "./index";
import { User } from "./models/auth.model";
import { Game, type GameType } from "./models/games.model";
import { getEmbedding } from "./scripts/get-embeddings";
import { ensureGameEmbedding } from "./vector-search";

export type GameRecommendation = {
	_id: string;
	appid?: number;
	name?: string;
	score: number;
	capsule?: string;
	release_date?: unknown;
	vectorIndex: string;
};

const DEFAULT_VECTOR_INDEX_NAME = "vector_index";
const MIN_USER_RATING = 10;

const vectorSearchPipeline = (
	vector: number[],
	options: Partial<{
		limit: number;
		numCandidates: number;
		filter: Record<string, unknown>;
		indexName?: string;
	}>,
) => {
	const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
	const numCandidates = Math.min(
		Math.max(options.numCandidates ?? limit * 10, limit),
		2000,
	);
	const indexName = options.indexName ?? DEFAULT_VECTOR_INDEX_NAME;
	return [
		{
			$vectorSearch: {
				index: indexName,
				path: "embedding",
				queryVector: vector,
				numCandidates,
				limit,
				...(options.filter ? { filter: options.filter } : {}),
			},
		},
		{
			$project: {
				_id: 1,
				appid: 1,
				name: 1,
				score: { $meta: "vectorSearchScore" },
				capsule: "$data.capsule_image",
				release_date: "$data.release_date",
			},
		},
	];
};

const mapRecommendation = (doc: any): GameRecommendation => ({
	_id: String(doc._id),
	appid: typeof doc.appid === "number" ? doc.appid : undefined,
	name: doc.name ?? undefined,
	score: typeof doc.score === "number" ? doc.score : Number(doc.score ?? 0),
	capsule: doc.capsule ?? undefined,
	release_date: doc.release_date ?? undefined,
	vectorIndex: doc.vectorIndex ?? "",
});

export const recomendador = async (
	text: string,
	limite = 5,
): Promise<GameRecommendation[]> => {
	const collection = client.collection("game");

	// Generate embedding for the search query
	const queryEmbedding = await getEmbedding(text);

	// Define the sample vector search pipeline (usando índice por defecto)
	const pipeline = [
		{
			$vectorSearch: {
				index: DEFAULT_VECTOR_INDEX_NAME,
				queryVector: queryEmbedding,
				path: "embedding",
				exact: true,
				limit: limite,
			},
		},
		{
			$project: {
				_id: 1,
				appid: 1,
				name: 1,
				score: { $meta: "vectorSearchScore" },
				capsule: "$data.capsule_image",
				release_date: "$data.release_date",
				vectorIndex: "$data.vectorIndex",
			},
		},
	];

	// run pipeline y devolver resultados mapeados
	const docs = await collection.aggregate(pipeline).toArray();
	return docs.map(mapRecommendation);
};
const vectorFilter = (
	options: Partial<{
		excludeIds: (mongoose.Types.ObjectId | string)[];
		excludeAppIds: number[];
		baseFilter: Record<string, unknown>;
	}>,
): Record<string, unknown> | undefined => {
	const clauses: Record<string, unknown>[] = [];
	if (options.baseFilter && Object.keys(options.baseFilter).length > 0) {
		clauses.push(options.baseFilter);
	}
	if (options.excludeIds && options.excludeIds.length > 0) {
		clauses.push({
			_id: {
				$nin: options.excludeIds.map((id) =>
					id instanceof mongoose.Types.ObjectId
						? id
						: new mongoose.Types.ObjectId(String(id)),
				),
			},
		});
	}
	if (options.excludeAppIds && options.excludeAppIds.length > 0) {
		clauses.push({ appid: { $nin: options.excludeAppIds } });
	}
	if (clauses.length === 0) return undefined;
	if (clauses.length === 1) return clauses[0];
	return { $and: clauses };
};

// ...existing code...
export const recommendSimilarGamesByVector = async (params: {
	vector: number[];
	limit?: number;
	numCandidates?: number;
	excludeIds?: (mongoose.Types.ObjectId | string)[];
	excludeAppIds?: number[];
	baseFilter?: Record<string, unknown>;
}): Promise<GameRecommendation[]> => {
	if (!Array.isArray(params.vector) || params.vector.length === 0) {
		return [];
	}
	const pipeline = vectorSearchPipeline(params.vector, {
		limit: params.limit,
		numCandidates: params.numCandidates,
		filter: vectorFilter({
			excludeIds: params.excludeIds,
			excludeAppIds: params.excludeAppIds,
			baseFilter: params.baseFilter,
		}),
	});
	const docs = await client.collection("game").aggregate(pipeline).toArray();
	return docs.map(mapRecommendation);
};

const resolveGameFilter = (identifier: unknown) => {
	if (identifier instanceof mongoose.Types.ObjectId) return { _id: identifier };
	if (typeof identifier === "number") return { appid: identifier };
	if (typeof identifier === "string") {
		if (mongoose.Types.ObjectId.isValid(identifier)) {
			return { _id: new mongoose.Types.ObjectId(identifier) };
		}
		const numeric = Number(identifier);
		if (!Number.isNaN(numeric)) return { appid: numeric };
	}
	return null;
};
// ...existing code...
export const recommendSimilarGamesForApp = async (params: {
	gameId?: string;
	appid?: number | string;
	limit?: number;
	numCandidates?: number;
	autoGenerateIfMissing?: boolean;
}): Promise<GameRecommendation[]> => {
	const target = await Game.findOne(
		params.gameId
			? (resolveGameFilter(params.gameId) ?? undefined)
			: { appid: Number(params.appid) },
	)
		.select("_id appid name data embedding embeddingModel embeddingUpdatedAt")
		.lean()
		.exec();
	if (!target) return [];
	console.log(target);

	let vector =
		Array.isArray(target.embedding) && target.embedding.length > 0
			? target.embedding
			: null;
	if (!vector && params.autoGenerateIfMissing !== false) {
		const ensured = await ensureGameEmbedding(
			target as GameType & { _id: mongoose.Types.ObjectId },
		);
		vector = ensured?.vector ?? null;
	}
	if (!vector) {
		throw new Error(
			`El juego ${
				target.name ?? target._id
			} no tiene embedding generado. Ejecuta el script de backfill o configura GEMINI_API_KEY.`,
		);
	}
	return recommendSimilarGamesByVector({
		vector,
		limit: params.limit,
		numCandidates: params.numCandidates,
		excludeIds: [target._id],
		excludeAppIds:
			typeof target.appid === "number" ? [target.appid] : undefined,
	});
};

// ...existing code...
export const recommendSimilarGamesForUser = async (params: {
	userId?: string;
	email?: string;
	limit?: number;
	numCandidates?: number;
	minRating?: number;
}): Promise<GameRecommendation[]> => {
	const query: Record<string, unknown> = {};
	if (params.userId) query._id = params.userId;
	if (params.email) query.email = params.email;
	if (Object.keys(query).length === 0) {
		throw new Error(
			"Debes proporcionar userId o email para obtener recomendaciones personalizadas.",
		);
	}
	console.log("Buscando usuario con query:", query);
	const user = await User.findOne(query)
		.select("gamePreferences wishlist")
		.populate({
			path: "gamePreferences.gameId",
			select: "_id appid name embedding embeddingModel embeddingUpdatedAt",
		})
		.lean()
		.exec();
	console.log("Usuario encontrado:", user);
	if (!user) return [];
	const prefs = Array.isArray(user.gamePreferences) ? user.gamePreferences : [];
	console.log("Preferencias del usuario encontradas:", inspect(prefs));
	const minRating = params.minRating ?? MIN_USER_RATING;
	const vectors: {
		vector: number[];
		weight: number;
		appid?: number;
		gameId: mongoose.Types.ObjectId;
	}[] = [];
	for (const pref of prefs) {
		const rating = typeof pref?.rating === "number" ? pref.rating : 0;
		if (rating < minRating) continue;
		const gameDoc: any = pref?.gameId;
		let vector: number[] | null =
			Array.isArray(gameDoc?.embedding) && gameDoc.embedding.length > 0
				? gameDoc.embedding
				: null;
		let appid: number | undefined =
			typeof gameDoc?.appid === "number" ? gameDoc.appid : undefined;
		let gameId: mongoose.Types.ObjectId | undefined =
			gameDoc?._id instanceof mongoose.Types.ObjectId ? gameDoc._id : undefined;
		if (!vector) {
			const ensured = await ensureGameEmbedding(
				gameId ?? gameDoc ?? pref?.gameId,
			);
			if (!ensured?.vector?.length) continue;
			vector = ensured.vector;
			if (typeof ensured.appid === "number") appid = ensured.appid;
			if (ensured.gameId) gameId = ensured.gameId;
		}
		if (!vector || vector.length === 0 || !gameId) continue;
		vectors.push({
			vector,
			weight: rating,
			appid,
			gameId,
		});
	}
	console.log(
		"Vectores de preferencias del usuario encontrados:",
		inspect(vectors),
	);
	if (vectors.length === 0) return [];
	const dimension = vectors[0]?.vector?.length ?? 0;
	if (dimension === 0) return [];
	const accumulator = new Array<number>(dimension).fill(0);
	let weightTotal = 0;
	for (const item of vectors) {
		if (!Array.isArray(item.vector) || item.vector.length !== dimension)
			continue;
		for (let i = 0; i < dimension; i += 1) {
			const component = item.vector[i];
			if (typeof component !== "number") continue;
			const current = accumulator[i] ?? 0;
			accumulator[i] = current + component * item.weight;
		}
		weightTotal += item.weight;
	}
	if (weightTotal === 0) return [];
	const preferenceVector = accumulator.map((value) => value / weightTotal);
	const excludeAppIds = vectors
		.map((item) => item.appid)
		.filter((appid): appid is number => typeof appid === "number");
	const wishlist = Array.isArray(user.wishlist) ? user.wishlist : [];
	for (const entry of wishlist) {
		const wGame: any = entry?.gameId;
		if (wGame && typeof wGame.appid === "number") {
			excludeAppIds.push(wGame.appid);
		}
	}
	return recommendSimilarGamesByVector({
		vector: preferenceVector,
		limit: params.limit,
		numCandidates: params.numCandidates,
		excludeAppIds,
	});
};

// ...existing code...
export const recommendSimilarGamesForText = async (params: {
	text: string;
	limit?: number;
	numCandidates?: number;
}): Promise<GameRecommendation[]> => {
	const vector = await getEmbedding(params.text);
	return recommendSimilarGamesByVector({
		vector,
		limit: params.limit,
		numCandidates: params.numCandidates,
	});
};
