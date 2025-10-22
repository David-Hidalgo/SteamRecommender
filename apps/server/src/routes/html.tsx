/** biome-ignore-all lint/correctness/noUnusedImports: Elisia necesita importar HTML aunque no lo use */
import { Html, html } from "@elysiajs/html";
import { Elysia } from "elysia";
import GamesPage from "public/Frontend/games.html" with { type: "text" };
import index from "public/index.html" with { type: "text" };

export const plugin = <T extends string>(config: { prefix: T }) =>
	new Elysia({
		name: "Html",
		seed: config,
		prefix: config.prefix,
	})
		.use(html())
		.get(`${config.prefix}/hi`, () => "Hi")
		.get(
			"/html",
			() => `
            <html lang='en'>
                <head>
                    <title>Hello World HTML</title>
                </head>
                <body>
                    <h1>Hello World HTML</h1>
                </body>
            </html>`,
		)
		.get("/tsx", () => (
			<html lang="en">
				<head>
					<title>Hello World TSX</title>
				</head>
				<body>
					<h1>Hello World TSX</h1>
				</body>
			</html>
		))
		.get("/", () => index)
		.get("/games", () => GamesPage);
