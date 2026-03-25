/* ==========================================
   MÓDULO DE PERFORMANCE (TRACKER & FUNNEL)
   ========================================== */

// Estado global para guardar la memoria de ordenamiento de las tablas
window.trackerSortState = window.trackerSortState || {
    op: { col: 'citas', asc: false },
    camp: { col: 'leads', asc: false },
    breakdown: { col: 'inv', asc: false }
};

function renderizarCallTracker(dataFiltrada) {
    const llamadas = dataFiltrada.llamadas || [];
    const contactados = dataFiltrada.contactados || [];
    const leads = dataFiltrada.leads || [];
    const citas = dataFiltrada.citas || [];
    const shows = dataFiltrada.shows || [];
    const ads = dataFiltrada.ads || [];

    // 1. MAPEO INVERSO DE OPERADORES
    const numeroAOperador = {};
    citas.forEach(c => {
        let num = String(c['Numero'] || '').trim();
        let op = (c['Operador'] || '').trim();
        if (num !== '' && op !== '') numeroAOperador[num] = op;
    });

    // 2. KPIs SUPERIORES (Calidad de Llamadas)
    let pickUpCount = 0, connectionCount = 0, effectiveCount = 0;
    llamadas.forEach(ll => {
        let duracion = parseFloat(ll['Duracion Lllamda']) || 0;
        if (duracion > 5) pickUpCount++;
        if (duracion > 15) connectionCount++;
        if (duracion > 60) effectiveCount++;
    });

    const kpiCards = document.querySelectorAll('#view-tracker .grid-cards .kpi-card');
    if (kpiCards.length >= 5) {
        const globalStlEl = document.querySelector('#kpi-container-general .kpi-card:nth-child(2) .metric-value');
        kpiCards[0].querySelector('.metric-value').innerText = globalStlEl ? globalStlEl.innerText : '0 min';
        kpiCards[1].querySelector('.metric-value').innerText = llamadas.length > 0 ? ((pickUpCount / llamadas.length) * 100).toFixed(1) + '%' : '0%';
        kpiCards[2].querySelector('.metric-value').innerText = llamadas.length > 0 ? ((connectionCount / llamadas.length) * 100).toFixed(1) + '%' : '0%';
        kpiCards[3].querySelector('.metric-value').innerText = llamadas.length > 0 ? ((effectiveCount / llamadas.length) * 100).toFixed(1) + '%' : '0%';
        kpiCards[4].querySelector('.metric-value').innerText = llamadas.length;
    }

    // 3. INICIALIZAR Y AGRUPAR DATOS (Con Escudos de Seguridad)
    const statsOp = {};
    const statsCamp = {};
    let totalClicks = 0;

    const initCamp = (c) => {
        if(!c) return; c = c.trim();
        if(!statsCamp[c]) statsCamp[c] = { name: c, inv: 0, clicks: 0, leads: 0, contactados: 0, citas: 0, shows: 0, ventas: 0, sumaStl: 0, stlCount: 0, ops: new Set() };
    };
    const initOp = (o) => {
        if(!o || o === 'Sin Asignar') return; o = o.trim();
        if(!statsOp[o]) statsOp[o] = { name: o, citas: 0, shows: 0, llamadas: 0, sumaStl: 0, stlCount: 0 };
    };

    ads.forEach(ad => {
        let c = (ad['Campaign name'] || 'Desconocida').trim(); initCamp(c);
        let spent = parseFloat(String(ad['Amount spent'] || '0').replace(/[^0-9.-]+/g, "")) || 0;
        let clk = parseInt(ad['Clicks (all)'] || 0) || 0;
        statsCamp[c].inv += spent; statsCamp[c].clicks += clk; totalClicks += clk;
    });

    leads.forEach(l => {
        let c = (l['Campaña'] || 'Desconocida').trim(); initCamp(c);
        statsCamp[c].leads++;
    });

    const globalTz = document.getElementById('global-timezone') ? document.getElementById('global-timezone').value : 'America/Mexico_City';
    const globalOffset = typeof getTzOffsetMins === 'function' ? getTzOffsetMins(globalTz) : 0;

    contactados.forEach(c => {
        let camp = (c['Campaña'] || 'Desconocida').trim(); initCamp(camp);
        let num = String(c['Numero'] || '').trim();
        let op = c['Operador'] ? c['Operador'].trim() : (numeroAOperador[num] || 'Sin Asignar');
        initOp(op);
        
        statsCamp[camp].contactados++;
        
        let leadTz = c['Zona Horaria'] || c['Zona horaria'] || globalTz;
        let tE = typeof parseDateSpanish === 'function' ? parseDateSpanish(c['Fecha entrada lead'] || c['Fecha Lead entra'], c, 'Fecha entrada lead') : null;
        let tL = typeof parseDateSpanish === 'function' ? parseDateSpanish(c['Fecha 1er llamada'], c, 'Fecha 1er llamada') : null;

        if (tE && tL) {
            let parseTime = (str) => { let p = String(str).split(':'); return { h: parseInt(p[0]||0), m: parseInt(p[1]||0), s: parseInt(p[2]||0) }; };
            let pE = parseTime(c['Hora Generado'] || c['Hora entrada']);
            let pL = parseTime(c['Hora 1er llamada']);
            
            let dE = new Date(tE); dE.setHours(pE.h, pE.m, pE.s);
            let dL = new Date(tL); dL.setHours(pL.h, pL.m, pL.s);
            
            let diffMins = globalOffset - (typeof getTzOffsetMins === 'function' ? getTzOffsetMins(leadTz) : 0);
            dE.setMinutes(dE.getMinutes() + diffMins); dL.setMinutes(dL.getMinutes() + diffMins);

            let bMins = typeof getBusinessMinutes === 'function' ? getBusinessMinutes(dE, dL) : 0;
            
            statsCamp[camp].sumaStl += bMins; statsCamp[camp].stlCount++;
            if (op !== 'Sin Asignar') { statsOp[op].sumaStl += bMins; statsOp[op].stlCount++; }
        }
    });

    citas.forEach(c => {
        let op = (c['Operador'] || 'Sin Asignar').trim(); initOp(op);
        let camp = (c['Campaña'] || 'Desconocida').trim(); initCamp(camp);
        
        if (op !== 'Sin Asignar') statsOp[op].citas++;
        statsCamp[camp].citas++; 
        if(op !== 'Sin Asignar') statsCamp[camp].ops.add(op);
    });

    llamadas.forEach(ll => {
        let num = String(ll['Numero'] || '').trim();
        let op = numeroAOperador[num] || 'Sin Asignar';
        if(op !== 'Sin Asignar') { initOp(op); statsOp[op].llamadas++; }
    });

    let totalVentas = shows.filter(s => {
        const dep = (s['Deposito'] || '').toLowerCase().trim();
        return dep !== '' && dep !== 'sin deposito' && dep !== 'sin depósito';
    }).length;

    shows.forEach(s => {
        let op = (s['Operador'] || 'Sin Asignar').trim(); initOp(op);
        let camp = (s['Campaña'] || 'Desconocida').trim(); initCamp(camp);
        if (op !== 'Sin Asignar') statsOp[op].shows++;
        statsCamp[camp].shows++;
    });

    // 4. ACTUALIZAR EMBUDO 
    const fLeads = leads.length;
    const fCitas = citas.length;
    const fShows = shows.length;
    const fVentas = totalVentas;

    document.getElementById('track-funnel-clicks').innerText = totalClicks.toLocaleString();
    document.getElementById('track-funnel-leads').innerText = fLeads.toLocaleString();
    document.getElementById('track-funnel-citas').innerText = fCitas.toLocaleString();
    document.getElementById('track-funnel-shows').innerText = fShows.toLocaleString();
    document.getElementById('track-funnel-ventas').innerText = fVentas.toLocaleString();

    document.getElementById('track-drop-1').innerText = `↳ ${totalClicks>0 ? ((fLeads/totalClicks)*100).toFixed(1) : 0}% conversión a Lead`;
    document.getElementById('track-drop-2').innerText = `↳ ${fLeads>0 ? ((fCitas/fLeads)*100).toFixed(1) : 0}% booking rate`;
    document.getElementById('track-drop-3').innerText = `↳ ${fCitas>0 ? ((fShows/fCitas)*100).toFixed(1) : 0}% asistencia`;
    document.getElementById('track-drop-4').innerText = `↳ ${fShows>0 ? ((fVentas/fShows)*100).toFixed(1) : 0}% cierre`;

    // 5. MOTOR DE ORDENAMIENTO DE TABLAS
    const sortArray = (arr, state) => {
        return arr.sort((a, b) => {
            let valA = a[state.col]; let valB = b[state.col];
            if (typeof valA === 'string') return state.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            return state.asc ? valA - valB : valB - valA;
        });
    };

    const attachSortListeners = (tableId, key) => {
        document.querySelectorAll(`#${tableId} th[data-sort]`).forEach(th => {
            th.onclick = () => {
                const col = th.getAttribute('data-sort');
                if(window.trackerSortState[key].col === col) {
                    window.trackerSortState[key].asc = !window.trackerSortState[key].asc;
                } else {
                    window.trackerSortState[key].col = col;
                    window.trackerSortState[key].asc = false;
                }
                renderizarCallTracker(dataFiltrada);
            };
        });
    };

    // 6. RENDERIZAR TABLAS RANKING
    const renderRanking = (dataRows, tbodyId, btnId, isCamp) => {
        const tbody = document.getElementById(tbodyId); const btn = document.getElementById(btnId);
        if (!tbody) return; tbody.innerHTML = '';

        if (dataRows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No hay datos suficientes</td></tr>';
            if (btn) btn.style.display = 'none'; return;
        }

        dataRows.forEach((row, index) => {
            let tr = document.createElement('tr');
            if (index >= 3) tr.style.display = 'none';
            tr.className = index >= 3 ? 'hidden-row' : '';
            let pos = index === 0 ? '🥇 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : `${index + 1}`;
            let stlMins = row.stlCount > 0 ? Math.round(row.sumaStl / row.stlCount) : 0;
            let stlTxt = stlMins < 60 ? `${stlMins} min` : `${Math.floor(stlMins/60)}h ${stlMins%60}m`;

            if (isCamp) {
                tr.innerHTML = `<td><strong>${pos}</strong></td> <td>${row.name}</td> <td>${row.leads}</td> <td><span class="text-warning">${row.leads>0?((row.contactados/row.leads)*100).toFixed(1):0}%</span></td> <td><span class="text-success">${row.citas} (${row.leads>0?((row.citas/row.leads)*100).toFixed(1):0}%)</span></td> <td>${row.stlCount>0?stlTxt:'-'}</td>`;
            } else {
                tr.innerHTML = `<td><strong>${pos}</strong></td> <td>${row.name}</td> <td><span class="text-success">${row.citas}</span></td> <td>${row.shows}</td> <td style="color: var(--text-muted);">${row.stlCount>0?stlTxt:'-'}</td> <td style="color: var(--text-muted);">${row.llamadas}</td>`;
            }
            tbody.appendChild(tr);
        });

        if (btn) {
            if (dataRows.length > 3) {
                btn.style.display = 'block'; btn.innerHTML = `Ver todos (${dataRows.length}) <i class="fa-solid fa-chevron-down"></i>`;
                let newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn);
                let expanded = false;
                newBtn.addEventListener('click', () => {
                    expanded = !expanded;
                    tbody.querySelectorAll('.hidden-row').forEach(r => r.style.display = expanded ? 'table-row' : 'none');
                    newBtn.innerHTML = expanded ? `Ver menos <i class="fa-solid fa-chevron-up"></i>` : `Ver todos (${dataRows.length}) <i class="fa-solid fa-chevron-down"></i>`;
                });
            } else { btn.style.display = 'none'; }
        }
    };

    let opRows = Object.values(statsOp).filter(r => r.citas > 0 || r.llamadas > 0);
    let campRows = Object.values(statsCamp).filter(r => r.leads > 0);
    
    opRows = sortArray(opRows, window.trackerSortState.op);
    campRows = sortArray(campRows, window.trackerSortState.camp);

    renderRanking(opRows, 'tracker-op-table', 'btn-toggle-op', false);
    renderRanking(campRows, 'tracker-camp-table', 'btn-toggle-camp', true);
    
    attachSortListeners('tracker-op-table', 'op');
    attachSortListeners('tracker-camp-table', 'camp');

    // 7. RENDERIZAR TABLA DE DESGLOSE
    const breakTbody = document.querySelector('#tracker-breakdown-table tbody');
    if(breakTbody) {
        breakTbody.innerHTML = '';
        let bRows = Object.values(statsCamp).filter(r => r.inv > 0 || r.leads > 0 || r.citas > 0);
        bRows.forEach(r => r.opsList = Array.from(r.ops).join(', ') || '-');
        
        bRows = sortArray(bRows, window.trackerSortState.breakdown);

        if (bRows.length === 0) {
            breakTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Sin actividad en este rango</td></tr>';
        } else {
            bRows.forEach(r => {
                breakTbody.innerHTML += `
                    <tr>
                        <td><strong>${r.name}</strong></td>
                        <td style="color: var(--text-muted); font-size: 0.85rem;">${r.opsList}</td>
                        <td style="color: var(--accent-danger);">$${r.inv.toFixed(2)}</td>
                        <td>${r.leads}</td>
                        <td><span class="text-warning">${r.contactados}</span></td>
                        <td><strong class="text-success">${r.citas}</strong></td>
                        <td>${r.shows}</td>
                    </tr>
                `;
            });
        }
        attachSortListeners('tracker-breakdown-table', 'breakdown');
    }
}
