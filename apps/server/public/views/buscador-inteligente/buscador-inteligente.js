// Código para el buscador inteligente — define <game-card> component (ligero) y maneja búsqueda

class GameCard extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		const appid = this.getAttribute("appid");
		const name = this.getAttribute("name") || "";
		const capsuleAttr = this.getAttribute("capsule") || null;
		const imageUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;

		this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 6px 18px rgba(0,0,0,0.35);
                    transition: transform 0.18s ease;
                    cursor: pointer;
                    background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.05));
                }
                :host(:hover) { transform: translateY(-6px); }
                img { width:100%; height:auto; display:block; }
                .card-content { padding: 10px; background: transparent; }
                h3 { margin:0; font-size:1rem; color:var(--text,#e6e6ea); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            </style>
            <article>
                <img src="${imageUrl}" alt="${escapeHtml(name)}" loading="lazy">
                <div class="card-content">
                    <h3>${escapeHtml(name)}</h3>
                </div>
            </article>
        `;

		const img = this.shadowRoot.querySelector("img");
		if (img) {
			let triedCapsule = false;
			img.addEventListener("error", () => {
				if (!triedCapsule && capsuleAttr) {
					triedCapsule = true;
					img.src = capsuleAttr;
					return;
				}
				this.dispatchEvent(new CustomEvent("img-error", { bubbles: true }));
			});
			img.addEventListener("load", () => {
				this.dispatchEvent(new CustomEvent("img-load", { bubbles: true }));
			});
		}
	}
}
customElements.define("game-card", GameCard);

function escapeHtml(s) {
	return String(s).replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			],
	);
}

// Función para renderizar resultados en el contenedor
async function renderGamesList(container, games) {
	container.innerHTML = "";
	if (!Array.isArray(games) || games.length === 0) {
		container.innerHTML = '<p class="empty-msg">No se encontraron juegos.</p>';
		return;
	}

	for (const g of games) {
		if (!g?.appid) continue;
		const el = document.createElement("game-card");
		el.setAttribute("appid", String(g.appid));
		el.setAttribute("name", String(g.name ?? ""));
		const capsule = g.capsule || (g.data && g.data.capsule_image) || "";
		if (capsule) el.setAttribute("capsule", capsule);

		const link = document.createElement("a");
		link.href = `/public/views/games/game.html?appid=${encodeURIComponent(String(g.appid))}`;
		link.style.display = "block";
		link.style.textDecoration = "none";
		link.appendChild(el);
		container.appendChild(link);

		el.addEventListener("img-error", () => el.remove(), { once: true });

		const safetyTimeout = setTimeout(() => {
			try {
				const img = el.shadowRoot && el.shadowRoot.querySelector("img");
				if (!img || img.naturalWidth === 0) el.remove();
			} catch (e) {}
		}, 6000);
		el.addEventListener("img-load", () => clearTimeout(safetyTimeout), {
			once: true,
		});
	}
}

document.addEventListener("DOMContentLoaded", () => {
	const input = document.getElementById("search-input");
	const btn = document.getElementById("search-btn");
	const container = document.getElementById("top-games");
	if (!input || !btn || !container) return;

	let pending = null;

	async function doSearch() {
		const q = String(input.value || "").trim();
		if (q.length === 0) {
			container.innerHTML =
				'<p class="empty-msg">Escribe algo para buscar.</p>';
			return;
		}
		container.innerHTML = '<p class="empty-msg">Buscando…</p>';
		try {
			const res = await fetch(
				`/api/games/vector-recommendations/text?text=${encodeURIComponent(q)}&limit=25`,
			);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const games = await res.json();
			await renderGamesList(container, games);
		} catch (err) {
			console.error("Error buscando juegos:", err);
			container.innerHTML =
				'<p class="empty-msg">Error al buscar. Intenta de nuevo más tarde.</p>';
		}
	}

	// submit on enter
	input.addEventListener("keydown", (ev) => {
		if (ev.key === "Enter") {
			ev.preventDefault();
			if (pending) clearTimeout(pending);
			pending = setTimeout(() => doSearch(), 0);
		}
	});

	btn.addEventListener("click", (ev) => {
		ev.preventDefault();
		if (pending) clearTimeout(pending);
		pending = setTimeout(() => doSearch(), 0);
	});

	// Optional: simple debounce for live searching while typing (not required)
	let debounceTimer = null;
	input.addEventListener("input", () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			// only run live search for 3+ chars to avoid noise
			if ((input.value || "").trim().length >= 3) doSearch();
		}, 420);
	});
});
