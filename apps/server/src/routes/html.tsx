/** biome-ignore-all lint/correctness/noUnusedImports: Elisia necesita importar HTML aunque no lo use */
import { Html, html } from "@elysiajs/html";
import { Elysia } from "elysia";
import Footer from "@/components/footer";

export const plugin = <T extends string>(config: { prefix: T }) =>
	new Elysia({
		name: "Html",
		seed: config,
		prefix: config.prefix,
	})
		.use(html())
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
