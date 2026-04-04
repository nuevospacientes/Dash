/* ==========================================
   GRÁFICOS VISUALES E INTERACTIVOS (NIVEL DIOS)
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

window.insertChartVar = function(v) {
    const input = document.getElementById('chart-custom-formula');
    if(input) { input.value += v; input.focus(); }
};

window.guardarCustomChartMetric = function() {
    const name = document.getElementById('chart-custom-name').value.trim();
    const formula = document.getElementById('chart-custom-formula').value.trim();
    const format = document.getElementById('chart-custom-format') ? document.getElementById('chart-custom-format').value : 'number';
    
    if (!name || !formula) { alert("Ingresa un nombre y una fórmula."); return; }
    
    let customMetrics = JSON.parse(localStorage.getItem('np_chart_custom_metrics')) || {};
    let id = 'chart_custom_' + Date.now();
    customMetrics[id] = { name, formula, format }; // Ahora guardamos el formato
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
    const globalOffset = typeof getTzOffsetMins === 'function' ? getTzOffsetMins(globalTz) : 0;

    const isSingleDay = start !== null && end !== null && (end - start) <= 86400000;

    const METRIC_CONFIG = {
        'leads': { label: 'Volumen de Leads', color: '#3b6bfa', isReverse: false },
        'contactados': { label: 'Contactados Únicos', color: '#f6ad55', isReverse: false },
        'llamadas': { label: 'Llamadas Conectadas', color: '#9f7aea', isReverse: false },
        'citas': { label: 'Citas Agendadas', color: '#37ca37', isReverse: false },
        'shows': { label: 'Asistencias (Shows)', color: '#fbbf24', isReverse: false },
        'ventas': { label: 'Ventas Cerradas', color: '#e93d3d', isReverse: false },
        'stl': { label: 'Speed to Lead (Min)', color: '#bc13fe', isReverse: true }
    };

   // Nueva variable
    const formatTooltip = (val, conf) => {
        if (!conf || !conf.format) return val;
        if (conf.format === 'percentage') return `${val}%`;
        if (conf.format === 'currency') return `$${val.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        return val;
    };
   
    const customMetrics = JSON.parse(localStorage.getItem('np_chart_custom_metrics')) || {};
    const syncSelect = (id) => {
        const sel = document.getElementById(id);
        if(!sel) return;
        Object.keys(customMetrics).forEach(k => {
            // Pasamos el formato al config maestro
            METRIC_CONFIG[k] = { 
                label: customMetrics[k].name, 
                color: '#37ca37', 
                isReverse: false, 
                formula: customMetrics[k].formula,
                format: customMetrics[k].format || 'number'
            };
            if(!sel.querySelector(`option[value="${k}"]`)) {
                const opt = document.createElement('option');
                opt.value = k; opt.innerText = customMetrics[k].name;
                sel.appendChild(opt);
            }
        });
    };
    ['grafico-metrica-1', 'grafico-metrica-2', 'grafico-dinamico-m1', 'grafico-dinamico-m2'].forEach(syncSelect);

    const extractMetricValue = (obj, metricKey) => {
        if (!obj) return 0;
        if (metricKey === 'stl') return obj.stlCount > 0 ? Math.round(obj.stlSum / obj.stlCount) : 0;
        if (METRIC_CONFIG[metricKey] && METRIC_CONFIG[metricKey].formula) {
            let fStr = METRIC_CONFIG[metricKey].formula;
            let vals = {
                leads: obj.leads || 0, contactados: obj.contactados || 0, llamadas: obj.llamadas || 0, 
                citas: obj.citas || 0, shows: obj.shows || 0, ventas: obj.ventas || 0,
                stl: obj.stlCount > 0 ? Math.round(obj.stlSum / obj.stlCount) : 0
            };
            Object.keys(vals).forEach(v => { fStr = fStr.replace(new RegExp(`{{${v}}}`, 'g'), vals[v]); });
            try { let res = eval(fStr); return isNaN(res) || !isFinite(res) ? 0 : Number(res.toFixed(2)); } catch(e) { return 0; }
        }
        return obj[metricKey] || 0;
    };

    // =========================================================================
    // MOTOR DE FECHAS (Extrae fecha y hora AM/PM y aplica zona horaria)
    // =========================================================================
    const getExactDate = (item, dateKeys, timeKeys) => {
        let rawDate = null, rawTime = null;
        for (let k of dateKeys) { if (item[k]) { rawDate = item[k]; break; } }
        for (let k of timeKeys) { if (item[k]) { rawTime = item[k]; break; } }
        
        if (!rawDate) return null;

        let t = typeof parseDateSpanish === 'function' ? parseDateSpanish(rawDate, item, dateKeys[0]) : new Date(rawDate).getTime();
        if (!t) return null;

        let d = new Date(t);
        if (rawTime && typeof rawTime === 'string') {
            let timeStr = rawTime.trim().toLowerCase();
            let isPM = timeStr.includes('pm');
            let isAM = timeStr.includes('am');
            
            let cleanTime = timeStr.replace(/[a-z]/g, '').trim();
            let p = cleanTime.split(':');
            
            let h = parseInt(p[0] || 0, 10);
            let m = parseInt(p[1] || 0, 10);
            let s = parseInt(p[2] || 0, 10);

            if (isPM && h < 12) h += 12;
            if (isAM && h === 12) h = 0;

            d.setHours(h, m, s);
        }

        let leadTz = item['Zona Horaria'] || item['Zona horaria'] || globalTz;
        let leadOffset = typeof getTzOffsetMins === 'function' ? getTzOffsetMins(leadTz) : 0;
        d.setMinutes(d.getMinutes() + (globalOffset - leadOffset));

        return d;
    };

    // =========================================================================
    // GRÁFICOS 1 y 2 (SUPERIORES - FILTRADOS)
    // =========================================================================
    let timelineTop = {};
    if (isSingleDay) { for(let i=0; i<24; i++) timelineTop[i] = { leads: 0, contactados: 0, llamadas: 0, citas: 0, shows: 0, ventas: 0, stlSum: 0, stlCount: 0 }; }

    const agruparTop = (array, dateKeys, timeKeys, key, filterFn = null) => {
        if (!array) return;
        array.forEach(item => {
            if (filterFn && !filterFn(item)) return;
            
            // CORRECCIÓN AQUÍ: Usamos getExactDate con los arrays de claves
            let dateObj = getExactDate(item, dateKeys, timeKeys);
            if (!dateObj) return;

            let t = dateObj.getTime();
            if (start !== null && end !== null && (t < start || t >= end)) return; // Filtro global

            if (isSingleDay) {
                let h = dateObj.getHours();
                if (key === 'stl') {
                    let bMins = item['_stl_' + globalTz];
                    if (bMins !== undefined && bMins !== null) { timelineTop[h].stlSum += bMins; timelineTop[h].stlCount++; }
                } else { timelineTop[h][key]++; }
            } else {
                let y = dateObj.getFullYear(), m = String(dateObj.getMonth()+1).padStart(2,'0'), day = String(dateObj.getDate()).padStart(2,'0');
                let fechaStr = `${y}-${m}-${day}`;
                if (!timelineTop[fechaStr]) timelineTop[fechaStr] = { leads: 0, contactados: 0, llamadas: 0, citas: 0, shows: 0, ventas: 0, stlSum: 0, stlCount: 0 };
                
                if (key === 'stl') {
                    let bMins = item['_stl_' + globalTz];
                    if (bMins !== undefined && bMins !== null) { timelineTop[fechaStr].stlSum += bMins; timelineTop[fechaStr].stlCount++; }
                } else { timelineTop[fechaStr][key]++; }
            }
        });
    };

    agruparTop(leads, ['Fecha entrada lead', 'Fecha Lead entra'], ['Hora Generado', 'Hora entrada'], 'leads'); 
    agruparTop(contactadosFiltrados, ['Fecha last call', 'Fecha 1er llamada', 'Fecha entrada lead'], ['Hora last call', 'Hora 1er llamada', 'Hora entrada'], 'contactados');
    agruparTop(llamadas, ['Fecha last call', 'Fecha 1er llamada'], ['Hora last call', 'Hora 1er llamada'], 'llamadas'); 
    agruparTop(citas, ['Cita generada'], ['Hora 1er llamada'], 'citas'); 
    agruparTop(shows, ['Fecha Visita'], ['Hora Visita'], 'shows');
    agruparTop(shows, ['Fecha Visita'], ['Hora Visita'], 'ventas', (item) => { const dep = (item['Deposito'] || '').toLowerCase().trim(); return dep !== '' && dep !== 'sin deposito' && dep !== 'sin depósito'; });
    agruparTop(contactadosFiltrados, ['Fecha last call', 'Fecha 1er llamada', 'Fecha entrada lead'], ['Hora last call', 'Hora 1er llamada', 'Hora entrada'], 'stl');

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    let topKeys = isSingleDay ? Array.from({length: 24}, (_, i) => i) : Object.keys(timelineTop).sort();
    let topLabelsX = isSingleDay ? Array.from({length: 24}, (_, i) => `${i}:00`) : topKeys.map(f => new Date(f + 'T00:00:00').getDate().toString());

    if (!isSingleDay && topKeys.length > 0) {
        let firstD = new Date(topKeys[0] + 'T00:00:00'), lastD = new Date(topKeys[topKeys.length - 1] + 'T00:00:00');
        let labelTextClass = (firstD.getMonth() === lastD.getMonth() && firstD.getFullYear() === lastD.getFullYear()) ? `${monthNames[firstD.getMonth()]} ${firstD.getFullYear()}` : `${monthNames[firstD.getMonth()]} ${firstD.getFullYear()} - ${monthNames[lastD.getMonth()]} ${lastD.getFullYear()}`;
        const formatShort = (d) => `${String(d.getDate()).padStart(2, '0')}-${monthNames[d.getMonth()].toLowerCase()}`;
        let labelTextDin = (firstD.getTime() === lastD.getTime()) ? formatShort(firstD) : `${formatShort(firstD)} al ${formatShort(lastD)}`;
        
        const labelElClas = document.getElementById('chart-month-year-label'); if (labelElClas) labelElClas.innerText = labelTextClass;
        const labelElDin = document.getElementById('chart-dynamic-date-label'); if (labelElDin) labelElDin.innerText = labelTextDin;
    } else if (isSingleDay && start !== null) {
        let sd = new Date(start);
        const labelStr = `${String(sd.getDate()).padStart(2, '0')}-${monthNames[sd.getMonth()].toLowerCase()} (Por Horas)`;
        const labelElClas = document.getElementById('chart-month-year-label'); if (labelElClas) labelElClas.innerText = labelStr;
        const labelElDin = document.getElementById('chart-dynamic-date-label'); if (labelElDin) labelElDin.innerText = labelStr;
    }

    // 1. Gráfico Clásico
    const ctxTendencia = document.getElementById('chart-tendencia');
    if (ctxTendencia) {
        if (chartTendencia) chartTendencia.destroy();
        chartTendencia = new Chart(ctxTendencia, {
            type: 'line',
            data: {
                labels: topLabelsX,
                datasets: [
                    { label: 'Leads', data: topKeys.map(k => timelineTop[k].leads), borderColor: '#3b6bfa', backgroundColor: '#3b6bfa', tension: 0.4 },
                    { label: 'Contactados', data: topKeys.map(k => timelineTop[k].contactados), borderColor: '#f6ad55', backgroundColor: '#f6ad55', tension: 0.4 },
                    { label: 'Llamadas', data: topKeys.map(k => timelineTop[k].llamadas), borderColor: '#9f7aea', backgroundColor: '#9f7aea', tension: 0.4 },
                    { label: 'Citas', data: topKeys.map(k => timelineTop[k].citas), borderColor: '#37ca37', backgroundColor: '#37ca37', tension: 0.4 },
                    { label: 'Shows', data: topKeys.map(k => timelineTop[k].shows), borderColor: '#fbbf24', backgroundColor: '#fbbf24', tension: 0.4 },
                    { label: 'Ventas', data: topKeys.map(k => timelineTop[k].ventas), borderColor: '#e93d3d', backgroundColor: '#e93d3d', tension: 0.4, borderWidth: 3 }
                ]
            }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // 2. Gráfico Interactivo
    window.updateDynamicChart = function() {
        const ctxDinamica = document.getElementById('chart-tendencia-dinamica');
        if(!ctxDinamica) return;
        let m1 = document.getElementById('grafico-metrica-1') ? document.getElementById('grafico-metrica-1').value : 'leads';
        let m2 = document.getElementById('grafico-metrica-2') ? document.getElementById('grafico-metrica-2').value : 'citas';
        let conf1 = METRIC_CONFIG[m1] || METRIC_CONFIG['leads']; let conf2 = METRIC_CONFIG[m2] || METRIC_CONFIG['citas'];

        if (chartTendenciaDinamica) chartTendenciaDinamica.destroy();
        chartTendenciaDinamica = new Chart(ctxDinamica, {
            type: 'line',
            data: {
                labels: topLabelsX,
                datasets: [
                    { label: conf1.label, data: topKeys.map(k => extractMetricValue(timelineTop[k], m1)), borderColor: conf1.color, backgroundColor: conf1.color, tension: 0.4, borderWidth: 3, yAxisID: 'y' },
                    { label: conf2.label, data: topKeys.map(k => extractMetricValue(timelineTop[k], m2)), borderColor: conf2.color, backgroundColor: conf2.color, tension: 0.4, borderWidth: 3, borderDash: [5, 5], yAxisID: 'y1' }
                ]
            }, 
            options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    interaction: { mode: 'index', intersect: false }, 
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    let conf = (context.datasetIndex === 0) ? conf2 : conf1; // dataset[0] es m2, dataset[1] es m1
                                    return label + formatTooltip(context.parsed.y, conf);
                                }
                            }
                        }
                    },
                    scales: { 
                        y: { type: 'linear', display: true, position: 'left', reverse: conf1.isReverse, beginAtZero: true }, 
                        y1: { type: 'linear', display: true, position: 'right', reverse: conf2.isReverse, beginAtZero: true, grid: { drawOnChartArea: false } } 
                    } 
                }
        });
    };
    window.updateDynamicChart();

    // =========================================================================
    // 3. GRÁFICOS INFERIORES (DINÁMICA: HOY vs HISTÓRICO GLOBAL SIN FILTRO FECHA)
    // =========================================================================
    const campaignSelected = document.getElementById('global-campaign-filter') ? document.getElementById('global-campaign-filter').value : 'all';
    const operatorSelected = document.getElementById('global-operator-filter') ? document.getElementById('global-operator-filter').value : 'all';
    const currentHourTz = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: globalTz, hour: 'numeric', hourCycle: 'h23' }).format(new Date()), 10);
    const pToday = new Intl.DateTimeFormat('en-US', { timeZone: globalTz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const todayStr = `${pToday.find(p=>p.type==='year').value}-${pToday.find(p=>p.type==='month').value}-${pToday.find(p=>p.type==='day').value}`;

    let botHist = {}, botHoy = {};
    for(let i=0; i<24; i++) botHoy[i] = { leads: 0, contactados: 0, llamadas: 0, citas: 0, shows: 0, ventas: 0, stlSum: 0, stlCount: 0 };

    const agruparBottom = (array, dateKeys, timeKeys, key, filterFn = null) => {
        if (!array) return;
        array.forEach(item => {
            if (campaignSelected !== 'all' && item['Campaña'] !== campaignSelected) return;
            if (operatorSelected !== 'all' && item['Operador'] !== operatorSelected) return;
            if (filterFn && !filterFn(item)) return;

            // CORRECCIÓN AQUÍ: Usamos getExactDate con los arrays de claves
            let dateObj = getExactDate(item, dateKeys, timeKeys);
            if (!dateObj) return;
            
            let y = dateObj.getFullYear(), m = String(dateObj.getMonth()+1).padStart(2,'0'), day = String(dateObj.getDate()).padStart(2,'0');
            let fechaStr = `${y}-${m}-${day}`;
            let h = dateObj.getHours();

            if (!botHist[fechaStr]) botHist[fechaStr] = { leads: 0, contactados: 0, llamadas: 0, citas: 0, shows: 0, ventas: 0, stlSum: 0, stlCount: 0 };
            
            if (key === 'stl') {
                let bMins = item['_stl_' + globalTz];
                if (bMins !== undefined && bMins !== null) {
                    botHist[fechaStr].stlSum += bMins; botHist[fechaStr].stlCount++;
                    if (fechaStr === todayStr && h >= 0 && h <= currentHourTz) { botHoy[h].stlSum += bMins; botHoy[h].stlCount++; }
                }
            } else {
                botHist[fechaStr][key]++;
                if (fechaStr === todayStr && h >= 0 && h <= currentHourTz) botHoy[h][key]++;
            }
        });
    };

    if (window.AppData && window.AppData.raw) {
        agruparBottom(window.AppData.raw.leads, ['Fecha entrada lead', 'Fecha Lead entra'], ['Hora Generado', 'Hora entrada'], 'leads');
        agruparBottom(window.AppData.raw.contactados, ['Fecha last call', 'Fecha 1er llamada', 'Fecha entrada lead'], ['Hora last call', 'Hora 1er llamada', 'Hora entrada'], 'contactados');
        agruparBottom(window.AppData.raw.llamadas, ['Fecha last call', 'Fecha 1er llamada'], ['Hora last call', 'Hora 1er llamada'], 'llamadas');
        agruparBottom(window.AppData.raw.citas, ['Cita generada'], ['Hora 1er llamada'], 'citas');
        agruparBottom(window.AppData.raw.shows, ['Fecha Visita'], ['Hora Visita'], 'shows');
        agruparBottom(window.AppData.raw.shows, ['Fecha Visita'], ['Hora Visita'], 'ventas', (item) => { const dep = (item['Deposito'] || '').toLowerCase().trim(); return dep !== '' && dep !== 'sin deposito' && dep !== 'sin depósito'; });
        agruparBottom(window.AppData.raw.contactados, ['Fecha last call', 'Fecha 1er llamada', 'Fecha entrada lead'], ['Hora last call', 'Hora 1er llamada', 'Hora entrada'], 'stl');
    }

    let histKeys = Object.keys(botHist).sort();
    if (histKeys.length > 0) {
        let firstD = new Date(histKeys[0] + 'T00:00:00'), lastD = new Date(histKeys[histKeys.length - 1] + 'T00:00:00');
        const fShort = (d) => `${String(d.getDate()).padStart(2, '0')}-${monthNames[d.getMonth()].toLowerCase()}`;
        currentDynamicLabelHist = (firstD.getTime() === lastD.getTime()) ? fShort(firstD) : `${fShort(firstD)} al ${fShort(lastD)}`;
    } else { currentDynamicLabelHist = "Sin datos"; }
    currentDynamicLabelHoy = `Hoy, ${new Intl.DateTimeFormat('es-ES', { timeZone: globalTz, day: '2-digit', month: 'short' }).format(new Date()).replace('.', '')}`;

    window.updateBottomChart = function() {
        const ctxHist = document.getElementById('chart-historico-dias');
        const ctxHoy = document.getElementById('chart-horas-hoy');
        
        let m1 = document.getElementById('grafico-dinamico-m1') ? document.getElementById('grafico-dinamico-m1').value : 'contactados';
        let m2 = document.getElementById('grafico-dinamico-m2') ? document.getElementById('grafico-dinamico-m2').value : 'stl';
        let conf1 = METRIC_CONFIG[m1] || METRIC_CONFIG['contactados']; let conf2 = METRIC_CONFIG[m2] || METRIC_CONFIG['stl'];

        if (ctxHist) {
            if (chartHistoricoDias) chartHistoricoDias.destroy();
            chartHistoricoDias = new Chart(ctxHist, {
                type: 'bar',
                data: {
                    labels: histKeys.map(f => new Date(f + 'T00:00:00').getDate().toString()),
                    datasets: [
                        { label: conf2.label, data: histKeys.map(k => extractMetricValue(botHist[k], m2)), type: 'line', borderColor: conf2.color, backgroundColor: conf2.color, borderWidth: 3, tension: 0.4, yAxisID: 'y1' },
                        { label: conf1.label, data: histKeys.map(k => extractMetricValue(botHist[k], m1)), backgroundColor: conf1.color + '66', borderColor: conf1.color, borderWidth: 1, borderRadius: 4, yAxisID: 'y' }
                    ]
                }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { type: 'linear', display: true, position: 'left', reverse: conf1.isReverse, beginAtZero: true }, y1: { type: 'linear', display: true, position: 'right', reverse: conf2.isReverse, beginAtZero: true, grid: { drawOnChartArea: false } } } }
            });
        }
        if (ctxHoy) {
            let keysHoy = Array.from({length: 24}, (_, i) => i);
            if (chartHorasHoy) chartHorasHoy.destroy();
            chartHorasHoy = new Chart(ctxHoy, {
                type: 'bar',
                data: {
                    labels: keysHoy.map(i => `${i}:00`),
                    datasets: [
                        { label: conf2.label, data: keysHoy.map(k => extractMetricValue(botHoy[k], m2)), type: 'line', borderColor: conf2.color, backgroundColor: conf2.color, borderWidth: 3, tension: 0.4, yAxisID: 'y1', spanGaps: false },
                        { label: conf1.label, data: keysHoy.map(k => extractMetricValue(botHoy[k], m1)), backgroundColor: conf1.color + '66', borderColor: conf1.color, borderWidth: 1, borderRadius: 4, yAxisID: 'y' }
                    ]
                }, 

               options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    interaction: { mode: 'index', intersect: false }, 
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    let conf = (context.datasetIndex === 0) ? conf2 : conf1; 
                                    return label + formatTooltip(context.parsed.y, conf);
                                }
                            }
                        }
                    },
                    scales: { 
                        y: { type: 'linear', display: true, position: 'left', reverse: conf1.isReverse, beginAtZero: true }, 
                        y1: { type: 'linear', display: true, position: 'right', reverse: conf2.isReverse, beginAtZero: true, grid: { drawOnChartArea: false } } 
                    } 
                }
            });
        }
        window.switchDynamicTab(activeDynamicTab);
    };
    window.updateBottomChart();

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
