import { User } from "@SteamRecommender/db/models/auth.model";
import { Game as GameModel } from "@SteamRecommender/db/models/games.model";
import { Elysia, t } from "elysia";
import {
	recommendSimilarGamesByContent,
	recommendForUserCollaborative,
	recommendGamesByPublisher,
	recommendByGameContext,
} from "@SteamRecommender/db/recommender";
// Intentamos usar el cliente nativo exportado por el paquete db

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
					params: t.Object({
						id: t.Number(),
					}),
					query: t.Object({
						name: t.String(),
					}),
				},
			)
			.get("/list", async () => {
				try {
					return await GameModel.find()
						.select("_id data.type data.categories data.capsule_image")
						.limit(50)
						.exec();
				} catch (err) {
					console.error("Error reading games from DB:", err);
					return [];
				}
			})
			.post(
				"/user/preference",
				async ({ body: { userId, gameId, rating, notes }, status }) => {
					const user = await User.findById(userId);
					if (!user) return status(404, { message: "Usuario no encontrado" });

					const game = await GameModel.findOne({ appid: gameId });
					if (!game) return status(404, { message: "Juego no encontrado" });

					user.gamePreferences.push({
						gameId: game._id,
						rating,
						notes: notes ?? "",
					});
					await user.save();

					return status(201, { message: "Preferencia agregada" });
				},
				{
					body: t.Object({
						userId: t.String(),
						gameId: t.Numeric(),
						rating: t.Number({ minimum: 1, maximum: 5 }),
						notes: t.Optional(t.String()),
					}),
					response: {
						201: t.Object({ message: t.String() }),
						404: t.Object({ message: t.String() }),
					},
				},
			)
			.post(
				"/user/wishlist",
				async ({ body: { userId, gameId }, status }) => {
					const user = await User.findById(userId);
					if (!user) return status(404, { message: "Usuario no encontrado" });

					const game = await GameModel.findOne({ appid: gameId });
					if (!game) return status(404, { message: "Juego no encontrado" });

					const alreadyInWishlist = user.wishlist.some(
						({ gameId: storedGameId }) => storedGameId?.equals?.(game._id),
					);
					if (alreadyInWishlist)
						return status(200, { message: "El juego ya está en la wishlist" });

					user.wishlist.push({ gameId: game._id });
					await user.save();

					return status(201, { message: "Juego agregado a la wishlist" });
				},
				{
					body: t.Object({
						userId: t.String(),
						gameId: t.Numeric(),
					}),
					response: {
						200: t.Object({ message: t.String() }),
						201: t.Object({ message: t.String() }),
						404: t.Object({ message: t.String() }),
					},
				},
			)
			.get(
				"/appid/:appid/similar",
				async (ctx: any) => {
					const { appid } = ctx.params || {};
					const { status } = ctx;
					try {
						console.info("Running recommendSimilarGamesByContent for appid:", appid);
						const recs = await recommendSimilarGamesByContent(Number(appid), 20);
						return recs;
					} catch (err: any) {
						console.error("Error running recommendSimilarGamesByContent:", err?.message || err, err?.stack);
						// Dev-only: return error message/stack to help debugging
						return status(500, { message: err?.message ?? "Internal Server Error", stack: err?.stack });
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
					if (!userId) return status(400, { message: "userId query param is required" });
					try {
						const recs = await recommendForUserCollaborative(String(userId), Number(limit) || 20);
						return recs;
					} catch (err) {
						console.error("Error running recommendForUserCollaborative:", err);
						return status(500, { message: "Internal Server Error" });
					}
				},
				{
					query: t.Object({ userId: t.String(), limit: t.Optional(t.Number()) }),
				},
			),
	);
