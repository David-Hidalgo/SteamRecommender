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
						border-top: 1px solid #eaeaea;
						margin-top: 2rem;
						color: #666;
						font-size: 0.9rem;
						background: transparent;
					}
					a {
						color: inherit;
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
