// user.js - simple profile loader for logged-in user
async function loadProfileByEmail(email) {
  const status = document.getElementById('status');
  if (status) status.textContent = 'Cargando perfil...';
  try {
    const res = await fetch(`/api/users/email/${encodeURIComponent(email)}`);
    if (!res.ok) {
      const txt = await res.text();
      if (status) status.textContent = `Error ${res.status}: ${txt}`;
      return null;
    }
    const user = await res.json();
    if (status) status.textContent = '';
    return user;
  } catch (err) {
    if (status) status.textContent = 'Error al conectar con el servidor: ' + String(err);
    return null;
  }
}

(function(){
  // If not logged in, redirect to login page
  const me = (() => { try { return JSON.parse(localStorage.getItem('user')||'null'); } catch(e){return null} })();
  if (!me || !me.email) {
    // redirect to login
    location.href = '/public/views/login/login.html';
    return;
  }

  // load fresh profile and render
  (async ()=>{
    const fresh = await loadProfileByEmail(me.email);
    if (!fresh) return;
    localStorage.setItem('user', JSON.stringify(fresh));
    document.getElementById('profile-name').textContent = fresh.name ?? '(sin nombre)';
    document.getElementById('profile-email').textContent = fresh.email ?? '';
    document.getElementById('profile-meta').textContent = `Creado: ${new Date(fresh.createdAt).toLocaleString()}`;
    const profile = document.getElementById('profile');
    if (profile) profile.style.display = '';
    // render preferences
    try { renderPreferences(fresh); } catch(e) { console.error('renderPreferences error', e); }
  })();
})();

function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  });
  for (const c of children) if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else if (c) e.appendChild(c);
  return e;
}

function createRatingStars(rating) {
  const wrap = el('div', { class: 'rating-stars', style: 'color:#ffd54f; font-size:1.05rem' });
  for (let i = 1; i <= 5; i++) {
    const star = el('span', { style: 'margin-right:4px' }, i <= rating ? '★' : '☆');
    wrap.appendChild(star);
  }
  return wrap;
}

function renderPreferences(user) {
  const container = document.getElementById('preferences');
  const list = document.getElementById('prefs-list');
  if (!container || !list) return;
  list.innerHTML = '';
  const prefs = user.gamePreferences || [];
  if (!Array.isArray(prefs) || prefs.length === 0) { container.style.display = 'none'; return; }
  container.style.display = '';

  for (const p of prefs) {
    const g = p.gameId && p.gameId.appid ? p.gameId : (p.gameId || {});
    const title = g.name || g.data?.name || String(g.appid || g._id || '');
    const thumb = g.data?.capsule_image || (g.appid ? `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg` : '');

    const left = el('div', {}, el('img', { src: thumb, alt: title, style: 'width:160px;height:88px;object-fit:cover;border-radius:6px' }));
    const info = el('div', { style: 'flex:1; color: #e8e8ee' }, el('div', { style: 'font-weight:700; font-size:1.05rem; margin-bottom:6px; color:#fff' }, title), createRatingStars(p.rating || 0), el('div', { style: 'margin-top:6px; color:var(--muted,#cfcfcf)' }, p.notes || ''), el('div', { style: 'margin-top:8px' }, el('a', { href: '/public/views/game-preferences/game-preferences.html' }, 'Editar / Añadir más')));

    const card = el('div', { class: 'card-item', style: 'display:flex; gap:12px; align-items:center; background: rgba(255,255,255,0.02); padding:12px; border-radius:8px' }, left, info);
    list.appendChild(card);
  }
}
