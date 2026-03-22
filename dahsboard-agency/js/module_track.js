/* ==========================================
   MÓDULO 2: CALL TRACKER Y RENDIMIENTO
   ========================================== */

function renderizarCallTracker(dataFiltrada) {
    const llamadas = dataFiltrada.llamadas;
    const contactados = dataFiltrada.contactados;
    const citas = dataFiltrada.citas;
    const shows = dataFiltrada.shows;

    // 1. Calidad de Llamadas (Pick up, Connection, Efectiva)
    let totalLlamadas = llamadas.length;
    let pickup = 0, connection = 0, efectiva = 0;

    llamadas.forEach(ll => {
        let duracion = parseInt(ll['Duracion Lllamda']) || 0;
        if (duracion > 5) pickup++;
        if (duracion > 15) connection++;
        if (duracion > 60) efectiva++;
    });

    const getRate = (val) => totalLlamadas > 0 ? ((val / totalLlamadas) * 100).toFixed(1) : 0;

    // 2. Speed to Lead (En minutos)
    let totalMinutosSTL = 0;
    let leadsValidosSTL = 0;

    contactados.forEach(c => {
        let fechaEntrada = c['Fecha Lead entra'] + " " + c['Hora entrada'];
        let fechaLlamada = c['Fecha 1er llamada'] + " " + c['Hora 1er llamada'];
        
        let d1 = parseDateSpanish(fechaEntrada);
        let d2 = parseDateSpanish(fechaLlamada);

        if (d1 && d2 && d2 >= d1) {
            let diffMins = (d2 - d1) / (1000 * 60);
            // Filtro básico para ignorar leads contactados al día siguiente de manera irreal
            if (diffMins >= 0 && diffMins < 1440) { 
                totalMinutosSTL += diffMins;
                leadsValidosSTL++;
            }
        }
    });

    let avgSTL = leadsValidosSTL > 0 ? (totalMinutosSTL / leadsValidosSTL).toFixed(0) : 0;

    // 3. Inyectar KPIs de Tracking
    const trackerContainer = document.querySelector('#view-tracker .grid-cards');
    if (trackerContainer) {
        trackerContainer.innerHTML = `
            <div class="kpi-card"><div class="metric-title">Speed To Lead Promedio</div><div class="metric-value">${avgSTL} <span style="font-size:1rem">min</span></div></div>
            <div class="kpi-card"><div class="metric-title">Total Llamadas Emitidas</div><div class="metric-value">${totalLlamadas}</div></div>
            <div class="kpi-card"><div class="metric-title">Pick Up Rate (>5s)</div><div class="metric-value">${getRate(pickup)}%</div></div>
            <div class="kpi-card"><div class="metric-title">Connection Rate (>15s)</div><div class="metric-value">${getRate(connection)}%</div></div>
            <div class="kpi-card"><div class="metric-title">Conversación Efectiva (>60s)</div><div class="metric-value text-success">${getRate(efectiva)}%</div></div>
        `;
    }

    // 4. Leaderboard de Operadores
    let operadoresStats = {};
    
    // Contar Citas por Operador
    citas.forEach(c => {
        let op = c['Operador'] || 'Sin Asignar';
        if (!operadoresStats[op]) operadoresStats[op] = { citas: 0, shows: 0 };
        operadoresStats[op].citas++;
    });

    // Contar Shows por Operador
    shows.forEach(s => {
        let op = s['Operador'] || 'Sin Asignar';
        if (operadoresStats[op]) operadoresStats[op].shows++;
    });

    // Convertir a Array y Ordenar por Citas
    let rankArray = Object.keys(operadoresStats).map(op => {
        return { nombre: op, citas: operadoresStats[op].citas, shows: operadoresStats[op].shows };
    }).sort((a, b) => b.citas - a.citas);

    // Inyectar Tabla
    const tbody = document.querySelector('#tracker-table tbody');
    if (tbody) {
        tbody.innerHTML = '';
        if(rankArray.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No hay datos para este filtro</td></tr>';
        } else {
            rankArray.forEach((op, index) => {
                let showRateOp = op.citas > 0 ? ((op.shows / op.citas) * 100).toFixed(1) : 0;
                let medalla = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1);
                
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight: bold; font-size: 1.2rem;">${medalla}</td>
                        <td style="font-weight: bold; color: var(--text-main);">${op.nombre}</td>
                        <td class="text-success font-bold">${op.citas}</td>
                        <td>${op.shows}</td>
                        <td>-- min</td>
                        <td>${showRateOp}% (Show Rate)</td>
                    </tr>
                `;
            });
        }
    }
}
