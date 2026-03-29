/* ==========================================
   GRÁFICOS VISUALES E INTERACTIVOS
   ========================================== */

let chartTendencia = null; 
let chartTendenciaDinamica = null; 
let chartHorasHoy = null; 
let chartHistoricoDias = null; 
let chartPagosDona = null;
let currentDynamicLabelHoy = ""; 
let currentDynamicLabelHist = ""; 
let activeDynamicTab = "hoy"; 

Chart.defaults.color = '#BDBDBD'; 
Chart.defaults.font.family = "'Inter', sans-serif";

window.switchDynamicTab = function(tab) {
    activeDynamicTab = tab;
    const wrapHoy = document.getElementById('wrapper-chart-hoy'), wrapHist = document.getElementById('wrapper-chart-hist');
    const btnHoy = document.getElementById('btn-tab-hoy'), btnHist = document.getElementById('btn-tab-hist'), labelEl = document.getElementById('chart-dynamic-label');
    
    if(tab === 'hoy') {
        if(wrapHoy) wrapHoy.style.display = 'block'; if(wrapHist) wrapHist.style.display = 'none';
        if(btnHoy) { btnHoy.style.background = 'var(--brand-primary)'; btnHoy.style.color = '#fff'; }
        if(btnHist) { btnHist.style.background = 'transparent'; btnHist.style.color = 'var(--text-muted)'; }
        if(labelEl) labelEl.innerText = currentDynamicLabelHoy;
    } else {
        if(wrapHoy) wrapHoy.style.display = 'none'; if(wrapHist) wrapHist.style.display = 'block';
        if(btnHist) { btnHist.style.background = 'var(--brand-primary)'; btnHist.style.color = '#fff'; }
        if(btnHoy) { btnHoy.style.background = 'transparent'; btnHoy.style.color = 'var(--text-muted)'; }
        if(labelEl) labelEl.innerText = currentDynamicLabelHist;
    }
};

// --- LOGICA DE MÉTRICAS PERSONALIZADAS ---
window.insertChartVar = function(v) {
    const input = document.getElementById('chart-custom-formula');
    if(input) { input.value += v; input.focus(); }
};

window.guardarCustomChartMetric = function() {
    const name = document.getElementById('chart-custom-name').value.trim();
    const formula = document.getElementById('chart-custom-formula').value.trim();
    
    if (!name || !formula) { alert("Ingresa un nombre y una fórmula."); return; }
    
    let customMetrics = JSON.parse(localStorage.getItem('np_chart_custom_metrics')) || {};
    let id = 'chart_custom_' + Date.now();
    customMetrics[id] = { name, formula };
    localStorage.setItem('np_chart_custom_metrics', JSON.stringify(customMetrics));
    
    document.getElementById('modal-custom-chart').style.display = 'none';
    document.getElementById('chart-custom-name').value = '';
    document.getElementById('chart-custom-formula').value = '';
    
    if (typeof procesarYRenderizar === 'function') procesarYRenderizar();
};

function renderizarGraficos(dataFiltrada) {
    const leads = dataFiltrada.leads || []; 
    const contactadosFiltrados = dataFiltrada.contactados || [];
    const llamadas = dataFiltrada.llamadas || []; 
    const citas = dataFiltrada.citas || []; 
    const shows = dataFiltrada.shows || [];
    const { start, end } = dataFiltrada.dateRange || { start: null, end: null };
    const globalTz = document.getElementById('global-timezone') ? document.getElementById('global-timezone').value : 'America/Mexico_City';

    // 1. LÍNEA DE TIEMPO BASE
    let timeline = {};
    const agruparPorFecha = (array, propFecha, key, filterFn = null) => {
        if (!array) return;
        array.forEach(item => {
            if (filterFn && !filterFn(item)) return;
            let rawDate = item[propFecha];
            if (!rawDate) return;
            let d = typeof parseDateSpanish === 'function' ? parseDateSpanish(rawDate, item, propFecha) : new Date(rawDate);
            if (d && !isNaN(new Date(d).getTime())) {
                let t = new Date(d).getTime();
                if (start !== null && end !== null) { if (t < start || t >= end) return; }
                let fechaStr = new Date(d).toISOString().split('T')[0];
                if (!timeline[fechaStr]) timeline[fechaStr] = { leads: 0, contactados: 0, llamadas: 0, citas: 0, shows: 0, ventas: 0, stlSum: 0, stlCount: 0 };
                
                if (key === 'stl') {
                    let bMins = item['_stl_' + globalTz];
                    if (bMins !== undefined && bMins !== null) {
                        timeline[fechaStr].stlSum += bMins;
                        timeline[fechaStr].stlCount++;
                    }
                } else {
                    timeline[fechaStr][key]++;
                }
            }
        });
    };

    agruparPorFecha(leads, 'Fecha entrada lead', 'leads'); 
    agruparPorFecha(contactadosFiltrados, 'Fecha 1er llamada', 'contactados');
    agruparPorFecha(llamadas, 'Fecha last call', 'llamadas'); 
    agruparPorFecha(citas, 'Cita generada', 'citas'); 
    agruparPorFecha(shows, 'Fecha Visita', 'shows');
    agruparPorFecha(shows, 'Fecha Visita', 'ventas', (item) => { const dep = (item['Deposito'] || '').toLowerCase().trim(); return dep !== '' && dep !== 'sin deposito' && dep !== 'sin depósito'; });
    agruparPorFecha(contactadosFiltrados, 'Fecha 1er llamada', 'stl');

    let labelsFechas = Object.keys(timeline).sort();
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    
    // Configurar Etiquetas de Fechas
    const formatShort = (d) => `${String(d.getDate()).padStart(2, '0')}-${monthNames[d.getMonth()].toLowerCase()}`;
    if (labelsFechas.length > 0) {
        let firstD = new Date(labelsFechas[0] + 'T00:00:00'), lastD = new Date(labelsFechas[labelsFechas.length - 1] + 'T00:00:00');
        let labelTextClass = (firstD.getMonth() === lastD.getMonth() && firstD.getFullYear() === lastD.getFullYear()) ? `${monthNames[firstD.getMonth()]} ${firstD.getFullYear()}` : `${monthNames[firstD.getMonth()]} ${firstD.getFullYear()} - ${monthNames[lastD.getMonth()]} ${lastD.getFullYear()}`;
        let labelTextDin = (firstD.getTime() === lastD.getTime()) ? formatShort(firstD) : `${formatShort(firstD)} al ${formatShort(lastD)}`;
        
        const labelEl = document.getElementById('chart-month-year-label'); if (labelEl) labelEl.innerText = labelTextClass;
        const labelElDin = document.getElementById('chart-dynamic-date-label'); if (labelElDin) labelElDin.innerText = labelTextDin;
    }

    let labelsEjeX = labelsFechas.map(f => new Date(f + 'T00:00:00').getDate().toString());

    // --- GRÁFICO 1: TENDENCIA CLÁSICA ---
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
            }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // --- GRÁFICO 2: TENDENCIA DINÁMICA INTERACTIVA ---
    const customMetrics = JSON.parse(localStorage.getItem('np_chart_custom_metrics')) || {};
    const METRIC_CONFIG = {
        'leads': { label: 'Volumen de Leads', color: '#3b6bfa', isReverse: false },
        'contactados': { label: 'Contactados Únicos', color: '#f6ad55', isReverse: false },
        'llamadas': { label: 'Llamadas Conectadas', color: '#9f7aea', isReverse: false },
        'citas': { label: 'Citas Agendadas', color: '#37ca37', isReverse: false },
        'shows': { label: 'Asistencias (Shows)', color: '#fbbf24', isReverse: false },
        'ventas': { label: 'Ventas Cerradas', color: '#e93d3d', isReverse: false },
        'stl': { label: 'Speed to Lead (Min)', color: '#bc13fe', isReverse: true }
    };

    // Inyectar métricas custom
    const syncSelect = (id) => {
        const sel = document.getElementById(id);
        if(!sel) return;
        Object.keys(customMetrics).forEach(k => {
            METRIC_CONFIG[k] = { label: customMetrics[k].name, color: '#37ca37', isReverse: false, formula: customMetrics[k].formula };
            if(!sel.querySelector(`option[value="${k}"]`)) {
                const opt = document.createElement('option');
                opt.value = k; opt.innerText = customMetrics[k].name;
                sel.appendChild(opt);
            }
        });
    };
    syncSelect('grafico-metrica-1'); syncSelect('grafico-metrica-2');

    window.updateDynamicChart = function() {
        const ctxDinamica = document.getElementById('chart-tendencia-dinamica');
        if(!ctxDinamica) return;

        const sel1 = document.getElementById('grafico-metrica-1');
        const sel2 = document.getElementById('grafico-metrica-2');
        let m1 = sel1 ? sel1.value : 'leads';
        let m2 = sel2 ? sel2.value : 'citas';

        let conf1 = METRIC_CONFIG[m1] || METRIC_CONFIG['leads'];
        let conf2 = METRIC_CONFIG[m2] || METRIC_CONFIG['citas'];

        // Extractor Matemático (Evalúa fórmulas)
        const extractData = (key) => {
            return labelsFechas.map(f => {
                let daily = timeline[f] || {};
                let vals = {
                    leads: daily.leads || 0, contactados: daily.contactados || 0,
                    llamadas: daily.llamadas || 0, citas: daily.citas || 0,
                    shows: daily.shows || 0, ventas: daily.ventas || 0,
                    stl: daily.stlCount > 0 ? Math.round(daily.stlSum / daily.stlCount) : 0
                };

                if (METRIC_CONFIG[key] && METRIC_CONFIG[key].formula) {
                    let fStr = METRIC_CONFIG[key].formula;
                    Object.keys(vals).forEach(v => { fStr = fStr.replace(new RegExp(`{{${v}}}`, 'g'), vals[v]); });
                    try {
                        let res = eval(fStr);
                        return isNaN(res) || !isFinite(res) ? 0 : Number(res.toFixed(2));
                    } catch(e) { return 0; }
                }
                if (key === 'stl') return vals.stl;
                return vals[key] || 0;
            });
        };

        if (chartTendenciaDinamica) chartTendenciaDinamica.destroy();
        chartTendenciaDinamica = new Chart(ctxDinamica, {
            type: 'line',
            data: {
                labels: labelsEjeX,
                datasets: [
                    { label: conf1.label, data: extractData(m1), borderColor: conf1.color, backgroundColor: conf1.color, tension: 0.4, borderWidth: 3, yAxisID: 'y' },
                    { label: conf2.label, data: extractData(m2), borderColor: conf2.color, backgroundColor: conf2.color, tension: 0.4, borderWidth: 3, borderDash: [5, 5], yAxisID: 'y1' }
                ]
            }, 
            options: { 
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } },
                scales: {
                    y: { type: 'linear', display: true, position: 'left', reverse: conf1.isReverse },
                    y1: { type: 'linear', display: true, position: 'right', reverse: conf2.isReverse, grid: { drawOnChartArea: false } }
                }
            }
        });
    };

    // Pintar el gráfico interactivo
    window.updateDynamicChart();

    // 3. DINÁMICA DUAL (HOY vs HISTÓRICO)
    const globalOffset = typeof getTzOffsetMins === 'function' ? getTzOffsetMins(globalTz) : 0;
    const rawContactados = (window.AppData && window.AppData.raw) ? window.AppData.raw.contactados : [];
    const campaignSelected = document.getElementById('global-campaign-filter') ? document.getElementById('global-campaign-filter').value : 'all';
    const operatorSelected = document.getElementById('global-operator-filter') ? document.getElementById('global-operator-filter').value : 'all';

    const adjustToDashboardTz = (dateStr, timeStr, rowTz, rowObj, colName) => {
        if (!dateStr || !timeStr) return null;
        let t = typeof parseDateSpanish === 'function' ? parseDateSpanish(dateStr, rowObj, colName) : null;
        if (!t) return null;
        let p = String(timeStr).split(':'), d = new Date(t);
        d.setHours(parseInt(p[0]||0), parseInt(p[1]||0), parseInt(p[2]||0));
        d.setMinutes(d.getMinutes() + (globalOffset - (typeof getTzOffsetMins === 'function' ? getTzOffsetMins(rowTz) : 0)));
        return d;
    };

    // --- HISTÓRICO ---
    let timelineHist = {};
    contactadosFiltrados.forEach(c => {
        let leadTz = c['Zona Horaria'] || c['Zona horaria'] || globalTz;
        let dateL = adjustToDashboardTz(c['Fecha 1er llamada'], c['Hora 1er llamada'], leadTz, c, 'Fecha 1er llamada');
        
        if (dateL) {
            let y = dateL.getFullYear(), m = String(dateL.getMonth()+1).padStart(2,'0'), d = String(dateL.getDate()).padStart(2,'0');
            let fechaStr = `${y}-${m}-${d}`;
            if (!timelineHist[fechaStr]) timelineHist[fechaStr] = { contactados: 0, sumaStl: 0, countStl: 0 };
            
            timelineHist[fechaStr].contactados++;
            
            let bMins = c['_stl_' + globalTz];
            if (bMins !== undefined && bMins !== null) {
                timelineHist[fechaStr].sumaStl += bMins;
                timelineHist[fechaStr].countStl++;
            }
        }
    });

    let histFechas = Object.keys(timelineHist).sort();
    if (histFechas.length > 0) {
        let firstD = new Date(histFechas[0] + 'T00:00:00'), lastD = new Date(histFechas[histFechas.length - 1] + 'T00:00:00');
        const fShort = (d) => `${String(d.getDate()).padStart(2, '0')}-${monthNames[d.getMonth()].toLowerCase()}`;
        currentDynamicLabelHist = (firstD.getTime() === lastD.getTime()) ? fShort(firstD) : `${fShort(firstD)} al ${fShort(lastD)}`;
    } else { currentDynamicLabelHist = "Sin datos"; }

    const ctxHist = document.getElementById('chart-historico-dias');
    if (ctxHist) {
        if (chartHistoricoDias) chartHistoricoDias.destroy();
        chartHistoricoDias = new Chart(ctxHist, {
            type: 'bar',
            data: {
                labels: histFechas.map(f => new Date(f + 'T00:00:00').getDate().toString()),
                datasets: [
                    { label: 'Speed to Lead Promedio (Min)', data: histFechas.map(f => timelineHist[f].countStl > 0 ? Math.round(timelineHist[f].sumaStl / timelineHist[f].countStl) : 0), type: 'line', borderColor: '#f6ad55', backgroundColor: '#f6ad55', borderWidth: 3, tension: 0.4, yAxisID: 'y1' },
                    { label: 'Volumen Contactados', data: histFechas.map(f => timelineHist[f].contactados), backgroundColor: 'rgba(59, 107, 250, 0.4)', borderColor: '#3b6bfa', borderWidth: 1, borderRadius: 4, yAxisID: 'y' }
                ]
            }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { type: 'linear', display: true, position: 'left', beginAtZero: true, ticks: { stepSize: 1 } }, y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } } } }
        });
    }

    // --- HOY ---
    const currentHourTz = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: globalTz, hour: 'numeric', hourCycle: 'h23' }).format(new Date()), 10);
    const pToday = new Intl.DateTimeFormat('en-US', { timeZone: globalTz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const todayStr = `${pToday.find(p=>p.type==='year').value}-${pToday.find(p=>p.type==='month').value}-${pToday.find(p=>p.type==='day').value}`;

    let volHoy = new Array(24).fill(null), stlSumaHoy = new Array(24).fill(0), stlCountHoy = new Array(24).fill(0);
    for (let i = 0; i <= currentHourTz; i++) volHoy[i] = 0;

    rawContactados.forEach(c => {
        if (campaignSelected !== 'all' && c['Campaña'] !== campaignSelected) return;
        if (operatorSelected !== 'all' && c['Operador'] !== operatorSelected) return;

        let leadTz = c['Zona Horaria'] || c['Zona horaria'] || globalTz;
        let dateL = adjustToDashboardTz(c['Fecha 1er llamada'], c['Hora 1er llamada'], leadTz, c, 'Fecha 1er llamada');

        if (dateL) {
            let y = dateL.getFullYear(), m = String(dateL.getMonth()+1).padStart(2,'0'), d = String(dateL.getDate()).padStart(2,'0');
            if (`${y}-${m}-${d}` === todayStr) {
                let h = dateL.getHours(); 
                if (h >= 0 && h <= currentHourTz) {
                    volHoy[h]++;
                    let bMins = c['_stl_' + globalTz];
                    if (bMins !== undefined && bMins !== null) {
                        stlSumaHoy[h] += bMins;
                        stlCountHoy[h]++;
                    }
                }
            }
        }
    });

    let avgStlHoy = new Array(24).fill(null);
    for(let i=0; i <= currentHourTz; i++) avgStlHoy[i] = stlCountHoy[i] > 0 ? Math.round(stlSumaHoy[i] / stlCountHoy[i]) : 0;
    
    currentDynamicLabelHoy = `Hoy, ${new Intl.DateTimeFormat('es-ES', { timeZone: globalTz, day: '2-digit', month: 'short' }).format(new Date()).replace('.', '')}`;

    const ctxHoy = document.getElementById('chart-horas-hoy');
    if (ctxHoy) {
        if (chartHorasHoy) chartHorasHoy.destroy();
        chartHorasHoy = new Chart(ctxHoy, {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                datasets: [
                    { label: 'Speed to Lead Hoy (Min)', data: avgStlHoy, type: 'line', borderColor: '#f6ad55', backgroundColor: '#f6ad55', borderWidth: 3, tension: 0.4, yAxisID: 'y1', spanGaps: false },
                    { label: 'Contactados Hoy', data: volHoy, backgroundColor: 'rgba(59, 107, 250, 0.4)', borderColor: '#3b6bfa', borderWidth: 1, borderRadius: 4, yAxisID: 'y' }
                ]
            }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { type: 'linear', display: true, position: 'left', beginAtZero: true, ticks: { stepSize: 1 } }, y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } } } }
        });
    }

    window.switchDynamicTab(activeDynamicTab);

    // 4. DISTRIBUCIÓN DE PAGOS
    const pagosObj = {};
    shows.forEach(v => {
        let dep = (v['Deposito'] || '').trim();
        if (dep !== '' && dep.toLowerCase() !== 'sin deposito' && dep.toLowerCase() !== 'sin depósito') {
            let mLower = dep.toLowerCase(), mFinal = dep;
            if (mLower.includes('transferencia')) mFinal = 'Transferencia'; else if (mLower.includes('link')) mFinal = 'Link de Pago'; else if (mLower.includes('tarjeta')) mFinal = 'Tarjeta'; else if (mLower.includes('efectivo')) mFinal = 'Efectivo'; else if (mLower.includes('financiamiento') || mLower.includes('cuota')) mFinal = 'Financiamiento'; else mFinal = mFinal.charAt(0).toUpperCase() + mFinal.slice(1);
            pagosObj[mFinal] = (pagosObj[mFinal] || 0) + 1;
        }
    });

    const ctxPagos = document.getElementById('chart-pagos-dona');
    if (ctxPagos) {
        if (chartPagosDona) chartPagosDona.destroy();
        chartPagosDona = new Chart(ctxPagos, { type: 'doughnut', data: { labels: Object.keys(pagosObj), datasets: [{ data: Object.values(pagosObj), backgroundColor: ['#3b6bfa', '#37ca37', '#f6ad55', '#e93d3d', '#9f7aea', '#ecc94b'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { color: '#BDBDBD', boxWidth: 12, font: {size: 11} } } } } });
    }
}
