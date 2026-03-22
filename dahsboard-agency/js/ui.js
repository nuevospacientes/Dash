/* ==========================================
   CONTROLADOR DE INTERFAZ DE USUARIO (UI)
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. LÓGICA DEL TEMA (MODO CLARO / OSCURO)
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            const html = document.documentElement;
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            html.setAttribute('data-theme', newTheme);
            
            // Cambiar el icono (Luna para oscuro, Sol para claro)
            btnThemeToggle.innerHTML = newTheme === 'dark' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
        });
    }

    // 2. NAVEGACIÓN DE PESTAÑAS (TABS)
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remover la clase 'active' de todos los botones y secciones
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
            
            // Encontrar el botón exacto que se hizo clic (incluso si se hizo clic en el icono de adentro)
            const targetBtn = e.target.closest('.tab-btn');
            targetBtn.classList.add('active');
            
            // Mostrar la sección correspondiente
            const targetId = targetBtn.getAttribute('data-target');
            if (targetId && document.getElementById(targetId)) {
                document.getElementById(targetId).classList.add('active');
            }
        });
    });

    // 3. POPUP DE CONFIGURACIÓN DE METAS
    const btnSettings = document.getElementById('btn-settings');
    const closeSettings = document.getElementById('close-settings');
    const saveSettings = document.getElementById('save-settings');
    const modalSettings = document.getElementById('modal-settings');

    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            modalSettings.style.display = 'flex';
        });
    }

    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            modalSettings.style.display = 'none';
        });
    }

    if (saveSettings) {
        saveSettings.addEventListener('click', () => {
            modalSettings.style.display = 'none';
            
            // Más adelante, aquí guardaremos las metas en localStorage
            // y obligaremos a app.js a recalcular los datos.
            if (typeof procesarYRenderizar === 'function') {
                procesarYRenderizar();
            }
        });
    }
});
