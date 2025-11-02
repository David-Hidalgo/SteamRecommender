import mongoose from "mongoose";
import { User } from "./models/auth.model";
import { Game } from "./models/games.model";

type RecItem = {
	_id: mongoose.Types.ObjectId;
	appid?: number;
	name?: string;
	score: number;
	reason?: any;
};

/**
 * Devuelve juegos similares por contenido (tags / genres / categories) usando Aggregation Framework.
 * Busca overlap de tags entre el juego objetivo y el resto, ponderando por `data.popularity` cuando exista.
 *
 * @param gameId string | ObjectId | number (si usas appid)
 * @param limit número máximo de resultados
 */
export async function recommendSimilarGamesByContent(
	gameId: string | mongoose.Types.ObjectId | number,
	limit = 20,
): Promise<RecItem[]> {
	// Normalize gameId to ObjectId if possible; otherwise try to match by appid
	let matchByObjectId = false;
	let objectId: mongoose.Types.ObjectId | null = null;

	try {
		if (typeof gameId === "string") {
			objectId = new mongoose.Types.ObjectId(gameId);
			matchByObjectId = true;
		} else if (gameId instanceof mongoose.Types.ObjectId) {
			objectId = gameId;
			matchByObjectId = true;
		}
	} catch (e) {
		matchByObjectId = false;
		objectId = null;
	}

	// Pipeline: obtener tags/genres del juego objetivo
	const matchStage = matchByObjectId
		? { $match: { _id: objectId } }
		: { $match: { appid: gameId } };

	// We'll try to read data.tags, data.genres, data.categories in that order
	const pipeline: mongoose.PipelineStage[] = [
		matchStage,
		{
			$project: {
				_id: 1,
				appid: 1,
				name: 1,
				tags: {
					$ifNull: [
						"$data.tags",
						{
							$ifNull: ["$data.genres", { $ifNull: ["$data.categories", []] }],
						},
					],
				},
			},
		},
		{ $limit: 1 },
		{
			$lookup: {
				from: "game",
				let: { targetTags: "$tags", targetId: "$_id" },
				pipeline: [
					{ $match: { $expr: { $ne: ["$_id", "$$targetId"] } } },
					{
						$project: {
							appid: 1,
							name: 1,
							tags: {
								$ifNull: [
									"$data.tags",
									{
										$ifNull: [
											"$data.genres",
											{ $ifNull: ["$data.categories", []] },
										],
									},
								],
							},
							popularity: { $ifNull: ["$data.popularity", 1] },
						},
					},
					{
						$addFields: {
							commonTags: {
								$size: {
									$setIntersection: [
										{ $ifNull: ["$tags", []] },
										{ $ifNull: ["$$targetTags", []] },
									],
								},
							},
						},
					},
					{ $match: { commonTags: { $gt: 0 } } },
					{
						$addFields: {
							score: { $multiply: ["$commonTags", "$popularity"] },
							reason: { commonTags: "$commonTags", popularity: "$popularity" },
						},
					},
					{ $sort: { score: -1 } },
					{ $limit: limit },
				],
				as: "candidates",
			},
		},
		{ $unwind: "$candidates" },
		{ $replaceRoot: { newRoot: "$candidates" } },
	];

	try {
		const results = await Game.aggregate(pipeline).exec();
		return (results || []).map((r: any) => ({
			_id: r._id,
			appid: r.appid,
			name: r.name,
			score: typeof r.score === "number" ? r.score : 0,
			reason: r.reason || null,
		}));
	} catch (error) {
		console.error("recommendSimilarGamesByContent error:", error);
		throw error;
	}
}

/**
 * Recomendación colaborativa simple basada en co-ocurrencia: encontrar juegos que usuarios
 * que compartieron gustos con `userId` calificaron positivamente.
 *
 * @param userId string (el _id del usuario en la colección `user`)
 * @param limit número máximo de resultados
 */
export async function recommendForUserCollaborative(
	userId: string,
	limit = 20,
): Promise<RecItem[]> {
	if (!userId) return [];

	const pipeline: mongoose.PipelineStage[] = [
		{ $match: { _id: userId } },
		// obtener ids de juegos que el usuario ya calificó (map a ObjectId)
		{
			$project: {
				likedIds: {
					$map: {
						input: {
							$filter: {
								input: "$gamePreferences",
								as: "gp",
								cond: { $gte: ["$$gp.rating", 4] },
							},
						},
						as: "g",
						in: "$$g.gameId",
					},
				},
			},
		},
		// buscar en usuarios que también tienen esos juegos en sus preferencias
		{
			$lookup: {
				from: "user",
				let: { liked: "$likedIds" },
				pipeline: [
					{
						$match: {
							$expr: {
								$gt: [{ $size: { $ifNull: ["$gamePreferences", []] } }, 0],
							},
						},
					},
					{ $unwind: "$gamePreferences" },
					{
						$match: { $expr: { $in: ["$gamePreferences.gameId", "$$liked"] } },
					},
					// considerar sólo ratings >= 3 para contributors
					{ $match: { "gamePreferences.rating": { $gte: 3 } } },
					{
						$project: {
							otherGame: "$gamePreferences.gameId",
							rating: "$gamePreferences.rating",
						},
					},
				],
				as: "othersPrefs",
			},
		},
		{ $unwind: { path: "$othersPrefs", preserveNullAndEmptyArrays: false } },
		// ahora agrupar por otherGame y sumar un score (puede ser sum of ratings)
		{
			$group: {
				_id: "$othersPrefs.otherGame",
				score: { $sum: "$othersPrefs.rating" },
				count: { $sum: 1 },
			},
		},
		// excluir juegos que el usuario ya tiene en likedIds: we'll do a lookup to get likedIds context
		// Para simplificar, vamos a lookup the original user likedIds again
		{
			$lookup: {
				from: "user",
				localField: "_id",
				foreignField: "gamePreferences.gameId",
				as: "_dummy",
			},
		},
		// join with game collection to fetch metadata
		{
			$lookup: {
				from: "game",
				localField: "_id",
				foreignField: "_id",
				as: "game",
			},
		},
		{ $unwind: "$game" },
		{
			$project: {
				_id: 1,
				score: 1,
				count: 1,
				appid: "$game.appid",
				name: "$game.name",
			},
		},
		{ $sort: { score: -1, count: -1 } },
		{ $limit: limit },
	];

	try {
		// Ejecutamos el pipeline empezando desde la colección user, pero necesitamos pasar userId match
		const results = await User.aggregate(pipeline).exec();

		// Filter out games that the user already liked or had in wishlist would be good to do, but
		// requires fetching that user's likedIds; the pipeline above is a simple approximation.

		return (results || []).map((r: any) => ({
			_id: r._id,
			appid: r.appid,
			name: r.name,
			score: typeof r.score === "number" ? r.score : 0,
			reason: { count: r.count },
		}));
	} catch (error) {
		console.error("recommendForUserCollaborative error:", error);
		throw error;
	}
}

/**
 * Recomendación por publisher: busca juegos cuyo `data.publisher`, `data.publishers`,
 * `data.developer` o `data.developers` coincida con `publisher` (case-insensitive).
 * Ordena por `data.popularity` y `data.release_date`.
 *
 * @param publisher string (ej. 'Valve', 'Ubisoft')
 * @param limit número máximo de resultados
 */
export async function recommendGamesByPublisher(
	publisher: string,
	limit = 20,
): Promise<RecItem[]> {
	if (!publisher || typeof publisher !== "string") return [];

	const regex = publisher;
	const pipeline: mongoose.PipelineStage[] = [
		{
			$match: {
				$or: [
					{
						"data.publishers": { $elemMatch: { $regex: regex, $options: "i" } },
					},
					{ "data.publisher": { $regex: regex, $options: "i" } },
					{
						"data.developers": { $elemMatch: { $regex: regex, $options: "i" } },
					},
					{ "data.developer": { $regex: regex, $options: "i" } },
				],
			},
		},
		{
			$project: {
				appid: 1,
				name: 1,
				popularity: { $ifNull: ["$data.popularity", 1] },
				release_date: "$data.release_date",
				publisherMatched: {
					$cond: [
						{
							$regexMatch: {
								input: { $ifNull: ["$data.publisher", ""] },
								regex: regex,
								options: "i",
							},
						},
						"$data.publisher",
						{
							$cond: [
								{ $gt: [{ $size: { $ifNull: ["$data.publishers", []] } }, 0] },
								{ $arrayElemAt: ["$data.publishers", 0] },
								null,
							],
						},
					],
				},
			},
		},
		{ $addFields: { score: "$popularity" } },
		{ $sort: { score: -1, release_date: -1 } },
		{ $limit: limit },
	];

	try {
		const results = await Game.aggregate(pipeline).exec();
		return (results || []).map((r: any) => ({
			_id: r._id,
			appid: r.appid,
			name: r.name,
			score: typeof r.score === "number" ? r.score : 0,
			reason: {
				publisherMatched: r.publisherMatched,
				popularity: r.popularity,
			},
		}));
	} catch (error) {
		console.error("recommendGamesByPublisher error:", error);
		throw error;
	}
}

function escapeRegex(str: string) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFranchiseFromName(name?: string) {
	if (!name || typeof name !== "string") return null;
	// If name contains ':' or '-' take prefix before it
	const colonIdx = name.indexOf(":");
	if (colonIdx > 0) return name.slice(0, colonIdx).trim();
	const dashIdx = name.indexOf(" - ");
	if (dashIdx > 0) return name.slice(0, dashIdx).trim();
	// fallback: first two words (helps for 'Call of Duty: ...' or 'Assassin's Creed ..')
	const words = name.split(/\s+/).filter(Boolean);
	return words.slice(0, 2).join(" ");
}

/**
 * Recomendación híbrida centrada en el contexto de un juego objetivo: combina
 * - juegos de la misma franquicia (boost alto)
 * - juegos del/los mismos publisher(s) (boost medio)
 * - juegos con solapamiento de tags/genres/categories (score por overlap)
 *
 * @param gameId ObjectId|string|number (puede ser appid o _id)
 */
export async function recommendByGameContext(
	gameId: string | mongoose.Types.ObjectId | number,
	limit = 20,
): Promise<RecItem[]> {
	// Resolve game
	let matchByObjectId = false;
	let objectId: mongoose.Types.ObjectId | null = null;
	try {
		if (typeof gameId === "string") {
			objectId = new mongoose.Types.ObjectId(gameId);
			matchByObjectId = true;
		} else if (gameId instanceof mongoose.Types.ObjectId) {
			objectId = gameId;
			matchByObjectId = true;
		}
	} catch (e) {
		matchByObjectId = false;
		objectId = null;
	}

	const gameMatch = matchByObjectId ? { _id: objectId } : { appid: gameId };
	const target = await Game.findOne(gameMatch).lean().exec();
	if (!target) return [];

	const name: string = target.name || "";
	const targetTags: string[] =
		(target.data?.tags || target.data?.genres || target.data?.categories) ?? [];
	const targetPublishers: string[] = (() => {
		if (Array.isArray(target.data?.publishers) && target.data.publishers.length)
			return target.data.publishers;
		if (typeof target.data?.publisher === "string")
			return [target.data.publisher];
		return [];
	})();
	// categories not used directly here (kept for future use)
	const franchise =
		target.data?.franchise ||
		target.data?.series ||
		extractFranchiseFromName(name);

	// Prepare queries
	const franchiseRegex = franchise
		? new RegExp("^" + escapeRegex(String(franchise)), "i")
		: null;

	// 1) franchise candidates
	const franchisePipeline: mongoose.PipelineStage[] = [];
	if (franchiseRegex) {
		franchisePipeline.push(
			{ $match: { $expr: { $ne: ["$_id", target._id] } } },
			{
				$match: {
					$or: [
						{ name: { $regex: franchiseRegex } },
						{ "data.franchise": franchise },
					],
				},
			},
			{
				$project: {
					appid: 1,
					name: 1,
					popularity: { $ifNull: ["$data.popularity", 1] },
				},
			},
			{
				$addFields: {
					score: { $multiply: [100, "$popularity"] },
					reason: { type: "franchise", franchise: franchise },
				},
			},
			{ $sort: { score: -1 } },
			{ $limit: limit },
		);
	}

	// 2) publisher candidates
	const publisherPipeline: mongoose.PipelineStage[] = [
		{ $match: { $expr: { $ne: ["$_id", target._id] } } },
		{
			$match: {
				$or: [
					...(targetPublishers.length
						? targetPublishers.map((p) => ({
								"data.publishers": { $elemMatch: { $regex: p, $options: "i" } },
							}))
						: []),
					...(targetPublishers.length
						? targetPublishers.map((p) => ({
								"data.publisher": { $regex: p, $options: "i" },
							}))
						: []),
				],
			},
		},
		{
			$project: {
				appid: 1,
				name: 1,
				popularity: { $ifNull: ["$data.popularity", 1] },
				publishers: "$data.publishers",
				publisher: "$data.publisher",
			},
		},
		{
			$addFields: {
				score: { $multiply: [50, "$popularity"] },
				reason: { type: "publisher" },
			},
		},
		{ $sort: { score: -1 } },
		{ $limit: limit },
	];

	// 3) genre/category overlap candidates
	const tags = targetTags ?? [];
	const genrePipeline: mongoose.PipelineStage[] = [
		{ $match: { $expr: { $ne: ["$_id", target._id] } } },
		{
			$project: {
				appid: 1,
				name: 1,
				tags: {
					$ifNull: [
						"$data.tags",
						{
							$ifNull: ["$data.genres", { $ifNull: ["$data.categories", []] }],
						},
					],
				},
				popularity: { $ifNull: ["$data.popularity", 1] },
			},
		},
		{
			$addFields: {
				commonTags: {
					$size: { $setIntersection: [{ $ifNull: ["$tags", []] }, tags] },
				},
			},
		},
		{ $match: { commonTags: { $gt: 0 } } },
		{
			$addFields: {
				score: { $multiply: ["$commonTags", "$popularity"] },
				reason: { type: "tags", commonTags: "$commonTags" },
			},
		},
		{ $sort: { score: -1 } },
		{ $limit: limit * 2 },
	];

	// Run pipelines in parallel
	const runs = await Promise.all([
		franchiseRegex
			? Game.aggregate(franchisePipeline).exec()
			: Promise.resolve([]),
		Game.aggregate(publisherPipeline).exec(),
		Game.aggregate(genrePipeline).exec(),
	]);

	const [franchiseRes, publisherRes, genreRes] = runs;

	// Merge results, boosting duplicates
	const map = new Map<string, { item: RecItem; reasons: any[] }>();

	const pushResult = (r: any, baseScore: number, reason: any) => {
		const id = String(r._id);
		const entry = map.get(id);
		const item: RecItem = {
			_id: r._id,
			appid: r.appid,
			name: r.name,
			score: baseScore,
			reason,
		};
		if (!entry) {
			map.set(id, { item, reasons: [reason] });
		} else {
			entry.item.score += baseScore;
			entry.reasons.push(reason);
			entry.item.reason = { combined: entry.reasons };
		}
	};

	// Add franchise results (high boost)
	for (const r of franchiseRes || []) {
		pushResult(r, r.score ?? 100, r.reason ?? { type: "franchise" });
	}
	// Add publisher results (medium boost)
	for (const r of publisherRes || []) {
		pushResult(r, r.score ?? 50, {
			type: "publisher",
			publishers: r.publishers ?? r.publisher ?? null,
		});
	}
	// Add genre/tag results (score from overlap)
	for (const r of genreRes || []) {
		pushResult(r, r.score ?? 1, r.reason ?? { type: "tags" });
	}

	// Convert to array and sort
	const merged = Array.from(map.values()).map((v) => v.item);
	merged.sort((a, b) => b.score - a.score);

	return merged.slice(0, limit);
}

export default {
	recommendSimilarGamesByContent,
	recommendForUserCollaborative,
	recommendGamesByPublisher,
	recommendByGameContext,
};
