import { User } from "@SteamRecommender/db/models/auth.model";
import { Game as GameModel } from "@SteamRecommender/db/models/games.model";
import {
	recommendByGameContext,
	recommendForUserCollaborative,
	recommendGamesByPublisher,
	recommendSimilarGamesByContent,
} from "@SteamRecommender/db/recommender";
import { Elysia, t } from "elysia";
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
							{ $sample: { size: 10 } },
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
						const recs = await recommendForUserCollaborative(
							String(userId),
							Number(limit) || 20,
						);
						return recs;
					} catch (err) {
						console.error("Error running recommendForUserCollaborative:", err);
						return status(500, { message: "Internal Server Error" });
					}
				},
				{
					query: t.Object({
						userId: t.String(),
						limit: t.Optional(t.Number()),
					}),
				},
			),
	);
