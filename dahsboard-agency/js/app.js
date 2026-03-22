/* ==========================================
   EL CEREBRO: DESCARGA, LIMPIEZA Y CÁLCULOS
   ========================================== */

// 1. Promesa para envolver PapaParse y hacerlo asíncrono
function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                resolve(results.data);
            },
            error: function(err) {
                reject(err);
            }
        });
    });
}

// 2. Función Maestra de Inicialización (Se llama desde auth.js al loguearse)
async function loadAllData() {
    // Cambiar mensaje de carga
    document.getElementById('welcome-message').innerText = "Descargando bases de datos...";
    
    try {
        // Descarga de TODOS los CSV al mismo tiempo (¡Súper rápido!)
        const [
            leadsGenerados, 
            leadsContactados, 
            llamadasConectadas, 
            citasGeneradas, 
            shows, 
            noShows, 
            cancelaCita
        ] = await Promise.all([
            fetchCSV(DB_URLS.leadsGenerados),
            fetchCSV(DB_URLS.leadsContactados),
            fetchCSV(DB_URLS.llamadasConectadas),
            fetchCSV(DB_URLS.citasGeneradas),
            fetchCSV(DB_URLS.shows),
            fetchCSV(DB_URLS.noShows),
            fetchCSV(DB_URLS.cancelaCita)
        ]);

        // Guardamos la data cruda globalmente
        window.AppData.raw = {
            leads: leadsGenerados,
            contactados: leadsContactados,
            llamadas: llamadasConectadas,
            citas: citasGeneradas,
            shows: shows,
            noShows: noShows,
            cancelados: cancelaCita
        };

        console.log("✅ Toda la data descargada:", window.AppData.raw);
        
        // Llenar los selectores (Campañas y Operadores)
        poblarFiltros();

        // Procesar y mostrar los datos por primera vez
        procesarYRenderizar();

        // Restaurar el saludo
        const session = JSON.parse(localStorage.getItem('np_session'));
        document.getElementById('welcome-message').innerHTML = `Bienvenido, <strong>${session.nombre}</strong>`;

    } catch (error) {
        console.error("Error al descargar los CSV:", error);
        alert("Hubo un error al conectar con las bases de datos. Revisa la consola.");
    }
}

// 3. Llenar los desplegables de Campañas y Operadores
function poblarFiltros() {
    const campañas = new Set();
    const operadores = new Set();

    // Extraer campañas de los leads
    window.AppData.raw.leads.forEach(row => {
        if(row['Campaña']) campañas.add(row['Campaña'].trim());
    });

    // Extraer operadores de las citas y shows
    window.AppData.raw.citas.forEach(row => {
        if(row['Operador']) operadores.add(row['Operador'].trim());
    });

    const campFilter = document.getElementById('global-campaign-filter');
    const opFilter = document.getElementById('global-operator-filter');

    // Inyectar en el HTML
    Array.from(campañas).sort().forEach(camp => {
        campFilter.innerHTML += `<option value="${camp}">${camp}</option>`;
    });

    Array.from(operadores).sort().forEach(op => {
        opFilter.innerHTML += `<option value="${op}">${op}</option>`;
    });
}

// 4. El Motor de Procesamiento (Se ejecuta cada vez que cambias un filtro)
function procesarYRenderizar() {
    // 4.1 Leer los filtros actuales
    const timezoneSelected = document.getElementById('global-timezone').value;
    const campaignSelected = document.getElementById('global-campaign-filter').value;
    const operatorSelected = document.getElementById('global-operator-filter').value;
    
    // (Nota: El filtro de fechas lo programaremos en detalle más adelante para la zona horaria)
    
    // 4.2 Filtrar la data según la Campaña seleccionada
    let leadsFiltrados = window.AppData.raw.leads;
    let contactadosFiltrados = window.AppData.raw.contactados;
    let citasFiltradas = window.AppData.raw.citas;
    let showsFiltrados = window.AppData.raw.shows;

    if (campaignSelected !== 'all') {
        leadsFiltrados = leadsFiltrados.filter(l => l['Campaña'] === campaignSelected);
        contactadosFiltrados = contactadosFiltrados.filter(l => l['Campaña'] === campaignSelected);
        citasFiltradas = citasFiltradas.filter(l => l['Campaña'] === campaignSelected);
        showsFiltrados = showsFiltrados.filter(l => l['Campaña'] === campaignSelected);
    }

    if (operatorSelected !== 'all') {
        // Los leads no tienen operador en tu CSV, pero las citas sí
        citasFiltradas = citasFiltradas.filter(c => c['Operador'] === operatorSelected);
        showsFiltrados = showsFiltrados.filter(s => s['Operador'] === operatorSelected);
    }

    // 4.3 Calcular KPIs Matemáticos
    const totalLeads = leadsFiltrados.length;
    
    // Para evitar duplicados en contactados, usamos un Set con los números de teléfono
    const setContactados = new Set(contactadosFiltrados.map(c => c['Numero']));
    const totalContactados = setContactados.size;
    const contactRate = totalLeads > 0 ? (totalContactados / totalLeads) * 100 : 0;

    const totalCitas = citasFiltradas.length;
    const bookingRate = totalLeads > 0 ? (totalCitas / totalLeads) * 100 : 0;

    const totalShows = showsFiltrados.length;
    const showRate = totalCitas > 0 ? (totalShows / totalCitas) * 100 : 0;

    // 4.4 Inyectar en el HTML (Actualizar las tarjetas)
    const kpiContainer = document.getElementById('kpi-container-general');
    
    kpiContainer.innerHTML = `
        <div class="kpi-card" style="border-left: 4px solid var(--brand-primary);">
            <div class="metric-title">Volumen de Leads</div>
            <div class="metric-value">${totalLeads}</div>
            <div class="metric-subtitle">CPL: $--.-- (Pendiente Meta Ads)</div>
        </div>

        <div class="kpi-card" style="border-left: 4px solid var(--accent-warning);">
            <div class="metric-title">Contact Rate</div>
            <div class="metric-value">${contactRate.toFixed(1)}%</div>
            <div class="metric-subtitle">${totalContactados} Leads Únicos Contactados</div>
        </div>

        <div class="kpi-card" style="border-left: 4px solid var(--brand-primary);">
            <div class="metric-title">Citas Agendadas</div>
            <div class="metric-value">${totalCitas}</div>
            <div class="metric-subtitle">Booking Rate: ${bookingRate.toFixed(1)}%</div>
        </div>

        <div class="kpi-card" style="border-left: 4px solid var(--accent-success); background: linear-gradient(90deg, rgba(48,174,185,0.05), transparent);">
            <div class="metric-title text-success">Shows Totales</div>
            <div class="metric-value text-success">${totalShows}</div>
            <div class="metric-subtitle">Asistencia: ${showRate.toFixed(1)}%</div>
        </div>
    `;

    // (La lógica del Speed to Lead y los gráficos las agregaremos en sus respectivos módulos)
}

// 5. Escuchar cambios en los filtros para recalcular todo en tiempo real
document.getElementById('global-campaign-filter').addEventListener('change', procesarYRenderizar);
document.getElementById('global-operator-filter').addEventListener('change', procesarYRenderizar);
document.getElementById('btn-refresh').addEventListener('click', loadAllData);
