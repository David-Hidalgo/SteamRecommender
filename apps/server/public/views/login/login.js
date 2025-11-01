async function postSignIn(email, password) {
  const res = await fetch('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include'
  });
  return res;
}

async function fetchUserByEmail(email) {
  const enc = encodeURIComponent(email);
  const res = await fetch(`/api/users/email/${enc}`);
  if (!res.ok) throw new Error('No se pudo obtener usuario: ' + res.status);
  return res.json();
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const error = document.getElementById('error');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    error.textContent = '';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) { error.textContent = 'Rellena email y contraseña'; return; }
    try {
      error.textContent = 'Iniciando sesión...';
      const res = await postSignIn(email, password);
      if (!res.ok) {
        const txt = await res.text();
        error.textContent = `Error ${res.status}: ${txt}`;
        return;
      }
      // Login ok. Fetch the user object to store locally for UI usage.
      const user = await fetchUserByEmail(email);
      try { localStorage.setItem('user', JSON.stringify(user)); } catch(e){}
      // Redirect to user profile page
      location.href = '/public/views/users/users.html';
    } catch (err) {
      error.textContent = 'Error de conexión: ' + String(err);
    }
  });
});
