import "dotenv/config";
import { auth } from "@SteamRecommender/auth";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import { plugin as gamesPlugin } from "./routes/games";
import { plugin as htmlPlugin } from "./routes/html";

const NOT_FOUND_PAGE_URL =
	"https://raw.githubusercontent.com/Apple2007/ErrorCodePages/refs/heads/main/404notfound.html";
let cachedNotFoundPage: string | null = null;

const loadNotFoundPage = async (): Promise<string> => {
	if (cachedNotFoundPage) {
		return cachedNotFoundPage;
	}

	try {
		const response = await fetch(NOT_FOUND_PAGE_URL);
		if (!response.ok) {
			throw new Error(`Unexpected status ${response.status}`);
		}

		const html = await response.text();
		cachedNotFoundPage = html;
		return html;
	} catch (error) {
		console.error("Failed to load remote 404 page", error);
		return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not Found</title></head><body><h1>404 Not Found</h1></body></html>';
	}
};

const _app = new Elysia()
	.use(
		cors({
			origin: process.env.CORS_ORIGIN || "",
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	.use(openapi())
	.use(staticPlugin())
	.use(htmlPlugin({ prefix: "/html" }))
	.use(gamesPlugin({ prefix: "/games" }))
	.mount(auth.handler)
	// .all("/api/auth/*", async (context) => {
	// 	const { request, status } = context;
	// 	if (["POST", "GET"].includes(request.method)) {
	// 		return auth.handler(request);
	// 	}
	// 	return status(405);
	// })

	.get("/", () => "OK")
	.onError(async ({ code, request, set }) => {
		if (code === "NOT_FOUND" && request.method === "GET") {
			set.status = 404;
			set.headers ??= {};
			set.headers["content-type"] = "text/html; charset=utf-8";
			return await loadNotFoundPage();
		}
	})
	.listen(3000, () => {
		console.log("Server is running on http://localhost:3000");
	});
