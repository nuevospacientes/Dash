/* ==========================================
   MÓDULO DE KPIs (VISTA GENERAL)
   ========================================== */

function renderizarVistaGeneral(dataFiltrada) {
    // 1. Conteo Base de las tablas
    const tLeads = dataFiltrada.leads.length;
    const tContactados = dataFiltrada.contactados.length;
    const tCitas = dataFiltrada.citas.length;
    const tShows = dataFiltrada.shows.length;
    
    // 2. Filtro de Ventas Reales (Shows que tienen un depósito registrado)
    const ventas = dataFiltrada.shows.filter(item => {
        const dep = (item['Deposito'] || '').toLowerCase().trim();
        return dep !== '' && dep !== 'sin deposito' && dep !== 'sin depósito';
    });
    const tVentas = ventas.length;

    // 3. Tasas de Conversión (%)
    const contactRate = tLeads > 0 ? ((tContactados / tLeads) * 100).toFixed(1) : 0;
    const bookingRate = tLeads > 0 ? ((tCitas / tLeads) * 100).toFixed(1) : 0;
    const showRate = tCitas > 0 ? ((tShows / tCitas) * 100).toFixed(1) : 0;
    const winRate = tShows > 0 ? ((tVentas / tShows) * 100).toFixed(1) : 0;

    // 4. Obtener Metas
    const metas = JSON.parse(localStorage.getItem('np_metas')) || { ads: 3000, citas: 100 };

    // 5. Cálculos Financieros Estimados
    const inversionActual = 0; // Más adelante vendrá de Meta Ads
    const cpl = tLeads > 0 ? (metas.ads / tLeads).toFixed(2) : 0;
    const cpa = tCitas > 0 ? (metas.ads / tCitas).toFixed(2) : 0;

    // ==========================================
    // A. RENDERIZAR TARJETAS DEL EMBUDO
    // ==========================================
    const kpiCards = document.querySelectorAll('#kpi-container-general .kpi-card');
    if(kpiCards.length >= 5) {
        kpiCards[0].querySelector('.metric-value').innerText = tLeads;
        kpiCards[0].querySelector('.metric-subtitle').innerText = `CPL Estimado: $${cpl}`;
        
        kpiCards[1].querySelector('.metric-value').innerText = tContactados;
        kpiCards[1].querySelector('.metric-subtitle').innerText = `Contact Rate: ${contactRate}%`;
        
        kpiCards[2].querySelector('.metric-value').innerText = tCitas;
        kpiCards[2].querySelector('.metric-subtitle').innerHTML = `Booking Rate: ${bookingRate}% <br> Costo x Cita: $${cpa}`;
        
        kpiCards[3].querySelector('.metric-value').innerText = tShows;
        kpiCards[3].querySelector('.metric-subtitle').innerText = `Asistencia: ${showRate}%`;
        
        kpiCards[4].querySelector('.metric-value').innerText = tVentas;
        kpiCards[4].querySelector('.metric-subtitle').innerText = `Win Rate: ${winRate}%`;
    }

    // ==========================================
    // B. RENDERIZAR BARRAS DE PROGRESO
    // ==========================================
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
    // C. DISTRIBUCIÓN DE MÉTODOS DE PAGO (DINÁMICO E INTERACTIVO)
    // ==========================================
    const paymentContainer = document.getElementById('payment-distribution-container');
    if (paymentContainer) {
        paymentContainer.innerHTML = ''; // Limpiamos las tarjetas anteriores

        if (tVentas === 0) {
            paymentContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 20px;">No hay ventas registradas con los filtros actuales.</div>`;
        } else {
            // Agrupamos dinámicamente
            const metodosAgrupados = {};

            ventas.forEach(v => {
                let metodoRaw = (v['Deposito'] || '').trim();
                let mLower = metodoRaw.toLowerCase();
                let metodoFinal = metodoRaw;

                // Inteligencia de separación
                if (mLower.includes('transferencia')) metodoFinal = 'Transferencia';
                else if (mLower.includes('link')) metodoFinal = 'Link de Pago';
                else if (mLower.includes('tarjeta')) metodoFinal = 'Tarjeta';
                else if (mLower.includes('efectivo')) metodoFinal = 'Efectivo';
                else if (mLower.includes('financiamiento') || mLower.includes('cuota')) metodoFinal = 'Financiamiento';
                else if (metodoRaw !== '') metodoFinal = metodoRaw.charAt(0).toUpperCase() + metodoRaw.slice(1); // Si escriben algo nuevo como Zelle

                if (!metodosAgrupados[metodoFinal]) metodosAgrupados[metodoFinal] = [];
                metodosAgrupados[metodoFinal].push(v);
            });

            // Creamos las tarjetas HTML por cada método que exista
            Object.keys(metodosAgrupados).sort().forEach(metodo => {
                const listaVentas = metodosAgrupados[metodo];
                const porcentaje = ((listaVentas.length / tVentas) * 100).toFixed(1);

                const card = document.createElement('div');
                card.className = 'kpi-card clickable-card';
                card.innerHTML = `
                    <div class="metric-title">${metodo}</div>
                    <div class="metric-value text-success">${listaVentas.length}</div>
                    <div class="metric-subtitle">${porcentaje}% del total filtrado</div>
                `;

                // Al hacer clic, abrimos el popup con la lista
                card.addEventListener('click', () => abrirModalPagos(metodo, listaVentas));
                paymentContainer.appendChild(card);
            });
        }
    }
}

// Función Global para gestionar el Modal de Detalles de Pago
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
