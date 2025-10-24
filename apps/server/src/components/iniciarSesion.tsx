// Adaptado de footer.tsx para usar JSX en ElysiaJS con @elysiajs/html.
// Importa Html para JSX (asegúrate de tener tsconfig.json configurado con jsx: "react", jsxFactory: "Html.createElement").
import {
	authClient,
	getErrorMessage,
} from "@SteamRecommender/auth/lib/auth-client";
// biome-ignore lint/correctness/noUnusedImports: HTML de ellysia siempre requerido
import { Html } from "@elysiajs/html";

const handleSubmit = async (event: SubmitEvent) => {
	event.preventDefault();
	const form = event.currentTarget as HTMLFormElement | null;
	if (!form) return;
	const formData = new FormData(form);
	const email = formData.get("email");
	const password = formData.get("password");
	if (typeof email !== "string" || typeof password !== "string") {
		alert("Por favor, completa los campos de correo y contraseña.");
		return;
	}
	const { error } = await authClient.signIn.email({ email, password });
	if (error && error.code !== undefined) {
		const message = getErrorMessage(error.code, "es") || "Error desconocido.";
		alert(`Error al iniciar sesión: ${message}`);
		return;
	}
	form.reset();
};

if (typeof document !== "undefined") {
	document.addEventListener("DOMContentLoaded", () => {
		const form = document.getElementById(
			"login-form",
		) as HTMLFormElement | null;
		if (!form) return;
		form.addEventListener("submit", handleSubmit);
	});
}

export const IniciarSesion = () => (
	<div>
		<h2>Iniciar Sesión</h2>
		<form id="login-form" method="post" data-endpoint="/api/auth/sign-in/email">
			<div>
				<label htmlFor="email">Email:</label>
				<input type="email" name="email" required />
			</div>
			<div>
				<label htmlFor="password">Contraseña:</label>
				<input type="password" name="password" required />
			</div>
			<button type="submit">Iniciar Sesión</button>
		</form>
	</div>
);
