/* ==========================================
   MÓDULO DE PERFORMANCE (TRACKER & FUNNEL)
   ========================================== */

window.trackerSortState = window.trackerSortState || {
    op: { col: 'citas', asc: false },
    camp: { col: 'leads', asc: false },
    breakdown: { col: 'inv', asc: false }
};

const TICKET_PROMEDIO_TRACKER = 500;

// --- GESTIÓN DE CONFIGURACIÓN DINÁMICA ---
const getTrackerSettings = () => {
    return JSON.parse(localStorage.getItem('np_tracker_sec')) || { pickup: 5, conn: 15, eff: 60 };
};

window.abrirModalTracker = function() {
    const s = getTrackerSettings();
    document.getElementById('track-sec-pickup').value = s.pickup;
    document.getElementById('track-sec-conn').value = s.conn;
    document.getElementById('track-sec-eff').value = s.eff;
    document.getElementById('modal-tracker-settings').style.display = 'flex';
};

window.guardarTrackerSettings = function() {
    const pickup = parseInt(document.getElementById('track-sec-pickup').value) || 5;
    const conn = parseInt(document.getElementById('track-sec-conn').value) || 15;
    const eff = parseInt(document.getElementById('track-sec-eff').value) || 60;
    
    localStorage.setItem('np_tracker_sec', JSON.stringify({ pickup, conn, eff }));
    document.getElementById('modal-tracker-settings').style.display = 'none';
    
    if (typeof procesarYRenderizar === 'function') procesarYRenderizar();
};
// -----------------------------------------

function renderizarCallTracker(dataFiltrada) {
    // TRACKER: Usamos la data "Raw" porque evaluamos acciones/esfuerzo, no personas únicas.
    const llamadas = dataFiltrada.llamadasRaw || []; 
    const contactados = dataFiltrada.marcasDeLlamadaRaw || [];
    const leads = dataFiltrada.leads || [];
    const citas = dataFiltrada.citas || [];
    const shows = dataFiltrada.shows || [];
    const ads = dataFiltrada.ads || [];

    const numeroAOperador = {};
    citas.forEach(c => {
        let num = String(c['Numero'] || '').trim();
        let op = (c['Operador'] || '').trim();
        if (num !== '' && op !== '') numeroAOperador[num] = op;
    });

    // 2. KPIs SUPERIORES (Calidad de Llamadas) DINÁMICOS
    let settings = getTrackerSettings();
    let totalLlamadasEmitidas = contactados.length;
    
    let pickUpCount = 0, connectionCount = 0, effectiveCount = 0;
    llamadas.forEach(ll => {
        // Extraemos solo el número, por si el Excel dice "60 seg" en vez de "60"
        let rawVal = String(ll['Duracion Llamada'] || ll['Duracion Lllamda'] || ll['Duración'] || '0');
        let duracion = parseFloat(rawVal.replace(/[^0-9.]/g, '')) || 0;
        
        if (duracion >= settings.pickup) pickUpCount++;
        if (duracion >= settings.conn) connectionCount++;
        if (duracion >= settings.eff) effectiveCount++;
    });

    const kpiCards = document.querySelectorAll('#view-tracker .grid-cards .kpi-card');
    if (kpiCards.length >= 5) {
        const globalStlEl = document.querySelector('#kpi-container-general .kpi-card:nth-child(2) .metric-value');
        kpiCards[0].querySelector('.metric-value').innerText = globalStlEl ? globalStlEl.innerText : '0 min';
        
        let pPick = totalLlamadasEmitidas > 0 ? (pickUpCount / totalLlamadasEmitidas) * 100 : 0;
        let pConn = totalLlamadasEmitidas > 0 ? (connectionCount / totalLlamadasEmitidas) * 100 : 0;
        let pEff = totalLlamadasEmitidas > 0 ? (effectiveCount / totalLlamadasEmitidas) * 100 : 0;

        kpiCards[1].querySelector('.metric-value').innerText = pPick.toFixed(1) + '%';
        kpiCards[2].querySelector('.metric-value').innerText = pConn.toFixed(1) + '%';
        kpiCards[3].querySelector('.metric-value').innerText = pEff.toFixed(1) + '%';
        kpiCards[4].querySelector('.metric-value').innerText = totalLlamadasEmitidas;

        // Actualizamos los subtítulos visuales
        const lPick = document.getElementById('track-lbl-pickup'); if(lPick) lPick.innerText = `Mínimo ${settings.pickup} seg`;
        const lConn = document.getElementById('track-lbl-conn'); if(lConn) lConn.innerText = `Mínimo ${settings.conn} seg`;
        const lEff = document.getElementById('track-lbl-eff'); if(lEff) lEff.innerText = `Mínimo ${settings.eff} seg`;

        // Actualizamos el texto de los Tooltips
        const ttPick = document.getElementById('track-tt-pickup'); if(ttPick) ttPick.innerText = `Porcentaje de llamadas emitidas que fueron contestadas por el prospecto y duraron más de ${settings.pickup} segundos.`;
        const ttConn = document.getElementById('track-tt-conn'); if(ttConn) ttConn.innerText = `Porcentaje de llamadas donde se logró retener al prospecto en línea por más de ${settings.conn} segundos.`;
        const ttEff = document.getElementById('track-tt-eff'); if(ttEff) ttEff.innerText = `Porcentaje de llamadas que se convirtieron en una conversación real, superando la barrera de los ${settings.eff} segundos.`;
    }

    const statsOp = {};
    const statsCamp = {};
    let totalClicks = 0;

    const initCamp = (c) => {
        if(!c) return; c = c.trim();
        if(!statsCamp[c]) statsCamp[c] = { name: c, inv: 0, clicks: 0, leads: 0, contactadosSet: new Set(), citas: 0, shows: 0, ventas: 0, stlMap: {}, ops: new Set(), llamadas: 0 };
    };
    const initOp = (o) => {
        if(!o || o === 'Sin Asignar') return; o = o.trim();
        if(!statsOp[o]) statsOp[o] = { name: o, citas: 0, shows: 0, llamadas: 0, stlMap: {} };
    };

    ads.forEach(ad => {
        let c = (ad['OfficialCampaign'] || ad['Campaign name'] || 'Desconocida').trim(); initCamp(c);
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

    // Procesar emisiones y recuperar STL de la memoria caché
    contactados.forEach(c => {
        let camp = (c['Campaña'] || 'Desconocida').trim(); initCamp(camp);
        let num = String(c['Numero'] || '').trim(); 
        let op = c['Operador'] ? c['Operador'].trim() : (numeroAOperador[num] || 'Sin Asignar');
        initOp(op);
        
        statsCamp[camp].llamadas++;
        if (num !== '') statsCamp[camp].contactadosSet.add(num);
        if (op !== 'Sin Asignar') statsOp[op].llamadas++;
        
        if (num !== '') {
            let bMins = c['_stl_' + globalTz]; // Tomamos el valor de la memoria
            if (bMins !== undefined && bMins !== null) {
                if (statsCamp[camp].stlMap[num] === undefined || bMins < statsCamp[camp].stlMap[num]) statsCamp[camp].stlMap[num] = bMins;
                if (op !== 'Sin Asignar') {
                    if (statsOp[op].stlMap[num] === undefined || bMins < statsOp[op].stlMap[num]) statsOp[op].stlMap[num] = bMins;
                }
            }
        }
    });

    // Inyectar sumas finales a los objetos de ranking
    for (let camp in statsCamp) {
        statsCamp[camp].sumaStl = Object.values(statsCamp[camp].stlMap).reduce((a,b)=>a+b, 0);
        statsCamp[camp].stlCount = Object.keys(statsCamp[camp].stlMap).length;
    }
    for (let op in statsOp) {
        statsOp[op].sumaStl = Object.values(statsOp[op].stlMap).reduce((a,b)=>a+b, 0);
        statsOp[op].stlCount = Object.keys(statsOp[op].stlMap).length;
    }

    citas.forEach(c => {
        let op = (c['Operador'] || 'Sin Asignar').trim(); initOp(op);
        let camp = (c['Campaña'] || 'Desconocida').trim(); initCamp(camp);
        
        if (op !== 'Sin Asignar') statsOp[op].citas++;
        statsCamp[camp].citas++; 
        if(op !== 'Sin Asignar') statsCamp[camp].ops.add(op);
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

    // 4. ACTUALIZAR EMBUDO (Alineado con métricas reales: Leads -> Contactados -> Citas -> Shows -> Ventas)
    const fLeads = leads.length;
    // Utilizamos un Set temporal para contar los Contactados Únicos globalmente en esta vista
    const uniqueContactadosSet = new Set();
    contactados.forEach(c => {
        let num = String(c['Numero'] || '').trim();
        if (num !== '') uniqueContactadosSet.add(num);
    });
    const fContactados = uniqueContactadosSet.size;
    const fCitas = citas.length;
    const fShows = shows.length;
    const fVentas = totalVentas;

    // Actualizar los números grandes en el HTML
    // Nota: Como vamos a reemplazar 'Clics' por 'Leads' en el HTML, usaremos los IDs existentes para no romper el HTML por ahora, 
    // pero inyectaremos los datos correctos en el orden del nuevo embudo.
    const elPaso1 = document.getElementById('track-funnel-clicks'); // Ahora será Leads
    const elPaso2 = document.getElementById('track-funnel-leads');  // Ahora será Contactados
    const elPaso3 = document.getElementById('track-funnel-citas');  // Se mantiene como Citas
    const elPaso4 = document.getElementById('track-funnel-shows');  // Se mantiene como Shows
    const elPaso5 = document.getElementById('track-funnel-ventas'); // Se mantiene como Ventas

    if (elPaso1) {
        elPaso1.innerText = fLeads.toLocaleString();
        // Cambiar dinámicamente el título en el HTML anterior
        const prevTitle = elPaso1.previousElementSibling;
        if (prevTitle && prevTitle.innerText.includes('Clics')) prevTitle.innerText = '1. Leads Generados';
    }
    
    if (elPaso2) {
        elPaso2.innerText = fContactados.toLocaleString();
        const prevTitle = elPaso2.previousElementSibling;
        if (prevTitle && prevTitle.innerText.includes('Leads')) prevTitle.innerText = '2. Leads Contactados';
    }

    if (elPaso3) {
        elPaso3.innerText = fCitas.toLocaleString();
        const prevTitle = elPaso3.previousElementSibling;
        if (prevTitle) prevTitle.innerText = '3. Citas Agendadas';
    }
    
    if (elPaso4) {
        elPaso4.innerText = fShows.toLocaleString();
        const prevTitle = elPaso4.previousElementSibling;
        if (prevTitle) prevTitle.innerText = '4. Asistencias (Shows)';
    }

    if (elPaso5) {
        elPaso5.innerText = fVentas.toLocaleString();
        const prevTitle = elPaso5.previousElementSibling;
        if (prevTitle) prevTitle.innerText = '5. Ventas Cerradas';
    }

    // Actualizar los porcentajes de caída (Drop Rates)
    const drop1 = document.getElementById('track-drop-1');
    const drop2 = document.getElementById('track-drop-2');
    const drop3 = document.getElementById('track-drop-3');
    const drop4 = document.getElementById('track-drop-4');

    if(drop1) drop1.innerText = `↳ ${fLeads > 0 ? ((fContactados / fLeads) * 100).toFixed(1) : 0}% Contact Rate`;
    if(drop2) drop2.innerText = `↳ ${fLeads > 0 ? ((fCitas / fLeads) * 100).toFixed(1) : 0}% Booking Rate`; // Se calcula en base a leads (estándar de la industria)
    if(drop3) drop3.innerText = `↳ ${fCitas > 0 ? ((fShows / fCitas) * 100).toFixed(1) : 0}% Show Rate`;
    if(drop4) drop4.innerText = `↳ ${fShows > 0 ? ((fVentas / fShows) * 100).toFixed(1) : 0}% Win Rate`;

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
                if(window.trackerSortState[key].col === col) { window.trackerSortState[key].asc = !window.trackerSortState[key].asc; } 
                else { window.trackerSortState[key].col = col; window.trackerSortState[key].asc = false; }
                renderizarCallTracker(dataFiltrada);
            };
        });
    };

    const renderRanking = (dataRows, tableId, btnId, isCamp) => {
        // 1. Buscamos la tabla completa
        const table = document.getElementById(tableId);
        if (!table) return;
        
        // 2. Buscamos SOLO el cuerpo de la tabla (tbody) para proteger los encabezados (thead)
        const tbody = table.querySelector('tbody');
        const btn = document.getElementById(btnId);
        if (!tbody) return; 
        
        // 3. Limpiamos solo los datos antiguos, el encabezado queda intacto
        tbody.innerHTML = ''; 

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
                let uniqCont = row.contactadosSet.size;
                tr.innerHTML = `<td><strong>${pos}</strong></td> <td>${row.name}</td> <td>${row.leads}</td> <td><span class="text-warning">${row.leads>0?((uniqCont/row.leads)*100).toFixed(1):0}%</span></td> <td><span class="text-success">${row.citas} (${row.leads>0?((row.citas/row.leads)*100).toFixed(1):0}%)</span></td> <td>${row.stlCount>0?stlTxt:'-'}</td>`;
            } else {
                // Solo inyectamos 4 columnas: Posición, Nombre, Citas y Shows
                tr.innerHTML = `<td><strong>${pos}</strong></td> <td>${row.name}</td> <td><span class="text-success">${row.citas}</span></td> <td>${row.shows}</td>`;
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

    const breakTbody = document.querySelector('#tracker-breakdown-table tbody');
    if(breakTbody) {
        breakTbody.innerHTML = '';
        let bRows = Object.values(statsCamp).filter(r => r.inv > 0 || r.leads > 0 || r.citas > 0);
        bRows.forEach(r => {
            r.opsList = Array.from(r.ops).join(', ') || '-';
            r.contactados = r.contactadosSet.size; 
        });
        
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
