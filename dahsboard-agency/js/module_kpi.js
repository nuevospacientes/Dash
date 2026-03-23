/* ==========================================
   MÓDULO DE KPIs (VISTA GENERAL)
   ========================================== */

// ----------------------------------------------------
// MOTOR 1: DETECTOR Y CONVERSOR DE ZONAS HORARIAS
// ----------------------------------------------------
function getTzOffsetMins(timeZone) {
    try {
        // Usa la API nativa de internacionalización del navegador para sacar el GMT de cualquier país
        const str = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).format(new Date());
        const match = str.match(/GMT([+-])(\d+)(?::(\d+))?/);
        if (!match) return 0;
        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2], 10);
        const mins = match[3] ? parseInt(match[3], 10) : 0;
        return sign * (hours * 60 + mins);
    } catch(e) {
        // Si hay error o no viene zona, asumimos GMT-5 (Perú/Colombia/EST)
        return -300; 
    }
}

// ----------------------------------------------------
// MOTOR 2: CÁLCULO ESTRICTO DE HORARIO COMERCIAL (9 AM - 6 PM)
// ----------------------------------------------------
function getBusinessMinutes(dateStart, dateEnd) {
    let current = new Date(dateStart);
    let end = new Date(dateEnd);
    let minutes = 0;

    // REGLA DE ENTRADA: Si entra antes de las 9am, el reloj arranca a las 9am.
    if (current.getHours() < 9) { 
        current.setHours(9, 0, 0, 0); 
    }
    // REGLA DE NOCHE: Si entra a las 6pm o más tarde, el reloj arranca a las 9am del DÍA SIGUIENTE.
    else if (current.getHours() >= 18) { 
        current.setDate(current.getDate() + 1); 
        current.setHours(9, 0, 0, 0); 
    }

    // LÍMITE DE SALIDA: Si por algún motivo la llamada se registró de noche, cortamos a las 6pm.
    if (end.getHours() >= 18) { 
        end.setHours(18, 0, 0, 0); 
    }
    else if (end.getHours() < 9) { 
        end.setDate(end.getDate() - 1); 
        end.setHours(18, 0, 0, 0); 
    }

    // Si después de los ajustes, la hora de entrada superó a la de salida, tardaron 0 minutos hábiles.
    if (current > end) return 0;

    // BUCLE DE DÍAS: Sumamos 9 horas (540 mins) por cada día intermedio que haya pasado.
    while (current.toDateString() !== end.toDateString()) {
        let endOfDay = new Date(current);
        endOfDay.setHours(18, 0, 0, 0);
        minutes += (endOfDay - current) / 60000;
        
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
    }
    
    // Sumamos los minutos del último día
    minutes += (end - current) / 60000;
    
    return minutes > 0 ? minutes : 0;
}

// ----------------------------------------------------
// FUNCIÓN PRINCIPAL DE RENDERIZADO
// ----------------------------------------------------
function renderizarVistaGeneral(dataFiltrada) {
    // 1. Conteo Base
    const tLeads = dataFiltrada.leads.length;
    const tContactados = dataFiltrada.contactados.length;
    const tCitas = dataFiltrada.citas.length;
    const tShows = dataFiltrada.shows.length;
    
    // 2. Filtro de Ventas Reales
    const ventas = dataFiltrada.shows.filter(item => {
        const dep = (item['Deposito'] || '').toLowerCase().trim();
        return dep !== '' && dep !== 'sin deposito' && dep !== 'sin depósito';
    });
    const tVentas = ventas.length;

    // 3. Tasas de Conversión
    const contactRate = tLeads > 0 ? ((tContactados / tLeads) * 100).toFixed(1) : 0;
    const bookingRate = tLeads > 0 ? ((tCitas / tLeads) * 100).toFixed(1) : 0;
    const showRate = tCitas > 0 ? ((tShows / tCitas) * 100).toFixed(1) : 0;
    const winRate = tShows > 0 ? ((tVentas / tShows) * 100).toFixed(1) : 0;

    // 4. Algoritmo de Speed To Lead (Cruce de Zonas + Horario Comercial)
    let totalMinutes = 0;
    let validStlCount = 0;
    
    const globalTz = document.getElementById('global-timezone').value;
    const globalOffset = getTzOffsetMins(globalTz);

    dataFiltrada.contactados.forEach(c => {
        let fEntrada = c['Fecha entrada lead'] || c['Fecha Lead entra'];
        let hEntrada = c['Hora Generado'] || c['Hora entrada'];
        let fLlamada = c['Fecha 1er llamada'];
        let hLlamada = c['Hora 1er llamada'];
        
        // Buscamos la zona horaria del lead
        let leadTz = c['Zona Horaria'] || c['Zona horaria'] || globalTz;

        if (fEntrada && hEntrada && fLlamada && hLlamada) {
            // Pasamos el nombre de la columna para aprovechar la memoria caché
            let tEntrada = parseDateSpanish(fEntrada, c, 'Fecha entrada lead');
            let tLlamada = parseDateSpanish(fLlamada, c, 'Fecha 1er llamada');

            if (tEntrada && tLlamada) {
                // Función que convierte "14:30:00" en {h: 14, m: 30, s: 0}
                let parseTime = (str) => { let p = String(str).split(':'); return { h: parseInt(p[0]||0), m: parseInt(p[1]||0), s: parseInt(p[2]||0) }; };
                
                // ¡AQUÍ FALTABAN ESTAS DOS LÍNEAS VITALES!
                let timeE = parseTime(hEntrada);
                let timeL = parseTime(hLlamada);

                let dateE = new Date(tEntrada); dateE.setHours(timeE.h, timeE.m, timeE.s);
                let dateL = new Date(tLlamada); dateL.setHours(timeL.h, timeL.m, timeL.s);

                // AJUSTE: Transformamos el tiempo local del lead al tiempo del dashboard seleccionado
                let leadOffset = getTzOffsetMins(leadTz);
                let diffMins = globalOffset - leadOffset;

                dateE.setMinutes(dateE.getMinutes() + diffMins);
                dateL.setMinutes(dateL.getMinutes() + diffMins);

                // FILTRO: Aplicamos la protección de 9 AM a 6 PM sobre el horario ya estandarizado
                let bMinutes = getBusinessMinutes(dateE, dateL);
                
                totalMinutes += bMinutes;
                validStlCount++;
            }
        }
    });

    let avgStlMinutes = validStlCount > 0 ? Math.round(totalMinutes / validStlCount) : 0;
    let stlDisplay = avgStlMinutes < 60 ? `${avgStlMinutes} min` : `${Math.floor(avgStlMinutes/60)}h ${avgStlMinutes%60}m`;

    // 5. Metas y Finanzas Reales (Desde Meta Ads)
    const metas = JSON.parse(localStorage.getItem('np_metas')) || { ads: 3000, citas: 100 };
    
    let inversionActual = 0;
    if (dataFiltrada.ads) {
        dataFiltrada.ads.forEach(ad => {
            // Limpiamos el texto "$61.97" para convertirlo en número matemático
            let spent = String(ad['Amount spent'] || '0').replace(/[^0-9.-]+/g, "");
            inversionActual += parseFloat(spent) || 0;
        });
    }

    const cpl = tLeads > 0 ? (inversionActual / tLeads).toFixed(2) : 0;
    const cpa = tCitas > 0 ? (inversionActual / tCitas).toFixed(2) : 0;
    // ==========================================
    // A. RENDERIZAR TARJETAS 
    // ==========================================
    const kpiCards = document.querySelectorAll('#kpi-container-general .kpi-card');
    if(kpiCards.length >= 6) {
        kpiCards[0].querySelector('.metric-value').innerText = tLeads;
        kpiCards[0].querySelector('.metric-subtitle').innerText = `CPL Estimado: $${cpl}`;
        
        kpiCards[1].querySelector('.metric-value').innerText = stlDisplay;
        
        kpiCards[2].querySelector('.metric-value').innerText = tContactados;
        kpiCards[2].querySelector('.metric-subtitle').innerText = `Contact Rate: ${contactRate}%`;
        
        kpiCards[3].querySelector('.metric-value').innerText = tCitas;
        kpiCards[3].querySelector('.metric-subtitle').innerHTML = `Booking Rate: ${bookingRate}% <br> Costo x Cita: $${cpa}`;
        
        kpiCards[4].querySelector('.metric-value').innerText = tShows;
        kpiCards[4].querySelector('.metric-subtitle').innerText = `Asistencia: ${showRate}%`;
        
        kpiCards[5].querySelector('.metric-value').innerText = tVentas;
        kpiCards[5].querySelector('.metric-subtitle').innerText = `Win Rate: ${winRate}%`;
    }

    // B. Barras Top (Ads y Citas)
    const progAds = metas.ads > 0 ? (inversionActual / metas.ads) * 100 : 0;
    const progCitas = metas.citas > 0 ? (tCitas / metas.citas) * 100 : 0;

    const topCards = document.querySelectorAll('#view-general > .grid-cards:first-child .kpi-card');
    if(topCards.length >= 2) {
        topCards[0].querySelector('.metric-value').innerText = `$${inversionActual.toFixed(2)} / $${metas.ads.toLocaleString('en-US')}`;
        topCards[0].querySelector('.progress-bar-fill').style.width = `${Math.min(progAds, 100)}%`;
        
        topCards[1].querySelector('.metric-value').innerText = `${tCitas} / ${metas.citas}`;
        topCards[1].querySelector('.progress-bar-fill').style.width = `${Math.min(progCitas, 100)}%`;
    }

    // ==========================================
    // C. PAGOS REACTIVOS
    // ==========================================
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
                card.innerHTML = `
                    <div class="metric-title">${metodo}</div>
                    <div class="metric-value text-success">${listaVentas.length}</div>
                    <div class="metric-subtitle">${porcentaje}% del total</div>
                `;

                card.addEventListener('click', () => abrirModalPagos(metodo, listaVentas));
                paymentContainer.appendChild(card);
            });
        }
    }
}

// Modal de Detalles 
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
