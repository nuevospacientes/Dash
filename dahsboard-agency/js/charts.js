/* ==========================================
   GRÁFICOS VISUALES
   ========================================== */

let chartTendencia = null;
let chartHorasHoy = null; 
let chartHistoricoDias = null;
let chartPagosDona = null;

// Variables de estado para los labels de los Tabs
let currentDynamicLabelHoy = "";
let currentDynamicLabelHist = "";
let activeDynamicTab = "hoy"; // Tab por defecto

Chart.defaults.color = '#BDBDBD';
Chart.defaults.font.family = "'Inter', sans-serif";

// Función Global para cambiar de pestaña en el gráfico dual
window.switchDynamicTab = function(tab) {
    activeDynamicTab = tab;
    const wrapHoy = document.getElementById('wrapper-chart-hoy');
    const wrapHist = document.getElementById('wrapper-chart-hist');
    const btnHoy = document.getElementById('btn-tab-hoy');
    const btnHist = document.getElementById('btn-tab-hist');
    const labelEl = document.getElementById('chart-dynamic-label');

    if(tab === 'hoy') {
        if(wrapHoy) wrapHoy.style.display = 'block';
        if(wrapHist) wrapHist.style.display = 'none';
        if(btnHoy) { btnHoy.style.background = 'var(--brand-primary)'; btnHoy.style.color = '#fff'; }
        if(btnHist) { btnHist.style.background = 'transparent'; btnHist.style.color = 'var(--text-muted)'; }
        if(labelEl) labelEl.innerText = currentDynamicLabelHoy;
    } else {
        if(wrapHoy) wrapHoy.style.display = 'none';
        if(wrapHist) wrapHist.style.display = 'block';
        if(btnHist) { btnHist.style.background = 'var(--brand-primary)'; btnHist.style.color = '#fff'; }
        if(btnHoy) { btnHoy.style.background = 'transparent'; btnHoy.style.color = 'var(--text-muted)'; }
        if(labelEl) labelEl.innerText = currentDynamicLabelHist;
    }
};

function renderizarGraficos(dataFiltrada) {
    const leads = dataFiltrada.leads || [];
    const contactados = dataFiltrada.contactados || [];
    const llamadas = dataFiltrada.llamadas || []; 
    const citas = dataFiltrada.citas || [];
    const shows = dataFiltrada.shows || [];
    const { start, end } = dataFiltrada.dateRange || { start: null, end: null };

    // ==========================================
    // 1. TENDENCIA DIARIA GENERAL
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
                if (start !== null && end !== null) { if (t < start || t >= end) return; }
                let fechaStr = new Date(d).toISOString().split('T')[0];
                if (!timeline[fechaStr]) timeline[fechaStr] = { leads: 0, contactados: 0, llamadas: 0, citas: 0, shows: 0, ventas: 0 };
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
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    
    if (labelsFechas.length > 0) {
        let firstD = new Date(labelsFechas[0] + 'T00:00:00');
        let lastD = new Date(labelsFechas[labelsFechas.length - 1] + 'T00:00:00');
        let labelText = (firstD.getMonth() === lastD.getMonth() && firstD.getFullYear() === lastD.getFullYear()) 
            ? `${monthNames[firstD.getMonth()]} ${firstD.getFullYear()}` 
            : `${monthNames[firstD.getMonth()]} ${firstD.getFullYear()} - ${monthNames[lastD.getMonth()]} ${lastD.getFullYear()}`;
        const labelEl = document.getElementById('chart-month-year-label');
        if (labelEl) labelEl.innerText = labelText;
    }

    let labelsEjeX = labelsFechas.map(f => new Date(f + 'T00:00:00').getDate().toString());
    const ctxTendencia = document.getElementById('chart-tendencia');
    if (ctxTendencia) {
        if (chartTendencia) chartTendencia.destroy();
        chartTendencia = new Chart(ctxTendencia, {
            type: 'line',
            data: {
                labels: labelsEjeX,
                datasets: [
                    { label: 'Leads', data: labelsFechas.map(f => timeline[f].leads), borderColor: '#3b6bfa', backgroundColor: '#3b6bfa', tension: 0.4 },
                    { label: 'Contactados', data: labelsFechas.map(f => timeline[f].contactados), borderColor: '#f6ad55', backgroundColor: '#f6ad55', tension: 0.4 },
                    { label: 'Llamadas', data: labelsFechas.map(f => timeline[f].llamadas), borderColor: '#9f7aea', backgroundColor: '#9f7aea', tension: 0.4 },
                    { label: 'Citas', data: labelsFechas.map(f => timeline[f].citas), borderColor: '#37ca37', backgroundColor: '#37ca37', tension: 0.4 },
                    { label: 'Shows', data: labelsFechas.map(f => timeline[f].shows), borderColor: '#fbbf24', backgroundColor: '#fbbf24', tension: 0.4 },
                    { label: 'Ventas', data: labelsFechas.map(f => timeline[f].ventas), borderColor: '#e93d3d', backgroundColor: '#e93d3d', tension: 0.4, borderWidth: 3 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // ==========================================
    // 2. DINÁMICA DUAL (HOY vs HISTÓRICO)
    // ==========================================
    const globalTz = document.getElementById('global-timezone') ? document.getElementById('global-timezone').value : 'America/Mexico_City';
    const globalOffset = typeof getTzOffsetMins === 'function' ? getTzOffsetMins(globalTz) : 0;
    const rawContactados = (window.AppData && window.AppData.raw) ? window.AppData.raw.contactados : [];
    const campaignSelected = document.getElementById('global-campaign-filter') ? document.getElementById('global-campaign-filter').value : 'all';
    const operatorSelected = document.getElementById('global-operator-filter') ? document.getElementById('global-operator-filter').value : 'all';

    const adjustToDashboardTz = (dateStr, timeStr, rowTz, rowObj) => {
        if (!dateStr || !timeStr) return null;
        let t = typeof parseDateSpanish === 'function' ? parseDateSpanish(dateStr, rowObj) : null;
        if (!t) return null;
        let p = String(timeStr).split(':');
        let d = new Date(t);
        d.setHours(parseInt(p[0]||0), parseInt(p[1]||0), parseInt(p[2]||0));
        let leadOffset = typeof getTzOffsetMins === 'function' ? getTzOffsetMins(rowTz) : 0;
        d.setMinutes(d.getMinutes() + (globalOffset - leadOffset));
        return d;
    };

    // --- 2A. DATA HISTÓRICA (Agrupada por Día) ---
    let timelineHist = {};
    contactados.forEach(c => {
        let leadTz = c['Zona Horaria'] || c['Zona horaria'] || globalTz;
        let dateE = adjustToDashboardTz(c['Fecha entrada lead'] || c['Fecha Lead entra'], c['Hora Generado'] || c['Hora entrada'], leadTz, c);
        if (dateE) {
            let y = dateE.getFullYear(), m = String(dateE.getMonth()+1).padStart(2,'0'), d = String(dateE.getDate()).padStart(2,'0');
            let fechaStr = `${y}-${m}-${d}`;
            if (!timelineHist[fechaStr]) timelineHist[fechaStr] = { contactados: 0, sumaStl: 0, countStl: 0 };
            
            timelineHist[fechaStr].contactados++;
            
            let dateL = adjustToDashboardTz(c['Fecha 1er llamada'], c['Hora 1er llamada'], leadTz, c);
            if (dateL) {
                timelineHist[fechaStr].sumaStl += (typeof getBusinessMinutes === 'function' ? getBusinessMinutes(dateE, dateL) : 0);
                timelineHist[fechaStr].countStl++;
            }
        }
    });

    let histFechas = Object.keys(timelineHist).sort();
    if (histFechas.length > 0) {
        let firstD = new Date(histFechas[0] + 'T00:00:00');
        let lastD = new Date(histFechas[histFechas.length - 1] + 'T00:00:00');
        const fShort = (d) => `${String(d.getDate()).padStart(2, '0')}-${monthNames[d.getMonth()].toLowerCase()}`;
        currentDynamicLabelHist = (firstD.getTime() === lastD.getTime()) ? fShort(firstD) : `${fShort(firstD)} al ${fShort(lastD)}`;
    } else {
        currentDynamicLabelHist = "Sin datos";
    }

    let histEjeX = histFechas.map(f => new Date(f + 'T00:00:00').getDate().toString());
    let histDataVol = histFechas.map(f => timelineHist[f].contactados);
    let histDataStl = histFechas.map(f => timelineHist[f].countStl > 0 ? Math.round(timelineHist[f].sumaStl / timelineHist[f].countStl) : 0);

    const ctxHist = document.getElementById('chart-historico-dias');
    if (ctxHist) {
        if (chartHistoricoDias) chartHistoricoDias.destroy();
        chartHistoricoDias = new Chart(ctxHist, {
            type: 'bar',
            data: {
                labels: histEjeX,
                datasets: [
                    { label: 'Speed to Lead Promedio (Min)', data: histDataStl, type: 'line', borderColor: '#f6ad55', backgroundColor: '#f6ad55', borderWidth: 3, tension: 0.4, yAxisID: 'y1' },
                    { label: 'Volumen Contactados', data: histDataVol, backgroundColor: 'rgba(59, 107, 250, 0.4)', borderColor: '#3b6bfa', borderWidth: 1, borderRadius: 4, yAxisID: 'y' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                scales: {
                    y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Nº de Contactados' }, beginAtZero: true, ticks: { stepSize: 1 } },
                    y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Minutos (STL)' }, beginAtZero: true, grid: { drawOnChartArea: false } }
                }
            }
        });
    }

    // --- 2B. DATA HOY (Agrupada por Hora, Ignora Fechas) ---
    const currentHourTz = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: globalTz, hour: 'numeric', hourCycle: 'h23' }).format(new Date()), 10);
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: globalTz, year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = formatter.formatToParts(new Date());
    const todayStr = `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}-${parts.find(p=>p.type==='day').value}`;

    let volHoy = new Array(24).fill(null);
    let stlSumaHoy = new Array(24).fill(0);
    let stlCountHoy = new Array(24).fill(0);
    for (let i = 0; i <= currentHourTz; i++) volHoy[i] = 0;

    rawContactados.forEach(c => {
        if (campaignSelected !== 'all' && c['Campaña'] !== campaignSelected) return;
        if (operatorSelected !== 'all' && c['Operador'] !== operatorSelected) return;

        let leadTz = c['Zona Horaria'] || c['Zona horaria'] || globalTz;
        let dateE = adjustToDashboardTz(c['Fecha entrada lead'] || c['Fecha Lead entra'], c['Hora Generado'] || c['Hora entrada'], leadTz, c);

        if (dateE) {
            let y = dateE.getFullYear(), m = String(dateE.getMonth()+1).padStart(2,'0'), d = String(dateE.getDate()).padStart(2,'0');
            if (`${y}-${m}-${d}` === todayStr) {
                let h = dateE.getHours();
                if (h >= 0 && h <= currentHourTz) {
                    volHoy[h]++;
                    let dateL = adjustToDashboardTz(c['Fecha 1er llamada'], c['Hora 1er llamada'], leadTz, c);
                    if (dateL) {
                        stlSumaHoy[h] += (typeof getBusinessMinutes === 'function' ? getBusinessMinutes(dateE, dateL) : 0);
                        stlCountHoy[h]++;
                    }
                }
            }
        }
    });

    let avgStlHoy = new Array(24).fill(null);
    for(let i=0; i <= currentHourTz; i++){ avgStlHoy[i] = stlCountHoy[i] > 0 ? Math.round(stlSumaHoy[i] / stlCountHoy[i]) : 0; }
    
    let shortDateStr = new Intl.DateTimeFormat('es-ES', { timeZone: globalTz, day: '2-digit', month: 'short' }).format(new Date());
    currentDynamicLabelHoy = `Hoy, ${shortDateStr.replace('.', '')}`;

    const ctxHoy = document.getElementById('chart-horas-hoy');
    if (ctxHoy) {
        let labelsHoras = Array.from({length: 24}, (_, i) => `${i}:00`);
        if (chartHorasHoy) chartHorasHoy.destroy();
        chartHorasHoy = new Chart(ctxHoy, {
            type: 'bar',
            data: {
                labels: labelsHoras,
                datasets: [
                    { label: 'Speed to Lead Hoy (Min)', data: avgStlHoy, type: 'line', borderColor: '#f6ad55', backgroundColor: '#f6ad55', borderWidth: 3, tension: 0.4, yAxisID: 'y1', spanGaps: false },
                    { label: 'Contactados Hoy', data: volHoy, backgroundColor: 'rgba(59, 107, 250, 0.4)', borderColor: '#3b6bfa', borderWidth: 1, borderRadius: 4, yAxisID: 'y' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                scales: {
                    y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Nº de Contactados' }, beginAtZero: true, ticks: { stepSize: 1 } },
                    y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Minutos (STL)' }, beginAtZero: true, grid: { drawOnChartArea: false } }
                }
            }
        });
    }

    // Actualizar UI al estado activo
    window.switchDynamicTab(activeDynamicTab);

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
            data: { labels: labelsPagos, datasets: [{ data: dataPagos, backgroundColor: palette.slice(0, labelsPagos.length), borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { color: '#BDBDBD', boxWidth: 12, font: {size: 11} } } } }
        });
    }
}
