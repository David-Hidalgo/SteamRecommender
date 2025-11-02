// dashboard.js - fetch top10 and render <game-card-wc>
window.addEventListener("DOMContentLoaded", async () => {
	const status = document.getElementById("status");
	const container = document.getElementById("games-container");
	if (!status || !container) return;
	try {
		status.textContent = "Cargando juegos...";
		const res = await fetch("/api/games/top10");
		if (!res.ok) throw new Error("HTTP " + res.status);
		const games = await res.json();
		if (!Array.isArray(games) || games.length === 0) {
			status.textContent = "No hay juegos para mostrar.";
			return;
		}
		status.textContent = "";
		container.innerHTML = "";
		for (const g of games) {
			const el = document.createElement("game-card-wc");
			el.gameData = g;
			container.appendChild(el);
		}
	} catch (err) {
		console.error("Error cargando top10", err);
		status.textContent = "Error al cargar los juegos.";
	}
});
