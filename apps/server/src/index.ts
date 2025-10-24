import "dotenv/config";
import { auth } from "@SteamRecommender/auth";
import { cors } from "@elysiajs/cors";
import { cron, Patterns } from "@elysiajs/cron";
import { Html, html } from "@elysiajs/html";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import index from "./../public/index.html" with { type: "text" };
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
	.use(html())
	.use(
		cron({
			name: "heartbeat",
			pattern: Patterns.everyHours(),
			run() {
				console.log("Heartbeat");
			},
		}),
	)
	.use(gamesPlugin({ prefix: "/api" }))
	.onError(async ({ code, request }) => {
		console.log("Error");
		if (code === "NOT_FOUND" && request.method === "GET") {
			const notFoundPage = await loadNotFoundPage();
			return new Response(notFoundPage, {
				status: 404,
				headers: {
					"content-type": "text/html; charset=utf-8",
				},
			});
		}
	})
	.use(openapi())
	.use(staticPlugin())
	.use(htmlPlugin({ prefix: "/html" }))
	.all("/api/auth/*", async (context) => {
		const { request, status } = context;
		if (["POST", "GET"].includes(request.method)) {
			return auth.handler(request);
		}
		return status(405);
	})

	.get("/", () => index)
	.listen(3000, () => {
		console.log("Server is running on http://localhost:3000");
	});
