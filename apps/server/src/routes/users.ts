import { User } from "@SteamRecommender/db/models/auth.model";
import { Game as GameModel } from "@SteamRecommender/db/models/games.model";
import { Elysia, t } from "elysia";

export const plugin = <T extends string>(config: { prefix: T }) =>
	new Elysia({
		name: "Users",
		seed: config,
		prefix: config.prefix,
	}).group(
		"/users",
		(app) =>
			app
				.get(
					"/",
					async ({ query }) => {
						const userId = (query as any)?.userId;
						try {
							if (userId) {
								const user = await User.findById(userId)
									.select("email name image createdAt wishlist gamePreferences")
									.populate(
										"gamePreferences.gameId",
										"appid name data.capsule_image",
									)
									.populate("wishlist.gameId", "appid name data.capsule_image")
									.lean()
									.exec();
								if (!user) return { status: 404, message: "Usuario no encontrado" };
								return user;
							}

							const users = await User.find()
								.select("email name image createdAt wishlist gamePreferences")
								.populate(
									"gamePreferences.gameId",
									"appid name data.capsule_image",
								)
								.populate("wishlist.gameId", "appid name data.capsule_image")
								.limit(200)
								.lean()
								.exec();
							return users;
						} catch (err) {
							console.error("Error fetching users", err);
							return [];
						}
					},
					{
						response: {
							200: t.Array(t.Any()),
						},
					},
				)

			// helper to resolve a game either by numeric appid or by Mongo _id

				.get(
					"/email/:email",
					async ({ params: { email }, status }) => {
						try {
							console.log("[users/email] lookup email=", email);
							const user = await User.findOne({ email: String(email) })
								.populate("gamePreferences.gameId", "appid name data.capsule_image")
								.populate("wishlist.gameId", "appid name data.capsule_image")
								.lean()
								.exec();
							if (!user) return status(404, { message: "Usuario no encontrado" });

							try {
								const wl = user.wishlist;
								const gp = user.gamePreferences;
								console.log(
									`[users/email] found user wishlist length=${Array.isArray(wl) ? wl.length : "n/a"} gamePreferences length=${Array.isArray(gp) ? gp.length : "n/a"}`,
								);
							} catch (e) {
								console.log(
									"[users/email] diagnostic: could not read wishlist/gamePreferences",
									e,
								);
							}

							return user;
						} catch (err) {
							console.error("Error fetching user by email", err);
							return status(500, { message: "Internal Server Error" });
						}
					},
					{
						params: t.Object({ email: t.String() }),
						response: {
							200: t.Any(),
							404: t.Object({ message: t.String() }),
							500: t.Object({ message: t.String() }),
						},
					},
				)
				.post(
					"/preference",
					async ({ body: { userId, gameId, rating, notes }, status }) => {
						// Resolve game by numeric appid or by Mongo _id
						let game = null;
						try {
							if (gameId != null && (typeof gameId === 'number' || String(gameId).match(/^\d+$/))) {
								const n = Number(gameId);
								game = await GameModel.findOne({ appid: n }).exec();
							}
							if (!game) {
								try { game = await GameModel.findById(String(gameId)).exec(); } catch(e) { /* ignore */ }
							}
						} catch (err) {
							console.error('Error resolving game', err);
						}
						if (!game) return status(404, { message: "Juego no encontrado" });

						const updated = await User.findOneAndUpdate(
							{ _id: userId, "gamePreferences.gameId": game._id },
							{ $set: { "gamePreferences.$.rating": rating, "gamePreferences.$.notes": notes ?? "" } },
							{ new: true },
						).exec();

						if (updated) return status(200, { message: "Preferencia actualizada" });

						const pushed = await User.findByIdAndUpdate(
							userId,
							{ $push: { gamePreferences: { gameId: game._id, rating, notes: notes ?? "" } } },
							{ new: true },
						).exec();

						if (!pushed) return status(404, { message: "Usuario no encontrado" });

						return status(201, { message: "Preferencia agregada" });
					},
					{
						body: t.Object({
							userId: t.String(),
							gameId: t.Any(),
							rating: t.Number({ minimum: 1, maximum: 5 }),
							notes: t.Optional(t.String()),
						}),
						response: {
							200: t.Object({ message: t.String() }),
							201: t.Object({ message: t.String() }),
							404: t.Object({ message: t.String() }),
							500: t.Object({ message: t.String() }),
						},
					},
				)
				.post(
					"/preference/email",
					async ({ body: { email, gameId, rating, notes }, status }) => {
						try {
							let game = null;
							if (gameId != null && (typeof gameId === 'number' || String(gameId).match(/^\d+$/))) {
								const n = Number(gameId);
								game = await GameModel.findOne({ appid: n }).exec();
							}
							if (!game) {
								try { game = await GameModel.findById(String(gameId)).exec(); } catch(e) { /* ignore */ }
							}
							if (!game) return status(404, { message: "Juego no encontrado" });

							const updated = await User.findOneAndUpdate(
								{ email, "gamePreferences.gameId": game._id },
								{ $set: { "gamePreferences.$.rating": rating, "gamePreferences.$.notes": notes ?? "" } },
								{ new: true },
							).exec();

							if (updated) return status(200, { message: "Preferencia actualizada" });

							const pushed = await User.findOneAndUpdate(
								{ email },
								{ $push: { gamePreferences: { gameId: game._id, rating, notes: notes ?? "" } } },
								{ new: true },
							).exec();

							if (!pushed) return status(404, { message: "Usuario no encontrado" });

							return status(201, { message: "Preferencia agregada" });
						} catch (err) {
							console.error("Error adding preference by email", err);
							return status(500, { message: "Internal Server Error" });
						}
					},
					{
						body: t.Object({
							email: t.String(),
							gameId: t.Any(),
							rating: t.Number({ minimum: 1, maximum: 5 }),
							notes: t.Optional(t.String()),
						}),
						response: {
							200: t.Object({ message: t.String() }),
							201: t.Object({ message: t.String() }),
							404: t.Object({ message: t.String() }),
							500: t.Object({ message: t.String() }),
						},
					},
				)
				.post(
					"/wishlist",
					async ({ body: { userId, gameId }, status }) => {
						let game = null;
						try {
							if (gameId != null && (typeof gameId === 'number' || String(gameId).match(/^\d+$/))) {
								game = await GameModel.findOne({ appid: Number(gameId) }).exec();
							}
							if (!game) {
								try { game = await GameModel.findById(String(gameId)).exec(); } catch(e) { /* ignore */ }
							}
							if (!game) return status(404, { message: "Juego no encontrado" });
						} catch (err) {
							console.error('Error resolving game for wishlist', err);
							return status(500, { message: 'Internal Server Error' });
						}

						const exists = await User.exists({ _id: userId, "wishlist.gameId": game._id });
						if (exists) return status(200, { message: "El juego ya está en la wishlist" });

						const pushed = await User.findByIdAndUpdate(
							userId,
							{ $push: { wishlist: { gameId: game._id } } },
							{ new: true },
						).exec();
						if (!pushed) return status(404, { message: "Usuario no encontrado" });

						return status(201, { message: "Juego agregado a la wishlist" });
					},
					{
						body: t.Object({
							userId: t.String(),
							gameId: t.Any(),
						}),
						response: {
							200: t.Object({ message: t.String() }),
							201: t.Object({ message: t.String() }),
							404: t.Object({ message: t.String() }),
							500: t.Object({ message: t.String() }),
						},
					},
				)
				.post(
						"/preference/remove",
						async ({ body: { userId, email, gameId }, status }) => {
							try {
								let game = null;
								if (gameId != null && (typeof gameId === 'number' || String(gameId).match(/^\d+$/))) {
									game = await GameModel.findOne({ appid: Number(gameId) }).exec();
								}
								if (!game) {
									try { game = await GameModel.findById(String(gameId)).exec(); } catch(e) { /* ignore */ }
								}
								if (!game) return status(404, { message: "Juego no encontrado" });
							const query: any = {};
							if (userId) query._id = userId;
							if (email) query.email = email;
							if (!query._id && !query.email) return status(400, { message: "Se requiere userId o email" });
							const updated = await User.findOneAndUpdate(query, { $pull: { gamePreferences: { gameId: game._id } } }, { new: true }).exec();
							if (!updated) return status(404, { message: "Usuario no encontrado" });
							return status(200, { message: "Preferencia eliminada" });
						} catch (err) {
							console.error("Error removing preference", err);
							return status(500, { message: "Internal Server Error" });
						}
					},
					{
						body: t.Object({ userId: t.Optional(t.String()), email: t.Optional(t.String()), gameId: t.Any() }),
						response: {
							200: t.Object({ message: t.String() }),
							400: t.Object({ message: t.String() }),
							404: t.Object({ message: t.String() }),
							500: t.Object({ message: t.String() }),
						},
					},
				),
	);