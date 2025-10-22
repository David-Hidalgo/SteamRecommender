import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	noExternal: [/@SteamRecommender\/.*/],
	external: ["public/index.html", "public/Frontend/games.html"],
	copy: [{ from: "public", to: "dist" }],
});
