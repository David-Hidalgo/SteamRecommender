// Adaptado de footer.tsx para usar JSX en ElysiaJS con @elysiajs/html.
// Importa Html para JSX (asegúrate de tener tsconfig.json configurado con jsx: "react", jsxFactory: "Html.createElement").
// biome-ignore lint/correctness/noUnusedImports: HTML de ellysia siempre requerido
import { Html } from "@elysiajs/html";

const Footer = () => {
	const year = new Date().getFullYear();

	const container: Record<string, string> = {
		padding: "1rem",
		textAlign: "center",
		borderTop: "1px solid #eaeaea",
		marginTop: "2rem",
		color: "#666",
		fontSize: "0.9rem",
		background: "transparent",
	};

	const linkStyle: Record<string, string> = {
		color: "inherit",
		textDecoration: "none",
		margin: "0 0.5rem",
	};

	return (
		<footer style={container}>
			<div>© {year} Tu proyecto</div>
			<div>
				<a href="/privacy" style={linkStyle}>
					Privacidad
				</a>
				<a href="/terms" style={linkStyle}>
					Términos
				</a>
				<a
					href="https://github.com"
					target="_blank"
					rel="noopener noreferrer"
					style={linkStyle}
				>
					GitHub
				</a>
			</div>
		</footer>
	);
};

export default Footer;