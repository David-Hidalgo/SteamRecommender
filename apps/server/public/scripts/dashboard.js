async function loadGames() {
	const status = document.getElementById("status");
	const container = document.getElementById("games-container");

	try {
		const res = await fetch("/api/games/list");
		if (!res.ok) {
			throw new Error(`Error HTTP ${res.status}`);
		}
		const games = await res.json();

		if (!Array.isArray(games) || games.length === 0) {
			status.textContent = "No se encontraron juegos.";
			return;
		}

		status.style.display = "none";

		for (const game of games) {
			const gameCard = document.createElement("game-card");
			const appId = game.appid ?? game.steam_appid ?? game._id;
			const name = game.name ?? game.data?.name;

			if (appId && name) {
				gameCard.setAttribute("appid", appId);
				gameCard.setAttribute("name", name);
				container.appendChild(gameCard);
			}
		}
	} catch (error) {
		status.textContent = `Error al cargar los juegos: ${error.message}`;
		console.error(error);
	}
}

if (typeof window !== "undefined") {
	window.addEventListener("DOMContentLoaded", loadGames);
}
