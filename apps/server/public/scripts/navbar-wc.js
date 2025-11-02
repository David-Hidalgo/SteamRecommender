class NavbarWC extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		// connected
		const userJson = localStorage.getItem("user");
		let username = "Invitado";
		try {
			if (userJson) {
				const u = JSON.parse(userJson);
				username = u?.name ?? u?.username ?? String(u) ?? "Invitado";
			}
		} catch (e) {
			// ignore parse errors
		}

		if (this.shadowRoot) {
			this.shadowRoot.innerHTML = `
        <style>
          :host{ display:block; }
          nav{
            display:flex;
            align-items:center;
            justify-content:space-between;
            padding:0.6rem 1rem;
            gap:1rem;
            background: var(--nav-bg, linear-gradient(180deg,#0f1115,#111217));
            background-color: var(--surface, #0f1115) !important;
            color: var(--text, #e8e8ee) !important;
            box-shadow: 0 1px 0 rgba(0,0,0,0.3), 0 6px 18px rgba(0,0,0,0.35);
            border-radius:8px;
          }
          .left, .center, .right{ display:flex; align-items:center; gap:0.75rem }
          .logo{ display:flex; align-items:center; gap:0.5rem; font-weight:700; color:var(--accent-600); font-size:1rem }
          .logo svg{ width:34px; height:34px; filter: drop-shadow(0 2px 4px rgba(106,27,154,0.12)); }
          a.button{ padding:0.4rem 0.75rem; border-radius:8px; text-decoration:none; color:var(--muted); background:transparent; font-weight:600; transition:all .18s ease }
          a.button:hover{ color:var(--accent); transform:translateY(-1px); box-shadow:0 6px 12px rgba(106,27,154,0.06) }
          .user{ font-size:0.95rem; color:var(--muted); display:flex; align-items:center; gap:0.5rem }
          .avatar{
            min-width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg,var(--accent,#9b59b6),var(--accent-600,#7b3aa8)); display:inline-flex; align-items:center; justify-content:center; color:var(--text,#fff); font-weight:700; box-shadow:0 4px 10px rgba(123,58,168,0.12)
          }
          .user-btn{ display:flex; align-items:center; gap:0.5rem; cursor:pointer; border-radius:8px; padding:0.15rem 0.25rem }
          .user-btn:focus{ outline:2px solid rgba(106,27,154,0.12) }
          .dropdown{ position:absolute; right:0; top:calc(100% + 10px); min-width:160px; background:var(--surface,#0f1115); border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.45); padding:0.5rem 0.25rem; display:none; z-index:40 }
          .dropdown.open{ display:block }
          .dropdown a, .dropdown button{ display:block; width:100%; text-align:left; padding:0.5rem 0.75rem; border:none; background:transparent; color:var(--text,#e8e8ee); text-decoration:none; font-weight:600; cursor:pointer }
          .dropdown a:hover, .dropdown button:hover{ background:linear-gradient(90deg, rgba(123,58,168,0.06), transparent) }
          .right{ position:relative }
          /* responsive: collapse center links into a small menu on narrow screens */
          .center{ gap:0.5rem }
          @media (max-width:640px){
            nav{ flex-direction:column; align-items:stretch; padding:0.5rem }
            .center{ order:3; justify-content:space-around; padding:0.4rem 0 }
            .left{ justify-content:space-between }
          }
        </style>
        <nav>
          <div class="left">
            <div class="logo">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <rect width="24" height="24" rx="6" fill="url(#g)"></rect>
                <defs>
                  <linearGradient id="g" x1="0" x2="1">
                    <stop offset="0%" stop-color="#7b1fa2" />
                    <stop offset="100%" stop-color="#8e24aa" />
                  </linearGradient>
                </defs>
                <path d="M7 12.5c1.5-2 4-3 6.5-3" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>SteamRecommender</span>
            </div>
          </div>
          <div class="center">
            <a class="button" href="/public/index.html">Inicio</a>
            <a class="button" href="/public/views/games/games.html">Juegos</a>
          </div>
          <div class="right">
            <div class="user-btn" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false">
              <span class="avatar">${username.slice(0, 1).toUpperCase()}</span>
              <span style="margin-left:.25rem">${username}</span>
            </div>
            <div class="dropdown" role="menu">
              <a href="/public/views/users/users.html" class="menu-profile" role="menuitem">Perfil</a>
              <button class="menu-logout" type="button" role="menuitem">Cerrar sesión</button>
            </div>
          </div>
        </nav>
      `;

			// Interactividad: abrir/cerrar dropdown y logout
			const userBtn = this.shadowRoot.querySelector(".user-btn");
			const dropdown = this.shadowRoot.querySelector(".dropdown");
			const logoutBtn = this.shadowRoot.querySelector(".menu-logout");
			const profileLink = this.shadowRoot.querySelector(".menu-profile");

			const onDocClick = (e) => {
				// usar composedPath para respetar shadow DOM
				const path = e.composedPath ? e.composedPath() : e.path || [];
				if (!path.includes(this)) {
					dropdown.classList.remove("open");
					if (userBtn) userBtn.setAttribute("aria-expanded", "false");
				}
			};

			const toggle = (ev) => {
				ev?.stopPropagation();
				const isOpen = dropdown.classList.toggle("open");
				if (userBtn) userBtn.setAttribute("aria-expanded", String(isOpen));
			};

			userBtn?.addEventListener("click", toggle);
			userBtn?.addEventListener("keydown", (ev) => {
				if (ev.key === "Enter" || ev.key === " ") {
					ev.preventDefault();
					toggle(ev);
				}
				if (ev.key === "Escape") {
					dropdown.classList.remove("open");
					userBtn.setAttribute("aria-expanded", "false");
				}
			});

			window.addEventListener("click", onDocClick);

			profileLink?.addEventListener("click", (e) => {
				// navigate to new user profile page
				e.preventDefault();
				location.href = "/public/views/user/user.html";
			});

			logoutBtn?.addEventListener("click", () => {
				localStorage.removeItem("user");
				location.reload();
			});

			// Expose logout for programmatic use
			this.logout = () => {
				localStorage.removeItem("user");
				location.reload();
			};

			// Store cleanup reference for disconnectedCallback
			this.__nav_cleanup = () => {
				window.removeEventListener("click", onDocClick);
			};
		}
	}

	disconnectedCallback() {
		if (this.__nav_cleanup) this.__nav_cleanup();
	}
}

customElements.define("navbar-wc", NavbarWC);
