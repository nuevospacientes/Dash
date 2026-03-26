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

    // 1. REGLA DE NEGOCIO: Si el contacto fue un domingo o fuera de horario (antes de 9am o después de las 6pm)
    let endDay = end.getDay();
    let endHour = end.getHours();
    if (endDay === 0 || endHour < 9 || endHour >= 18) {
        return null; // Retornamos null para que NO se promedie en el Speed To Lead
    }

    // 2. Ajustar el inicio (cuando entró el lead) si fue fuera de horario
    let startDay = start.getDay();
    let startHour = start.getHours();

    if (startDay === 0) { // Si entró en Domingo -> Empieza a correr el Lunes a las 9am
        start.setDate(start.getDate() + 1);
        start.setHours(9, 0, 0, 0);
    } else if (startHour < 9) { // Si entró antes de las 9am -> Empieza a las 9am de hoy
        start.setHours(9, 0, 0, 0);
    } else if (startHour >= 18) { // Si entró a las 6pm o después -> Empieza a las 9am de mañana
        start.setDate(start.getDate() + 1);
        start.setHours(9, 0, 0, 0);
        if (start.getDay() === 0) { // Si "mañana" es domingo, lo saltamos al lunes
            start.setDate(start.getDate() + 1);
        }
    }

    // Si por error de base de datos el inicio quedó después del final
    if (start > end) return null;

    let minutes = 0;
    let current = new Date(start);

    // Sumar días completos de 9 horas (540 minutos) saltando los domingos
    while (current.toDateString() !== end.toDateString()) {
        if (current.getDay() !== 0) {
            let endOfDay = new Date(current);
            endOfDay.setHours(18, 0, 0, 0);
            minutes += (endOfDay - current) / 60000;
        }
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
    }

    // Sumar los minutos del día en que finalmente fue contactado
    if (current.getDay() !== 0) {
        minutes += (end - current) / 60000;
    }

    return minutes;
}

function renderizarVistaGeneral(dataFiltrada) {
    const tLeads = dataFiltrada.leads.length;
    
    // CORRECCIÓN EXACTA a =COUNTUNIQUE() usando la columna "Numero"
    const leadsContactadosSet = new Set();
    dataFiltrada.contactados.forEach(c => {
        let numeroUnico = String(c['Numero'] || c['Teléfono'] || c['Telefono'] || c['Phone'] || c['Número'] || '').trim();
        // Solo añadimos si el número no está vacío
        if (numeroUnico !== '') leadsContactadosSet.add(numeroUnico);
    });
    const tContactados = leadsContactadosSet.size;

    // Nueva Métrica: Llamadas Conectadas (Hoja 3)
    const tLlamadasConectadas = dataFiltrada.llamadas.length;
    const conectividad = tContactados > 0 ? ((tLlamadasConectadas / tContactados) * 100).toFixed(1) : 0;

    const tCitas = dataFiltrada.citas.length;
    const tShows = dataFiltrada.shows.length;
    
    const ventas = dataFiltrada.shows.filter(item => {
        const dep = (item['Deposito'] || '').toLowerCase().trim();
        return dep !== '' && dep !== 'sin deposito' && dep !== 'sin depósito';
    });
    const tVentas = ventas.length;

    const contactRate = tLeads > 0 ? ((tContactados / tLeads) * 100).toFixed(1) : 0;
    const bookingRate = tLeads > 0 ? ((tCitas / tLeads) * 100).toFixed(1) : 0;
    const showRate = tCitas > 0 ? ((tShows / tCitas) * 100).toFixed(1) : 0;
    const winRate = tShows > 0 ? ((tVentas / tShows) * 100).toFixed(1) : 0;

    let stlMap = {}; 
    const globalTz = document.getElementById('global-timezone').value;
    const globalOffset = getTzOffsetMins(globalTz);

    dataFiltrada.contactados.forEach(c => {
        let id = String(c['Numero'] || c['Teléfono'] || c['Telefono'] || c['Phone'] || c['Número'] || '').trim(); 
        if (id === '') return;

        let cacheKey = '_stl_' + globalTz;
        let bMinutes = c[cacheKey]; // Buscamos en caché

        if (bMinutes === undefined) {
            let fEntrada = c['Fecha entrada lead'] || c['Fecha Lead entra'];
            let hEntrada = c['Hora Generado'] || c['Hora entrada'];
            let fLlamada = c['Fecha 1er llamada'];
            let hLlamada = c['Hora 1er llamada'];
            let leadTz = c['Zona Horaria'] || c['Zona horaria'] || globalTz;

            if (fEntrada && hEntrada && fLlamada && hLlamada) {
                let tEntrada = parseDateSpanish(fEntrada, c, 'Fecha entrada lead');
                let tLlamada = parseDateSpanish(fLlamada, c, 'Fecha 1er llamada');
                if (tEntrada && tLlamada) {
                    let parseTime = (str) => { let p = String(str).split(':'); return { h: parseInt(p[0]||0), m: parseInt(p[1]||0), s: parseInt(p[2]||0) }; };
                    let timeE = parseTime(hEntrada); let timeL = parseTime(hLlamada);
                    let dateE = new Date(tEntrada); dateE.setHours(timeE.h, timeE.m, timeE.s);
                    let dateL = new Date(tLlamada); dateL.setHours(timeL.h, timeL.m, timeL.s);
                    let diffMins = globalOffset - getTzOffsetMins(leadTz);
                    dateE.setMinutes(dateE.getMinutes() + diffMins); dateL.setMinutes(dateL.getMinutes() + diffMins);
                    
                    bMinutes = getBusinessMinutes(dateE, dateL);
                } else { bMinutes = null; }
            } else { bMinutes = null; }
            
            c[cacheKey] = bMinutes; // Guardamos en la memoria temporal
        }

        // Si la llamada fue fuera de horario, bMinutes será null y SE IGNORA aquí (pero el lead sí contó arriba)
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
    if (dataFiltrada.ads) {
        dataFiltrada.ads.forEach(ad => {
            let spent = String(ad['Amount spent'] || '0').replace(/[^0-9.-]+/g, "");
            inversionActual += parseFloat(spent) || 0;
        });
    }

    const cpl = tLeads > 0 ? (inversionActual / tLeads).toFixed(2) : 0;
    const cpa = tCitas > 0 ? (inversionActual / tCitas).toFixed(2) : 0;

    // INYECCIÓN A LAS 7 TARJETAS
    const kpiCards = document.querySelectorAll('#kpi-container-general .kpi-card');
    if(kpiCards.length >= 7) {
        kpiCards[0].querySelector('.metric-value').innerText = tLeads;
        kpiCards[0].querySelector('.metric-subtitle').innerText = `CPL Estimado: $${cpl}`;
        
        kpiCards[1].querySelector('.metric-value').innerText = stlDisplay;
        
        kpiCards[2].querySelector('.metric-value').innerText = tContactados;
        kpiCards[2].querySelector('.metric-subtitle').innerText = `Contact Rate: ${contactRate}%`;
        
        // La tarjeta NUEVA
        kpiCards[3].querySelector('.metric-value').innerText = tLlamadasConectadas;
        kpiCards[3].querySelector('.metric-subtitle').innerText = `Conectividad: ${conectividad}%`;

        kpiCards[4].querySelector('.metric-value').innerText = tCitas;
        kpiCards[4].querySelector('.metric-subtitle').innerHTML = `Booking Rate: ${bookingRate}% <br> Costo x Cita: $${cpa}`;
        
        kpiCards[5].querySelector('.metric-value').innerText = tShows;
        kpiCards[5].querySelector('.metric-subtitle').innerText = `Asistencia: ${showRate}%`;
        
        kpiCards[6].querySelector('.metric-value').innerText = tVentas;
        kpiCards[6].querySelector('.metric-subtitle').innerText = `Win Rate: ${winRate}%`;
    }

    const progAds = metas.ads > 0 ? (inversionActual / metas.ads) * 100 : 0;
    const progCitas = metas.citas > 0 ? (tCitas / metas.citas) * 100 : 0;
    const topCards = document.querySelectorAll('#view-general > .grid-cards:first-child .kpi-card');
    if(topCards.length >= 2) {
        topCards[0].querySelector('.metric-value').innerText = `$${inversionActual.toFixed(2)} / $${metas.ads.toLocaleString('en-US')}`;
        topCards[0].querySelector('.progress-bar-fill').style.width = `${Math.min(progAds, 100)}%`;
        topCards[1].querySelector('.metric-value').innerText = `${tCitas} / ${metas.citas}`;
        topCards[1].querySelector('.progress-bar-fill').style.width = `${Math.min(progCitas, 100)}%`;
    }

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

                if (mLower.includes('transferencia')) metodoFinal = 'Transferencia';
                else if (mLower.includes('link')) metodoFinal = 'Link de Pago';
                else if (mLower.includes('tarjeta')) metodoFinal = 'Tarjeta';
                else if (mLower.includes('efectivo')) metodoFinal = 'Efectivo';
                else if (mLower.includes('financiamiento') || mLower.includes('cuota')) metodoFinal = 'Financiamiento';
                else if (metodoRaw !== '') metodoFinal = metodoRaw.charAt(0).toUpperCase() + metodoRaw.slice(1);

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
