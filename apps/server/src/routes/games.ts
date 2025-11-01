import { User } from "@SteamRecommender/db/models/auth.model";
import { Game as GameModel } from "@SteamRecommender/db/models/games.model";
import { Elysia, t } from "elysia";

// Games plugin: routes that do not require user context
export const plugin = <T extends string>(config: { prefix: T }) =>
	new Elysia({
		name: "Games",
		seed: config,
		prefix: config.prefix,
	}).group(
		"/games",
		(app) =>
			app
				.get("/", () => "Games endpoint")
				.get(
					"/id/:id",
					async ({ params: { id } }) => {
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
								{ $project: { appid: 1, name: 1, capsule: "$data.capsule_image" } },
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
								})
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
							const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
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
				),
	);
