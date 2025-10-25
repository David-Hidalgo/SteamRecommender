class GameCard extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		const appid = this.getAttribute("appid");
		const name = this.getAttribute("name");
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
          padding: 15px;
          background-color: #fff;
        }
        h3 {
          margin: 0;
          font-size: 1.1em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
      <article>
        <img src="${imageUrl}" alt="${name}" loading="lazy">
        <div class="card-content">
          <h3>${name}</h3>
        </div>
      </article>
    `;
	}
}

customElements.define("game-card", GameCard);
