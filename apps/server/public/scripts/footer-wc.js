class FooterWC extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		const year = new Date().getFullYear();
		if (this.shadowRoot) {
			this.shadowRoot.innerHTML = `
				<style>
					footer {
						padding: 1rem;
						text-align: center;
						border-top: 1px solid var(--table-border, rgba(255,255,255,0.06));
						margin-top: 2rem;
						color: var(--muted, #c6c6cf);
						font-size: 0.9rem;
						background: var(--footer-bg, transparent);
					}
					a {
						color: var(--text, #e8e8ee);
						text-decoration: none;
						margin: 0 0.5rem;
					}
				</style>
				<footer>
					<div>© ${year} Tu proyecto</div>
					<div>
						<a href="/privacy">Privacidad</a>
						<a href="/terms">Términos</a>
						<a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
					</div>
				</footer>
			`;
		}
	}
}

customElements.define("footer-wc", FooterWC);
