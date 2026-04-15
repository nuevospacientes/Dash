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
        const [ leadsGenerados, leadsContactados, llamadasConectadas, citasGeneradas, shows, noShows, cancelaCita, leadsAntiguos, metaAds, showsNt ] = await Promise.all([
            fetchCSV(DB_URLS.leadsGenerados), fetchCSV(DB_URLS.leadsContactados), fetchCSV(DB_URLS.llamadasConectadas), fetchCSV(DB_URLS.citasGeneradas),
            fetchCSV(DB_URLS.shows), fetchCSV(DB_URLS.noShows), fetchCSV(DB_URLS.cancelaCita), fetchCSV(DB_URLS.leadsAntiguos), fetchCSV(DB_URLS.metaAds),
            fetchCSV(DB_URLS.showsNt)
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

        // 1. CARGAMOS LA DATA CRUDA EN LA MEMORIA RAM
        window.AppData.raw = {
            leads: [...(leadsGenerados || []), ...leadsAntiguosFormateados], 
            contactados: leadsContactados, 
            llamadas: llamadasConectadas, 
            citas: citasGeneradas, 
            shows: shows, 
            showsNt: showsNt || [], 
            noShows: noShows, 
            cancelados: cancelaCita, 
            ads: metaAds 
        };
        
        // 2. EJECUTAMOS EL SCRAPPER PESADO Y ESTRUCTURAL (UNA SOLA VEZ)
        procesarBasesDeDatosMaestras();

        // 3. RENDERIZAMOS LA VISTA AL INSTANTE
        procesarYRenderizar();

        const session = JSON.parse(localStorage.getItem('np_session'));
        if(session && welcome) welcome.innerHTML = `Bienvenido, <strong>${session.nombre}</strong>`;

    } catch (error) {
        console.error(error);
        mostrarErrorSistema("Hubo un error al descargar la información.", "loadAllData()", "Asegúrate de que la URL termine en 'output=csv' y exista en config.js.");
    }
}

// =========================================================================
// FUNCIÓN PESADA NIVEL NASA: ESTRUCTURACIÓN DE CLINICA - TRATAMIENTO
// =========================================================================
function procesarBasesDeDatosMaestras() {
    const cleanPhone = (str) => String(str || '').replace(/[^0-9]/g, '');
    const cleanEmail = (str) => String(str || '').toLowerCase().trim();
    const normalizeStr = (str) => String(str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();

    // Diccionario Oficiales
    const officialNames = { camp: {}, op: {} };

    // Desensamblador Inteligente de Campañas (Clínica vs Tratamiento)
    const getOfficialCampName = (rawCamp) => {
        if (!rawCamp || String(rawCamp).trim() === '') return null;
        let str = String(rawCamp).trim();
        
        let clinica = str;
        let tratamiento = "";
        
        if (str.includes('-')) {
            let parts = str.split('-');
            clinica = parts[0].trim();
            tratamiento = parts.slice(1).join('-').trim(); // Por si hay múltiples guiones
        }

        let keyC = normalizeStr(clinica);
        let keyT = normalizeStr(tratamiento);
        let masterKey = keyT ? `${keyC}|${keyT}` : keyC; // Hash indestructible

        if (!officialNames.camp[masterKey]) {
            // Guardamos la primera versión como la "Bonita y Oficial", estandarizando el guión
            officialNames.camp[masterKey] = tratamiento ? `${clinica} - ${tratamiento}` : clinica;
        }
        return officialNames.camp[masterKey];
    };

    const getOfficialOpName = (rawOp) => {
        if (!rawOp || String(rawOp).trim() === '') return null;
        let norm = normalizeStr(rawOp);
        if (!officialNames.op[norm]) officialNames.op[norm] = String(rawOp).trim();
        return officialNames.op[norm]; 
    };

    const masterCamp = { byPhone: {}, byEmail: {}, byName: {} };
    const masterOp = { byPhone: {}, byEmail: {}, byName: {} };
    const sheets = ['leads', 'contactados', 'llamadas', 'citas', 'shows', 'showsNt', 'noShows', 'cancelados'];

    // FASE 1: Aprender de todas las hojas simultáneamente
    sheets.forEach(sheetName => {
        if (!window.AppData.raw[sheetName]) return;
        window.AppData.raw[sheetName].forEach(row => {
            let camp = getOfficialCampName(row['Campaña']);
            let op = getOfficialOpName(row['Operador']);
            
            let p = cleanPhone(row['Numero'] || row['Teléfono'] || row['Telefono'] || row['Phone'] || row['Número']);
            let e = cleanEmail(row['Email'] || row['Email ']);
            let n = normalizeStr(row['Nombre'] || row['First Name'] || row['Lead Name']);

            if (camp) {
                if (p) masterCamp.byPhone[p] = camp;
                if (e) masterCamp.byEmail[e] = camp;
                if (n && n.length > 3) masterCamp.byName[n] = camp;
            }
            if (op && op !== 'Sin Asignar') {
                if (p && !masterOp.byPhone[p]) masterOp.byPhone[p] = op;
                if (e && !masterOp.byEmail[e]) masterOp.byEmail[e] = op;
                if (n && n.length > 3 && !masterOp.byName[n]) masterOp.byName[n] = op;
            }
        });
    });

    // FASE 2: Reparar y curar la memoria RAM de todas las hojas del Embudo
    sheets.forEach(sheetName => {
        if (!window.AppData.raw[sheetName]) return;
        window.AppData.raw[sheetName].forEach(row => {
            let p = cleanPhone(row['Numero'] || row['Teléfono'] || row['Telefono'] || row['Phone'] || row['Número']);
            let e = cleanEmail(row['Email'] || row['Email ']);
            let n = normalizeStr(row['Nombre'] || row['First Name'] || row['Lead Name']);

            let baseCamp = getOfficialCampName(row['Campaña']);
            row['Campaña'] = masterCamp.byPhone[p] || masterCamp.byEmail[e] || masterCamp.byName[n] || baseCamp || 'Desconocida';
            
            let baseOp = getOfficialOpName(row['Operador']);
            row['Operador'] = masterOp.byPhone[p] || masterOp.byEmail[e] || masterOp.byName[n] || baseOp || 'Sin Asignar';
        });
    });

    // FASE 3: Curar también los Meta Ads usando el mismo algoritmo para evitar cuellos de botella al filtrar
    if (window.AppData.raw.ads) {
        window.AppData.raw.ads.forEach(row => {
            row['OfficialCampaign'] = getOfficialCampName(row['Campaign name']) || 'Desconocida';
        });
    }
}
// =========================================================================

function parseDateSpanish(dateStr, row = null, colName = null) {
    if (!dateStr) return null;
    if (row && colName && row[`_ts_${colName}`] !== undefined) { return row[`_ts_${colName}`]; }

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
            let month = meses[p[1]];
            let day = parseInt(p[0]);

            if (row) {
                let referenceYear = null;

                if (row['Cita Programada en']) {
                    let cProg = String(row['Cita Programada en']).trim().toLowerCase();
                    if (cProg.includes(' de ')) {
                        let parts = cProg.split(' de ');
                        if (parts.length === 3) referenceYear = parseInt(parts[2]);
                    } else if (cProg.includes('/')) {
                        let parts = cProg.split('/');
                        if (parts.length >= 3) referenceYear = parseInt(parts[2]);
                    }
                }

                if (!referenceYear) {
                    let cLead = String(row['Fecha Lead entra'] || row['Fecha entrada lead'] || '').trim().toLowerCase();
                    if (cLead) {
                        if (cLead.includes(' de ')) {
                            let parts = cLead.split(' de ');
                            if (parts.length === 3) referenceYear = parseInt(parts[2]);
                        } else if (cLead.includes('/')) {
                            let parts = cLead.split('/');
                            if (parts.length >= 3) referenceYear = parseInt(parts[2]);
                        }
                    }
                }

                if (referenceYear) {
                    year = referenceYear;
                    let currentMonth = new Date().getMonth();
                    if (month < currentMonth && currentMonth >= 9) { 
                        year++;
                    }
                } else {
                    let tempDate = new Date(year, month, day);
                    if (colName === 'Cita Programada en' || colName === 'Cita generada') {
                        let currentMonth = new Date().getMonth();
                        if (currentMonth === 11 && month === 0) year++;
                        else if (currentMonth === 0 && month === 11) year--;
                    } else {
                        if (tempDate > new Date()) year--;
                    }
                }
            }

            finalTime = new Date(year, month, day).getTime();
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

// =========================================================================
// FUNCIÓN LIGERA: FILTRA LA DATA PERFECTA EN MILISEGUNDOS
// =========================================================================
function procesarYRenderizar() {
    if (!window.AppData || !window.AppData.raw || !window.AppData.raw.leads) return;

    const { start, end } = getRangoFechas();

    const isDateValid = (row, colFecha) => {
        if (start === null || end === null) return true;
        if (!row[colFecha] || String(row[colFecha]).trim() === '') return false;
        const rowTime = parseDateSpanish(row[colFecha], row, colFecha); 
        if (!rowTime) return false; 
        return rowTime >= start && rowTime < end;
    };

    const campañasDisponibles = new Set();
    const operadoresDisponibles = new Set();

    // Buscar opciones activas en el rango de fechas
    window.AppData.raw.leads.forEach(r => { if(isDateValid(r, 'Fecha entrada lead')) campañasDisponibles.add(r['Campaña']); });
    
    if(window.AppData.raw.contactados) {
        window.AppData.raw.contactados.forEach(r => { 
            let colDate = r['Fecha 1er llamada'] ? 'Fecha 1er llamada' : (r['Fecha Lead entra'] ? 'Fecha Lead entra' : 'Fecha entrada lead');
            if(isDateValid(r, colDate)) campañasDisponibles.add(r['Campaña']); 
        });
    }
    
    if(window.AppData.raw.llamadas) {
        window.AppData.raw.llamadas.forEach(r => { 
            let col = r['Fecha last call'] ? 'Fecha last call' : 'Fecha Lead entra';
            if(isDateValid(r, col)) campañasDisponibles.add(r['Campaña']); 
        });
    }
    
    window.AppData.raw.citas.forEach(r => {
        if(isDateValid(r, 'Cita generada')) {
            campañasDisponibles.add(r['Campaña']);
            operadoresDisponibles.add(r['Operador']);
        }
    });

    window.AppData.raw.shows.forEach(r => { if(isDateValid(r, 'Fecha Visita')) campañasDisponibles.add(r['Campaña']); });

    const campFilter = document.getElementById('global-campaign-filter');
    const opFilter = document.getElementById('global-operator-filter');
    const prevCamp = campFilter.value; const prevOp = opFilter.value;

    let campHTML = '<option value="all" selected>Todas las Campañas</option>';
    let opHTML = '<option value="all" selected>Todos los Operadores</option>';

    Array.from(campañasDisponibles).sort().forEach(camp => { campHTML += `<option value="${camp}">${camp}</option>`; });
    Array.from(operadoresDisponibles).sort().forEach(op => { opHTML += `<option value="${op}">${op}</option>`; });

    campFilter.innerHTML = campHTML;
    opFilter.innerHTML = opHTML;

    campFilter.value = campañasDisponibles.has(prevCamp) ? prevCamp : 'all';
    opFilter.value = operadoresDisponibles.has(prevOp) ? prevOp : 'all';

    const finalCampaignSelected = campFilter.value;
    const finalOperatorSelected = opFilter.value;

    // Filtros Ultra-Rápidos usando comparación exacta (==)
    const cumpleFiltroFinal = (row, colDate, isOpRelevant = false) => {
        if (finalCampaignSelected !== 'all' && row['Campaña'] !== finalCampaignSelected) return false;
        if (isOpRelevant && finalOperatorSelected !== 'all' && row['Operador'] !== finalOperatorSelected) return false;
        return isDateValid(row, colDate);
    };

    const cumpleFiltroAds = (row) => {
        // Gracias al scrapper de la Fase 3, aquí ya tenemos 'OfficialCampaign' curada.
        if (finalCampaignSelected !== 'all' && row['OfficialCampaign'] !== finalCampaignSelected) return false;
        if (start !== null && end !== null && row['Day']) {
            let rowTime = new Date(row['Day'] + 'T00:00:00').getTime();
            if (rowTime < start || rowTime >= end) return false;
        }
        return true;
    };
        // 1. FILTRADO BÁSICO (Fechas, Campañas y Operadores)
    const baseLeads = window.AppData.raw.leads.filter(r => cumpleFiltroFinal(r, 'Fecha entrada lead', false));
    const baseContactados = window.AppData.raw.contactados.filter(r => {
        let colDate = r['Fecha last call'] ? 'Fecha last call' : (r['Fecha 1er llamada'] ? 'Fecha 1er llamada' : 'Fecha Lead entra');
        return cumpleFiltroFinal(r, colDate, false);
    }); 
    const baseLlamadas = window.AppData.raw.llamadas.filter(r => {
        let col = r['Fecha last call'] ? 'Fecha last call' : 'Fecha Lead entra';
        return cumpleFiltroFinal(r, col, false);
    });
    const baseCitas = window.AppData.raw.citas.filter(r => cumpleFiltroFinal(r, 'Cita generada', true));

    // 2. ÚNICA FUENTE DE VERDAD (Deduplicación global para todos los módulos)
    const leadsMap = new Map();
    baseLeads.forEach(lead => {
        let num = String(lead['Numero'] || lead['Teléfono'] || lead['Phone'] || '').trim();
        if (num !== '') leadsMap.set(num, lead);
        else leadsMap.set('sin_num_' + Math.random(), lead);
    });
    const leadsUnicos = Array.from(leadsMap.values());

    const contactadosMap = new Map();
    baseContactados.forEach(c => {
        let num = String(c['Numero'] || c['Teléfono'] || c['Phone'] || '').trim();
        if (num !== '' && !contactadosMap.has(num)) contactadosMap.set(num, c);
    });

    const llamadasMap = new Map();
    baseLlamadas.forEach(c => {
        let num = String(c['Numero'] || c['Teléfono'] || c['Phone'] || '').trim();
        if (num !== '' && !llamadasMap.has(num)) llamadasMap.set(num, c);
    });

    const citasNuevas = [];
    const citasReprogramadas = [];
    baseCitas.forEach(c => {
        let tipo = String(c['Tipo de cita'] || '').toLowerCase();
        if (tipo.includes('reagenda') || tipo.includes('reagendamiento') || tipo.includes('reprogramada')) {
            citasReprogramadas.push(c);
        } else {
            citasNuevas.push(c);
        }
    });

    // 3. EMPAQUETADO FINAL (Se envía a todos los módulos)
    const dataFiltrada = {
        // Data pura (por si algún gráfico histórico lo necesita)
        leadsRaw: baseLeads,
        citasRaw: baseCitas,
        
        // DATA LIMPIA Y OFICIAL (Esta es la que usarán todos)
        leads: leadsUnicos,
        contactados: Array.from(contactadosMap.values()),
        llamadas: Array.from(llamadasMap.values()),
        citas: citasNuevas, // Citas limpias de reprogramaciones
        citasReprog: citasReprogramadas,
        citasCalendario: window.AppData.raw.citas.filter(r => cumpleFiltroFinal(r, 'Cita Programada en', true)),
        
        shows: window.AppData.raw.shows.filter(r => cumpleFiltroFinal(r, 'Fecha Visita', true)),
        showsNt: window.AppData.raw.showsNt ? window.AppData.raw.showsNt.filter(r => cumpleFiltroFinal(r, 'Fecha Visita', true)) : [],
        noShows: window.AppData.raw.noShows.filter(r => cumpleFiltroFinal(r, 'Fecha Visita', true)),
        cancelados: window.AppData.raw.cancelados.filter(r => cumpleFiltroFinal(r, 'Fecha Visita', true)),
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

/* ==========================================
   🕵️ DETECTIVE DE LEADS (Rastreador detallado)
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('btn-search-lead');

    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', window.ejecutarDetective);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.ejecutarDetective();
        });
    }
});

window.ejecutarDetective = function() {
    const container = document.getElementById('search-results');
    const input = document.getElementById('search-input');
    if (!container || !input) return;

    const termRaw = input.value.toLowerCase().trim();
    if (termRaw.length < 3) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--accent-warning); background: var(--bg-panel); border-radius: 8px;">Por favor ingresa al menos 3 caracteres para buscar (Nombre, Correo o Teléfono).</div>';
        container.style.display = 'block';
        return;
    }

    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--brand-primary);"><i class="fa-solid fa-circle-notch fa-spin"></i> Auditando bases de datos...</div>';
    container.style.display = 'block';

    setTimeout(() => {
        const rawData = window.AppData.raw;
        if (!rawData || !rawData.leads) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--accent-danger);">No hay bases de datos cargadas en el sistema.</div>';
            return;
        }

        const termPhone = termRaw.replace(/[^0-9]/g, '');
        const matchRecord = (row) => {
            const name = String(row['Nombre'] || row['First Name'] || row['Lead Name'] || '').toLowerCase();
            const email = String(row['Email'] || row['Email '] || '').toLowerCase();
            const phoneStr = String(row['Numero'] || row['Teléfono'] || row['Telefono'] || row['Phone'] || row['Número'] || '');
            const phoneClean = phoneStr.replace(/[^0-9]/g, '');

            if (name.includes(termRaw)) return true;
            if (email.includes(termRaw)) return true;
            if (termPhone.length >= 4 && phoneClean.includes(termPhone)) return true;
            if (phoneStr.toLowerCase().includes(termRaw)) return true; 
            return false;
        };

        let perfiles = {};

        const addEvent = (id, type, dateStr, details, badgeColor, icon, row) => {
            if (!perfiles[id]) {
                perfiles[id] = {
                    nombre: row['Nombre'] || row['First Name'] || 'Desconocido',
                    telefono: row['Numero'] || row['Teléfono'] || row['Phone'] || '-',
                    email: row['Email'] || row['Email '] || '-',
                    campana: row['Campaña'] || row['Campaña (UTM)'] || row['Origen Campaña'] || 'Desconocida',
                    events: []
                };
            }
            
            let timestamp = 0;
            if (dateStr) {
                let parsed = typeof parseDateSpanish === 'function' ? parseDateSpanish(dateStr.split(' ')[0], row, 'dummy') : new Date(dateStr.split(' ')[0]).getTime();
                
                if (parsed) {
                    timestamp = parsed;
                    let timeMatch = dateStr.match(/\d{1,2}:\d{2}(:\d{2})?/);
                    if (timeMatch) {
                        let pts = timeMatch[0].split(':');
                        timestamp += (parseInt(pts[0]) * 3600000) + (parseInt(pts[1]) * 60000);
                    }
                }
            }

            perfiles[id].events.push({ type, dateStr: dateStr || 'Fecha no registrada', details, badgeColor, icon, timestamp, row });
        };

        const calcularDuracion = (horaInicio, horaFin) => {
            if (!horaInicio || !horaFin) return null;
            let t1 = String(horaInicio).trim().split(':');
            let t2 = String(horaFin).trim().split(':');
            
            if (t1.length < 2 || t2.length < 2) return null;

            let d1 = new Date(); d1.setHours(parseInt(t1[0]), parseInt(t1[1]), parseInt(t1[2]||0));
            let d2 = new Date(); d2.setHours(parseInt(t2[0]), parseInt(t2[1]), parseInt(t2[2]||0));
            
            let diffMs = d2 - d1;
            if (diffMs < 0) diffMs += 86400000; 
            
            let diffSecs = Math.floor(diffMs / 1000);
            if (diffSecs < 60) return `${diffSecs} seg`;
            return `${Math.floor(diffSecs / 60)} min ${diffSecs % 60} seg`;
        };

        rawData.leads.filter(matchRecord).forEach(r => {
            let id = String(r['Numero'] || r['Teléfono'] || r['Phone'] || r['Nombre']).trim();
            let hora = r['Hora Generado'] || r['Hora entrada'] || '';
            let dateStr = hora ? `${r['Fecha entrada lead'] || r['Lead entry date']} ${hora}` : (r['Fecha entrada lead'] || r['Lead entry date']);
            addEvent(id, 'INGRESO LEAD', dateStr, `El lead entró al sistema.`, 'var(--border-color)', 'fa-user-plus', r);
        });

        if(rawData.contactados) {
            rawData.contactados.filter(matchRecord).forEach(r => {
                let id = String(r['Numero'] || r['Teléfono'] || r['Phone'] || r['Nombre']).trim();
                let op = r['Operador'] || 'un agente';
                let fecha = r['Fecha 1er llamada'] || r['Fecha Lead entra'] || 'Fecha desconocida';
                let hora = r['Hora 1er llamada'] || '';
                let dateStr = hora ? `${fecha} ${hora}` : fecha;
                
                addEvent(id, 'INTENTO DE LLAMADA', dateStr, `El operador <b>${op}</b> realizó una marca/intento de contacto.`, 'var(--text-muted)', 'fa-phone', r);
            });
        }

        if(rawData.llamadas) {
            rawData.llamadas.filter(matchRecord).forEach(r => {
                let id = String(r['Numero'] || r['Teléfono'] || r['Phone'] || r['Nombre']).trim();
                let op = r['Operador'] || 'un agente';
                let fecha = r['Fecha last call'] || r['Fecha 1er llamada'] || 'Fecha desconocida';
                let horaInicio = r['Hora 1er llamada'] || '';
                let horaFin = r['Hora last call'] || '';
                
                let dateStr = horaInicio ? `${fecha} ${horaInicio}` : fecha;
                
                let duracion = calcularDuracion(horaInicio, horaFin);
                let duracionHtml = duracion ? `<br><span style="color: #bc13fe; font-size: 0.8rem;"><i class="fa-solid fa-clock"></i> Tiempo en línea: <b>${duracion}</b></span>` : '';

                addEvent(id, 'LLAMADA CONECTADA', dateStr, `El lead contestó. Atendido por: <b>${op}</b>.${duracionHtml}`, '#bc13fe', 'fa-phone-volume', r);
            });
        }

        if(rawData.citas) {
            rawData.citas.filter(matchRecord).forEach(r => {
                let id = String(r['Numero'] || r['Teléfono'] || r['Phone'] || r['Nombre']).trim();
                let citaPara = r['Cita Programada en'] || r['Fecha Cita Solicitada'] || 'Pendiente';
                let op = r['Operador'] || 'un agente';
                addEvent(id, 'CITA AGENDADA', r['Cita generada'], `<b>${op}</b> agendó una cita para la fecha: <b>${citaPara}</b>.`, 'var(--brand-primary)', 'fa-calendar-check', r);
            });
        }

        const finales = [
            { sheet: 'shows', type: 'SHOW / ASISTENCIA', color: 'var(--accent-success)', icon: 'fa-check-double' },
            { sheet: 'noShows', type: 'NO SHOW (Faltó)', color: 'var(--accent-warning)', icon: 'fa-user-xmark' },
            { sheet: 'cancelados', type: 'CANCELADO', color: 'var(--accent-danger)', icon: 'fa-ban' }
        ];

        finales.forEach(cfg => {
            if(rawData[cfg.sheet]) {
                rawData[cfg.sheet].filter(matchRecord).forEach(r => {
                    let id = String(r['Numero'] || r['Teléfono'] || r['Phone'] || r['Nombre']).trim();
                    let dep = r['Deposito'] && String(r['Deposito']).toLowerCase() !== 'sin deposito' && String(r['Deposito']).toLowerCase() !== 'sin depósito' ? `Dejó depósito vía: <b style="color: var(--accent-success);">${r['Deposito']}</b>` : 'No dejó depósito.';
                    addEvent(id, cfg.type, r['Fecha Visita'], `Resultado de la cita. <br><span style="font-size: 0.8rem;">${dep}</span>`, cfg.color, cfg.icon, r);
                });
            }
        });

        let html = '';
        const keys = Object.keys(perfiles);

        if (keys.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 30px; background: var(--bg-panel); border-radius: 8px; border: 1px dashed var(--border-color);"><i class="fa-solid fa-magnifying-glass" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 10px;"></i><br>No hay rastro de este lead en ninguna base de datos.</div>';
            return;
        }

        keys.forEach(k => {
            let p = perfiles[k];
            p.events.sort((a,b) => a.timestamp - b.timestamp);

            let eventsHtml = p.events.map((ev, index) => {
                let isLast = index === p.events.length - 1;
                return `
                    <div style="display: flex; gap: 15px; margin-bottom: ${isLast ? '0' : '20px'}; position: relative;">
                        ${!isLast ? `<div style="width: 2px; background: var(--border-color); position: absolute; left: 14px; top: 30px; bottom: -20px; z-index: 0;"></div>` : ''}
                        
                        <div style="width: 30px; height: 30px; border-radius: 50%; background: var(--bg-panel); border: 2px solid ${ev.badgeColor}; display: flex; align-items: center; justify-content: center; z-index: 1; flex-shrink: 0; box-shadow: 0 0 10px rgba(0,0,0,0.5);">
                            <i class="fa-solid ${ev.icon}" style="color: ${ev.badgeColor}; font-size: 0.75rem;"></i>
                        </div>
                        
                        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 12px 15px; border-radius: 8px; flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                                <div style="font-weight: 700; color: ${ev.badgeColor}; font-size: 0.9rem;">${ev.type}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); background: var(--bg-input); padding: 2px 6px; border-radius: 4px;">${ev.dateStr}</div>
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-main); line-height: 1.4;">${ev.details}</div>
                        </div>
                    </div>
                `;
            }).join('');

            html += `
                <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 25px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                    <div style="background: rgba(0,0,0,0.2); padding: 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 15px; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--brand-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold;">
                                ${p.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 style="margin: 0; color: var(--text-main); font-size: 1.3rem;">${p.nombre}</h3>
                                <div style="color: var(--brand-primary); font-size: 0.85rem; margin-top: 5px; font-weight: 600;"><i class="fa-solid fa-bullhorn"></i> ${p.campana}</div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="color: var(--text-main); font-size: 0.95rem; font-weight: 500;"><i class="fa-solid fa-phone" style="color: var(--text-muted);"></i> ${p.telefono}</div>
                            <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 5px;"><i class="fa-solid fa-envelope"></i> ${p.email}</div>
                        </div>
                    </div>
                    <div style="padding: 25px;">
                        <h4 style="margin-top: 0; margin-bottom: 25px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">Línea de Tiempo del Embudo</h4>
                        ${eventsHtml}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    }, 300);
};
