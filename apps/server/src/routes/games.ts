import { Game as GameModel } from "@SteamRecommender/db/models/games.model";
import { Elysia } from "elysia";
// Intentamos usar el cliente nativo exportado por el paquete db

export const plugin = <T extends string>(config: { prefix: T }) =>
	new Elysia({
		name: "Games",
		seed: config,
		prefix: config.prefix,
	}).group("/games", (app) =>
		app
			.get("/", () => "Games endpoint")
			.get("/list", async () => {
				try {
					return await GameModel.find().limit(50).exec();
				} catch (err) {
					console.error("Error reading games from DB:", err);
					return [];
				}
			}),
	);
