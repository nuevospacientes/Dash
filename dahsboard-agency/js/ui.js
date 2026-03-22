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
            
            // NUEVO: Leer los datos guardados en memoria al abrir el modal
            const metas = JSON.parse(localStorage.getItem('np_metas')) || {
                ads: 3000, facturacion: 15000, citas: 100, stl: 5, llamadas: 50
            };
            
            document.getElementById('meta-ads').value = metas.ads;
            document.getElementById('meta-facturacion').value = metas.facturacion;
            document.getElementById('meta-citas').value = metas.citas;
            document.getElementById('meta-stl').value = metas.stl;
            document.getElementById('meta-llamadas-agente').value = metas.llamadas;
        });
    }

    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            modalSettings.style.display = 'none';
        });
    }

    if (saveSettings) {
        saveSettings.addEventListener('click', () => {
            // NUEVO: Capturar los valores escritos por el usuario y guardarlos
            const metas = {
                ads: parseFloat(document.getElementById('meta-ads').value) || 0,
                facturacion: parseFloat(document.getElementById('meta-facturacion').value) || 0,
                citas: parseInt(document.getElementById('meta-citas').value) || 0,
                stl: parseInt(document.getElementById('meta-stl').value) || 0,
                llamadas: parseInt(document.getElementById('meta-llamadas-agente').value) || 0
            };
            
            localStorage.setItem('np_metas', JSON.stringify(metas));
            modalSettings.style.display = 'none';
            
            // Recalcular todo el dashboard instantáneamente
            if (typeof procesarYRenderizar === 'function') {
                procesarYRenderizar();
            }
        });
    }
});
