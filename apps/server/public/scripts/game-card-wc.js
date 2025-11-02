// game-card-wc.js
class GameCardWC extends HTMLElement {
	constructor() {
		super();
		this._shadow = this.attachShadow({ mode: "open" });
		this._data = null;
	}
	connectedCallback() {
		// always attempt to render — if no data provided we'll show a sensible fallback
		this._render();
	}
	set gameData(d) {
		this._data = d;
		this._render();
	}
	_render() {
		const g = this._data || {};
		const img =
			g.capsule ||
			"data:image/svg+xml;utf8," +
				encodeURIComponent(
					`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" font-size="22" fill="#999" dominant-baseline="middle" text-anchor="middle">Sin imagen</text></svg>`,
				);
		const name = (g.name || "Sin datos").toString();
		this._shadow.innerHTML = `
            <style>
                    :host{display:block}
                    .card{border-radius:12px; overflow:visible; background:transparent}
                    /* subtle light card background for dark theme */
                    .cover{width:100%; aspect-ratio:16/9; display:block; border-radius:12px; background:rgba(255,255,255,0.03); box-shadow:0 6px 18px rgba(0,0,0,0.18)}
                    .cover img{width:100%;height:100%;object-fit:contain;border-radius:12px;display:block}
                    /* light text for dark background */
                    .name{margin-top:8px;text-align:center;font-size:0.95rem;color:#ffffff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                    @media (max-width:520px){ .name{font-size:0.86rem} }
                </style>
            <div class="card">
                <div class="cover"><img src="${img}" alt="${this._escape(name)}"/></div>
                <div class="name" title="${this._escape(name)}">${this._escape(name)}</div>
            </div>
        `;
	}
	_escape(s) {
		return String(s)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}
}
customElements.define("game-card-wc", GameCardWC);
