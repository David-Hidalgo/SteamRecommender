// JS mínimo para el index — ahora usa <game-card> web component solicitado

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
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    transition: transform 0.2s;
                    cursor: pointer;
                }
                :host(:hover) {
                    transform: translateY(-5px);
                }
                img {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                .card-content {
                    padding: 12px 10px;
                    background-color: transparent;
                }
                h3 {
                    margin: 0;
                    font-size: 1.02rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            </style>
            <article>
                <img src="${imageUrl}" alt="${escapeHtml(name)}" loading="lazy">
                <div class="card-content">
                    <h3>${escapeHtml(name)}</h3>
                </div>
            </article>
        `;
		// wire load/error handling inside the component so consumers can react
		const img = this.shadowRoot.querySelector("img");
		if (img) {
			let triedCapsule = false;
			img.addEventListener("error", () => {
				// try capsule fallback if provided
				if (!triedCapsule && capsuleAttr) {
					triedCapsule = true;
					img.src = capsuleAttr;
					return;
				}
				// dispatch an event so the host page can remove the card
				this.dispatchEvent(new CustomEvent("img-error", { bubbles: true }));
			});
			img.addEventListener("load", () => {
				this.dispatchEvent(new CustomEvent("img-load", { bubbles: true }));
			});
		}
	}
}

customElements.define("game-card", GameCard);

document.addEventListener("DOMContentLoaded", async () => {
	const container = document.getElementById("top-games");
	if (!container) return;
	try {
		const res = await fetch("/api/games/top10");
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const games = await res.json();
		if (!Array.isArray(games) || games.length === 0) {
			container.innerHTML = "<p>No hay juegos para mostrar.</p>";
			return;
		}
		container.innerHTML = "";
		for (const g of games) {
			// skip entries without an appid
			if (!g?.appid) continue;

			const el = document.createElement("game-card");
			el.setAttribute("appid", String(g.appid));
			el.setAttribute("name", String(g.name ?? ""));
			// pass capsule fallback to the component when available
			if (g.capsule) el.setAttribute("capsule", g.capsule);
			// Wrap the card in a native link to guarantee navigation even if
			// Shadow DOM event propagation behaves unexpectedly in some browsers
			const link = document.createElement("a");
			link.href = `/public/views/games/game.html?appid=${encodeURIComponent(
				String(g.appid),
			)}`;
			link.style.display = "block";
			link.style.textDecoration = "none";
			link.appendChild(el);
			container.appendChild(link);

			// remove the card if image fails (component will dispatch 'img-error')
			el.addEventListener(
				"img-error",
				() => {
					el.remove();
				},
				{ once: true },
			);

			// safety: if image neither loads nor errors in 6s, remove the card
			const safetyTimeout = setTimeout(() => {
				try {
					const img = el.shadowRoot && el.shadowRoot.querySelector("img");
					if (!img || img.naturalWidth === 0) el.remove();
				} catch (e) {
					/* ignore */
				}
			}, 6000);
			el.addEventListener("img-load", () => clearTimeout(safetyTimeout), {
				once: true,
			});
		}
	} catch (err) {
		console.error("Error cargando top juegos", err);
		container.innerHTML = "<p>Error al cargar los juegos.</p>";
	}
});

function escapeHtml(s) {
	return String(s).replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			],
	);
}
