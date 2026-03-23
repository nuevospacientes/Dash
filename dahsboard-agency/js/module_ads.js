/* ==========================================
   MÓDULO DE CONTROL FINANCIERO (META ADS)
   ========================================== */

const TICKET_PROMEDIO_ADS = 500; // Valor promedio de venta para estimar el ROAS

function renderizarAds(dataFiltrada) {
    const tbody = document.querySelector('#ads-table tbody');
    if (!tbody) return;

    if (!dataFiltrada.ads || dataFiltrada.ads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">No hay datos de inversión para las fechas o campañas seleccionadas.</td></tr>';
        return;
    }

    // 1. Agrupar la inversión por nombre de campaña
    const campanasStats = {};

    dataFiltrada.ads.forEach(ad => {
        let campName = (ad['Campaign name'] || 'Desconocida').trim();
        let spent = parseFloat(String(ad['Amount spent'] || '0').replace(/[^0-9.-]+/g, "")) || 0;
        
        if (!campanasStats[campName]) {
            campanasStats[campName] = { inversion: 0, leads: 0, citas: 0, ventas: 0 };
        }
        campanasStats[campName].inversion += spent;
    });

    // 2. Cruzar con Leads
    dataFiltrada.leads.forEach(lead => {
        let campName = (lead['Campaña'] || '').trim();
        if (campanasStats[campName]) campanasStats[campName].leads++;
    });

    // 3. Cruzar con Citas
    dataFiltrada.citas.forEach(cita => {
        let campName = (cita['Campaña'] || '').trim();
        if (campanasStats[campName]) campanasStats[campName].citas++;
    });

    // 4. Cruzar con Ventas Reales (Shows con Depósito)
    dataFiltrada.shows.forEach(show => {
        let dep = (show['Deposito'] || '').toLowerCase().trim();
        if (dep !== '' && dep !== 'sin deposito' && dep !== 'sin depósito') {
            let campName = (show['Campaña'] || '').trim();
            if (campanasStats[campName]) campanasStats[campName].ventas++;
        }
    });

    // 5. Renderizar la tabla de Media Buying
    tbody.innerHTML = '';
    let totalInversion = 0, totalLeads = 0, totalCitas = 0, totalVentas = 0;

    // Convertimos a array y ordenamos por las campañas que más gastan
    const filas = Object.keys(campanasStats).map(nombre => {
        return { nombre, ...campanasStats[nombre] };
    }).filter(c => c.inversion > 0); 

    filas.sort((a, b) => b.inversion - a.inversion);

    filas.forEach(camp => {
        totalInversion += camp.inversion;
        totalLeads += camp.leads;
        totalCitas += camp.citas;
        totalVentas += camp.ventas;

        let cpl = camp.leads > 0 ? (camp.inversion / camp.leads) : 0;
        let cpa = camp.citas > 0 ? (camp.inversion / camp.citas) : 0;
        let ingresos = camp.ventas * TICKET_PROMEDIO_ADS;
        let roas = camp.inversion > 0 ? (ingresos / camp.inversion) : 0;

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${camp.nombre}</strong></td>
            <td style="color: var(--accent-danger)">$${camp.inversion.toFixed(2)}</td>
            <td>${camp.leads}</td>
            <td>$${cpl.toFixed(2)}</td>
            <td>${camp.citas}</td>
            <td>$${cpa.toFixed(2)}</td>
            <td style="color: var(--accent-success); font-weight: 700;">${roas > 0 ? roas.toFixed(2) + 'x' : '0.00x'}</td>
        `;
        tbody.appendChild(tr);
    });

    // 6. Fila Resumen de Totales
    let cplTotal = totalLeads > 0 ? (totalInversion / totalLeads) : 0;
    let cpaTotal = totalCitas > 0 ? (totalInversion / totalCitas) : 0;
    let ingresosTotales = totalVentas * TICKET_PROMEDIO_ADS;
    let roasTotal = totalInversion > 0 ? (ingresosTotales / totalInversion) : 0;

    let trTotal = document.createElement('tr');
    trTotal.style.backgroundColor = 'rgba(59, 107, 250, 0.1)';
    trTotal.innerHTML = `
        <td><strong>TOTAL GLOBAL</strong></td>
        <td style="color: var(--accent-danger)"><strong>$${totalInversion.toFixed(2)}</strong></td>
        <td><strong>${totalLeads}</strong></td>
        <td><strong>$${cplTotal.toFixed(2)}</strong></td>
        <td><strong>${totalCitas}</strong></td>
        <td><strong>$${cpaTotal.toFixed(2)}</strong></td>
        <td style="color: var(--accent-success)"><strong>${roasTotal > 0 ? roasTotal.toFixed(2) + 'x' : '0.00x'}</strong></td>
    `;
    tbody.appendChild(trTotal);
}
