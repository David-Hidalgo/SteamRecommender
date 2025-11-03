// Recommender page: fetch vector recommendations for current user and render
import "../../scripts/game-card-wc.js";

async function fetchUserVectorRecs({ email, userId, limit = 24 } = {}) {
	const params = new URLSearchParams();
	if (email) params.set("email", email);
	params.set("limit", String(limit));
	console.log("Fetching vector recs with params:", params.toString());
	const res = await fetch(
		`/api/games/vector-recommendations/user?${params.toString()}`,
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return await res.json();
}


function createCardForGame(g) {
	const appid = g?.appid ?? null;
	const name = g?.name ?? g?.game?.name ?? "Sin título";
	const capsule = g?.capsule ?? g?.data?.capsule_image ?? null;

	const el = document.createElement("game-card-wc");
	el.gameData = { appid: appid, name: name, capsule: capsule, _id: g._id };

	const link = document.createElement("a");
	link.href = appid
		? `/public/views/games/game.html?appid=${encodeURIComponent(String(appid))}`
		: g._id
			? `/public/views/games/game.html?id=${encodeURIComponent(g._id)}`
			: "#";
	link.style.display = "block";
	link.style.textDecoration = "none";
	link.appendChild(el);

	// remove card if image fails to load
	el.addEventListener("img-error", () => el.remove(), { once: true });

	// safety timeout
	const safety = setTimeout(() => {
		try {
			const img = el.shadowRoot?.querySelector("img");
			if (!img || img.naturalWidth === 0) el.remove();
		} catch (_e) {}
	}, 6000);
	el.addEventListener("img-load", () => clearTimeout(safety), { once: true });

	return link;
}

document.addEventListener("DOMContentLoaded", async () => {
	const container = document.getElementById("recommended-games");
	const status = document.getElementById("rec-status");
	if (!container || !status) return;
	status.textContent = "Cargando recomendaciones...";

	// get current user from localStorage
	let me = null;
	try {
		me = JSON.parse(localStorage.getItem("user") || "null");
	} catch (_e) {
		me = null;
	}
	if (!me || (!me.email && !me._id)) {
		status.innerHTML = `Inicia sesión para ver recomendaciones personales. <a href="/public/views/login/login.html">Iniciar sesión</a>`;
		return;
	}

	try {
		const res = await fetchUserVectorRecs({
			email: me.email,
			userId: me._id,
			limit: 24,
		});
		if (!Array.isArray(res) || res.length === 0) {
			status.textContent = "No hay recomendaciones disponibles por ahora.";
			return;
		}
		console.log("Vector recommendations received:", res);
		container.innerHTML = "";
		for (const g of res) {
			// normalize shape
			const obj = g && typeof g === "object" ? g : {};
			const card = createCardForGame(obj);
			container.appendChild(card);
		}
		status.textContent = "";
	} catch (err) {
		console.error("Error fetching vector recs:", err);
		status.textContent = "Error al obtener recomendaciones. Intenta más tarde.";
	}
});
