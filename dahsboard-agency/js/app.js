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
        // AÑADIDO: Agregamos showsNt al bloque de descargas
        const [ leadsGenerados, leadsContactados, llamadasConectadas, citasGeneradas, shows, noShows, cancelaCita, leadsAntiguos, metaAds, showsNt ] = await Promise.all([
            fetchCSV(DB_URLS.leadsGenerados), fetchCSV(DB_URLS.leadsContactados), fetchCSV(DB_URLS.llamadasConectadas), fetchCSV(DB_URLS.citasGeneradas),
            fetchCSV(DB_URLS.shows), fetchCSV(DB_URLS.noShows), fetchCSV(DB_URLS.cancelaCita), fetchCSV(DB_URLS.leadsAntiguos), fetchCSV(DB_URLS.metaAds),
            fetchCSV(DB_URLS.showsNt) // <--- NUEVO
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
            contactados: leadsContactados, 
            llamadas: llamadasConectadas, 
            citas: citasGeneradas, 
            shows: shows, 
            showsNt: showsNt || [], // <--- NUEVA HOJA AÑADIDA AL CEREBRO
            noShows: noShows, 
            cancelados: cancelaCita, 
            ads: metaAds 
        };
        
        procesarYRenderizar();

        const session = JSON.parse(localStorage.getItem('np_session'));
        if(session && welcome) welcome.innerHTML = `Bienvenido, <strong>${session.nombre}</strong>`;

    } catch (error) {
        console.error(error);
        mostrarErrorSistema("Hubo un error al descargar la información.", "loadAllData()", "Asegúrate de que la URL termine en 'output=csv' y exista en config.js.");
    }
}

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
        } else if (str.includes('-')) {
            const p = str.split('-');
            if (p.length === 2) {
                // Caso "28-mar"
                let year = new Date().getFullYear(); 
                let tempDate = new Date(year, meses[p[1]], parseInt(p[0]));
                if (colName === 'Cita Programada en') {
                    // Si la cita programada es para un mes anterior y ya pasó, asumimos que es del próximo año
                    // (Ej. Estamos en nov y agenda para ene -> es ene del siguiente año)
                    if (tempDate < new Date() && tempDate.getMonth() < new Date().getMonth()) year++;
                } else {
                    if (tempDate > new Date()) year--;
                }
                finalTime = new Date(year, meses[p[1]], parseInt(p[0])).getTime();
            }
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

    // --- NUEVO CEREBRO DE ATRIBUCIÓN MAESTRA ---
    // 1. Mapeamos el teléfono de cada Lead con su Campaña exacta (La fuente de la verdad)
    const numeroACampana = {};
    window.AppData.raw.leads.forEach(l => {
        let num = String(l['Numero'] || l['Teléfono'] || l['Telefono'] || l['Phone'] || l['Número'] || '').trim();
        let camp = String(l['Campaña'] || '').trim();
        if (num !== '' && camp !== '') numeroACampana[num] = camp;
    });

    // 2. Mapeamos el teléfono con el Operador (desde Citas)
    const numeroAOperador = {};
    window.AppData.raw.citas.forEach(c => {
        let num = String(c['Numero'] || c['Teléfono'] || c['Telefono'] || c['Phone'] || c['Número'] || '').trim();
        let op = String(c['Operador'] || '').trim();
        if (num !== '' && op !== '') numeroAOperador[num] = op;
    });

    // 3. Unificamos todas las hojas inyectando la Campaña y Operador correctos usando el Teléfono
    ['contactados', 'llamadas', 'citas', 'shows', 'noShows', 'cancelados'].forEach(sheet => {
        if(window.AppData.raw[sheet]) {
            window.AppData.raw[sheet].forEach(row => {
                let num = String(row['Numero'] || row['Teléfono'] || row['Telefono'] || row['Phone'] || row['Número'] || '').trim();
                
                // ATRIBUCIÓN DE CAMPAÑA: Forzamos la campaña del Lead original para que el filtro nunca falle
                if (numeroACampana[num]) {
                    row['Campaña'] = numeroACampana[num];
                } else if (!row['Campaña'] || String(row['Campaña']).trim() === '') {
                    row['Campaña'] = 'Desconocida';
                }
                
                // ATRIBUCIÓN DE OPERADOR
                if (!row['Operador'] || String(row['Operador']).trim() === '') {
                    row['Operador'] = numeroAOperador[num] || 'Sin Asignar';
                }
            });
        }
    });

    const { start, end } = getRangoFechas();
    
    
    const campañasDisponibles = new Set();
    const operadoresDisponibles = new Set();

    window.AppData.raw.leads.forEach(r => {
        let esValida = true;
        if (start !== null && end !== null) {
            const t = parseDateSpanish(r['Fecha entrada lead'], r, 'Fecha entrada lead');
            if (!t || t < start || t >= end) esValida = false;
        }
        if (esValida && r['Campaña']) campañasDisponibles.add(r['Campaña'].trim());
    });

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
    const prevCamp = campFilter.value; const prevOp = opFilter.value;

    // Armamos todo primero en texto para no ahogar al navegador inyectando uno por uno
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

    const cumpleFiltro = (row, colCampaña, colOperador, colFecha) => {
        // 1. Limpiamos espacios extra en Campaña para evitar que se filtren mal
        if (finalCampaignSelected !== 'all' && colCampaña && row[colCampaña] !== undefined) {
            if (String(row[colCampaña]).trim() !== finalCampaignSelected) return false;
        }
        // 2. Limpiamos espacios extra en Operador
        if (finalOperatorSelected !== 'all' && colOperador && row[colOperador] !== undefined) {
            if (String(row[colOperador]).trim() !== finalOperatorSelected) return false;
        }
        // 3. Filtro de Fecha
        if (start !== null && end !== null && colFecha) {
            if (!row[colFecha] || String(row[colFecha]).trim() === '') return false;
            const rowTime = parseDateSpanish(row[colFecha], row, colFecha); 
            if (!rowTime) return false; 
            if (rowTime < start || rowTime >= end) return false;
        }
        return true;
    };

    const cumpleFiltroAds = (row) => {
        if (finalCampaignSelected !== 'all' && row['Campaign name'] !== undefined) {
            if (String(row['Campaign name']).trim() !== finalCampaignSelected) return false;
        }
        if (start !== null && end !== null && row['Day']) {
            let rowTime = new Date(row['Day'] + 'T00:00:00').getTime();
            if (rowTime < start || rowTime >= end) return false;
        }
        return true;
    };

    const dataFiltrada = {
        leads: window.AppData.raw.leads.filter(r => cumpleFiltro(r, 'Campaña', null, 'Fecha entrada lead')),
        
        contactados: window.AppData.raw.contactados.filter(r => {
            let colDate = r['Fecha 1er llamada'] ? 'Fecha 1er llamada' : (r['Fecha Lead entra'] ? 'Fecha Lead entra' : 'Fecha entrada lead');
            return cumpleFiltro(r, 'Campaña', null, colDate);
        }), 
        
        llamadas: window.AppData.raw.llamadas.filter(r => {
            let col = r['Fecha last call'] ? 'Fecha last call' : 'Fecha Lead entra';
            return cumpleFiltro(r, 'Campaña', null, col);
        }),
        
        // Mantenemos 'citas' para no romper gráficos antiguos, y agregamos las separadas
        citas: window.AppData.raw.citas.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Cita generada')),
        citasGeneradas: window.AppData.raw.citas.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Cita generada')),
        citasCalendario: window.AppData.raw.citas.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Cita Programada en')),
        
        shows: window.AppData.raw.shows.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Fecha Visita')),
        showsNt: window.AppData.raw.showsNt ? window.AppData.raw.showsNt.filter(r => cumpleFiltro(r, 'Campaña', 'Operador', 'Fecha Visita')) : [],
        
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
                
                // Si tiene hora, se la sumamos al timestamp para que el orden sea exacto
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

        // --- CEREBRO PARA CALCULAR LA DURACIÓN DE LA LLAMADA ---
        const calcularDuracion = (horaInicio, horaFin) => {
            if (!horaInicio || !horaFin) return null;
            let t1 = String(horaInicio).trim().split(':');
            let t2 = String(horaFin).trim().split(':');
            
            if (t1.length < 2 || t2.length < 2) return null;

            let d1 = new Date(); d1.setHours(parseInt(t1[0]), parseInt(t1[1]), parseInt(t1[2]||0));
            let d2 = new Date(); d2.setHours(parseInt(t2[0]), parseInt(t2[1]), parseInt(t2[2]||0));
            
            let diffMs = d2 - d1;
            if (diffMs < 0) diffMs += 86400000; // Si la llamada cruzó la medianoche
            
            let diffSecs = Math.floor(diffMs / 1000);
            if (diffSecs < 60) return `${diffSecs} seg`;
            return `${Math.floor(diffSecs / 60)} min ${diffSecs % 60} seg`;
        };

        // 1. ESPIA EN LEADS
        rawData.leads.filter(matchRecord).forEach(r => {
            let id = String(r['Numero'] || r['Teléfono'] || r['Phone'] || r['Nombre']).trim();
            let hora = r['Hora Generado'] || r['Hora entrada'] || '';
            let dateStr = hora ? `${r['Fecha entrada lead'] || r['Lead entry date']} ${hora}` : (r['Fecha entrada lead'] || r['Lead entry date']);
            addEvent(id, 'INGRESO LEAD', dateStr, `El lead entró al sistema.`, 'var(--border-color)', 'fa-user-plus', r);
        });

        // 2. ESPIA EN INTENTOS DE LLAMADA (Hoja 2)
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

        // 3. ESPIA EN LLAMADAS CONECTADAS (Hoja 3)
        if(rawData.llamadas) {
            rawData.llamadas.filter(matchRecord).forEach(r => {
                let id = String(r['Numero'] || r['Teléfono'] || r['Phone'] || r['Nombre']).trim();
                let op = r['Operador'] || 'un agente';
                let fecha = r['Fecha last call'] || r['Fecha 1er llamada'] || 'Fecha desconocida';
                let horaInicio = r['Hora 1er llamada'] || '';
                let horaFin = r['Hora last call'] || '';
                
                let dateStr = horaInicio ? `${fecha} ${horaInicio}` : fecha;
                
                // Calculamos la duración usando la nueva función matemática
                let duracion = calcularDuracion(horaInicio, horaFin);
                let duracionHtml = duracion ? `<br><span style="color: #bc13fe; font-size: 0.8rem;"><i class="fa-solid fa-clock"></i> Tiempo en línea: <b>${duracion}</b></span>` : '';

                addEvent(id, 'LLAMADA CONECTADA', dateStr, `El lead contestó. Atendido por: <b>${op}</b>.${duracionHtml}`, '#bc13fe', 'fa-phone-volume', r);
            });
        }

        // 4. ESPIA EN CITAS
        if(rawData.citas) {
            rawData.citas.filter(matchRecord).forEach(r => {
                let id = String(r['Numero'] || r['Teléfono'] || r['Phone'] || r['Nombre']).trim();
                let citaPara = r['Cita Programada en'] || r['Fecha Cita Solicitada'] || 'Pendiente';
                let op = r['Operador'] || 'un agente';
                addEvent(id, 'CITA AGENDADA', r['Cita generada'], `<b>${op}</b> agendó una cita para la fecha: <b>${citaPara}</b>.`, 'var(--brand-primary)', 'fa-calendar-check', r);
            });
        }

        // 5. ESPIA EN SHOWS Y CANCELACIONES
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

        // RENDERIZADO VISUAL
        let html = '';
        const keys = Object.keys(perfiles);

        if (keys.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 30px; background: var(--bg-panel); border-radius: 8px; border: 1px dashed var(--border-color);"><i class="fa-solid fa-magnifying-glass" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 10px;"></i><br>No hay rastro de este lead en ninguna base de datos.</div>';
            return;
        }

        keys.forEach(k => {
            let p = perfiles[k];
            // Ordenamos la línea de tiempo cronológicamente
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
