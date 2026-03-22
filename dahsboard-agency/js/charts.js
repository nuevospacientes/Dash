/* ==========================================
   GRÁFICOS VISUALES
   ========================================== */

let chartTendencia = null;
let chartHoras = null; // Eliminamos la variable chartDona

// Configuración global para colores oscuros
Chart.defaults.color = '#BDBDBD';
Chart.defaults.font.family = "'Inter', sans-serif";

function renderizarGraficos(dataFiltrada) {
    // Extraemos todas las tablas procesadas
    const leads = dataFiltrada.leads || [];
    const contactados = dataFiltrada.contactados || [];
    const llamadas = dataFiltrada.llamadas || []; 
    const citas = dataFiltrada.citas || [];
    const shows = dataFiltrada.shows || [];
    
    // EXTRAEMOS LOS LÍMITES DEL FILTRO GLOBAL
    const { start, end } = dataFiltrada.dateRange || { start: null, end: null };

    // ==========================================
    // 1. TENDENCIA DIARIA DEL EMBUDO (6 Variables)
    // ==========================================
    let timeline = {};
    
    // Función optimizada con CORTAFUEGOS
    const agruparPorFecha = (array, propFecha, key, filterFn = null) => {
        if (!array) return;
        array.forEach(item => {
            if (filterFn && !filterFn(item)) return;
            
            let rawDate = item[propFecha];
            if (!rawDate) return;

            let d = typeof parseDateSpanish === 'function' ? parseDateSpanish(rawDate, item) : new Date(rawDate);
            
            if (d && !isNaN(new Date(d).getTime())) {
                let t = new Date(d).getTime();
                
                // CORTAFUEGOS: Si la fecha está fuera del filtro seleccionado, la ignoramos.
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

    // Mapeo de eventos a sus respectivas fechas de ocurrencia
    agruparPorFecha(leads, 'Fecha entrada lead', 'leads');
    agruparPorFecha(contactados, 'Fecha 1er llamada', 'contactados');
    agruparPorFecha(llamadas, 'Fecha last call', 'llamadas'); 
    agruparPorFecha(citas, 'Cita generada', 'citas');
    agruparPorFecha(shows, 'Fecha Visita', 'shows');
    
    // Lógica de Ventas: Shows que tienen Depósito (ignora celdas vacías o "Sin Deposito")
    agruparPorFecha(shows, 'Fecha Visita', 'ventas', (item) => {
        const dep = (item['Deposito'] || '').toLowerCase().trim();
        return dep !== '' && dep !== 'sin deposito' && dep !== 'sin depósito';
    });

    // Ordenar cronológicamente para mantener el eje X secuencial
    let labelsFechas = Object.keys(timeline).sort();
    
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
                labels: labelsFechas,
                datasets: [
                    { label: 'Leads Generados', data: dataLeads, borderColor: '#3b6bfa', backgroundColor: '#3b6bfa', tension: 0.4 },
                    { label: 'Leads Contactados', data: dataContactados, borderColor: '#f6ad55', backgroundColor: '#f6ad55', tension: 0.4 },
                    { label: 'Llamadas Conectadas', data: dataLlamadas, borderColor: '#9f7aea', backgroundColor: '#9f7aea', tension: 0.4 },
                    { label: 'Citas Generadas', data: dataCitas, borderColor: '#37ca37', backgroundColor: '#37ca37', tension: 0.4 },
                    { label: 'Shows', data: dataShows, borderColor: '#fbbf24', backgroundColor: '#fbbf24', tension: 0.4 },
                    { label: 'Ventas Cerradas', data: dataVentas, borderColor: '#e93d3d', backgroundColor: '#e93d3d', tension: 0.4, borderWidth: 3 }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // ==========================================
    // 2. DINÁMICA DIARIA (Llamadas por Hora)
    // ==========================================
    const ctxHoras = document.getElementById('chart-horas');
    if (ctxHoras) {
        // Creamos 24 "cubetas" para las horas del día (0 a 23)
        let distribucionHoras = new Array(24).fill(0);
        
        contactados.forEach(item => {
            let horaStr = item['Hora 1er llamada'];
            if (horaStr) {
                let horaNum = parseInt(horaStr.split(':')[0]); // Extrae la hora "14:23:00" -> 14
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
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }
}
