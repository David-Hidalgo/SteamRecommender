// Force dark mode by applying CSS variables to :root. This file can be included in all pages.
(function(){
  try{
    // make page dark immediately
    document.documentElement.classList.add('dark');
    // set CSS variables (redundant with dark.css but safer for components)
    const r = document.documentElement.style;
    r.setProperty('--bg', '#0b0b10');
    r.setProperty('--surface', '#0f1115');
    r.setProperty('--muted', '#c6c6cf');
    r.setProperty('--text', '#e8e8ee');
    r.setProperty('--accent', '#9b59b6');
    r.setProperty('--accent-600', '#7b3aa8');
    r.setProperty('--nav-bg', 'linear-gradient(180deg, #0f1115, #111217)');
  }catch(e){ console.warn('dark-mode init failed', e); }
})();
