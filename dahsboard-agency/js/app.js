/* ==========================================
   EL CEREBRO: DESCARGA, LIMPIEZA Y CÁLCULOS
   ========================================== */

window.AppData = window.AppData || {};

function mostrarErrorSistema(problema, ubicacion, solucion) {
    document.getElementById('error-msg').innerText = problema;
    document.getElementById('error-location').innerText = ubicacion;
    document.getElementById('error-fix').innerText = solucion;
    document.getElementById('modal-error').style.display = 'flex';
    const welcome = document.getElementById('welcome-message');
    if(welcome) welcome.innerHTML = `<span style="color: var(--accent-danger)">Error en el sistema</span>`;
}

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-error-modal');
    if(closeBtn) closeBtn.addEventListener('click', () => document.getElementById('modal-error').style.display = 'none');
});

window.addEventListener('error', function(e) {
    mostrarErrorSistema(e.message, `Archivo: ${e.filename} (Línea ${e.lineno})`, "Presiona F12 para abrir la consola y buscar el error.");
});

window.addEventListener('unhandledrejection', function(e) {
    mostrarErrorSistema("Fallo al comunicarse con los datos externos.", "Promesa Rechazada", "Verifica tu conexión.");
});

async function fetchCSV(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const textData = await response.text();
        return new Promise((resolve, reject) => {
            Papa.parse(textData, { header: true, skipEmptyLines: true, complete: function(results) { resolve(results.data); }, error: function(err) { reject(new Error(err.message)); } });
        });
    } catch (error) { throw new Error(`Error al procesar la URL: ${url}.`); }
}

async function loadAllData() {
    const welcome = document.getElementById('welcome-message');
    if(welcome) welcome.innerText = "Descargando bases de datos...";
    
    try {
        const [ leadsGenerados, leadsContactados, llamadasConectadas, citasGeneradas, shows, noShows, cancelaCita, leadsAntiguos, metaAds ] = await Promise.all([
            fetchCSV(DB_URLS.leadsGenerados), fetchCSV(DB_URLS.leadsContactados), fetchCSV(DB_URLS.llamadasConectadas), fetchCSV(DB_URLS.citasGeneradas),
            fetchCSV(DB_URLS.shows), fetchCSV(DB_URLS.noShows), fetchCSV(DB_URLS.cancelaCita), fetchCSV(DB_URLS.leadsAntiguos), fetchCSV(DB_URLS.metaAds)
        ]);

        const leadsAntiguosFormateados = (leadsAntiguos || []).map(row => {
            return {
                'Fecha entrada lead': row['Lead entry date'] || '',
                'Hora Generado': row['Lead entry time'] || '',
                'Campaña': `${(row['Clinica'] || '').trim()}-${(row['Tratamiento Solicitado'] || '').trim()}`,
                'Nombre': `${(row['First Name'] || '').trim()} ${(row['Last Name'] || '').trim()}`.trim(),
                'Numero': row['Phone'] || '',
                'Cita solictida para': row['Fecha Cita Solicitada'] || '',
                'Zona Horaria': row['Timezone'] || '',
                'Ventana operativa SI/NO': '' 
            };
        });

        window.AppData.raw = {
            leads: [...(leadsGenerados || []), ...leadsAntiguosFormateados], 
            contactados: leadsContactados, llamadas: llamadasConectadas, citas: citasGeneradas, shows: shows, noShows: noShows, cancelados: cancelaCita, ads: metaAds 
        };
        
        // Ya no llamamos a poblarFiltros() estático, el renderizado dinámico se encarga
        procesarYRenderizar();

        const session = JSON.parse(localStorage.getItem('np_session'));
        if(session && welcome) welcome.innerHTML = `Bienvenido, <strong>${session.nombre}</strong>`;

    } catch (error) {
        console.error(error);
        mostrarErrorSistema("Hubo un error al descargar la información.", "loadAllData()", "Asegúrate de que la URL termine en 'output=csv'.");
    }
}

// ==========================================
// 4. MOTOR INTELIGENTE DE FECHAS CON CACHÉ
// ==========================================
function parseDateSpanish(dateStr, row = null, colName = null) {
    if (!dateStr) return null;

    if (row && colName && row[`_ts_${colName}`] !== undefined) {
        return row[`_ts_${colName}`];
    }

    let str = String(dateStr).trim().toLowerCase();
    const meses = { 'ene':0,'enero':0,'feb':1,'febrero':1,'mar':2,'marzo':2,'abr':3,'abril':3,'may':4,'mayo':4,'jun':5,'junio':5,'jul':6,'julio':6,'ago':7,'agosto':7,'sep':8,'septiembre':8,'oct':9,'octubre':9,'nov':10,'noviembre':10,'dic':11,'diciembre':11 };
    let finalTime = null;

    if (str.includes(' de ')) {
        const p = str.split(' de ');
        if (p.length === 3) finalTime = new Date(parseInt(p[2]), meses[p[1]], parseInt(p[0])).getTime();
    } else {
        str = str.split(' ')[0];
        if (str.includes('/')) {
            const p = str.split('/');
            if (p.length >= 3) finalTime = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])).getTime();
        } else if (str.includes('-') && str.split('-').length === 2) {
            const p = str.split('-');
            let year = new Date().getFullYear(); 
            if (row && row['Cita Programada en']) {
                let strProg = String(row['Cita Programada en']).trim().toLowerCase();
                if (strProg.includes(' de ')) { let pProg = strProg.split(' de '); if (pProg.length === 3) year = parseInt(pProg[2]); } 
                else if (strProg.includes('/')) { let pProg = strProg.split('/'); if (pProg.length >= 3) year = parseInt(pProg[2]); }
            } else {
                let tempDate = new Date(year, meses[p[1]], parseInt(p[0]));
                if (tempDate > new Date()) year--;
            }
            finalTime = new Date(year, meses[p[1]], parseInt(p[0])).getTime();
        } else {
            const fb = new Date(str).getTime();
            finalTime = isNaN(fb) ? null : fb;
        }
    }

    if (row && colName && finalTime !== null) { row[`_ts_${colName}`] = finalTime; }
    return finalTime;
}

function getRangoFechas() {
    const val = document.getElementById('global-date-filter').value;
    let start = null, end = null;
    const now = new Date(); now.setHours(0,0,0,0);

    if(val === 'today') { start = now.getTime(); end = now.getTime() + 86400000; }
    else if(val === 'yesterday') { start = now.getTime() - 86400000; end = now.getTime(); }
    else if(val === '7days') { start = now.getTime() - (7 * 86400000); end = now.getTime() + 86400000; }
    else if(val === '14days') { start = now.getTime() - (14 * 86400000); end = now.getTime() + 86400000; }
    else if(val === '30days') { start = now.getTime() - (30 * 86400000); end = now.getTime() + 86400000; }
    else if(val === 'thisMonth') { start = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(); }
    else if(val === 'lastMonth') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(); end = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); }
    else if(val === 'thisYear') { start = new Date(now.getFullYear(), 0, 1).getTime(); end = new Date(now.getFullYear() + 1, 0, 1).getTime(); }
    else if(val === 'custom') {
        const cS = document.getElementById('custom-start-date'); const cE = document.getElementById('custom-end-date');
        if (cS && cE && cS.value && cE.value) {
            const [sy, sm, sd] = cS.value.split('-'); const [ey, em, ed] = cE.value.split('-');
            start = new Date(sy, sm - 1, sd).getTime(); end = new Date(ey, em - 1, ed).getTime() + 86400000; 
        }
    }
    return { start, end };
}

function procesarYRenderizar() {
    if (!window.AppData || !window.AppData.raw || !window.AppData.raw.leads) return;
    
    const { start, end } = getRangoFechas();
    
    // ==========================================
    // 1. RECONSTRUCCIÓN DINÁMICA DE DESPLEGABLES
    // ==========================================
    const campañasDisponibles = new Set();
    const operadoresDisponibles = new Set();

    // Verificamos qué campañas tuvieron leads en estas fechas
    window.AppData.raw.leads.forEach(r => {
        let esValida = true;
        if (start !== null && end !== null) {
            const t = parseDateSpanish(r['Fecha entrada lead'], r, 'Fecha entrada lead');
            if (!t || t < start || t >= end) esValida = false;
        }
        if (esValida && r['Campaña']) campañasDisponibles.add(r['Campaña'].trim());
    });

    // Verificamos qué operadores generaron citas en estas fechas
    window.AppData.raw.citas.forEach(r => {
        let esValida = true;
        if (start !== null && end !== null) {
            const t = parseDateSpanish(r['Cita generada'], r, 'Cita generada');
            if (!t || t < start || t >= end) esValida = false;
        }
        if (esValida && r['Operador']) operadoresDisponibles.add(r['Operador'].trim());
    });

    const campFilter = document.getElementById('global-campaign-filter');
    const opFilter = document.getElementById('global-operator-filter');

    // Memorizamos lo que el usuario tenía seleccionado antes de reconstruir el menú
    const prevCamp = campFilter.value;
    const prevOp = opFilter.value;

    // Limpiamos y reconstruimos los menús
    campFilter.innerHTML = '<option value="all" selected>Todas las Campañas</option>';
    opFilter.innerHTML = '<option value="all" selected>Todos los Operadores</option>';

    Array.from(campañasDisponibles).sort().forEach(camp => { campFilter.innerHTML += `<option value="${camp}">${camp}</option>`; });
    Array.from(operadoresDisponibles).sort().forEach(op => { opFilter.innerHTML += `<option value="${op}">${op}</option>`; });

    // Si lo que estaba seleccionado sigue existiendo en estas fechas, lo mantenemos; si no, volvemos a "all"
    campFilter.value = campañasDisponibles.has(prevCamp) ? prevCamp : 'all';
    opFilter.value = operadoresDisponibles.has(prevOp) ? prevOp : 'all';

    const finalCampaignSelected = campFilter.value;
    const finalOperatorSelected = opFilter.value;

    // ==========================================
    // 2. FILTRADO PRINCIPAL DE LOS DATOS
    // ==========================================
    const cumpleFiltro = (row, colCampaña, colOperador, colFecha) => {
        if (finalCampaignSelected !== 'all' && colCampaña && row[colCampaña] !== finalCampaignSelected) return false;
        if (finalOperatorSelected !== 'all' && colOperador && row[colOperador] !== finalOperatorSelected) return false;
        if (start !== null && end !== null && colFecha) {
            if (!row[colFecha]) return false;
            const rowTime = parseDateSpanish(row[colFecha], row, colFecha); 
            if (!rowTime) return false; 
            if (rowTime < start || rowTime >= end) return false;
        }
        return true;
    };

    const cumpleFiltroAds = (row) => {
        if (finalCampaignSelected !== 'all' && row['Campaign name'] && row['Campaign name'] !== finalCampaignSelected) return false;
        if (start !== null && end !== null && row['Day']) {
            let rowTime = new Date(row['Day'] + 'T00:00:00').getTime();
            if (rowTime < start || rowTime >= end) return false;
        }
        return true;
    };

    const dataFiltrada = {
        leads: window.AppData.raw.leads.filter(r => cumpleFiltro(r, 'Campaña', null, 'Fecha entrada lead')),
        contactados: window.AppData.raw.contactados.filter(r => cumpleFiltro(r, 'Campaña', null, 'Fecha 1er llamada')), 
        llamadas: window.AppData.raw.llamadas.filter(r => cumpleFiltro(r, 'Campaña', null, 'Fecha last call')),
        citas: window.AppData.raw.citas.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Cita generada')),
        shows: window.AppData.raw.shows.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Fecha Visita')),
        noShows: window.AppData.raw.noShows.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Fecha Visita')),
        cancelados: window.AppData.raw.cancelados.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Fecha Visita')),
        ads: (window.AppData.raw.ads || []).filter(cumpleFiltroAds),
        dateRange: { start, end } 
    };

    if (typeof renderizarVistaGeneral === 'function') renderizarVistaGeneral(dataFiltrada);
    if (typeof renderizarCallTracker === 'function') renderizarCallTracker(dataFiltrada);
    if (typeof renderizarGraficos === 'function') renderizarGraficos(dataFiltrada);
    if (typeof renderizarAds === 'function') renderizarAds(dataFiltrada);
}

document.addEventListener('DOMContentLoaded', () => {
    const filterDate = document.getElementById('global-date-filter');
    const customContainer = document.getElementById('custom-date-container');
    if(filterDate && customContainer) {
        filterDate.addEventListener('change', function(e) {
            if (e.target.value === 'custom') customContainer.style.display = 'flex';
            else { customContainer.style.display = 'none'; procesarYRenderizar(); }
        });
    }
    const els = ['btn-apply-custom-date', 'global-campaign-filter', 'global-operator-filter', 'global-timezone'];
    els.forEach(id => { const el = document.getElementById(id); if(el) el.addEventListener(id.includes('btn') ? 'click' : 'change', procesarYRenderizar); });
    const btnRef = document.getElementById('btn-refresh');
    if(btnRef) btnRef.addEventListener('click', loadAllData);
});
