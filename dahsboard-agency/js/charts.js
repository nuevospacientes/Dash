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
    // 2. DINÁMICA DIARIA (Volumen vs STL por Hora)
    // ==========================================
    const ctxHoras = document.getElementById('chart-horas');
    if (ctxHoras) {
        let volumenEntrada = new Array(24).fill(0);
        let sumaStl = new Array(24).fill(0);
        let countStl = new Array(24).fill(0);

        // 2.1 Calcular Volumen de Entrada (Barras Azules)
        leads.forEach(item => {
            let horaStr = item['Hora Generado'] || item['Hora entrada'];
            if (horaStr) {
                let horaNum = parseInt(String(horaStr).split(':')[0]); 
                if (!isNaN(horaNum) && horaNum >= 0 && horaNum <= 23) {
                    volumenEntrada[horaNum]++;
                }
            }
        });

        // 2.2 Calcular Speed to Lead Promedio por Hora (Línea Naranja)
        const globalTz = document.getElementById('global-timezone') ? document.getElementById('global-timezone').value : 'America/Mexico_City';
        const globalOffset = typeof getTzOffsetMins === 'function' ? getTzOffsetMins(globalTz) : 0;

        contactados.forEach(c => {
            let fEntrada = c['Fecha entrada lead'] || c['Fecha Lead entra'];
            let hEntrada = c['Hora Generado'] || c['Hora entrada'];
            let fLlamada = c['Fecha 1er llamada'];
            let hLlamada = c['Hora 1er llamada'];
            let leadTz = c['Zona Horaria'] || c['Zona horaria'] || globalTz;

            if (fEntrada && hEntrada && fLlamada && hLlamada) {
                let tEntrada = typeof parseDateSpanish === 'function' ? parseDateSpanish(fEntrada, c) : null;
                let tLlamada = typeof parseDateSpanish === 'function' ? parseDateSpanish(fLlamada, c) : null;

                if (tEntrada && tLlamada) {
                    let parseTime = (str) => { let p = String(str).split(':'); return { h: parseInt(p[0]||0), m: parseInt(p[1]||0), s: parseInt(p[2]||0) }; };
                    let timeE = parseTime(hEntrada);
                    let timeL = parseTime(hLlamada);

                    let dateE = new Date(tEntrada); dateE.setHours(timeE.h, timeE.m, timeE.s);
                    let dateL = new Date(tLlamada); dateL.setHours(timeL.h, timeL.m, timeL.s);

                    let leadOffset = typeof getTzOffsetMins === 'function' ? getTzOffsetMins(leadTz) : 0;
                    let diffMins = globalOffset - leadOffset;

                    dateE.setMinutes(dateE.getMinutes() + diffMins);
                    dateL.setMinutes(dateL.getMinutes() + diffMins);

                    let bMinutes = typeof getBusinessMinutes === 'function' ? getBusinessMinutes(dateE, dateL) : 0;
                    
                    // En qué hora del día (ya ajustada al dashboard) entró este lead
                    let horaEntradaAjustada = dateE.getHours();
                    
                    if (!isNaN(horaEntradaAjustada) && horaEntradaAjustada >= 0 && horaEntradaAjustada <= 23) {
                        sumaStl[horaEntradaAjustada] += bMinutes;
                        countStl[horaEntradaAjustada]++;
                    }
                }
            }
        });

        // Promediar los minutos
        let avgStl = new Array(24).fill(0);
        for(let i=0; i<24; i++){
            avgStl[i] = countStl[i] > 0 ? Math.round(sumaStl[i] / countStl[i]) : 0;
        }

        let labelsHoras = Array.from({length: 24}, (_, i) => `${i}:00`);

        if (chartHoras) chartHoras.destroy();
        chartHoras = new Chart(ctxHoras, {
            type: 'bar',
            data: {
                labels: labelsHoras,
                datasets: [
                    {
                        label: 'Speed to Lead (Minutos)',
                        data: avgStl,
                        type: 'line', // Forzamos que este dataset sea una línea
                        borderColor: '#f6ad55', // Naranja
                        backgroundColor: '#f6ad55',
                        borderWidth: 3,
                        tension: 0.4,
                        yAxisID: 'y1' // Lo anclamos al eje derecho
                    },
                    {
                        label: 'Volumen de Entrada',
                        data: volumenEntrada,
                        backgroundColor: 'rgba(59, 107, 250, 0.4)', // Azul
                        borderColor: '#3b6bfa',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y' // Lo anclamos al eje izquierdo
                    }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false }, // Al pasar el mouse te muestra ambas métricas
                scales: { 
                    y: { 
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Nº de Leads' },
                        beginAtZero: true, 
                        ticks: { stepSize: 1 } 
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right', // Eje secundario a la derecha
                        title: { display: true, text: 'Minutos (STL)' },
                        beginAtZero: true,
                        grid: { drawOnChartArea: false } // Para que las líneas de fondo no se hagan un desastre
                    }
                }
            }
        });
    }

   // NUEVO: ETIQUETA INTELIGENTE DE DÍA - MES (Para Dinámica Diaria)
    const dayLabelEl = document.getElementById('chart-day-label');
    if (dayLabelEl) {
        if (labelsFechas.length > 0) {
            let firstD = new Date(labelsFechas[0] + 'T00:00:00');
            let lastD = new Date(labelsFechas[labelsFechas.length - 1] + 'T00:00:00');
            
            const formatShortDate = (d) => `${String(d.getDate()).padStart(2, '0')}-${monthNames[d.getMonth()].toLowerCase()}`;
            
            // Si es el mismo día muestra "23-mar", si son varios muestra "01-mar al 23-mar"
            if (firstD.getTime() === lastD.getTime()) {
                dayLabelEl.innerText = formatShortDate(firstD);
            } else {
                dayLabelEl.innerText = `${formatShortDate(firstD)} al ${formatShortDate(lastD)}`;
            }
        } else {
            dayLabelEl.innerText = "Sin datos";
        }
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
