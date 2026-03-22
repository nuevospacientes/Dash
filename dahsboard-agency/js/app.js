/* ==========================================
   EL CEREBRO: DESCARGA, LIMPIEZA Y CÁLCULOS
   ========================================== */

/* ==========================================
   SISTEMA GLOBAL DE MANEJO DE ERRORES
   ========================================== */

// Función para mostrar el modal de error
function mostrarErrorSistema(problema, ubicacion, solucion) {
    document.getElementById('error-msg').innerText = problema;
    document.getElementById('error-location').innerText = ubicacion;
    document.getElementById('error-fix').innerText = solucion;
    document.getElementById('modal-error').style.display = 'flex';
    
    // Si la pantalla de carga estaba activa, la ocultamos
    document.getElementById('welcome-message').innerHTML = `<span style="color: var(--accent-danger)">Error en el sistema</span>`;
}

// Cerrar el modal
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-error-modal').addEventListener('click', () => {
        document.getElementById('modal-error').style.display = 'none';
    });
});

// 1. CAZADOR DE ERRORES DE CÓDIGO (Variables no definidas, sintaxis rota, etc.)
window.addEventListener('error', function(e) {
    mostrarErrorSistema(
        e.message,
        `Archivo: ${e.filename} (Línea ${e.lineno})`,
        "Presiona F12 para abrir la consola de desarrollador y buscar el error en rojo. Probablemente falta una coma, hay un error de tipeo, o una variable no existe."
    );
});

// 2. CAZADOR DE ERRORES ASÍNCRONOS (Promesas, fallos de red, etc.)
window.addEventListener('unhandledrejection', function(e) {
    mostrarErrorSistema(
        "Fallo al comunicarse con los datos externos (Google Sheets).",
        "Petición de Red / Promesa Rechazada",
        "1. Verifica que tengas conexión a internet.\n2. Asegúrate de que los enlaces en config.js sean correctos y terminen en 'output=csv'.\n3. Confirma que la hoja de Google Sheets siga estando 'Publicada en la web'."
    );
});


// 1. Promesa para envolver PapaParse y hacerlo asíncrono
function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) { resolve(results.data); },
            error: function(err) { reject(err); }
        });
    });
}

// 2. Función Maestra de Inicialización
async function loadAllData() {
    document.getElementById('welcome-message').innerText = "Descargando bases de datos...";
    
    try {
        const [
            leadsGenerados, leadsContactados, llamadasConectadas, 
            citasGeneradas, shows, noShows, cancelaCita
        ] = await Promise.all([
            fetchCSV(DB_URLS.leadsGenerados),
            fetchCSV(DB_URLS.leadsContactados),
            fetchCSV(DB_URLS.llamadasConectadas),
            fetchCSV(DB_URLS.citasGeneradas),
            fetchCSV(DB_URLS.shows),
            fetchCSV(DB_URLS.noShows),
            fetchCSV(DB_URLS.cancelaCita)
        ]);

        // Guardamos la data cruda
        window.AppData.raw = {
            leads: leadsGenerados, 
            contactados: leadsContactados,
            llamadas: llamadasConectadas, 
            citas: citasGeneradas,
            shows: shows, 
            noShows: noShows, 
            cancelados: cancelaCita
        };

        console.log("✅ Toda la data descargada con éxito", window.AppData.raw);
        
        poblarFiltros();
        procesarYRenderizar();

        const session = JSON.parse(localStorage.getItem('np_session'));
        if(session) {
            document.getElementById('welcome-message').innerHTML = `Bienvenido, <strong>${session.nombre}</strong>`;
        }

    } catch (error) {
        console.error("Detalle técnico del error:", error);
        
        mostrarErrorSistema(
            "No se pudieron descargar o procesar los archivos CSV.",
            "Función loadAllData() en app.js",
            "1. Revisa que todas las URLs en config.js estén correctamente escritas.\n2. Revisa que ningún Google Sheet haya sido eliminado o puesto como privado.\n3. Verifica si los encabezados del CSV no han cambiado de nombre."
        );
    }
}

// 3. Llenar Desplegables
function poblarFiltros() {
    const campañas = new Set();
    const operadores = new Set();

    window.AppData.raw.leads.forEach(row => { if(row['Campaña']) campañas.add(row['Campaña'].trim()); });
    window.AppData.raw.citas.forEach(row => { if(row['Operador']) operadores.add(row['Operador'].trim()); });

    const campFilter = document.getElementById('global-campaign-filter');
    const opFilter = document.getElementById('global-operator-filter');

    // Limpiar antes de llenar para evitar duplicados
    campFilter.innerHTML = '<option value="all" selected>Todas las Campañas</option>';
    opFilter.innerHTML = '<option value="all" selected>Todos los Operadores</option>';

    Array.from(campañas).sort().forEach(camp => campFilter.innerHTML += `<option value="${camp}">${camp}</option>`);
    Array.from(operadores).sort().forEach(op => opFilter.innerHTML += `<option value="${op}">${op}</option>`);
}

// ==========================================
// 4. MOTOR INTELIGENTE DE FECHAS
// ==========================================

// Convierte los 3 formatos de tus CSVs a Tiempo Real (Milisegundos)
function parseDateSpanish(dateStr) {
    if (!dateStr) return null;
    let str = String(dateStr).trim().toLowerCase();
    
    // CORRECCIÓN: Cortar cualquier hora pegada a la fecha (Ej: "21/03/2026 14:18" -> "21/03/2026")
    str = str.split(' ')[0];

    const meses = {
        'ene': 0, 'enero': 0, 'feb': 1, 'febrero': 1, 'mar': 2, 'marzo': 2,
        'abr': 3, 'abril': 3, 'may': 4, 'mayo': 4, 'jun': 5, 'junio': 5,
        'jul': 6, 'julio': 6, 'ago': 7, 'agosto': 7, 'sep': 8, 'septiembre': 8,
        'oct': 9, 'octubre': 9, 'nov': 10, 'noviembre': 10, 'dic': 11, 'diciembre': 11
    };

    if (str.includes('/')) {
        const p = str.split('/');
        if (p.length >= 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])).getTime();
    }
    
    if (str.includes(' de ')) {
        const p = str.split(' de ');
        if (p.length === 3) return new Date(parseInt(p[2]), meses[p[1]], parseInt(p[0])).getTime();
    }

    if (str.includes('-') && str.split('-').length === 2) {
        const p = str.split('-');
        let year = new Date().getFullYear(); 
        return new Date(year, meses[p[1]], parseInt(p[0])).getTime();
    }
    
    const fb = new Date(str).getTime();
    return isNaN(fb) ? null : fb;
}

// Obtiene el rango de fechas del filtro superior
function getRangoFechas() {
    const val = document.getElementById('global-date-filter').value;
    let start = null, end = null;
    const now = new Date(); 
    now.setHours(0,0,0,0);

    if(val === 'today') { start = now.getTime(); end = now.getTime() + 86400000; }
    else if(val === 'yesterday') { start = now.getTime() - 86400000; end = now.getTime(); }
    else if(val === '7days') { start = now.getTime() - (7 * 86400000); end = now.getTime() + 86400000; }
    else if(val === '14days') { start = now.getTime() - (14 * 86400000); end = now.getTime() + 86400000; }
    else if(val === '30days') { start = now.getTime() - (30 * 86400000); end = now.getTime() + 86400000; }
    
    // CORRECCIÓN: "Este Mes" ahora abarca hasta el día 1 del mes SIGUIENTE para incluir todo
    else if(val === 'thisMonth') { 
        start = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); 
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(); 
    }
    else if(val === 'lastMonth') { 
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(); 
        end = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); 
    }
    // CORRECCIÓN: "Este Año" ahora abarca los 12 meses completos
    else if(val === 'thisYear') { 
        start = new Date(now.getFullYear(), 0, 1).getTime(); 
        end = new Date(now.getFullYear() + 1, 0, 1).getTime(); 
    }
    
    return { start, end };
}
// ==========================================
// 5. MOTOR DE PROCESAMIENTO Y RENDERIZADO
// ==========================================
function procesarYRenderizar() {
    if (!window.AppData.raw.leads) return;

    const campaignSelected = document.getElementById('global-campaign-filter').value;
    const operatorSelected = document.getElementById('global-operator-filter').value;
    const { start, end } = getRangoFechas();

    // Filtro Universal (Evalúa Campaña, Operador y Fecha exacta)
    // Filtro Universal (Evalúa Campaña, Operador y Fecha exacta)
    const cumpleFiltro = (row, colCampaña, colOperador, colFecha) => {
        if (campaignSelected !== 'all' && colCampaña && row[colCampaña] !== campaignSelected) return false;
        if (operatorSelected !== 'all' && colOperador && row[colOperador] !== operatorSelected) return false;
        
        // CORRECCIÓN: Lógica de exclusión estricta (Fail-Closed)
        if (start !== null && end !== null && colFecha) {
            // 1. Si la celda está vacía, rechazamos la fila
            if (!row[colFecha]) return false;
            
            const rowTime = parseDateSpanish(row[colFecha]);
            
            // 2. Si la celda tiene texto pero no es una fecha entendible, la rechazamos
            if (!rowTime) return false; 
            
            // 3. Si la fecha existe pero está fuera del rango seleccionado, la rechazamos
            if (rowTime < start || rowTime >= end) return false;
        }
        return true;
    };

    // 5.1 FILTRADO DE TODAS TUS HOJAS REALES
    const leadsF = window.AppData.raw.leads.filter(r => cumpleFiltro(r, 'Campaña', null, 'Fecha entrada lead'));
    const contactadosF = window.AppData.raw.contactados.filter(r => cumpleFiltro(r, 'Campaña', null, 'Fecha Lead entra'));
    const llamadasF = window.AppData.raw.llamadas.filter(r => cumpleFiltro(r, 'Campaña', null, 'Fecha Lead entra'));
    const citasF = window.AppData.raw.citas.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Cita generada'));
    const showsF = window.AppData.raw.shows.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Fecha Visita'));
    const noShowsF = window.AppData.raw.noShows.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Fecha Visita'));
    const canceladosF = window.AppData.raw.cancelados.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Fecha Visita'));

    // Empaquetamos todo limpio y filtrado
    const dataFiltrada = {
        leads: leadsF,
        contactados: contactadosF,
        llamadas: llamadasF,
        citas: citasF,
        shows: showsF,
        noShows: noShowsF,
        cancelados: canceladosF,
        dateRange: { start, end } // <--- NUEVO: Mandamos el límite de fechas a los gráficos
    };

    // 5.2 LLAMAR A LOS MÓDULOS EXTERNOS PARA QUE DIBUJEN LA INTERFAZ
    if (typeof renderizarVistaGeneral === 'function') renderizarVistaGeneral(dataFiltrada);
    if (typeof renderizarCallTracker === 'function') renderizarCallTracker(dataFiltrada);
    if (typeof renderizarGraficos === 'function') renderizarGraficos(dataFiltrada);
}

// 6. ESCUCHADORES DE EVENTOS GLOBALES
document.getElementById('global-date-filter').addEventListener('change', procesarYRenderizar);
document.getElementById('global-campaign-filter').addEventListener('change', procesarYRenderizar);
document.getElementById('global-operator-filter').addEventListener('change', procesarYRenderizar);
document.getElementById('global-timezone').addEventListener('change', procesarYRenderizar);
document.getElementById('btn-refresh').addEventListener('click', loadAllData);
