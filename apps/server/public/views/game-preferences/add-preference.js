async function loadGamesList(){
  const res = await fetch('/api/games/list');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function el(tag, props = {}, ...children){
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k,v])=>{ if(k==='class') e.className = v; else e.setAttribute(k,v); });
  for(const c of children) if(typeof c==='string') e.appendChild(document.createTextNode(c)); else if(c) e.appendChild(c);
  return e;
}

function renderResults(list){
  const container = document.getElementById('results');
  container.innerHTML = '';
  for (const g of list) {
    const appid = g.appid || g.steam_appid || (g._id ? String(g._id) : null);
    if (!appid) continue;
    const name = g.name || g.data?.name || '';
    const capsule = g.data?.capsule_image || null;

    // Build a full game object to pass to the component and the selection panel
    const gameObj = { appid: appid, name: name, capsule: capsule, _id: g._id };

    // Use the shared <game-card-wc> component
    const card = document.createElement('game-card-wc');
    // set the data directly so the web component renders itself
    card.gameData = gameObj;

    // click selects the card and opens selection panel
    card.addEventListener('click', (ev) => {
      // toggle selection
      const prev = container.querySelector('game-card-wc.selected');
      if (prev && prev !== card) prev.classList.remove('selected');
      const isSelected = card.classList.toggle('selected');
      showSelectionPanel(isSelected ? gameObj : null);
    });

    container.appendChild(card);
  }
}

function showSelectionPanel(game) {
  const panel = document.getElementById('selection-panel');
  panel.innerHTML = '';
  if (!game) return;
  const thumb = game.capsule || `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`;

  const img = el('img', { src: thumb, alt: game.name, style: 'width:100%; height:160px; object-fit:cover; border-radius:8px' });
  const meta = el('div', { class: 'meta' }, el('div', { class: 'game-title' }, game.name), el('div', {}, `AppID: ${game.appid}`));
  const ratingSelect = el('select', {});
  [5,4,3,2,1].forEach(v => ratingSelect.appendChild(el('option', { value: v }, String(v))));
  ratingSelect.className = 'rating-select-styled';
  ratingSelect.value = '3';

  const notes = el('textarea', { placeholder: 'Notas (opcional)', class: 'notes-input' });

  const addBtn = el('button', { class: 'btn-primary' }, 'Agregar');
  const cancelBtn = el('button', { class: 'btn-ghost' }, 'Cancelar');

  addBtn.addEventListener('click', async () => {
    const userJson = localStorage.getItem('user');
    if (!userJson) { location.href = '/public/views/login/login.html'; return; }
    let u = null; try { u = JSON.parse(userJson); } catch (e) { u = null }
    if (!u || !u.email) { location.href = '/public/views/login/login.html'; return; }
    addBtn.disabled = true; addBtn.textContent = 'Agregando...';
    try {
      // Prefer numeric appid when available, otherwise send the Mongo _id
      const gameIdToSend = (game.appid != null && !Number.isNaN(Number(game.appid))) ? Number(game.appid) : (game._id || game.appid);
      const body = { email: u.email, gameId: gameIdToSend, rating: Number(ratingSelect.value), notes: notes.value };
      const res = await fetch('/api/users/preference/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const txt = await res.text(); document.getElementById('status').textContent = `Error ${res.status}: ${txt}`; addBtn.disabled = false; addBtn.textContent = 'Agregar'; return; }
      document.getElementById('status').textContent = 'Juego agregado a tus preferencias.';
      // refresh local user
      const fresh = await (async function(){ const e = encodeURIComponent(u.email); const r = await fetch(`/api/users/email/${e}`); if (r.ok) return r.json(); return null; })();
      if (fresh) try { localStorage.setItem('user', JSON.stringify(fresh)); } catch (e) {}
      // clear selection
      const container = document.getElementById('results');
      const prev = container.querySelector('game-card-wc.selected'); if (prev) prev.classList.remove('selected');
      panel.innerHTML = '';
    } catch (err) { document.getElementById('status').textContent = 'Error: ' + String(err); }
    addBtn.disabled = false; addBtn.textContent = 'Agregar';
  });

  cancelBtn.addEventListener('click', () => {
    const container = document.getElementById('results');
    const prev = container.querySelector('game-card-wc.selected'); if (prev) prev.classList.remove('selected');
    panel.innerHTML = '';
  });

  // Build a prettier selection card
  const infoBlock = el('div', { style: 'display:flex; flex-direction:column; gap:8px; flex:1' }, el('div', { class: 'meta' }, `AppID: ${game.appid}`), el('div', {}, el('label', {}, 'Rating: '), ratingSelect), notes, el('div', { style: 'display:flex; gap:8px; margin-top:6px' }, addBtn, cancelBtn));
  // place image above info for vertical layout
  const cardWrap = el('div', { class: 'selection-card' }, img, el('div', { style: 'margin-top:10px' }, el('div', { class: 'game-title' }, game.name), infoBlock));
  panel.appendChild(cardWrap);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const q = document.getElementById('q');
  const searchBtn = document.getElementById('searchBtn');
  let games = [];
  try{ games = await loadGamesList(); }catch(e){ document.getElementById('status').textContent = 'No se pudieron cargar los juegos: '+String(e); return; }
  // normalize name field
  games = games.map(g => ({ ...(g||{}), name: g.name || g.data?.name }));

  const runFilter = (term) => {
    const v = (term || q?.value || '').trim().toLowerCase();
    if(!v) return renderResults(games.slice(0,50));
    const f = games.filter(g => (g.name||'').toLowerCase().includes(v)).slice(0,80);
    renderResults(f);
  };

  renderResults(games.slice(0,50));

  if (q) {
    q.addEventListener('input', ()=> runFilter());
  }
  async function searchGames(term) {
    try {
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(term)}`);
      if (!res.ok) { document.getElementById('status').textContent = `Error ${res.status} searching games`; return []; }
      const body = await res.json();
      return body;
    } catch (err) { document.getElementById('status').textContent = 'Error searching games: '+String(err); return []; }
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', async ()=> {
      const term = q?.value || '';
      if (!term || term.trim().length === 0) return renderResults(games.slice(0,50));
      const res = await searchGames(term.trim());
      // normalize and render
      const normalized = (res || []).map(g => ({ ...(g||{}), name: g.name || g.data?.name }));
      renderResults(normalized.slice(0,80));
    });
    // allow pressing Enter to trigger search too
    q?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); searchBtn.click(); } });
  }
});
