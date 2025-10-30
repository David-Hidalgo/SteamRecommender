document.addEventListener('DOMContentLoaded', () => {
    const contentContainer = document.getElementById('content-container');
    const navLinks = document.querySelectorAll('nav a');

    async function loadView(viewName) {
        try {
                const response = await fetch(`/public/components/${viewName}/${viewName}.html`);
            if (!response.ok) {
                throw new Error(`Error al cargar la vista: ${response.status}`);
            }
            const html = await response.text();
            contentContainer.innerHTML = html;

            // Cargar CSS específico de la vista
                loadCss(`/public/components/${viewName}/${viewName}.css`);

            // Cargar y ejecutar JS específico de la vista
                loadJs(`/public/components/${viewName}/${viewName}.js`);

        } catch (error) {
            console.error('Error loading view:', error);
            contentContainer.innerHTML = `<p>Error al cargar el contenido. Es posible que la página no exista.</p>`;
        }
    }

    function loadCss(path) {
        // Evitar duplicados
        if (document.querySelector(`link[href="${path}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = path;
        document.head.appendChild(link);
    }

    function loadJs(path) {
        // Evitar duplicados y recargar scripts
        const oldScript = document.querySelector(`script[src="${path}"]`);
        if(oldScript) oldScript.remove();

        const script = document.createElement('script');
        script.src = path;
        script.type = 'module'; // Asumimos que todos son módulos para consistencia
        document.body.appendChild(script);
    }


    // Cargar la vista inicial
    loadView('lista-juegos');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            if (view) {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                loadView(view);
            }
        });
    });
});
