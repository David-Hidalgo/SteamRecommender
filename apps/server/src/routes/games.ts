import { Elysia } from "elysia";

export const plugin = <T extends string>(config: { prefix: T }) =>
	new Elysia({
		name: "Games",
		seed: config,
		prefix: config.prefix,
	})
	.get("/", () => "Games endpoint")