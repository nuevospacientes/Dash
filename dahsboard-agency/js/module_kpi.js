/* ==========================================
   MÓDULO DE KPIs (VISTA GENERAL)
   ========================================== */

function getTzOffsetMins(timeZone) {
    try {
        const str = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).format(new Date());
        const match = str.match(/GMT([+-])(\d+)(?::(\d+))?/);
        if (!match) return 0;
        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2], 10);
        const mins = match[3] ? parseInt(match[3], 10) : 0;
        return sign * (hours * 60 + mins);
    } catch(e) { return -300; }
}

function getBusinessMinutes(dateStart, dateEnd) {
    let start = new Date(dateStart);
    let end = new Date(dateEnd);

    // 1. REGLA DE NEGOCIO: Si el contacto fue un domingo o fuera de horario
    let endDay = end.getDay();
    let endHour = end.getHours();
    if (endDay === 0 || endHour < 9 || endHour >= 18) {
        return null; 
    }

    // 2. Ajustar el inicio (cuando entró el lead) si fue fuera de horario
    let startDay = start.getDay();
    let startHour = start.getHours();

    if (startDay === 0) { 
        start.setDate(start.getDate() + 1);
        start.setHours(9, 0, 0, 0);
    } else if (startHour < 9) { 
        start.setHours(9, 0, 0, 0);
    } else if (startHour >= 18) { 
        start.setDate(start.getDate() + 1);
        start.setHours(9, 0, 0, 0);
        if (start.getDay() === 0) { 
            start.setDate(start.getDate() + 1);
        }
    }

    if (start > end) return null;

    let minutes = 0;
    let current = new Date(start);

    while (current.toDateString() !== end.toDateString()) {
        if (current.getDay() !== 0) {
            let endOfDay = new Date(current);
            endOfDay.setHours(18, 0, 0, 0);
            minutes += (endOfDay - current) / 60000;
        }
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
    }

    if (current.getDay() !== 0) {
        minutes += (end - current) / 60000;
    }

    return minutes;
}

function renderizarVistaGeneral(dataFiltrada) {
    // ESCUDOS: Evitan el quiebre si la hoja llega vacía o falla la red
    const leadsRaw = dataFiltrada.leads || [];
    const contactadosRaw = dataFiltrada.contactados || [];
    const llamadasRaw = dataFiltrada.llamadas || [];
    const citasGeneradasRaw = dataFiltrada.citasGeneradas || [];
    const citasCalendarioRaw = dataFiltrada.citasCalendario || [];
    const showsRaw = dataFiltrada.shows || [];
    const showsNtRaw = dataFiltrada.showsNt || [];
    const adsRaw = dataFiltrada.ads || [];

    const tLeads = leadsRaw.length;
    
    // 1. LEADS CONTACTADOS (Únicos por número, guardando la fila completa)
    const contactadosMap = new Map();
    contactadosRaw.forEach(c => {
        let num = String(c['Numero'] || c['Teléfono'] || c['Telefono'] || c['Phone'] || c['Número'] || '').trim();
        if (num !== '' && !contactadosMap.has(num)) contactadosMap.set(num, c);
    });
    const leadsContactadosList = Array.from(contactadosMap.values());
    const tContactados = leadsContactadosList.length;

    // 2. LLAMADAS CONECTADAS (Únicos por número, guardando la fila completa)
    const llamadasMap = new Map();
    llamadasRaw.forEach(c => {
        let num = String(c['Numero'] || c['Teléfono'] || c['Telefono'] || c['Phone'] || c['Número'] || '').trim();
        if (num !== '' && !llamadasMap.has(num)) llamadasMap.set(num, c);
    });
    const llamadasConectadasList = Array.from(llamadasMap.values());
    const tLlamadasConectadas = llamadasConectadasList.length;
    
    const conectividad = tContactados > 0 ? ((tLlamadasConectadas / tContactados) * 100).toFixed(1) : 0;

    // 3. CITAS SEPARADAS (Nuevas vs Calendario)
    const citasNuevas = citasGeneradasRaw.filter(c => {
        let tipo = String(c['Tipo de cita'] || '').toLowerCase();
        return !tipo.includes('reprogramada');
    });
    const tCitasGeneradas = citasNuevas.length;
    const tCitasCalendario = citasCalendarioRaw.length;

    // 4. SHOWS TOTALES (Suma de Shows regulares + Shows NT)
    const todosLosShows = [...showsRaw, ...showsNtRaw];
    const tShows = todosLosShows.length;
    
    // 5. VENTAS CERRADAS 
    const ventas = showsRaw;
    const tVentas = ventas.length;

    // Ratios del Embudo
    const contactRate = tLeads > 0 ? ((tContactados / tLeads) * 100).toFixed(1) : 0;
    const bookingRate = tLeads > 0 ? ((tCitasGeneradas / tLeads) * 100).toFixed(1) : 0;
    const showRate = tCitasCalendario > 0 ? ((tShows / tCitasCalendario) * 100).toFixed(1) : 0;
    const winRate = tShows > 0 ? ((tVentas / tShows) * 100).toFixed(1) : 0;

    // --- CÁLCULO DEL SPEED TO LEAD ---
    let stlMap = {}; 
    const globalTz = document.getElementById('global-timezone') ? document.getElementById('global-timezone').value : 'America/Mexico_City';
    const globalOffset = typeof getTzOffsetMins === 'function' ? getTzOffsetMins(globalTz) : 0;

    contactadosRaw.forEach(c => {
        let id = String(c['Numero'] || c['Teléfono'] || c['Telefono'] || c['Phone'] || c['Número'] || '').trim();
        if (id === '') return;

        let cacheKey = '_stl_' + globalTz;
        let bMinutes = c[cacheKey]; 

        if (bMinutes === undefined) {
            let fEntrada = c['Fecha entrada lead'] || c['Fecha Lead entra'];
            let hEntrada = c['Hora Generado'] || c['Hora entrada'];
            let fLlamada = c['Fecha 1er llamada'];
            let hLlamada = c['Hora 1er llamada'];
            let leadTz = c['Zona Horaria'] || c['Zona horaria'] || globalTz;

            if (fEntrada && hEntrada && fLlamada && hLlamada) {
                let tEntrada = typeof parseDateSpanish === 'function' ? parseDateSpanish(fEntrada, c, 'Fecha entrada lead') : null;
                let tLlamada = typeof parseDateSpanish === 'function' ? parseDateSpanish(fLlamada, c, 'Fecha 1er llamada') : null;
                
                if (tEntrada && tLlamada) {
                    // CEREBRO AM/PM INTEGRADO
                    let parseTime = (str) => { 
                        let tStr = String(str).trim().toLowerCase();
                        let isPM = tStr.includes('pm'), isAM = tStr.includes('am');
                        let p = tStr.replace(/[a-z]/g, '').trim().split(':'); 
                        let h = parseInt(p[0]||0, 10), m = parseInt(p[1]||0, 10), s = parseInt(p[2]||0, 10);
                        if (isPM && h < 12) h += 12;
                        if (isAM && h === 12) h = 0;
                        return { h, m, s }; 
                    };
                    
                    let timeE = parseTime(hEntrada); let timeL = parseTime(hLlamada);
                    let dateE = new Date(tEntrada); dateE.setHours(timeE.h, timeE.m, timeE.s);
                    let dateL = new Date(tLlamada); dateL.setHours(timeL.h, timeL.m, timeL.s);
                    let diffMins = globalOffset - (typeof getTzOffsetMins === 'function' ? getTzOffsetMins(leadTz) : 0);
                    dateE.setMinutes(dateE.getMinutes() + diffMins); dateL.setMinutes(dateL.getMinutes() + diffMins);
                    
                    bMinutes = getBusinessMinutes(dateE, dateL);
                } else { bMinutes = null; }
            } else { bMinutes = null; }
            
            c[cacheKey] = bMinutes; 
        }

        if (bMinutes !== null && (stlMap[id] === undefined || bMinutes < stlMap[id])) {
            stlMap[id] = bMinutes;
        }
    });

    let validStlCount = Object.keys(stlMap).length;
    let totalMinutes = Object.values(stlMap).reduce((a, b) => a + b, 0);

    let avgStlMinutes = validStlCount > 0 ? Math.round(totalMinutes / validStlCount) : 0;
    let stlDisplay = avgStlMinutes < 60 ? `${avgStlMinutes} min` : `${Math.floor(avgStlMinutes/60)}h ${avgStlMinutes%60}m`;

    const metas = JSON.parse(localStorage.getItem('np_metas')) || { ads: 3000, citas: 100 };
    let inversionActual = 0;
    adsRaw.forEach(ad => {
        let spent = String(ad['Amount spent'] || '0').replace(/[^0-9.-]+/g, "");
        inversionActual += parseFloat(spent) || 0;
    });

    // --- CÁLCULOS FINANCIEROS (CPA) ---
    const cpl = tLeads > 0 ? (inversionActual / tLeads).toFixed(2) : 0;
    const cpa_citas = tCitasGeneradas > 0 ? (inversionActual / tCitasGeneradas).toFixed(2) : 0;
    const cpa_citas_cal = tCitasCalendario > 0 ? (inversionActual / tCitasCalendario).toFixed(2) : 0;
    const costo_venta = tVentas > 0 ? (inversionActual / tVentas).toFixed(2) : 0;

    // --- INYECCIÓN A LAS TARJETAS SEPARADAS Y EVENTOS DE CLIC ---
    const setMetric = (id, val, subtitleId, subtitleVal, clickData, clickTitle, clickDateCol) => {
        const el = document.getElementById(id);
        if(el) {
            el.innerText = val;
            if(subtitleId && subtitleVal) document.getElementById(subtitleId).innerHTML = subtitleVal;
            if(clickData) {
                const card = el.closest('.kpi-card');
                if(card) {
                    card.classList.add('clickable-card');
                    card.onclick = () => window.abrirModalLista(clickTitle, clickData, clickDateCol);
                }
            }
        }
    };

    setMetric('kpi-leads', tLeads, 'kpi-cpl', `CPL Estimado: $${cpl}`, leadsRaw, 'Volumen de Leads', 'Fecha Entrada');
    setMetric('kpi-stl', stlDisplay, null, null, null, null, null);
    setMetric('kpi-contactados', tContactados, 'kpi-contact-rate', `Contact Rate: ${contactRate}%`, leadsContactadosList, 'Leads Contactados', 'Fecha Last Call');
    setMetric('kpi-llamadas', tLlamadasConectadas, 'kpi-conectividad', `Conectividad: ${conectividad}%`, llamadasConectadasList, 'Llamadas Conectadas', 'Fecha Last Call');
    
    setMetric('kpi-citas-gen', tCitasGeneradas, null, null, citasNuevas, 'Citas Generadas (Nuevas)', 'Fecha Creación');
    const brEl = document.getElementById('kpi-booking-rate'); if(brEl) brEl.innerText = `${bookingRate}%`;
    const cpaEl = document.getElementById('kpi-cpa-cita'); if(cpaEl) cpaEl.innerText = cpa_citas;

    setMetric('kpi-citas-cal', tCitasCalendario, 'kpi-subtitle-citas-cal', `Costo x Cita (Cal): $${cpa_citas_cal}`, citasCalendarioRaw, 'Citas en Calendario', 'Fecha Programada');
    
    setMetric('kpi-shows', tShows, 'kpi-show-rate', `Show Rate: ${showRate}%`, todosLosShows, 'Shows y Asistencias', 'Fecha Visita');
    
    setMetric('kpi-ventas', tVentas, 'kpi-win-rate', `Win Rate: ${winRate}% <br> Costo x Venta: $${costo_venta}`, ventas, 'Ventas Cerradas', 'Fecha Visita');

    const progAds = metas.ads > 0 ? (inversionActual / metas.ads) * 100 : 0;
    const progCitas = metas.citas > 0 ? (tCitasGeneradas / metas.citas) * 100 : 0;
    const topCards = document.querySelectorAll('#view-general > .grid-cards:first-child .kpi-card');
    if(topCards.length >= 2) {
        topCards[0].querySelector('.metric-value').innerText = `$${inversionActual.toFixed(2)} / $${metas.ads.toLocaleString('en-US')}`;
        topCards[0].querySelector('.progress-bar-fill').style.width = `${Math.min(progAds, 100)}%`;
        topCards[1].querySelector('.metric-value').innerText = `${tCitasGeneradas} / ${metas.citas}`;
        topCards[1].querySelector('.progress-bar-fill').style.width = `${Math.min(progCitas, 100)}%`;
    }

    // DISTRIBUCIÓN DE PAGOS
    const paymentContainer = document.getElementById('payment-distribution-container');
    if (paymentContainer) {
        paymentContainer.innerHTML = ''; 
        if (tVentas === 0) {
            paymentContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 20px;">No hay ventas registradas.</div>`;
        } else {
            const metodosAgrupados = {};
            ventas.forEach(v => {
                let metodoRaw = (v['Deposito'] || '').trim();
                let mLower = metodoRaw.toLowerCase();
                let metodoFinal = metodoRaw;

                if (mLower === '' || mLower.includes('sin deposito') || mLower.includes('sin depósito')) {
                    metodoFinal = 'Sin Depósito (Pago en Clínica)';
                } else if (mLower.includes('transferencia')) {
                    metodoFinal = 'Transferencia';
                } else if (mLower.includes('link')) {
                    metodoFinal = 'Link de Pago';
                } else if (mLower.includes('tarjeta')) {
                    metodoFinal = 'Tarjeta';
                } else if (mLower.includes('efectivo')) {
                    metodoFinal = 'Efectivo';
                } else if (mLower.includes('financiamiento') || mLower.includes('cuota')) {
                    metodoFinal = 'Financiamiento';
                } else {
                    metodoFinal = metodoRaw.charAt(0).toUpperCase() + metodoRaw.slice(1);
                }

                if (!metodosAgrupados[metodoFinal]) metodosAgrupados[metodoFinal] = [];
                metodosAgrupados[metodoFinal].push(v);
            });

            Object.keys(metodosAgrupados).sort().forEach(metodo => {
                const listaVentas = metodosAgrupados[metodo];
                const porcentaje = ((listaVentas.length / tVentas) * 100).toFixed(1);
                const card = document.createElement('div');
                card.className = 'kpi-card clickable-card';
                card.innerHTML = `<div class="metric-title">${metodo}</div><div class="metric-value text-success">${listaVentas.length}</div><div class="metric-subtitle">${porcentaje}% del total</div>`;
                card.addEventListener('click', () => abrirModalPagos(metodo, listaVentas));
                paymentContainer.appendChild(card);
            });
        }
    }
}

// ============================================================================
// FUNCIONES DE MODALES DE DETALLE (TABLAS)
// ============================================================================

function abrirModalPagos(metodo, listaVentas) {
    document.getElementById('payment-modal-title').innerText = metodo;
    const tbody = document.querySelector('#payment-details-table tbody');
    tbody.innerHTML = '';

    listaVentas.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${v['Fecha Visita'] || '-'}</td>
            <td><strong>${v['Nombre'] || 'Desconocido'}</strong></td>
            <td style="color: var(--text-muted); font-size: 0.85rem;">${v['Campaña'] || '-'}</td>
            <td><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${v['Operador'] || '-'}</span></td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('modal-payment-details').style.display = 'flex';
}

window.abrirModalLista = function(titulo, lista, tituloColFecha) {
    document.getElementById('list-modal-title').innerText = titulo;
    document.getElementById('list-col-fecha').innerText = tituloColFecha || 'Fecha';
    
    const tbody = document.querySelector('#list-details-table tbody');
    tbody.innerHTML = '';

    if (!lista || lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No hay registros para mostrar.</td></tr>';
    } else {
        lista.forEach(v => {
            let fecha = v['Fecha entrada lead'] || v['Fecha Lead entra'] || v['Fecha 1er llamada'] || v['Fecha last call'] || v['Cita generada'] || v['Fecha Visita'] || v['Cita Programada en'] || '-';
            let nombre = v['Nombre'] || v['First Name'] || v['Lead Name'] || 'Desconocido';
            let telefono = v['Numero'] || v['Teléfono'] || v['Telefono'] || v['Phone'] || v['Número'] || '-';
            let campana = v['Campaña'] || '-';
            let operador = v['Operador'] || 'Sin Asignar';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="white-space: nowrap; color: var(--text-muted); font-size: 0.85rem;">${fecha}</td>
                <td><strong>${nombre}</strong></td>
                <td style="color: var(--brand-primary); font-weight: 500;">${telefono}</td>
                <td style="color: var(--text-main); font-size: 0.85rem;">${campana}</td>
                <td><span style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${operador}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    document.getElementById('modal-list-details').style.display = 'flex';
};
