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

async function loadUserByEmail(email) {
	const status = document.getElementById("status");
	if (status) status.textContent = "Cargando usuario...";
	try {
		const encoded = encodeURIComponent(email);
		const res = await fetch(`/api/users/email/${encoded}`);
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

function createRatingSelect(value) {
	const sel = el("select", { class: "rating-select" });
	for (let v = 1; v <= 5; v++)
		sel.appendChild(el("option", { value: v }, String(v)));
	sel.value = String(value || 3);
	return sel;
}

function renderPreferences(user) {
	const container = document.getElementById("preferences");
	const list = document.getElementById("prefs-list");
	list.innerHTML = "";
	const prefs = user.gamePreferences || [];
	if (!Array.isArray(prefs) || prefs.length === 0) {
		if (container) container.style.display = "none";
		return;
	}
	if (container) container.style.display = "";

	const me = (() => {
		try {
			return JSON.parse(localStorage.getItem("user") || "null");
		} catch (e) {
			return null;
		}
	})();
	const email = me?.email;

	for (const p of prefs) {
		const g = p.gameId && p.gameId.appid ? p.gameId : p.gameId || {};
		const title = g.name || g.data?.name || String(g.appid || g._id || "");
		const thumb =
			g.data?.capsule_image ||
			(g.appid
				? `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`
				: "");

		const notesInput = el(
			"textarea",
			{ rows: 2, style: "width:100%;" },
			p.notes || "",
		);
		const ratingSelect = createRatingSelect(p.rating || 3);

		const saveBtn = el("button", { type: "button" }, "Guardar");
		const delBtn = el(
			"button",
			{ type: "button", style: "background:#7b1fa2;color:#fff" },
			"Eliminar",
		);

		const info = el(
			"div",
			{ style: "flex:1;" },
			el("div", {}, el("strong", {}, title)),
			el("div", { style: "margin-top:6px" }, ratingSelect),
			notesInput,
			el(
				"div",
				{ style: "margin-top:6px; display:flex; gap:8px" },
				saveBtn,
				delBtn,
			),
		);

		const card = el(
			"div",
			{ class: "card-item" },
			el("img", {
				src: thumb,
				alt: title,
				style: "width:100%;height:120px;object-fit:cover;border-radius:6px",
			}),
			info,
		);

		saveBtn.addEventListener("click", async () => {
			if (!email) {
				location.href = "/public/views/login/login.html";
				return;
			}
			saveBtn.disabled = true;
			saveBtn.textContent = "Guardando...";
			try {
				const body = {
					email,
					gameId: g.appid ?? g._id,
					rating: Number(ratingSelect.value),
					notes: notesInput.value,
				};
				const res = await fetch("/api/users/preference/email", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});
				if (!res.ok) {
					const txt = await res.text();
					document.getElementById("status").textContent =
						`Error ${res.status}: ${txt}`;
					saveBtn.disabled = false;
					saveBtn.textContent = "Guardar";
					return;
				}
				document.getElementById("status").textContent =
					"Preferencia actualizada.";
				// refresh local user
				const fresh = await loadUserByEmail(email);
				if (fresh) {
					localStorage.setItem("user", JSON.stringify(fresh));
					renderPreferences(fresh);
				}
			} catch (err) {
				document.getElementById("status").textContent = "Error: " + String(err);
			}
			saveBtn.disabled = false;
			saveBtn.textContent = "Guardar";
		});

		delBtn.addEventListener("click", async () => {
			if (!email) {
				location.href = "/public/views/login/login.html";
				return;
			}
			if (!confirm(`Eliminar preferencia de ${title}?`)) return;
			delBtn.disabled = true;
			delBtn.textContent = "Eliminando...";
			try {
				const res = await fetch("/api/users/preference/remove", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email, gameId: g.appid ?? g._id }),
				});
				if (!res.ok) {
					const txt = await res.text();
					document.getElementById("status").textContent =
						`Error ${res.status}: ${txt}`;
					delBtn.disabled = false;
					delBtn.textContent = "Eliminar";
					return;
				}
				document.getElementById("status").textContent =
					"Preferencia eliminada.";
				const fresh = await loadUserByEmail(email);
				if (fresh) {
					localStorage.setItem("user", JSON.stringify(fresh));
					renderPreferences(fresh);
				}
			} catch (err) {
				document.getElementById("status").textContent = "Error: " + String(err);
			}
			delBtn.disabled = false;
			delBtn.textContent = "Eliminar";
		});

		list.appendChild(card);
	}
}

(async () => {
	const me = (() => {
		try {
			return JSON.parse(localStorage.getItem("user") || "null");
		} catch (e) {
			return null;
		}
	})();
	if (!me || !me.email) {
		location.href = "/public/views/login/login.html";
		return;
	}
	const user = await loadUserByEmail(me.email);
	if (!user) return;
	localStorage.setItem("user", JSON.stringify(user));
	renderPreferences(user);
})();
