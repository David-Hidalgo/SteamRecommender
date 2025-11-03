import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mongoose from "mongoose";
import type { Document } from "mongoose";
import { client } from "./index";
import { Game, type GameType } from "./models/games.model";
import { User } from "./models/auth.model";
import { inspect } from "bun";

const EMBEDDING_PROVIDER = (process.env.EMBEDDING_PROVIDER || "openai").toLowerCase();
const VECTOR_INDEX_NAME = process.env.MONGODB_VECTOR_INDEX || "game_embedding_index";
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
const ACTIVE_EMBEDDING_MODEL =
	EMBEDDING_PROVIDER === "gemini"
		? GEMINI_EMBEDDING_MODEL
		: OPENAI_EMBEDDING_MODEL;

const EMBEDDING_DIMENSIONS = Number(
	process.env.EMBEDDING_DIMENSIONS ??
	(EMBEDDING_PROVIDER === "gemini"
		? process.env.GEMINI_EMBEDDING_DIMENSIONS ?? "768"
		: process.env.OPENAI_EMBEDDING_DIMENSIONS ?? "1536"),
);

const MIN_USER_RATING = Number(process.env.RECOMMENDER_MIN_RATING || "3");

let openAIClient: OpenAI | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

const getOpenAIClient = () => {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey || apiKey.trim().length === 0) {
		throw new Error("OPENAI_API_KEY no está configurada. Configúrala para generar embeddings.");
	}
	if (!openAIClient) {
		openAIClient = new OpenAI({ apiKey });
	}
	return openAIClient;
};

const getGeminiClient = () => {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey || apiKey.trim().length === 0) {
		throw new Error("GEMINI_API_KEY no está configurada. Configúrala para generar embeddings.");
	}
	if (!geminiClient) {
		geminiClient = new GoogleGenerativeAI(apiKey);
	}
	return geminiClient;
};

const normaliseString = (value: unknown): string => {
	if (typeof value === "string") return value.trim();
	return "";
};

const collectStrings = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value
			.map((item) => normaliseString(item))
			.filter((item) => item.length > 0);
	}
	const single = normaliseString(value);
	return single.length > 0 ? [single] : [];
};

const buildGameEmbeddingText = (game: Pick<GameType, "name" | "data">): string => {
	const parts: string[] = [];
	if (game.name) parts.push(game.name);
	const data = (game.data as Record<string, unknown>) ?? {};
	const shortDescription = normaliseString(data.short_description);
	if (shortDescription) parts.push(shortDescription);
	const aboutGame = normaliseString(data.about_the_game);
	if (aboutGame) parts.push(aboutGame);
	const genres = collectStrings(data.genres);
	if (genres.length) parts.push(`Genres: ${genres.join(", ")}`);
	const categories = collectStrings(data.categories);
	if (categories.length) parts.push(`Categories: ${categories.join(", ")}`);
	const tags = collectStrings(data.tags);
	if (tags.length) parts.push(`Tags: ${tags.join(", ")}`);
	return parts.join("\n\n").trim();
};

const isGameDocument = (
	candidate: unknown,
): candidate is (Document<unknown, unknown, GameType> & GameType & { _id: mongoose.Types.ObjectId }) => {
	return (
		candidate !== null &&
		typeof candidate === "object" &&
		"_id" in candidate &&
		"data" in candidate &&
		"name" in candidate
	);
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

const listSearchIndexByName = async (name: string) => {
	try {
		const cursor = client.collection("game").listSearchIndexes(name);
		const all = await cursor.toArray();
		return all.some((index) => index?.name === name);
	} catch (error) {
		// Mongo driver < 6.1 does not support listSearchIndexes; fall back to attempting create every time.
		return false;
	}
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
		clauses.push({ _id: { $nin: options.excludeIds.map((id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)))) } });
	}
	if (options.excludeAppIds && options.excludeAppIds.length > 0) {
		clauses.push({ appid: { $nin: options.excludeAppIds } });
	}
	if (clauses.length === 0) return undefined;
	if (clauses.length === 1) return clauses[0];
	return { $and: clauses };
};

const vectorSearchPipeline = (
	vector: number[],
	options: Partial<{
		limit: number;
		numCandidates: number;
		filter: Record<string, unknown>;
	}>,
) => {
	const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
	const numCandidates = Math.min(Math.max(options.numCandidates ?? limit * 10, limit), 2000);
	return [
		{
			$vectorSearch: {
				index: VECTOR_INDEX_NAME,
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

export type GameRecommendation = {
	_id: string;
	appid?: number;
	name?: string;
	score: number;
	capsule?: string;
	release_date?: unknown;
	vectorIndex: string;
};

const mapRecommendation = (doc: any): GameRecommendation => {
	const capsule =
		typeof doc?.capsule === "string" && doc.capsule.length > 0
			? doc.capsule
			: undefined;
	return {
		_id: String(doc._id),
		appid: typeof doc.appid === "number" ? doc.appid : undefined,
		name: typeof doc.name === "string" ? doc.name : undefined,
		score: typeof doc.score === "number" ? doc.score : 0,
		capsule,
		release_date: doc?.release_date,
		vectorIndex: VECTOR_INDEX_NAME,
	};
};

export const ensureGameVectorIndex = async (): Promise<void> => {
	const exists = await listSearchIndexByName(VECTOR_INDEX_NAME);
	if (exists) return;
	try {
		await client.command({
			createSearchIndexes: "game",
			indexes: [
				{
					name: VECTOR_INDEX_NAME,
					definition: {
							mappings: {
								dynamic: false,
								fields: {
									embedding: {
										type: "vector",
										dimensions: EMBEDDING_DIMENSIONS,
										similarity: "cosine",
									},
								},
							},
					},
				},
			],
		});
	} catch (error) {
		const message = error instanceof Error ? error.message.toLowerCase() : String(error);
		if (message.includes("already exists") || message.includes("namespace")) return;
		throw error;
	}
};

export const generateEmbeddingForText = async (text: string): Promise<number[]> => {
	const clean = text.trim();
	if (clean.length === 0) {
		throw new Error("El texto para generar embedding está vacío.");
	}
	if (EMBEDDING_PROVIDER === "gemini") {
		const gemini = getGeminiClient();
		const model = gemini.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });
		const result = await model.embedContent(clean);
		const vector = result?.embedding?.values;
		if (!Array.isArray(vector) || vector.length === 0) {
			throw new Error("No se recibió un embedding válido desde Gemini.");
		}
		return vector as number[];
	}

	const openai = getOpenAIClient();
	const response = await openai.embeddings.create({
		model: OPENAI_EMBEDDING_MODEL,
		input: clean,
	});
	const vector = response.data?.[0]?.embedding;
	if (!Array.isArray(vector) || vector.length === 0) {
		throw new Error("No se recibió un embedding válido desde OpenAI.");
	}
	return vector;
};

export const ensureGameEmbedding = async (
	identifier: Parameters<typeof resolveGameFilter>[0],
	options: { force?: boolean } = {},
): Promise<{ vector: number[]; appid?: number; gameId: mongoose.Types.ObjectId } | null> => {
	let gameDoc: (GameType & { _id: mongoose.Types.ObjectId }) | null = null;
	if (isGameDocument(identifier)) {
		gameDoc = identifier;
	} else {
		const filter = resolveGameFilter(identifier);
		if (!filter) return null;
		gameDoc = await Game.findOne(filter)
			.select("appid name data embedding embeddingModel embeddingUpdatedAt")
			.lean()
			.exec() as (GameType & { _id: mongoose.Types.ObjectId }) | null;
	}
	if (!gameDoc) return null;
	if (!options.force && Array.isArray(gameDoc.embedding) && gameDoc.embedding.length > 0) {
		if (!Number.isNaN(EMBEDDING_DIMENSIONS) && EMBEDDING_DIMENSIONS > 0) {
			if (gameDoc.embedding.length === EMBEDDING_DIMENSIONS) {
				return { vector: gameDoc.embedding, appid: gameDoc.appid, gameId: gameDoc._id };
			}
		}
		return { vector: gameDoc.embedding, appid: gameDoc.appid, gameId: gameDoc._id };
	}
	const text = buildGameEmbeddingText(gameDoc);
	if (text.length === 0) {
		throw new Error(`No se pudo construir un texto descriptivo para el juego ${gameDoc.name ?? gameDoc._id}`);
	}
	const vector = await generateEmbeddingForText(text);
	await Game.updateOne(
		{ _id: gameDoc._id },
		{
			$set: {
				embedding: vector,
				embeddingModel: ACTIVE_EMBEDDING_MODEL,
				embeddingUpdatedAt: new Date(),
			},
		},
	).exec();
	return { vector, appid: gameDoc.appid, gameId: gameDoc._id };
};

export const recommendSimilarGamesByVector = async (
	params: {
		vector: number[];
		limit?: number;
		numCandidates?: number;
		excludeIds?: (mongoose.Types.ObjectId | string)[];
		excludeAppIds?: number[];
		baseFilter?: Record<string, unknown>;
	},
): Promise<GameRecommendation[]> => {
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

export const recommendSimilarGamesForApp = async (
	params: {
		gameId?: string;
		appid?: number | string;
		limit?: number;
		numCandidates?: number;
		autoGenerateIfMissing?: boolean;
	},
): Promise<GameRecommendation[]> => {
	const target = await Game.findOne(
		params.gameId ? resolveGameFilter(params.gameId) ?? undefined : { appid: Number(params.appid) },
	)
		.select("_id appid name data embedding embeddingModel embeddingUpdatedAt")
		.lean()
		.exec();
	if (!target) return [];
	let vector = Array.isArray(target.embedding) && target.embedding.length > 0 ? target.embedding : null;
	if (!vector && params.autoGenerateIfMissing !== false) {
		const ensured = await ensureGameEmbedding(target as GameType & { _id: mongoose.Types.ObjectId });
		vector = ensured?.vector ?? null;
	}
	if (!vector) {
		throw new Error(
			`El juego ${target.name ?? target._id} no tiene embedding generado. Ejecuta el script de backfill o configura OPENAI_API_KEY.`,
		);
	}
	return recommendSimilarGamesByVector({
		vector,
		limit: params.limit,
		numCandidates: params.numCandidates,
		excludeIds: [target._id],
		excludeAppIds: typeof target.appid === "number" ? [target.appid] : undefined,
	});
};

export const recommendSimilarGamesForUser = async (
	params: {
		userId?: string;
		email?: string;
		limit?: number;
		numCandidates?: number;
		minRating?: number;
	},
): Promise<GameRecommendation[]> => {
	const query: Record<string, unknown> = {};
	if (params.userId) query._id = params.userId;
	if (params.email) query.email = params.email;
	if (Object.keys(query).length === 0) {
		throw new Error("Debes proporcionar userId o email para obtener recomendaciones personalizadas.");
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
	const vectors: { vector: number[]; weight: number; appid?: number; gameId: mongoose.Types.ObjectId }[] = [];
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
			gameDoc?._id instanceof mongoose.Types.ObjectId
				? gameDoc._id
				: undefined;
		if (!vector) {
			const ensured = await ensureGameEmbedding(gameId ?? gameDoc ?? pref?.gameId);
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
	console.log("Vectores de preferencias del usuario encontrados:", inspect(vectors));
	if (vectors.length === 0) return [];
	const dimension = vectors[0]?.vector?.length ?? 0;
	if (dimension === 0) return [];
	const accumulator = new Array<number>(dimension).fill(0);
	let weightTotal = 0;
	for (const item of vectors) {
		if (!Array.isArray(item.vector) || item.vector.length !== dimension) continue;
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

export const recommendSimilarGamesForText = async (
	params: { text: string; limit?: number; numCandidates?: number },
): Promise<GameRecommendation[]> => {
	const vector = await generateEmbeddingForText(params.text);
	return recommendSimilarGamesByVector({
		vector,
		limit: params.limit,
		numCandidates: params.numCandidates,
	});
};
