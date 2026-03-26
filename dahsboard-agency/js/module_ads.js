/* ==========================================
   MÓDULO BUYING MEDIA (FINANCIAL ADS)
   ========================================== */

window.adsApp = {
    tableColumns: [],
    customColumns: [],
    currentSort: { column: 'gasto', desc: true },
    consolidatedData: [],
    totals: {},
    isInitialized: false,

    init: function() {
        this.tableColumns = [
            { id: 'campana', label: 'Campaña ↕', type: 'text', visible: true, align: 'left', color: 'var(--text-main)' },
            { id: 'gasto', label: 'Inversión ↕', type: 'currency', visible: true, align: 'right', color: 'var(--accent-danger)' },
            { id: 'clics', label: 'Clics ↕', type: 'number', visible: true, align: 'right', color: '' },
            { id: 'ctr', label: 'CTR ↕', type: 'percentage', visible: true, align: 'right', color: 'var(--text-muted)' },
            { id: 'leads', label: 'Leads ↕', type: 'number', visible: true, align: 'right', color: '' },
            { id: 'cpl', label: 'CPL ↕', type: 'currency', visible: true, align: 'right', color: 'var(--text-muted)' },
            { id: 'contactados', label: 'Contactados ↕', type: 'number', visible: true, align: 'right', color: 'var(--brand-primary)' },
            { id: 'cpq', label: 'Costo x Contacto ↕', type: 'currency', visible: true, align: 'right', color: 'var(--text-muted)' },
            { id: 'citas', label: 'Citas ↕', type: 'number', visible: true, align: 'right', color: 'var(--brand-primary)' },
            { id: 'cp_cita', label: 'Costo x Cita ↕', type: 'currency', visible: true, align: 'right', color: 'var(--text-muted)' },
            { id: 'shows', label: 'Shows ↕', type: 'number', visible: true, align: 'right', color: 'var(--accent-warning)' },
            { id: 'cp_show', label: 'Costo x Show ↕', type: 'currency', visible: true, align: 'right', color: 'var(--text-muted)' },
            { id: 'ventas', label: 'Ventas ↕', type: 'number', visible: true, align: 'right', color: 'var(--accent-success)' },
            { id: 'cpa', label: 'CPA ↕', type: 'currency', visible: true, align: 'right', color: 'var(--text-muted)' },
            { id: 'ingresos', label: 'Ingresos ↕', type: 'currency', visible: false, align: 'right', color: '#10b981' },
            { id: 'roas', label: 'ROAS ↕', type: 'roas', visible: false, align: 'right', color: '#bc13fe' }
        ];

        this.loadSettings();

        // Cierra el menú de columnas si das clic afuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#ads-col-config-container')) {
                const menu = document.getElementById('ads-col-menu');
                if(menu) menu.classList.remove('show');
            }
        });

        this.isInitialized = true;
    },

    loadSettings: function() {
        let saved = localStorage.getItem('np_ads_settings');
        if(saved) {
            try {
                let parsed = JSON.parse(saved);
                if(parsed.tableColumns) this.tableColumns = parsed.tableColumns;
                if(parsed.customColumns) this.customColumns = parsed.customColumns;
            } catch(e){}
        }
    },

    saveSettings: function() {
        localStorage.setItem('np_ads_settings', JSON.stringify({
            tableColumns: this.tableColumns,
            customColumns: this.customColumns
        }));
        alert('¡Configuración de columnas y métricas guardada con éxito!');
    },

    evaluateFormula: function(formula, row) {
        try {
            let parsed = formula.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, variable) => {
                return parseFloat(row[variable]) || 0;
            });
            let result = new Function('return ' + parsed)();
            return (isFinite(result) && !isNaN(result)) ? result : 0;
        } catch (e) { return 0; }
    },

    processData: function(dataFiltrada) {
        let stats = {};

        const init = (c) => {
            if(!c || String(c).trim() === '') c = 'Desconocida';
            if(!stats[c]) stats[c] = {
                campana: c, gasto: 0, clics: 0, impresiones: 0,
                leads: 0, contactados: 0, citas: 0, shows: 0, ventas: 0, ingresos: 0,
                isActive: false // Nuevo campo para el filtro
            };
            return c;
        };

        // Lógica para detectar si está "Activa" (Gasto entre ayer y hoy)
        let now = new Date();
        let startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();

        // 1. META ADS
        if (dataFiltrada.ads) {
            dataFiltrada.ads.forEach(ad => {
                let c = init(ad['Campaign name']);
                let amt = parseFloat(String(ad['Amount spent']||'0').replace(/[^0-9.-]+/g,""))||0;
                
                if (amt > 0) {
                    stats[c].gasto += amt;
                    stats[c].clics += parseInt(ad['Clicks (all)']||0)||0;
                    stats[c].impresiones += parseInt(ad['Impressions']||0)||0;

                    // Si la fila tiene gasto y es de ayer o hoy, la marcamos como activa
                    let rowTime = null;
                    if (ad['Day']) {
                        let p = String(ad['Day']).trim().split('-');
                        if(p.length === 3) rowTime = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2])).getTime();
                    }
                    if (rowTime && rowTime >= startOfYesterday) stats[c].isActive = true;
                }
            });
        }

        dataFiltrada.leads.forEach(r => { stats[init(r['Campaña'])].leads++; });

        let leadsContactadosSet = {};
        dataFiltrada.contactados.forEach(r => {
            let c = init(r['Campaña']);
            let num = String(r['Numero']||'').trim();
            if(num !== '') {
                if(!leadsContactadosSet[c]) leadsContactadosSet[c] = new Set();
                leadsContactadosSet[c].add(num);
            }
        });
        for(let c in leadsContactadosSet) stats[c].contactados = leadsContactadosSet[c].size;

        dataFiltrada.citas.forEach(r => { stats[init(r['Campaña'])].citas++; });
        dataFiltrada.shows.forEach(r => { stats[init(r['Campaña'])].shows++; });

        dataFiltrada.shows.filter(s => {
            const dep = (s['Deposito'] || '').toLowerCase().trim();
            return dep !== '' && dep !== 'sin deposito' && dep !== 'sin depósito';
        }).forEach(s => {
            let c = init(s['Campaña']);
            stats[c].ventas++;
            let amt = parseFloat(String(s['Monto ($)'] || s['Monto'] || s['Precio'] || '0').replace(/[^0-9.-]+/g,""));
            stats[c].ingresos += isNaN(amt) ? 0 : amt;
        });

        let arr = Object.values(stats).map(r => {
            r.cpl = r.leads > 0 ? r.gasto / r.leads : 0;
            r.cpq = r.contactados > 0 ? r.gasto / r.contactados : 0;
            r.cp_cita = r.citas > 0 ? r.gasto / r.citas : 0;
            r.cp_show = r.shows > 0 ? r.gasto / r.shows : 0;
            r.cpa = r.ventas > 0 ? r.gasto / r.ventas : 0;
            r.roas = r.gasto > 0 ? r.ingresos / r.gasto : 0;
            r.ctr = r.impresiones > 0 ? (r.clics / r.impresiones) * 100 : 0;

            this.customColumns.forEach(cc => { r[cc.id] = this.evaluateFormula(cc.formula, r); });
            return r;
        });

        this.consolidatedData = arr;
        this.applySort();
        this.renderColumnSettings();
    },

    applySort: function() {
        let col = this.currentSort.column;
        let mult = this.currentSort.desc ? -1 : 1;
        this.consolidatedData.sort((a, b) => {
            let valA = a[col] || 0, valB = b[col] || 0;
            if(typeof valA === 'string') return valA.localeCompare(valB) * mult;
            return (valA - valB) * mult;
        });
        this.renderTable();
    },

    sortTable: function(column) {
        if(this.currentSort.column === column) this.currentSort.desc = !this.currentSort.desc;
        else { this.currentSort.column = column; this.currentSort.desc = true; }
        this.applySort();
    },

    renderTable: function() {
        const thead = document.getElementById('ads-table-header-row');
        const tbody = document.getElementById('ads-table-body');
        const tfoot = document.getElementById('ads-table-foot');
        if(!thead || !tbody || !tfoot) return;
        
        thead.innerHTML = ''; tbody.innerHTML = ''; tfoot.innerHTML = '';
        let visibleCols = this.tableColumns.filter(c => c.visible);

        // 1. Obtener valores de los filtros
        let searchTerm = document.getElementById('ads-search-camp') ? document.getElementById('ads-search-camp').value.toLowerCase() : '';
        let statusFilter = document.getElementById('ads-status-filter') ? document.getElementById('ads-status-filter').value : 'active';

        // Renderizar Encabezados Draggables y Resizables
        visibleCols.forEach((col) => {
            const th = document.createElement('th');
            th.className = `draggable-header`;
            th.style.textAlign = col.align;
            // Ancho inicial para que no se aprieten
            th.style.minWidth = col.id === 'campana' ? '250px' : '130px'; 
            th.draggable = true; 
            th.innerHTML = col.label;
            
            // Div para redimensionar (arrastrar ancho)
            const resizer = document.createElement('div');
            resizer.className = 'resizer';
            th.appendChild(resizer);
            this.createResizableColumn(th, resizer);

            th.addEventListener('dragstart', (e) => this.handleDragStart(e, col.id));
            th.addEventListener('dragover', (e) => this.handleDragOver(e));
            th.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            th.addEventListener('drop', (e) => this.handleDrop(e, col.id));
            th.addEventListener('dragend', (e) => this.handleDragEnd(e));
            // Prevenir sort si se está haciendo clic en el resizer
            th.addEventListener('click', (e) => { if(!e.target.classList.contains('resizer')) this.sortTable(col.id); });
            
            thead.appendChild(th);
        });

        // 2. Aplicar Filtros a la Data
        let filteredData = this.consolidatedData.filter(row => {
            if (searchTerm && !row.campana.toLowerCase().includes(searchTerm)) return false;
            if (statusFilter === 'active' && !row.isActive) return false;
            if (statusFilter === 'inactive' && row.isActive) return false;
            return true;
        });

        let t = { gasto: 0, clics: 0, impresiones: 0, leads: 0, contactados: 0, citas: 0, shows: 0, ventas: 0, ingresos: 0 };

        filteredData.forEach(row => {
            t.gasto += row.gasto||0; t.clics += row.clics||0; t.impresiones += row.impresiones||0;
            t.leads += row.leads||0; t.contactados += row.contactados||0; t.citas += row.citas||0;
            t.shows += row.shows||0; t.ventas += row.ventas||0; t.ingresos += row.ingresos||0;

            const tr = document.createElement('tr');
            visibleCols.forEach(col => {
                const td = document.createElement('td');
                td.style.textAlign = col.align;
                if(col.color) td.style.color = col.color;
                if(col.id === 'campana') td.style.fontWeight = 'bold';
                
                let val = row[col.id] || 0;
                if (col.type === 'text') td.innerHTML = row[col.id];
                else if (col.type === 'number') td.innerHTML = val.toLocaleString(undefined, {maximumFractionDigits: 2});
                else if (col.type === 'currency') td.innerHTML = `$${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                else if (col.type === 'percentage') td.innerHTML = `${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`;
                else if (col.type === 'roas') td.innerHTML = `${val.toFixed(2)}x`;
                
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        if(filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${visibleCols.length}" style="text-align: center; padding: 20px; color: var(--text-muted);">No hay campañas que coincidan con tu búsqueda o filtro.</td></tr>`;
        } else {
            // 3. Fila de Totales en el TFOOT
            t.cpl = t.leads > 0 ? t.gasto / t.leads : 0;
            t.cpq = t.contactados > 0 ? t.gasto / t.contactados : 0;
            t.cp_cita = t.citas > 0 ? t.gasto / t.citas : 0;
            t.cp_show = t.shows > 0 ? t.gasto / t.shows : 0;
            t.cpa = t.ventas > 0 ? t.gasto / t.ventas : 0;
            t.roas = t.gasto > 0 ? t.ingresos / t.gasto : 0;
            t.ctr = t.impresiones > 0 ? (t.clics / t.impresiones) * 100 : 0;
            this.customColumns.forEach(cc => { t[cc.id] = this.evaluateFormula(cc.formula, t); });

            const trTotal = document.createElement('tr');
            
            visibleCols.forEach((col, idx) => {
                const td = document.createElement('td');
                td.style.textAlign = col.align;
                
                if (idx === 0) td.innerHTML = 'TOTAL GLOBAL FILTRADO';
                else {
                    let val = t[col.id] || 0;
                    if (col.type === 'number') td.innerHTML = val.toLocaleString(undefined, {maximumFractionDigits: 2});
                    else if (col.type === 'currency') td.innerHTML = `$${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                    else if (col.type === 'percentage') td.innerHTML = `${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`;
                    else if (col.type === 'roas') td.innerHTML = `${val.toFixed(2)}x`;
                }
                trTotal.appendChild(td);
            });
            tfoot.appendChild(trTotal);
        }

        this.updateKPIs(t);
    },

    updateKPIs: function(t) {
        document.getElementById('ads-kpi-leads').innerText = t.leads.toLocaleString();
        document.getElementById('ads-kpi-cpl').innerText = `$${t.cpl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        document.getElementById('ads-kpi-shows').innerText = t.shows.toLocaleString();
        document.getElementById('ads-kpi-cps').innerText = `$${t.cp_show.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        document.getElementById('ads-kpi-ventas').innerText = t.ventas.toLocaleString();
        document.getElementById('ads-kpi-cpa').innerText = `$${t.cpa.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        document.getElementById('ads-kpi-gasto').innerText = `$${t.gasto.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        let cpm = t.impresiones > 0 ? (t.gasto / t.impresiones) * 1000 : 0;
        document.getElementById('ads-kpi-cpm').innerText = `$${cpm.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        document.getElementById('ads-kpi-ingresos').innerText = `$${t.ingresos.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        let aov = t.ventas > 0 ? (t.ingresos / t.ventas) : 0;
        document.getElementById('ads-kpi-aov').innerText = `$${aov.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        document.getElementById('ads-kpi-roas').innerText = `${t.roas.toFixed(2)}x`;
        let profit = t.ingresos - t.gasto;
        let profitColor = profit >= 0 ? '#10b981' : 'var(--accent-danger)';
        let sign = profit >= 0 ? '+$' : '-$';
        let profitEl = document.getElementById('ads-kpi-profit');
        profitEl.innerText = `${sign}${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        profitEl.style.color = profitColor;
    },

   // Función para hacer las columnas redimensionables tipo Google Sheets
    createResizableColumn: function(col, resizer) {
        let x = 0; let w = 0;
        const mouseDownHandler = function(e) {
            x = e.clientX;
            const styles = window.getComputedStyle(col);
            w = parseInt(styles.width, 10);
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            resizer.classList.add('resizing');
            // Quitar draggable mientras se redimensiona
            col.setAttribute('draggable', false);
        };
        const mouseMoveHandler = function(e) {
            const dx = e.clientX - x;
            col.style.width = `${w + dx}px`;
            col.style.minWidth = `${w + dx}px`;
        };
        const mouseUpHandler = function() {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            resizer.classList.remove('resizing');
            col.setAttribute('draggable', true);
        };
        resizer.addEventListener('mousedown', mouseDownHandler);
    },

    updateKPIs: function(t) {
        document.getElementById('ads-kpi-leads').innerText = t.leads.toLocaleString();
        document.getElementById('ads-kpi-cpl').innerText = `$${t.cpl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        // Nueva tarjeta Contactados
        let contactadosEl = document.getElementById('ads-kpi-contactados');
        if(contactadosEl) {
            contactadosEl.innerText = t.contactados.toLocaleString();
            document.getElementById('ads-kpi-cpq').innerText = `$${t.cpq.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
        
        document.getElementById('ads-kpi-shows').innerText = t.shows.toLocaleString();
        document.getElementById('ads-kpi-cps').innerText = `$${t.cp_show.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        document.getElementById('ads-kpi-ventas').innerText = t.ventas.toLocaleString();
        document.getElementById('ads-kpi-cpa').innerText = `$${t.cpa.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        document.getElementById('ads-kpi-gasto').innerText = `$${t.gasto.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        let cpm = t.impresiones > 0 ? (t.gasto / t.impresiones) * 1000 : 0;
        document.getElementById('ads-kpi-cpm').innerText = `$${cpm.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    },
   
    // --- MANEJO DE COLUMNAS ---
    renderColumnSettings: function() {
        const container = document.getElementById('ads-col-menu');
        if(!container) return;
        container.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">Prende o apaga columnas:</div>';
        
        this.tableColumns.forEach(col => {
            const label = document.createElement('label');
            label.className = 'col-toggle-label';
            
            const cb = document.createElement('input');
            cb.type = 'checkbox'; 
            cb.checked = col.visible;
            cb.onchange = () => { col.visible = cb.checked; this.renderTable(); };
            
            label.appendChild(cb);
            label.appendChild(document.createTextNode(' ' + col.label.replace(' ↕', '')));
            container.appendChild(label);
        });
    },

    openCustomColModal: function() { document.getElementById('modal-custom-col').style.display = 'flex'; },
    insertVar: function(val) { let input = document.getElementById('custom-col-formula'); input.value += val + " "; input.focus(); },

    saveCustomCol: function() {
        let name = document.getElementById('custom-col-name').value;
        let formula = document.getElementById('custom-col-formula').value;
        let format = document.getElementById('custom-col-format').value;
        
        if(!name || !formula) { alert("Completa el nombre y la fórmula"); return; }
        
        let newId = 'cust_' + Date.now();
        this.customColumns.push({ id: newId, formula: formula });
        
        this.tableColumns.push({
            id: newId, label: name + ' ↕', type: format, visible: true, align: 'right',
            color: 'var(--accent-success)'
        });
        
        document.getElementById('custom-col-name').value = '';
        document.getElementById('custom-col-formula').value = '';
        document.getElementById('modal-custom-col').style.display = 'none';
        
        this.processData(window.AppData.lastFiltrada || window.AppData.raw); // Recalcular con la data actual
    },

    // --- EVENTOS DRAG AND DROP ---
    handleDragStart: function(e, colId) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', colId);
        e.target.style.opacity = '0.5';
    },
    handleDragOver: function(e) {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        e.target.classList.add('drag-over'); return false;
    },
    handleDragLeave: function(e) { e.target.classList.remove('drag-over'); },
    handleDrop: function(e, targetColId) {
        e.stopPropagation(); e.target.classList.remove('drag-over');
        let sourceColId = e.dataTransfer.getData('text/plain');
        if (sourceColId && sourceColId !== targetColId) {
            let srcIdx = this.tableColumns.findIndex(c => c.id === sourceColId);
            let dstIdx = this.tableColumns.findIndex(c => c.id === targetColId);
            let moved = this.tableColumns.splice(srcIdx, 1)[0];
            this.tableColumns.splice(dstIdx, 0, moved);
            this.renderTable(); this.renderColumnSettings();
        }
        return false;
    },
    handleDragEnd: function(e) {
        e.target.style.opacity = '1';
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }
};

// Conector con el Cerebro Central (`app.js`)
window.renderizarAds = function(dataFiltrada) {
    if (!window.adsApp.isInitialized) window.adsApp.init();
    window.AppData.lastFiltrada = dataFiltrada; // Guardar referencia para recalcular al crear métricas
    window.adsApp.processData(dataFiltrada);
};
