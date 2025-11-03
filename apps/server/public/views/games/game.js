function getQueryParam(name) {
	try {
		return new URLSearchParams(location.search).get(name);
	} catch (e) {
		return null;
	}
}

async function fetchGameByAppId(appid) {
	const res = await fetch(
		`/api/games/appid/${encodeURIComponent(String(appid))}`,
	);
	if (!res.ok) {
		const txt = await res.text();
		throw new Error(`HTTP ${res.status}: ${txt}`);
	}
	return await res.json();
}

(async () => {
	const statusEl = document.getElementById("status");
	const titleEl = document.getElementById("game-title");
	const detailWrap = document.getElementById("game-detail");
	const nameEl = document.getElementById("name");
	const descEl = document.getElementById("short-desc");
	const bannerWrap = document.getElementById("banner-wrap");
	const bannerImg = document.getElementById("banner-img");
	const carousel = document.getElementById("carousel");
	let carouselTrack = document.getElementById("gallery");
	let carouselDots = document.getElementById("carousel-dots");
	const prevBtn = document.getElementById("carousel-prev");
	const nextBtn = document.getElementById("carousel-next");
	const publisherEl = document.getElementById("publisher");
	const releaseEl = document.getElementById("release-date");

	let currentSlide = 0;
	let slideCount = 0;

	const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

	const getCarouselTrack = () => {
		if (!carouselTrack) {
			carouselTrack = document.getElementById("gallery");
			if (!carouselTrack && carousel) {
				const trackWrap = carousel.querySelector(".carousel-window");
				if (trackWrap) {
					const createdTrack = document.createElement("div");
					createdTrack.id = "gallery";
					createdTrack.className = "carousel-track";
					trackWrap.appendChild(createdTrack);
					carouselTrack = createdTrack;
				}
			}
		}
		return carouselTrack;
	};

	const getCarouselDots = () => {
		if (!carouselDots) {
			carouselDots = document.getElementById("carousel-dots");
			if (!carouselDots) {
				const createdDots = document.createElement("div");
				createdDots.id = "carousel-dots";
				createdDots.className = "carousel-dots";
				if (carousel && carousel.parentElement) {
					carousel.parentElement.insertBefore(
						createdDots,
						carousel.nextSibling,
					);
				} else if (carousel) {
					carousel.appendChild(createdDots);
				}
				carouselDots = createdDots;
			}
		}
		return carouselDots;
	};

	const showSlide = (idx) => {
		const track = getCarouselTrack();
		if (!track || !slideCount) return;
		const target = clamp(idx, 0, slideCount - 1);
		currentSlide = target;
		track.style.transform = `translateX(-${target * 100}%)`;
		const dots = getCarouselDots();
		if (dots) {
			Array.from(dots.children).forEach((dot, dotIdx) => {
				dot.classList.toggle("active", dotIdx === target);
			});
		}
		if (prevBtn) prevBtn.disabled = target === 0;
		if (nextBtn) nextBtn.disabled = target === slideCount - 1;
	};

	const setBanner = (src, gameName) => {
		if (!bannerWrap || !bannerImg) return;
		if (!src) {
			bannerWrap.classList.remove("active");
			bannerImg.removeAttribute("src");
			return;
		}
		bannerImg.src = src;
		bannerImg.alt = gameName ? `Banner de ${gameName}` : "Banner del juego";
		bannerImg.loading = "lazy";
		bannerImg.decoding = "async";
		bannerWrap.classList.add("active");
	};

	const buildCarousel = (sources, gameName) => {
		if (!carousel) return;
		const track = getCarouselTrack();
		const dots = getCarouselDots();
		if (!track) return;
		track.innerHTML = "";
		if (dots) dots.innerHTML = "";
		slideCount = Array.isArray(sources) ? sources.length : 0;
		if (!slideCount) {
			carousel.classList.remove("active");
			if (dots) dots.classList.remove("show");
			if (prevBtn) {
				prevBtn.style.display = "none";
				prevBtn.disabled = true;
				prevBtn.onclick = null;
			}
			if (nextBtn) {
				nextBtn.style.display = "none";
				nextBtn.disabled = true;
				nextBtn.onclick = null;
			}
			return;
		}
		sources.forEach((src, idx) => {
			if (!src) return;
			const slide = document.createElement("div");
			slide.className = "carousel-slide";
			const img = document.createElement("img");
			img.src = src;
			img.alt = gameName ? `Captura de ${gameName}` : "Captura del juego";
			slide.appendChild(img);
			track.appendChild(slide);
			if (dots) {
				const dot = document.createElement("button");
				dot.type = "button";
				dot.className = "carousel-dot";
				dot.setAttribute("aria-label", `Ver captura ${idx + 1}`);
				dot.addEventListener("click", () => showSlide(idx));
				dots.appendChild(dot);
			}
		});
		track.style.transform = "translateX(0%)";
		carousel.classList.add("active");
		if (dots) dots.classList.toggle("show", slideCount > 1);
		if (prevBtn) {
			prevBtn.style.display = slideCount > 1 ? "" : "none";
			prevBtn.disabled = slideCount <= 1;
			prevBtn.onclick =
				slideCount > 1 ? () => showSlide(currentSlide - 1) : null;
		}
		if (nextBtn) {
			nextBtn.style.display = slideCount > 1 ? "" : "none";
			nextBtn.disabled = slideCount <= 1;
			nextBtn.onclick =
				slideCount > 1 ? () => showSlide(currentSlide + 1) : null;
		}
		currentSlide = 0;
		showSlide(0);
	};

	const setMetadata = (game) => {
		const data = game && game.data ? game.data : null;
		if (publisherEl) {
			const publishers = data && data.publishers;
			let publisherText = "";
			if (Array.isArray(publishers))
				publisherText = publishers.filter(Boolean).join(", ");
			else if (publishers) publisherText = String(publishers);
			publisherEl.textContent = publisherText || "No disponible";
		}
		if (releaseEl) {
			const release = data && data.release_date;
			let releaseText = "";
			if (typeof release === "string") releaseText = release;
			else if (release && typeof release === "object") {
				if (release.date) releaseText = String(release.date);
				else if (release.coming_soon === true) releaseText = "Próximamente";
			}
			releaseEl.textContent = releaseText || "No disponible";
		}
	};

	const appid = getQueryParam("appid");
	if (!appid) {
		if (statusEl) statusEl.textContent = "No se proporcionó appid en la URL.";
		return;
	}
	try {
		const g = await fetchGameByAppId(appid);
		if (!g) {
			if (statusEl) statusEl.textContent = "Juego no encontrado.";
			return;
		}
		const gameName = g.name || "Juego";
		if (titleEl) titleEl.textContent = gameName;
		if (nameEl) {
			nameEl.textContent = gameName;
			if (typeof g.appid === "number") nameEl.dataset.appid = String(g.appid);
		}
		const short =
			(g.data && (g.data.short_description || g.data.about_the_game)) || "";
		if (descEl) descEl.textContent = short || "Descripción no disponible.";
		const data = g.data || {};
		let bannerSrc =
			data.header_image ||
			data.capsule_image ||
			(g.appid
				? `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`
				: "");
		const rawScreens = [];
		if (Array.isArray(data.screenshots)) {
			for (const s of data.screenshots) {
				if (!s) continue;
				if (s.path_full) rawScreens.push(s.path_full);
				else if (s.path_thumbnail) rawScreens.push(s.path_thumbnail);
			}
		}
		if (!bannerSrc && rawScreens.length) bannerSrc = rawScreens.shift();
		const seen = new Set();
		if (bannerSrc) seen.add(bannerSrc);
		const screenshots = [];
		const addScreenshot = (src) => {
			if (!src) return;
			const trimmed = String(src).trim();
			if (!trimmed || seen.has(trimmed)) return;
			seen.add(trimmed);
			screenshots.push(trimmed);
		};
		rawScreens.forEach(addScreenshot);
		if (!screenshots.length && bannerSrc) screenshots.push(bannerSrc);

		setBanner(bannerSrc, gameName);
		buildCarousel(screenshots, gameName);
		setMetadata(g);

		// wire add-to-preferences button: redirect to game-preferences with q=gameName
		try {
			const addPrefBtn = document.getElementById("add-pref-btn");
			if (addPrefBtn) {
				addPrefBtn.addEventListener("click", () => {
					const q = encodeURIComponent(gameName);
					location.href = `/public/views/game-preferences/game-preferences.html?q=${q}`;
				});
			}
		} catch (e) {
			/* ignore */
		}

		if (statusEl) statusEl.style.display = "none";
		if (detailWrap) detailWrap.style.display = "";
	} catch (err) {
		console.error("Error cargando juego", err);
		if (statusEl)
			statusEl.textContent = "Error al cargar el juego: " + String(err);
	}
})();

const similarSection = document.getElementById("similar-section");
const similarBtn = document.getElementById("similar-btn");
const similarGrid = document.getElementById("similar-grid");
let loadingSimilar = false;

const buildSimilarParams = () => {
	const params = new URLSearchParams(window.location.search);
	const appidParam = params.get("appid");
	if (appidParam && /^\d+$/.test(appidParam)) {
		return { query: `appid=${appidParam}`, appid: Number(appidParam) };
	}
	const idParam = params.get("id") ?? params.get("gameId");
	if (idParam) {
		return { query: `gameId=${encodeURIComponent(idParam)}`, gameId: idParam };
	}
	const banner = document.getElementById("banner-img");
	const match = banner?.src?.match(/\/steam\/apps\/(\d+)\//);
	if (match) {
		const derived = Number(match[1]);
		return {
			query: `appid=${match[1]}`,
			appid: Number.isNaN(derived) ? undefined : derived,
		};
	}
	const nameEl = document.getElementById("name");
	const dataAppId = nameEl?.dataset?.appid;
	if (dataAppId && /^\d+$/.test(dataAppId)) {
		return { query: `appid=${dataAppId}`, appid: Number(dataAppId) };
	}
	return null;
};

const resolveCapsule = (game) => {
	if (typeof game?.capsule === "string" && game.capsule.length > 0)
		return game.capsule;
	if (typeof game?.appid === "number")
		return `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`;
	return "https://via.placeholder.com/460x215.png?text=Steam+Recommender";
};

const createSimilarCard = (game) => {
	const appid = typeof game?.appid === "number" ? game.appid : null;
	const targetId =
		typeof game?._id === "string" && game._id.length > 0 ? game._id : null;
	const card = document.createElement("a");
	card.className = "similar-card";
	card.href = appid
		? `/public/views/games/game.html?appid=${appid}`
		: targetId
			? `/public/views/games/game.html?id=${encodeURIComponent(targetId)}`
			: "#";
	card.role = "listitem";

	const img = document.createElement("img");
	img.src = resolveCapsule(game);
	img.alt = `Juego similar: ${game?.name ?? "Juego"}`;

	const body = document.createElement("div");
	body.className = "similar-card__body";

	const title = document.createElement("h4");
	title.className = "similar-card__title";
	title.textContent = game?.name ?? "Juego sin título";

	const meta = document.createElement("p");
	meta.className = "similar-card__meta";
	meta.textContent =
		typeof game?.score === "number"
			? `Score vectorial: ${game.score.toFixed(3)}`
			: "Score vectorial no disponible";

	body.appendChild(title);
	body.appendChild(meta);
	card.appendChild(img);
	card.appendChild(body);
	return card;
};

const renderSimilarGames = (games) => {
	if (!similarGrid) return false;
	similarGrid.innerHTML = "";
	if (!Array.isArray(games) || games.length === 0) {
		return false;
	}
	for (const game of games.slice(0, 8)) {
		similarGrid.appendChild(createSimilarCard(game));
	}
	return true;
};

const renderSimilarError = (message) => {
	if (!similarGrid) return;
	similarGrid.innerHTML = "";
	const error = document.createElement("p");
	error.className = "similar-card__meta";
	error.textContent = `Error al buscar juegos parecidos: ${message}`;
	similarGrid.appendChild(error);
};

const fetchVectorSimilar = async (query) => {
	const res = await fetch(
		`/api/games/vector-recommendations/app?${query}&limit=5`,
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const data = await res.json();
	if (Array.isArray(data)) return data;
	if (Array.isArray(data?.results)) return data.results;
	return [];
};

const fetchContentSimilar = async (appid) => {
	const res = await fetch(`/api/games/appid/${appid}/similar`);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const data = await res.json();
	if (Array.isArray(data)) return data;
	if (Array.isArray(data?.results)) return data.results;
	return [];
};

const loadSimilarGames = async () => {
	if (!similarBtn || !similarGrid || loadingSimilar) return;
	const params = buildSimilarParams();
	if (!params) {
		renderSimilarError("No se pudo determinar el identificador del juego.");
		return;
	}
	console.log(params);

	loadingSimilar = true;
	similarBtn.disabled = true;
	const originalText = similarBtn.textContent;
	similarBtn.textContent = "Buscando...";
	try {
		let results = await fetchVectorSimilar(params.query);
		if (
			(!Array.isArray(results) || results.length === 0) &&
			typeof params.appid === "number"
		) {
			try {
				const fallback = await fetchContentSimilar(params.appid);
				if (Array.isArray(fallback) && fallback.length > 0) {
					results = fallback;
				}
			} catch (fallbackErr) {
				console.error(
					"Error buscando juegos similares por contenido",
					fallbackErr,
				);
			}
		}
		if (!renderSimilarGames(results)) {
			renderSimilarError("No se encontraron juegos parecidos.");
		}
	} catch (error) {
		renderSimilarError(error instanceof Error ? error.message : String(error));
	} finally {
		similarBtn.disabled = false;
		similarBtn.textContent = originalText;
		loadingSimilar = false;
		if (similarSection) similarSection.classList.add("similar-section--loaded");
	}
};

if (similarBtn) {
	similarBtn.addEventListener("click", () => {
		void loadSimilarGames();
	});
}
