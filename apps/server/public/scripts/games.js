async function loadGames() {
	const status = document.getElementById("status");
	const tbl = document.getElementById("games-table");
	const body = document.getElementById("games-body");
	try {
		const res = await fetch("/api/games/list");
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = await res.json();
		// Guardar los juegos en localStorage
		localStorage.setItem('games', JSON.stringify(data));
		if (!Array.isArray(data) || data.length === 0) {
			if (status) status.textContent = "No hay juegos guardados.";
			return;
		}
		if (status) status.style.display = "none";
		if (tbl) tbl.style.display = "";
		for (const g of data) {
			const tr = document.createElement("tr");
			const idTd = document.createElement("td");
			idTd.textContent = String(g.appid ?? g.steam_appid ?? g._id ?? "");
			const nameTd = document.createElement("td");
			nameTd.textContent = g.name ?? g.data?.name ?? "";
			const typeTd = document.createElement("td");
			typeTd.textContent = g.data?.type ?? "";
			tr.appendChild(idTd);
			tr.appendChild(nameTd);
			tr.appendChild(typeTd);
			if (body) body.appendChild(tr);

		}
	} catch (err) {
		if (status) status.textContent = `Error al cargar juegos: ${String(err)}`;
	}
}

if (typeof window !== "undefined") {
	window.addEventListener("DOMContentLoaded", loadGames);
}
