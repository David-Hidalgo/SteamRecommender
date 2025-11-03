// user.js - simple profile loader for logged-in user
async function loadProfileByEmail(email) {
	const status = document.getElementById("status");
	if (status) status.textContent = "Cargando perfil...";
	try {
		const res = await fetch(`/api/users/email/${encodeURIComponent(email)}`);
		if (!res.ok) {
			const txt = await res.text();
			if (status) status.textContent = `Error ${res.status}: ${txt}`;
			return null;
		}
		const user = await res.json();
		if (status) status.textContent = "";
		return user;
	} catch (err) {
		if (status)
			status.textContent = "Error al conectar con el servidor: " + String(err);
		return null;
	}
}

(() => {
	// If not logged in, redirect to login page
	const me = (() => {
		try {
			return JSON.parse(localStorage.getItem("user") || "null");
		} catch (e) {
			return null;
		}
	})();
	if (!me || !me.email) {
		// redirect to login
		location.href = "/public/views/login/login.html";
		return;
	}

	// load fresh profile and render
	(async () => {
		const fresh = await loadProfileByEmail(me.email);
		if (!fresh) return;
		localStorage.setItem("user", JSON.stringify(fresh));
		document.getElementById("profile-name").textContent =
			fresh.name ?? "(sin nombre)";
		document.getElementById("profile-email").textContent = fresh.email ?? "";
		document.getElementById("profile-meta").textContent =
			`Creado: ${new Date(fresh.createdAt).toLocaleString()}`;
		const profile = document.getElementById("profile");
		if (profile) profile.style.display = "";
		// render preferences
		try {
			renderPreferences(fresh);
		} catch (e) {
			console.error("renderPreferences error", e);
		}
	})();
})();

function el(tag, props = {}, ...children) {
	const e = document.createElement(tag);
	Object.entries(props).forEach(([k, v]) => {
		if (k === "class") e.className = v;
		else e.setAttribute(k, v);
	});
	for (const c of children)
		if (typeof c === "string") e.appendChild(document.createTextNode(c));
		else if (c) e.appendChild(c);
	return e;
}

function createRatingStars(rating) {
	const wrap = el("div", {
		class: "rating-stars",
		style: "color:#ffd54f; font-size:1.05rem",
	});
	for (let i = 1; i <= 5; i++) {
		const star = el(
			"span",
			{ style: "margin-right:4px" },
			i <= rating ? "★" : "☆",
		);
		wrap.appendChild(star);
	}
	return wrap;
}

function renderPreferences(user) {
	const container = document.getElementById("preferences");
	const list = document.getElementById("prefs-list");
	if (!container || !list) return;
	list.innerHTML = "";
	const prefs = user.gamePreferences || [];
	if (!Array.isArray(prefs) || prefs.length === 0) {
		container.style.display = "none";
		return;
	}
	container.style.display = "";

	// current user (read from localStorage so handlers can use it)
	const me = (() => {
		try {
			return JSON.parse(localStorage.getItem("user") || "null");
		} catch (e) {
			return null;
		}
	})();

	for (const p of prefs) {
		const g = p.gameId && p.gameId.appid ? p.gameId : p.gameId || {};
		const title = g.name || g.data?.name || String(g.appid || g._id || "");
		const thumb =
			g.data?.capsule_image ||
			(g.appid
				? `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`
				: "");

		// create image element (larger horizontal) and info column
		// image: do not set inline width/height so CSS can control sizing
		const imgEl = el("img", {
			src: thumb,
			alt: title,
		});

		const left = el("div", { class: "left-col" }, imgEl);

		const titleEl = el("div", { class: "card-title" }, title);
		const ratingEl = createRatingStars(p.rating || 0);
		ratingEl.className = "rating-stars";

		const modifyBtn = el(
			"button",
			{
				class: "btn-ghost",
				type: "button",
				style: "background:#7b1fa2;color:#fff",
			},
			"Modificar rating",
		);
		const removeBtn = el(
			"button",
			{
				class: "btn-ghost",
				type: "button",
				style: "background:#7b1fa2;color:#fff",
			},
			"Eliminar",
		);
		const actions = el("div", { class: "prefs-actions" }, modifyBtn, removeBtn);

		const info = el(
			"div",
			{ class: "info-col", style: "color: #e8e8ee" },
			titleEl,
			ratingEl,
			el(
				"div",
				{ style: "margin-top:6px; color:var(--muted,#cfcfcf)" },
				p.notes || "",
			),
			actions,
		);

		const card = el(
			"div",
			{
				class: "card-item",
				style:
					"display:flex; gap:12px; align-items:center; background: rgba(255,255,255,0.02); padding:12px; border-radius:8px",
			},
			left,
			info,
		);
		// wire up buttons (now under title, in the info column)
		modifyBtn?.addEventListener("click", () => {
			const q = encodeURIComponent(title);
			location.href = `/public/views/game-preferences/game-preferences.html?q=${q}`;
		});

		removeBtn?.addEventListener("click", async () => {
			if (!me || !me.email) {
				location.href = "/public/views/login/login.html";
				return;
			}
			if (!confirm(`Eliminar preferencia de ${title}?`)) return;
			removeBtn.disabled = true;
			removeBtn.textContent = "Eliminando...";
			try {
				const res = await fetch("/api/users/preference/remove", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email: me.email, gameId: g.appid ?? g._id }),
				});
				if (!res.ok) {
					const txt = await res.text();
					document.getElementById("status").textContent =
						`Error ${res.status}: ${txt}`;
					removeBtn.disabled = false;
					removeBtn.textContent = "Eliminar";
					return;
				}
				document.getElementById("status").textContent =
					"Preferencia eliminada.";
				const fresh = await loadProfileByEmail(me.email);
				if (fresh) {
					localStorage.setItem("user", JSON.stringify(fresh));
					renderPreferences(fresh);
				}
			} catch (err) {
				document.getElementById("status").textContent = "Error: " + String(err);
			}
			removeBtn.disabled = false;
			removeBtn.textContent = "Eliminar";
		});

		list.appendChild(card);
	}
}
