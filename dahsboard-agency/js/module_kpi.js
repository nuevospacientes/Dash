/* ==========================================
   MÓDULO 1: VISTA GENERAL Y KPIs
   ========================================== */

function renderizarVistaGeneral(dataFiltrada) {
    const leads = dataFiltrada.leads;
    const contactados = dataFiltrada.contactados;
    const citas = dataFiltrada.citas;
    const shows = dataFiltrada.shows;

    // 1. Cálculos de Embudo
    const totalLeads = leads.length;
    const setContactados = new Set(contactados.map(c => c['Numero']).filter(n => n));
    const totalContactados = setContactados.size;
    const totalCitas = citas.length;
    const totalShows = shows.length;

    const contactRate = totalLeads > 0 ? (totalContactados / totalLeads) * 100 : 0;
    const bookingRate = totalLeads > 0 ? (totalCitas / totalLeads) * 100 : 0;
    const showRate = totalCitas > 0 ? (totalShows / totalCitas) * 100 : 0;

    // 2. Inyectar KPIs Principales
    const kpiContainer = document.getElementById('kpi-container-general');
    if (kpiContainer) {
        kpiContainer.innerHTML = `
            <div class="kpi-card" style="border-left: 4px solid var(--brand-primary);">
                <div class="metric-title">Volumen de Leads</div>
                <div class="metric-value">${totalLeads}</div>
                <div class="metric-subtitle">Evaluados en este rango</div>
            </div>
            <div class="kpi-card" style="border-left: 4px solid var(--accent-warning);">
                <div class="metric-title">Contact Rate</div>
                <div class="metric-value">${contactRate.toFixed(1)}%</div>
                <div class="metric-subtitle">${totalContactados} Leads Contactados</div>
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
    }

    // 3. Cálculo de Distribución de Pagos (Desde la hoja Citas/Shows)
    let pagos = { transferencia: 0, tarjeta: 0, efectivo: 0, financiamiento: 0 };
    let totalPagos = 0;

    citas.forEach(cita => {
        let dep = (cita['Deposito'] || '').toLowerCase();
        if (!dep || dep === 'sin deposito') return;
        
        if (dep.includes('transferencia')) pagos.transferencia++;
        else if (dep.includes('tarjeta') || dep.includes('link')) pagos.tarjeta++;
        else if (dep.includes('efectivo')) pagos.efectivo++;
        else pagos.financiamiento++; // Otros
        
        totalPagos++;
    });

    // 4. Inyectar Pagos
    const getPorcentaje = (val) => totalPagos > 0 ? ((val / totalPagos) * 100).toFixed(1) : 0;
    
    const payContainer = document.getElementById('payment-distribution-container');
    if (payContainer) {
        payContainer.innerHTML = `
            <div class="kpi-card">
                <div class="metric-title">Transferencia</div>
                <div class="metric-value text-success">${pagos.transferencia}</div>
                <div class="metric-subtitle">${getPorcentaje(pagos.transferencia)}% del total</div>
            </div>
            <div class="kpi-card">
                <div class="metric-title">Tarjeta / Link</div>
                <div class="metric-value text-success">${pagos.tarjeta}</div>
                <div class="metric-subtitle">${getPorcentaje(pagos.tarjeta)}% del total</div>
            </div>
            <div class="kpi-card">
                <div class="metric-title">Efectivo</div>
                <div class="metric-value text-success">${pagos.efectivo}</div>
                <div class="metric-subtitle">${getPorcentaje(pagos.efectivo)}% del total</div>
            </div>
            <div class="kpi-card">
                <div class="metric-title">Otros / Financ.</div>
                <div class="metric-value text-success">${pagos.financiamiento}</div>
                <div class="metric-subtitle">${getPorcentaje(pagos.financiamiento)}% del total</div>
            </div>
        `;
    }
}
