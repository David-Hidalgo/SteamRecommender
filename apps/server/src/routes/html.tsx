import { html, Html } from "@elysiajs/html";
import { Elysia } from "elysia";

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
		));
