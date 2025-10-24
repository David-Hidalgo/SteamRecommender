/** biome-ignore-all lint/correctness/noUnusedImports: Elisia necesita importar HTML aunque no lo use */
import { Html, html } from "@elysiajs/html";
import staticPlugin from "@elysiajs/static";
import { Elysia } from "elysia";
import GamesPage from "public/Frontend/games.html" with { type: "text" };
import index from "public/index.html" with { type: "text" };
import Footer from "@/components/footer";
import indexP from "@/components/index.html" with { type: "text" };

export const plugin = <T extends string>(config: { prefix: T }) =>
	new Elysia({
		name: "Html",
		seed: config,
		prefix: config.prefix,
	})
		.use(html())
		.use(staticPlugin({ assets: "public" }))
		.get(`${config.prefix}/hi`, () => "Hi")
		.get(
			"/html",
			() => `
            <html lang='en'>
                <head>
                    <title>Hello World HTML</title>
                    <script type="module" src="/public/scripts/footer-wc.js"></script>
                </head>
                <body>
                    <h1>Hello World HTML</h1>
                    <footer-wc>ASASA</footer-wc>
					<b>Chamo</b>
				</body>
			</html>`,
		)
		// cargar un HTML en /public/index.html
		.get("/", () => index)
		// cargar un HTML en ../components/
		.get("/prueba", () => indexP)
		// cargar un HTML en /public/Frontend/games.html
		.get("/games", () => GamesPage)
		.get("/tsx", () => (
			<html lang="en">
				<head>
					<title>Hello World TSX</title>
				</head>
				<body>
					<h1>Hello World TSX</h1>
					<Footer />
				</body>
			</html>
		));
