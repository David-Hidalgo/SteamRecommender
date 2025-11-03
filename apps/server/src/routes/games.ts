import { User } from "@SteamRecommender/db/models/auth.model";
import { Game as GameModel } from "@SteamRecommender/db/models/games.model";
import {
	recommendByGameContext,
	recommendForUserCollaborative,
	recommendGamesByPublisher,
	recommendSimilarGamesByContent,
} from "@SteamRecommender/db/recommender";
import { Elysia, t } from "elysia";
import {
	recommendSimilarGamesForApp,
	recommendSimilarGamesForUser,
	recommendSimilarGamesForText,
} from "@SteamRecommender/db/vector-search";
// Intentamos usar el cliente nativo exportado por el paquete db

// Games plugin: routes that do not require user context
export const plugin = <T extends string>(config: { prefix: T }) =>
	new Elysia({
		name: "Games",
		seed: config,
		prefix: config.prefix,
	}).group("/games", (app) =>
		app
			.get("/", () => "Games endpoint")
			.get(
				"/id/:id",
				async (ctx: any) => {
					const { id } = ctx.params || {};
					try {
						const game = await GameModel.findById(id).exec();
						if (!game) return { status: 404, body: "Game not found" };
						return game;
					} catch (err) {
						console.error("Error reading game from DB:", err);
						return { status: 500, body: "Internal Server Error" };
					}
				},
				{
					params: t.Object({ id: t.Number() }),
					query: t.Object({ name: t.String() }),
				},
			)
			.get(
				"/top10",
				async () => {
					try {
						// If there are user ratings, we could aggregate; for now return random sample with consistent shape
						const sample = await GameModel.aggregate([
							{ $sample: { size: 24 } },
							{
								$project: { appid: 1, name: 1, capsule: "$data.capsule_image" },
							},
						]);

						return sample.map((g: any) => ({
							appid: g.appid,
							name: g.name,
							avgRating: 0,
							count: 0,
							capsule: g.capsule ?? "",
						}));
					} catch (err) {
						console.error("Error computing top10:", err);
						return [];
					}
				},
				{
					response: {
						200: t.Array(
							t.Object({
								appid: t.Number(),
								name: t.String(),
								avgRating: t.Number(),
								count: t.Number(),
								capsule: t.String(),
							}),
						),
					},
				},
			)
			.get("/list", async () => {
				try {
					// return a lightweight projection that includes name and appid for client-side search
					return await GameModel.find()
						.select("_id appid name data.capsule_image")
						.limit(200)
						.lean()
						.exec();
				} catch (err) {
					console.error("Error reading games from DB:", err);
					return [];
				}
			})
			.get(
				"/search",
				async ({ query }) => {
					const q = (query as any)?.q;
					if (!q || String(q).trim().length === 0) return [];
					const term = String(q).trim();
					try {
						const regex = new RegExp(
							term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
							"i",
						);
						return await GameModel.find({ name: { $regex: regex } })
							.select("_id appid name data.capsule_image")
							.limit(120)
							.lean()
							.exec();
					} catch (err) {
						console.error("Error searching games:", err);
						return [];
					}
				},
				{
					query: t.Object({ q: t.String() }),
				},
			)
			.get(
				"/appid/:appid/similar",
				async (ctx: any) => {
					const { appid } = ctx.params || {};
					const { status } = ctx;
					try {
						console.info(
							"Running recommendSimilarGamesByContent for appid:",
							appid,
						);
						const recs = await recommendSimilarGamesByContent(
							Number(appid),
							20,
						);
						return recs;
					} catch (err: any) {
						console.error(
							"Error running recommendSimilarGamesByContent:",
							err?.message || err,
							err?.stack,
						);
						// Dev-only: return error message/stack to help debugging
						return status(500, {
							message: err?.message ?? "Internal Server Error",
							stack: err?.stack,
						});
					}
				},
				{
					params: t.Object({ appid: t.Number() }),
				},
			)
			.get(
				"/appid/:appid/related",
				async (ctx: any) => {
					const { appid } = ctx.params || {};
					const { status } = ctx;
					try {
						const recs = await recommendByGameContext(Number(appid), 20);
						return recs;
					} catch (err) {
						console.error("Error running recommendByGameContext:", err);
						return status(500, { message: "Internal Server Error" });
					}
				},
				{
					params: t.Object({ appid: t.Number() }),
				},
			)
			.get(
				"/publisher/:publisher",
				async (ctx: any) => {
					const { publisher } = ctx.params || {};
					const { status } = ctx;
					try {
						const recs = await recommendGamesByPublisher(String(publisher), 20);
						return recs;
					} catch (err) {
						console.error("Error running recommendGamesByPublisher:", err);
						return status(500, { message: "Internal Server Error" });
					}
				},
				{
					params: t.Object({ publisher: t.String() }),
				},
			)
			.get(
				"/recommendations",
				async (ctx: any) => {
					const { userId, limit } = ctx.query || {};
					const { status } = ctx;
					if (!userId)
						return status(400, { message: "userId query param is required" });
					try {
						const parsedLimit = Number(limit);
						const effectiveLimit = Number.isFinite(parsedLimit)
							? Math.min(Math.max(Math.floor(parsedLimit), 1), 50)
							: 20;
						const vectorRecs = await recommendSimilarGamesForUser({
							userId: String(userId),
							limit: effectiveLimit,
						});
						if (Array.isArray(vectorRecs) && vectorRecs.length > 0) {
							return vectorRecs;
						}
						const fallback = await recommendForUserCollaborative(
							String(userId),
							effectiveLimit,
						);
						return fallback;
					} catch (err) {
						console.error("Error generating user recommendations:", err);
						return status(500, { message: "Internal Server Error" });
					}
				},
				{
					query: t.Object({
						userId: t.String(),
						limit: t.Optional(t.Number()),
					}),
				},
			)
			.get(
				"/vector-recommendations/user",
				async ({ query, status }) => {
					const params = query as Record<string, string | undefined>;
					const rawLimit = params?.limit ? Number(params.limit) : Number.NaN;
					const limit = Number.isFinite(rawLimit)
						? Math.min(Math.max(Math.floor(rawLimit), 1), 50)
						: 10;
					try {
						if (!params?.userId && !params?.email) {
							return status(400, {
								message: "Proporciona userId o email para obtener recomendaciones de usuario.",
							});
						}
						return await recommendSimilarGamesForUser({
							userId: params.userId,
							email: params.email,
							limit,
						});
					} catch (error) {
						console.error("Error generating user vector recommendations", error);
						return status(503, {
							message: "No se pudieron generar recomendaciones en este momento.",
							detail: error instanceof Error ? error.message : String(error),
						});
					}
				},
				{
					query: t.Object({
						userId: t.Optional(t.String()),
						email: t.Optional(t.String()),
						limit: t.Optional(t.String()),
					}),
					response: {
						200: t.Array(
							t.Object({
								_id: t.String(),
								appid: t.Optional(t.Number()),
								name: t.Optional(t.String()),
								score: t.Number(),
								capsule: t.Optional(t.String()),
								release_date: t.Optional(t.Any()),
								vectorIndex: t.String(),
							}),
						),
						400: t.Object({ message: t.String() }),
						503: t.Object({
							message: t.String(),
							detail: t.Optional(t.String()),
						}),
					},
				},
			)
			.get(
				"/vector-recommendations/app",
				async ({ query, status }) => {
					const params = query as Record<string, string | undefined>;
					const rawLimit = params?.limit ? Number(params.limit) : Number.NaN;
					const limit = Number.isFinite(rawLimit)
						? Math.min(Math.max(Math.floor(rawLimit), 1), 50)
						: 10;
					try {
						if (!params?.appid && !params?.gameId) {
							return status(400, {
								message: "Proporciona appid o gameId para obtener recomendaciones por juego.",
							});
						}
						const identifier = params.appid ?? params.gameId;
						const numeric = identifier && !Number.isNaN(Number(identifier))
							? Number(identifier)
							: undefined;
						return await recommendSimilarGamesForApp({
							appid: numeric ?? identifier,
							gameId: params.gameId,
							limit,
						});
					} catch (error) {
						console.error("Error generating app vector recommendations", error);
						return status(503, {
							message: "No se pudieron generar recomendaciones en este momento.",
							detail: error instanceof Error ? error.message : String(error),
						});
					}
				},
				{
					query: t.Object({
						appid: t.Optional(t.String()),
						gameId: t.Optional(t.String()),
						limit: t.Optional(t.String()),
					}),
					response: {
						200: t.Array(
							t.Object({
								_id: t.String(),
								appid: t.Optional(t.Number()),
								name: t.Optional(t.String()),
								score: t.Number(),
								capsule: t.Optional(t.String()),
								release_date: t.Optional(t.Any()),
								vectorIndex: t.String(),
							}),
						),
						400: t.Object({ message: t.String() }),
						503: t.Object({
							message: t.String(),
							detail: t.Optional(t.String()),
						}),
					},
				},
			)
			.get(
				"/vector-recommendations/text",
				async ({ query, status }) => {
					const params = query as Record<string, string | undefined>;
					const rawLimit = params?.limit ? Number(params.limit) : Number.NaN;
					const limit = Number.isFinite(rawLimit)
						? Math.min(Math.max(Math.floor(rawLimit), 1), 50)
						: 10;
					try {
						if (!params?.text) {
							return status(400, {
								message: "Proporciona text para obtener recomendaciones basadas en texto.",
							});
						}
						return await recommendSimilarGamesForText({
							text: params.text,
							limit,
						});
					} catch (error) {
						console.error("Error generating text vector recommendations", error);
						return status(503, {
							message: "No se pudieron generar recomendaciones en este momento.",
							detail: error instanceof Error ? error.message : String(error),
						});
					}
				},
				{
					query: t.Object({
						text: t.Optional(t.String()),
						limit: t.Optional(t.String()),
					}),
					response: {
						200: t.Array(
							t.Object({
								_id: t.String(),
								appid: t.Optional(t.Number()),
								name: t.Optional(t.String()),
								score: t.Number(),
								capsule: t.Optional(t.String()),
								release_date: t.Optional(t.Any()),
								vectorIndex: t.String(),
							}),
						),
						400: t.Object({ message: t.String() }),
						503: t.Object({
							message: t.String(),
							detail: t.Optional(t.String()),
						}),
					},
				},
			)
	);
