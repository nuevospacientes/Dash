/* ==========================================
   GRÁFICOS VISUALES
   ========================================== */

let chartTendencia = null;
let chartDona = null;
let chartHoras = null;

// Configuración global para colores oscuros
Chart.defaults.color = '#BDBDBD';
Chart.defaults.font.family = "'Inter', sans-serif";

function renderizarGraficos(dataFiltrada) {
    const leads = dataFiltrada.leads;
    const contactados = dataFiltrada.contactados;
    const citas = dataFiltrada.citas;

    // 1. Agrupar por Fechas para Líneas (Tendencia)
    let timeline = {};
    
    const agruparPorFecha = (array, propFecha, key) => {
        array.forEach(item => {
            let d = parseDateSpanish(item[propFecha]);
            if (d) {
                let fechaStr = new Date(d).toISOString().split('T')[0];
                if (!timeline[fechaStr]) timeline[fechaStr] = { leads: 0, citas: 0 };
                timeline[fechaStr][key]++;
            }
        });
    };

    agruparPorFecha(leads, 'Fecha entrada lead', 'leads');
    agruparPorFecha(citas, 'Cita generada', 'citas');

    let labelsFechas = Object.keys(timeline).sort();
    let dataLeads = labelsFechas.map(f => timeline[f].leads);
    let dataCitas = labelsFechas.map(f => timeline[f].citas);

    // 2. Dibujar Gráfico de Tendencia
    const ctxTendencia = document.getElementById('chart-tendencia');
    if (ctxTendencia) {
        if (chartTendencia) chartTendencia.destroy();
        chartTendencia = new Chart(ctxTendencia, {
            type: 'line',
            data: {
                labels: labelsFechas,
                datasets: [
                    { label: 'Leads', data: dataLeads, borderColor: '#3b6bfa', tension: 0.4 },
                    { label: 'Citas', data: dataCitas, borderColor: '#37ca37', tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 3. Dibujar Gráfico de Dona (Embudo Global)
    const ctxDona = document.getElementById('chart-dona-embudo');
    if (ctxDona) {
        if (chartDona) chartDona.destroy();
        chartDona = new Chart(ctxDona, {
            type: 'doughnut',
            data: {
                labels: ['Leads Sin Contactar', 'Contactados (Sin Cita)', 'Citas Agendadas'],
                datasets: [{
                    data: [
                        leads.length - contactados.length, 
                        contactados.length - citas.length, 
                        citas.length
                    ],
                    backgroundColor: ['#e93d3d', '#f6ad55', '#37ca37'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '75%' }
        });
    }
}
