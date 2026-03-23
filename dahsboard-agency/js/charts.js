/* ==========================================
   GRÁFICOS VISUALES
   ========================================== */

let chartTendencia = null;
let chartHoras = null; 
let chartPagosDona = null; // NUEVO GRÁFICO

Chart.defaults.color = '#BDBDBD';
Chart.defaults.font.family = "'Inter', sans-serif";

function renderizarGraficos(dataFiltrada) {
    const leads = dataFiltrada.leads || [];
    const contactados = dataFiltrada.contactados || [];
    const llamadas = dataFiltrada.llamadas || []; 
    const citas = dataFiltrada.citas || [];
    const shows = dataFiltrada.shows || [];
    
    const { start, end } = dataFiltrada.dateRange || { start: null, end: null };

    // ==========================================
    // 1. TENDENCIA DIARIA (Líneas Limpias)
    // ==========================================
    let timeline = {};
    
    const agruparPorFecha = (array, propFecha, key, filterFn = null) => {
        if (!array) return;
        array.forEach(item => {
            if (filterFn && !filterFn(item)) return;
            
            let rawDate = item[propFecha];
            if (!rawDate) return;

            let d = typeof parseDateSpanish === 'function' ? parseDateSpanish(rawDate, item) : new Date(rawDate);
            
            if (d && !isNaN(new Date(d).getTime())) {
                let t = new Date(d).getTime();
                if (start !== null && end !== null) {
                    if (t < start || t >= end) return; 
                }

                let fechaStr = new Date(d).toISOString().split('T')[0];
                if (!timeline[fechaStr]) {
                    timeline[fechaStr] = { leads: 0, contactados: 0, llamadas: 0, citas: 0, shows: 0, ventas: 0 };
                }
                timeline[fechaStr][key]++;
            }
        });
    };

    agruparPorFecha(leads, 'Fecha entrada lead', 'leads');
    agruparPorFecha(contactados, 'Fecha 1er llamada', 'contactados');
    agruparPorFecha(llamadas, 'Fecha last call', 'llamadas'); 
    agruparPorFecha(citas, 'Cita generada', 'citas');
    agruparPorFecha(shows, 'Fecha Visita', 'shows');
    
    agruparPorFecha(shows, 'Fecha Visita', 'ventas', (item) => {
        const dep = (item['Deposito'] || '').toLowerCase().trim();
        return dep !== '' && dep !== 'sin deposito' && dep !== 'sin depósito';
    });

    let labelsFechas = Object.keys(timeline).sort();
    
    // ETIQUETA INTELIGENTE DE MES Y AÑO (Esquina superior izquierda)
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    if (labelsFechas.length > 0) {
        let firstD = new Date(labelsFechas[0] + 'T00:00:00');
        let lastD = new Date(labelsFechas[labelsFechas.length - 1] + 'T00:00:00');

        let labelText = "";
        if (firstD.getMonth() === lastD.getMonth() && firstD.getFullYear() === lastD.getFullYear()) {
            labelText = `${monthNames[firstD.getMonth()]} ${firstD.getFullYear()}`;
        } else {
            labelText = `${monthNames[firstD.getMonth()]} ${firstD.getFullYear()} - ${monthNames[lastD.getMonth()]} ${lastD.getFullYear()}`;
        }
        
        const labelEl = document.getElementById('chart-month-year-label');
        if (labelEl) labelEl.innerText = labelText;
    }

    // LIMPIAR EJE X: Convertimos "2026-03-21" a solo "21"
    let labelsEjeX = labelsFechas.map(f => {
        let d = new Date(f + 'T00:00:00');
        return d.getDate().toString();
    });
    
    let dataLeads = labelsFechas.map(f => timeline[f].leads);
    let dataContactados = labelsFechas.map(f => timeline[f].contactados);
    let dataLlamadas = labelsFechas.map(f => timeline[f].llamadas);
    let dataCitas = labelsFechas.map(f => timeline[f].citas);
    let dataShows = labelsFechas.map(f => timeline[f].shows);
    let dataVentas = labelsFechas.map(f => timeline[f].ventas);

    const ctxTendencia = document.getElementById('chart-tendencia');
    if (ctxTendencia) {
        if (chartTendencia) chartTendencia.destroy();
        chartTendencia = new Chart(ctxTendencia, {
            type: 'line',
            data: {
                labels: labelsEjeX, // Usamos las etiquetas cortas
                datasets: [
                    { label: 'Leads', data: dataLeads, borderColor: '#3b6bfa', backgroundColor: '#3b6bfa', tension: 0.4 },
                    { label: 'Contactados', data: dataContactados, borderColor: '#f6ad55', backgroundColor: '#f6ad55', tension: 0.4 },
                    { label: 'Llamadas', data: dataLlamadas, borderColor: '#9f7aea', backgroundColor: '#9f7aea', tension: 0.4 },
                    { label: 'Citas', data: dataCitas, borderColor: '#37ca37', backgroundColor: '#37ca37', tension: 0.4 },
                    { label: 'Shows', data: dataShows, borderColor: '#fbbf24', backgroundColor: '#fbbf24', tension: 0.4 },
                    { label: 'Ventas', data: dataVentas, borderColor: '#e93d3d', backgroundColor: '#e93d3d', tension: 0.4, borderWidth: 3 }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // ==========================================
    // 2. DINÁMICA DIARIA (Llamadas por Hora)
    // ==========================================
    const ctxHoras = document.getElementById('chart-horas');
    if (ctxHoras) {
        let distribucionHoras = new Array(24).fill(0);
        
        contactados.forEach(item => {
            let horaStr = item['Hora 1er llamada'];
            if (horaStr) {
                let horaNum = parseInt(horaStr.split(':')[0]); 
                if (!isNaN(horaNum) && horaNum >= 0 && horaNum <= 23) {
                    distribucionHoras[horaNum]++;
                }
            }
        });

        let labelsHoras = Array.from({length: 24}, (_, i) => `${i}:00`);

        if (chartHoras) chartHoras.destroy();
        chartHoras = new Chart(ctxHoras, {
            type: 'bar',
            data: {
                labels: labelsHoras,
                datasets: [{
                    label: 'Volumen de 1er Contacto',
                    data: distribucionHoras,
                    backgroundColor: 'rgba(59, 107, 250, 0.4)',
                    borderColor: '#3b6bfa',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    // ==========================================
    // 3. DISTRIBUCIÓN DE PAGOS (Dona Reactiva)
    // ==========================================
    const pagosObj = {};
    shows.forEach(v => {
        let dep = (v['Deposito'] || '').trim();
        if (dep !== '' && dep.toLowerCase() !== 'sin deposito' && dep.toLowerCase() !== 'sin depósito') {
            let mLower = dep.toLowerCase();
            let mFinal = dep;

            if (mLower.includes('transferencia')) mFinal = 'Transferencia';
            else if (mLower.includes('link')) mFinal = 'Link de Pago';
            else if (mLower.includes('tarjeta')) mFinal = 'Tarjeta';
            else if (mLower.includes('efectivo')) mFinal = 'Efectivo';
            else if (mLower.includes('financiamiento') || mLower.includes('cuota')) mFinal = 'Financiamiento';
            else mFinal = mFinal.charAt(0).toUpperCase() + mFinal.slice(1);

            pagosObj[mFinal] = (pagosObj[mFinal] || 0) + 1;
        }
    });

    const ctxPagos = document.getElementById('chart-pagos-dona');
    if (ctxPagos) {
        if (chartPagosDona) chartPagosDona.destroy();
        
        let labelsPagos = Object.keys(pagosObj);
        let dataPagos = Object.values(pagosObj);
        let palette = ['#3b6bfa', '#37ca37', '#f6ad55', '#e93d3d', '#9f7aea', '#ecc94b'];

        chartPagosDona = new Chart(ctxPagos, {
            type: 'doughnut',
            data: {
                labels: labelsPagos,
                datasets: [{
                    data: dataPagos,
                    backgroundColor: palette.slice(0, labelsPagos.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'right', labels: { color: '#BDBDBD', boxWidth: 12, font: {size: 11} } }
                }
            }
        });
    }
}
