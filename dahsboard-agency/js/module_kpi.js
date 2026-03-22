/* ==========================================
   MÓDULO DE KPIs (VISTA GENERAL)
   ========================================== */

// Valor estimado por venta para calcular la facturación (Modifícalo según el High-Ticket de la clínica)
const TICKET_PROMEDIO = 500; 

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

    // 4. Obtener Metas configuradas por el usuario (o valores por defecto)
    const metas = JSON.parse(localStorage.getItem('np_metas')) || {
        ads: 3000, facturacion: 15000, citas: 100
    };

    // 5. Cálculos Financieros Estimados (Usando el presupuesto mensual objetivo)
    const cpl = tLeads > 0 ? (metas.ads / tLeads).toFixed(2) : 0;
    const cpa = tCitas > 0 ? (metas.ads / tCitas).toFixed(2) : 0;
    const facturacionActual = tVentas * TICKET_PROMEDIO;

    // ==========================================
    // RENDERIZADO EN PANTALLA
    // ==========================================

    // A. Actualizar las 6 tarjetas de Rendimiento del Embudo
    const kpiCards = document.querySelectorAll('#kpi-container-general .kpi-card');
    if(kpiCards.length >= 6) {
        kpiCards[0].querySelector('.metric-value').innerText = tLeads;
        kpiCards[0].querySelector('.metric-subtitle').innerText = `CPL Estimado: $${cpl}`;
        
        kpiCards[1].querySelector('.metric-value').innerText = `${contactRate}%`;
        kpiCards[1].querySelector('.metric-subtitle').innerText = `${tContactados} Leads Contactados`;
        
        kpiCards[2].querySelector('.metric-value').innerText = tCitas;
        kpiCards[2].querySelector('.metric-subtitle').innerText = `Booking Rate: ${bookingRate}%`;
        
        kpiCards[3].querySelector('.metric-value').innerText = tShows;
        kpiCards[3].querySelector('.metric-subtitle').innerText = `Asistencia: ${showRate}%`;
        
        kpiCards[4].querySelector('.metric-value').innerText = tVentas;
        kpiCards[4].querySelector('.metric-subtitle').innerText = `Win Rate: ${winRate}%`;
        
        kpiCards[5].querySelector('.metric-value').innerText = `$${cpa}`;
        kpiCards[5].querySelector('.metric-subtitle').innerText = `Presupuesto Ref: $${metas.ads}`;
    }

    // B. Actualizar Barras de Progreso (Top de la pantalla)
    const progFacturacion = metas.facturacion > 0 ? (facturacionActual / metas.facturacion) * 100 : 0;
    const progCitas = metas.citas > 0 ? (tCitas / metas.citas) * 100 : 0;

    const topCards = document.querySelectorAll('#view-general > .grid-cards:first-child .kpi-card');
    if(topCards.length >= 2) {
        // Barra Facturación
        topCards[0].querySelector('.metric-value').innerText = `$${facturacionActual.toLocaleString('en-US')}`;
        topCards[0].querySelector('.progress-bar-fill').style.width = `${Math.min(progFacturacion, 100)}%`;
        
        // Barra Citas
        topCards[1].querySelector('.metric-value').innerText = `${tCitas} / ${metas.citas}`;
        topCards[1].querySelector('.progress-bar-fill').style.width = `${Math.min(progCitas, 100)}%`;
    }

    // C. Distribución de Métodos de Pago
    let pagos = { transferencia: 0, tarjeta: 0, efectivo: 0, financiamiento: 0 };
    ventas.forEach(v => {
        let metodo = (v['Deposito'] || '').toLowerCase();
        if (metodo.includes('transferencia')) pagos.transferencia++;
        else if (metodo.includes('tarjeta') || metodo.includes('link')) pagos.tarjeta++;
        else if (metodo.includes('efectivo')) pagos.efectivo++;
        else if (metodo.includes('financiamiento') || metodo.includes('cuotas')) pagos.financiamiento++;
        else pagos.transferencia++; // Si ponen "Otro", lo sumamos a transferencia por defecto
    });

    const distCards = document.querySelectorAll('#payment-distribution-container .kpi-card');
    if (distCards.length >= 4) {
        const updatePago = (idx, valor) => {
            distCards[idx].querySelector('.metric-value').innerText = valor;
            distCards[idx].querySelector('.metric-subtitle').innerText = tVentas > 0 ? `${((valor/tVentas)*100).toFixed(1)}% del total` : `0% del total`;
        };
        updatePago(0, pagos.transferencia);
        updatePago(1, pagos.tarjeta);
        updatePago(2, pagos.efectivo);
        updatePago(3, pagos.financiamiento);
    }
}
