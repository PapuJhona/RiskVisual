// --- BASE DE DATOS FAKE PARA DEMO (O CONECTAR CON DB-MANAGER) ---
const companyData = (typeof getCompanyData === 'function') ? getCompanyData() : null; 
let systemData = (companyData && companyData.astData) ? companyData.astData : [];

// Opciones guardadas en LocalStorage
let optionsDB = JSON.parse(localStorage.getItem('sgsOptions')) || {
    positions: ["Operario", "Supervisor", "TÃ©cnico", "Ayudante", "Conductor"],
    ppes: ["Casco", "Lentes", "Zapatos", "Guantes", "Tapones", "Respirador", "ArnÃ©s", "Chaleco", "Ninguno"]
};

// --- VARIABLES ESTADO ---
let currentLevel = 'processes'; 
let currentProcessId = null;
let currentTaskId = null;
let currentRiskIndex = null;

let isEditing = false;
let editingId = null;
let editingIndex = null;
let tempEPPList = [];

// Variable para guardar instancias de grÃ¡ficos y poder borrarlos
let activeCharts = [];

// --- INICIALIZACIÃ“N ---
document.addEventListener('DOMContentLoaded', () => {
    applyPermissionsAST();
    
    // Recuperar estado al recargar pÃ¡gina (F5)
    const navEntry = performance.getEntriesByType("navigation")[0];
    if (navEntry && navEntry.type === 'reload') {
        const savedState = JSON.parse(localStorage.getItem('sgsAppState'));
        if (savedState) {
            currentLevel = savedState.level;
            currentProcessId = savedState.processId;
            currentTaskId = savedState.taskId;
            currentRiskIndex = savedState.riskIndex;
            window.history.replaceState(savedState, '', '');
        }
    } else {
        localStorage.removeItem('sgsAppState');
    }
    
    // Manejo del botÃ³n AtrÃ¡s del navegador
    window.onpopstate = function(event) {
        if (event.state) {
            currentLevel = event.state.level;
            currentProcessId = event.state.processId;
            currentTaskId = event.state.taskId;
            currentRiskIndex = event.state.riskIndex;
            renderView(false); 
        } else {
            currentLevel = 'processes';
            renderView(false);
        }
    };

    renderView(false);
    updateSummary();
});

// --- RENDERIZADO PRINCIPAL ---
function renderView(pushToHistory = false) {
    // Limpiar grÃ¡ficos anteriores para que no se superpongan
    activeCharts.forEach(chart => chart.destroy());
    activeCharts = [];

    if(pushToHistory) {
        const state = { level: currentLevel, processId: currentProcessId, taskId: currentTaskId, riskIndex: currentRiskIndex };
        localStorage.setItem('sgsAppState', JSON.stringify(state));
        window.history.pushState(state, '', '');
    }

    const mainArea = document.getElementById('main-area');
    const dynamicActions = document.getElementById('dynamic-actions');
    const btnBack = document.getElementById('btn-back');
    const pageTitle = document.getElementById('page-title');
    
    mainArea.classList.remove('fade-in'); void mainArea.offsetWidth; mainArea.classList.add('fade-in');
    mainArea.innerHTML = '';
    mainArea.className = 'content-grid fade-in';

    dynamicActions.innerHTML = `<button id="btn-add" class="btn btn-highlight" onclick="openAddModal()"><i class="fa-solid fa-plus-circle"></i> <span id="btn-add-text">NUEVO</span></button>`;
    applyPermissionsAST();

    // VISTA 1: PROCESOS
    if (currentLevel === 'processes') {
        pageTitle.style.display = 'block';
        pageTitle.innerText = 'Procesos de la Empresa';
        document.getElementById('page-subtitle').innerText = 'GestiÃ³n macro de las Ã¡reas operativas.';
        document.getElementById('btn-add-text').innerText = 'NUEVO PROCESO';
        document.getElementById('breadcrumb').innerText = 'Vista General';
        btnBack.style.display = 'none';

        if (systemData.length === 0) mainArea.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999;">No hay procesos.</div>`;

        systemData.forEach(proc => {
            const card = document.createElement('div'); card.className = 'card';
            card.onclick = (e) => { if(!e.target.closest('button')) enterProcess(proc.id); };
            card.innerHTML = `
                <div class="card-header-row"><h3><i class="fa-solid fa-industry"></i> ${proc.name}</h3><div class="action-group"><button onclick="openEditModal('process', ${proc.id})" class="btn-icon btn-edit"><i class="fa-solid fa-pen"></i></button><button onclick="deleteProcess(${proc.id})" class="btn-icon btn-delete"><i class="fa-solid fa-trash"></i></button></div></div>
                <div class="attributes-list"><div class="attribute-pill"><i class="fa-solid fa-list-check"></i> <strong>${proc.tasks.length}</strong> Tareas registradas</div></div>`;
            mainArea.appendChild(card);
        });

    // VISTA 2: TAREAS (AQUÃ ESTÃ LA MAGIA DEL MAPA)
    } else if (currentLevel === 'tasks') {
        const process = systemData.find(p => p.id === currentProcessId);
        if(!process) { goHome(); return; }

        // --- LÃ“GICA DEL BOTÃ“N DE MAPA ---
        const session = JSON.parse(localStorage.getItem('SGS_CURRENT_SESSION'));
        const isEditor = (session && session.role === 'editor');
        
        let mapButtonHtml = '';

        // Input oculto para subir archivo
        // IMPORTANTE: id="upload-map-input" debe coincidir con la funciÃ³n triggerMapUpload
        const fileInputHtml = `<input type="file" id="upload-map-input" accept="image/*,application/pdf" style="display:none" onchange="handleMapUpload(this)">`;

        if (process.processMap) {
            // SI YA TIENE MAPA: BotÃ³n Ver + BotÃ³n Borrar (solo editor)
            mapButtonHtml = `
                <button class="btn-title-action btn-map-view" onclick="openProcessMap()">
                    <i class="fa-solid fa-eye"></i> VER MAPA
                </button>
            `;
            if (isEditor) {
                mapButtonHtml += `
                    <button class="btn-title-action btn-map-delete" onclick="deleteProcessMap()" title="Borrar Mapa">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
            }
        } else {
            // SI NO TIENE MAPA: BotÃ³n Subir (solo editor)
            if (isEditor) {
                mapButtonHtml = `
                    <button class="btn-title-action btn-map-upload" onclick="triggerMapUpload()">
                        <i class="fa-solid fa-cloud-arrow-up"></i> SUBIR MAPA
                    </button>
                    ${fileInputHtml} 
                `;
            } else {
                mapButtonHtml = `<span style="font-size:0.8rem; color:#999; margin-left:10px; font-weight:normal;">(Sin mapa de proceso)</span>`;
            }
        }

        pageTitle.style.display = 'flex';
        pageTitle.style.alignItems = 'center';
        pageTitle.style.flexWrap = 'wrap'; 
        
        // Inyectamos los botones
        pageTitle.innerHTML = `
            Tareas: ${process.name} 
            <div class="title-actions">
                ${mapButtonHtml}
                <button class="btn-title-action btn-ast" onclick="openPdfModal()">
                    <i class="fa-solid fa-file-pdf"></i> MATRIZ AST
                </button>
            </div>
        `;
        
        document.getElementById('page-subtitle').innerText = 'GestiÃ³n de actividades operativas.';
        document.getElementById('btn-add-text').innerText = 'NUEVA TAREA';
        document.getElementById('breadcrumb').innerText = `${process.name} > Tareas`;
        btnBack.style.display = 'flex'; 

        if (process.tasks.length === 0) mainArea.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999;">No hay tareas.</div>`;

        process.tasks.forEach(task => {
            const card = document.createElement('div'); card.className = 'card'; card.style.borderTopColor = '#27ae60';
            card.onclick = (e) => { if(!e.target.closest('button')) enterTask(task.id); };
            card.innerHTML = `
                <div class="card-header-row"><h3><i class="fa-solid fa-clipboard-list"></i> ${task.name}</h3><div class="action-group"><button onclick="openEditModal('task', ${task.id})" class="btn-icon btn-edit"><i class="fa-solid fa-pen"></i></button><button onclick="deleteTask(${task.id})" class="btn-icon btn-delete"><i class="fa-solid fa-trash"></i></button></div></div>
                <div class="attributes-list"><div class="attribute-pill"><i class="fa-solid fa-user-gear"></i> <strong>Perfil:</strong> ${task.personnel||'-'}</div><div class="attribute-pill" style="color:${task.risks.length>0?'#c0392b':'#777'}"><i class="fa-solid fa-bolt"></i> <strong>${task.risks.length}</strong> Riesgos</div></div>`;
            mainArea.appendChild(card);
        });

    // VISTA 3: DETALLES (RIESGOS + DASHBOARD)
    } else if (currentLevel === 'details') {
        const process = systemData.find(p => p.id === currentProcessId);
        const task = process.tasks.find(t => t.id === currentTaskId);
        
        pageTitle.style.display = 'block'; 
        pageTitle.innerText = `Panel de Riesgos`;
        document.getElementById('page-subtitle').innerText = `EvaluaciÃ³n para: ${task.name}`;
        document.getElementById('btn-add-text').innerText = 'AGREGAR RIESGO';
        document.getElementById('breadcrumb').innerText = `${task.name} > Riesgos`;
        btnBack.style.display = 'flex';

        mainArea.className = 'fade-in'; 
        const container = document.createElement('div');
        container.className = 'risks-view-container';

        // LISTADO
        const leftCol = document.createElement('div');
        leftCol.className = 'risks-list-column';

        const infoCard = document.createElement('div'); infoCard.className = 'task-tech-card';
        let ppeHtml = (task.ppeList && task.ppeList.length > 0) ? task.ppeList.map(e=>`<span class="tag" style="border:1px solid #27ae60; color:#27ae60;">${e}</span>`).join(' ') : '<span style="color:#999">Ninguno</span>';
        infoCard.innerHTML = `<div class="tech-header-row"><div class="tech-title-block"><h4>Ficha TÃ©cnica de Tarea</h4><h2 class="tech-task-name">${task.name}</h2></div><button onclick="openEditModal('task', ${task.id})" class="btn-icon btn-edit"><i class="fa-solid fa-pen"></i></button></div><div class="tech-grid"><div class="tech-item"><label>Tipo</label><span>${task.type}</span></div><div class="tech-item"><label>Puesto</label><span>${task.personnel}</span></div><div class="tech-item"><label>EPPs Requeridos</label><div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:5px;">${ppeHtml}</div></div></div>`;
        leftCol.appendChild(infoCard);

        const separator = document.createElement('div'); separator.className = 'section-separator'; separator.innerHTML = '<i class="fa-solid fa-list-ul"></i> IdentificaciÃ³n de Riesgos';
        leftCol.appendChild(separator);

        if (task.risks.length === 0) {
            leftCol.innerHTML += `<div style="text-align:center; padding:50px; color:#999; background:white; border-radius:10px;">No hay riesgos identificados.</div>`;
        } else {
            task.risks.forEach((risk, index) => {
                let controlsHtml = risk.controls && risk.controls.length > 0 ? risk.controls.map(c => `<div class="simple-control-item"><i class="fa-solid fa-check-circle" style="color:#27ae60;"></i> ${c.description}</div>`).join('') : '<p style="color:#999; font-style:italic;">Sin controles.</p>';
                const card = document.createElement('div'); card.className = 'risk-card';
                card.onclick = (e) => { if(!e.target.closest('button')) enterRisk(index); };
                card.innerHTML = `
                    <div class="risk-status-bar ${getRiskColorClass(risk.severity)}"></div><div class="risk-content-main">
                    <div class="risk-header-row"><div class="risk-title"><i class="fa-solid fa-bolt" style="color:#c0392b"></i> ${risk.name}</div><div class="action-group"><button onclick="openEditModal('risk', null, ${index})" class="btn-icon btn-edit"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRisk(${index})" class="btn-icon btn-delete"><i class="fa-solid fa-trash"></i></button></div></div>
                    <div class="risk-attributes-row"><div class="text-detail"><strong>SEVERIDAD:</strong> ${risk.severity}</div><div class="separator-line"></div><div class="text-detail"><strong>FRECUENCIA:</strong> ${risk.frequency}</div></div>
                    <div class="controls-preview-simple"><div class="controls-label">Medidas de Control:</div>${controlsHtml}</div><div class="click-hint">Clic para gestionar controles &rarr;</div></div>`;
                leftCol.appendChild(card);
            });
        }

        // GRÃFICOS
        const rightCol = document.createElement('div');
        rightCol.className = 'risks-dashboard-column';
        
        if(task.risks.length > 0) {
            rightCol.innerHTML = `
                <div class="chart-card">
                    <div class="dashboard-title">Frecuencia</div>
                    <div class="chart-wrapper"><canvas id="chartFrequency"></canvas></div>
                </div>
                <div class="chart-card">
                    <div class="dashboard-title">Severidad</div>
                    <div class="chart-wrapper"><canvas id="chartSeverity"></canvas></div>
                </div>
                <div class="chart-card">
                    <div class="dashboard-title">Tolerancia</div>
                    <div class="chart-wrapper"><canvas id="chartTolerance"></canvas></div>
                </div>
            `;
        } else {
            rightCol.innerHTML = `<div class="chart-card"><div class="dashboard-title">Resumen</div><p style="text-align:center; color:#999; font-size:0.9rem;">Agrega riesgos para ver datos.</p></div>`;
        }

        container.appendChild(leftCol);
        container.appendChild(rightCol);
        mainArea.appendChild(container);

        if(task.risks.length > 0) renderRiskCharts(task.risks);

    // VISTA 4: CONTROLES
    } else if (currentLevel === 'controls') {
        const process = systemData.find(p => p.id === currentProcessId);
        const task = process.tasks.find(t => t.id === currentTaskId);
        const risk = task.risks[currentRiskIndex];
        if(!risk.controls) risk.controls = [];

        pageTitle.style.display = 'block';
        pageTitle.innerText = `Controles para: ${risk.name}`;
        document.getElementById('page-subtitle').innerText = 'GestiÃ³n de medidas preventivas, detectivas y correctivas.';
        document.getElementById('btn-add-text').innerText = 'AGREGAR CONTROL';
        document.getElementById('breadcrumb').innerText = `Riesgos > Controles`;
        btnBack.style.display = 'flex';

        if (risk.controls.length === 0) mainArea.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999;">Este riesgo no tiene controles. Agrega uno.</div>`;

        risk.controls.forEach((ctrl, index) => {
            const q = calculateControlQuality(ctrl);
            const badge = getBadge(q);
            let borderColor = '#ccc';
            if(badge.cls === 'q-bad') borderColor = '#e74c3c';
            if(badge.cls === 'q-medium') borderColor = '#f39c12';
            if(badge.cls === 'q-good') borderColor = '#3498db';
            if(badge.cls === 'q-excellent') borderColor = '#27ae60';

            const card = document.createElement('div'); card.className = 'control-card';
            card.innerHTML = `
                <div class="control-status-bar" style="background-color:${borderColor}"></div><div class="control-content"><div class="control-header"><div class="control-desc">${ctrl.description}</div><div class="action-group"><button onclick="openEditModal('control', null, ${index})" class="btn-icon btn-edit"><i class="fa-solid fa-pen"></i></button><button onclick="deleteControl(${index})" class="btn-icon btn-delete"><i class="fa-solid fa-trash"></i></button></div></div><div class="control-details-row"><div class="control-detail-item"><strong>TIPO:</strong> ${ctrl.type}</div><div class="separator-line"></div><div class="control-detail-item"><strong>DOCUMENTADO:</strong> ${ctrl.doc}</div><div class="separator-line"></div><div class="control-detail-item"><strong>EVIDENCIA:</strong> ${ctrl.evidence}</div><div class="separator-line"></div><div class="control-detail-item"><strong>FRECUENCIA:</strong> ${ctrl.freqDefined}</div><div class="quality-badge-container"><span class="mini-badge ${badge.cls}">${badge.text}</span></div></div></div>`;
            mainArea.appendChild(card);
        });
    }
    updateSummary();
}

// --- LÃ“GICA DE GRÃFICOS (CORREGIDA) ---
function renderRiskCharts(risks) {
    const totalRisks = risks.length;
    if (totalRisks === 0) return;

    const catsFreq = ['Improbable', 'Ocasional', 'Probable', 'Posible'];
    const catsSev = ['Bajo', 'Medio', 'Alto', 'Muy Alto'];
    const catsTol = ['BAJO', 'MEDIO', 'ALTO', 'CRÃTICO'];
    const unifiedColors = ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c']; 

    const getChartData = (categories, riskProperty, isTolerance = false) => {
        return categories.map(cat => {
            if (isTolerance) {
                return risks.filter(r => calculateTolerance(r.severity, r.frequency).text === cat).length;
            } else {
                return risks.filter(r => r[riskProperty] === cat).length;
            }
        });
    };

    const centerTextPlugin = {
        id: 'centerTotal',
        beforeDraw: function(chart) {
            if (chart.config.type !== 'doughnut') return;
            const { ctx } = chart;
            const { top, bottom, left, right, height } = chart.chartArea;
            ctx.restore();
            const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const fontSizeNum = (height / 110).toFixed(2); 
            ctx.font = "bold " + fontSizeNum + "em 'Segoe UI', sans-serif";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillStyle = "#002060";
            const textX = (left + right) / 2;
            const textY = (top + bottom) / 2;
            ctx.fillText(total.toString(), textX, textY - (height * 0.02)); 
            ctx.font = "bold " + (fontSizeNum * 0.4) + "em 'Segoe UI', sans-serif";
            ctx.fillStyle = "#888"; 
            ctx.fillText("Total", textX, textY + (height * 0.12));
            ctx.save();
        }
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
            legend: {
                position: 'right',
                labels: { boxWidth: 12, font: { size: 11, family: "'Segoe UI', sans-serif" }, color: '#555' }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        let value = context.raw || 0;
                        let percentage = ((value / totalRisks) * 100).toFixed(1) + '%';
                        return ` ${label}: ${percentage} (${value})`;
                    }
                },
                backgroundColor: 'rgba(0, 32, 96, 0.9)',
                padding: 10
            }
        }
    };

    if(document.getElementById('chartFrequency')) {
        activeCharts.push(new Chart(document.getElementById('chartFrequency').getContext('2d'), {
            type: 'doughnut',
            data: { labels: catsFreq, datasets: [{ data: getChartData(catsFreq, 'frequency'), backgroundColor: unifiedColors, borderWidth: 2, borderColor: '#ffffff' }] },
            options: commonOptions,
            plugins: [centerTextPlugin]
        }));
    }

    if(document.getElementById('chartSeverity')) {
        activeCharts.push(new Chart(document.getElementById('chartSeverity').getContext('2d'), {
            type: 'doughnut',
            data: { labels: catsSev, datasets: [{ data: getChartData(catsSev, 'severity'), backgroundColor: unifiedColors, borderWidth: 2, borderColor: '#ffffff' }] },
            options: commonOptions,
            plugins: [centerTextPlugin]
        }));
    }

    if(document.getElementById('chartTolerance')) {
        activeCharts.push(new Chart(document.getElementById('chartTolerance').getContext('2d'), {
            type: 'doughnut',
            data: { labels: catsTol, datasets: [{ data: getChartData(catsTol, null, true), backgroundColor: unifiedColors, borderWidth: 2, borderColor: '#ffffff' }] },
            options: commonOptions,
            plugins: [centerTextPlugin]
        }));
    }
}

// --- FUNCIONES PARA SUBIDA DE MAPA (NUEVAS Y EN EL SCOPE GLOBAL) ---

function triggerMapUpload() {
    const input = document.getElementById('upload-map-input');
    if(input) input.click();
    else alert("Error: No se encontrÃ³ el input de archivo. Recarga la pÃ¡gina.");
}

function handleMapUpload(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        alert("El archivo es demasiado grande. Por favor sube un PDF o Imagen de menos de 2MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const process = systemData.find(p => p.id === currentProcessId);
        if (process) {
            process.processMap = {
                data: e.target.result,
                type: file.type,
                name: file.name
            };
            updateSummary();
            renderView(); 
            alert("Mapa de proceso subido correctamente.");
        }
    };
    reader.onerror = function() { alert("Error al leer el archivo."); };
    reader.readAsDataURL(file);
}

function deleteProcessMap() {
    if (confirm("Â¿EstÃ¡s seguro de eliminar el mapa de este proceso?")) {
        const process = systemData.find(p => p.id === currentProcessId);
        if (process) {
            delete process.processMap;
            updateSummary();
            renderView();
        }
    }
}

function openProcessMap() {
    const process = systemData.find(p => p.id === currentProcessId);
    if (process && process.processMap) {
        const mapData = process.processMap;
        
        // --- SOLUCIÃ“N PARA EL BLOQUEO DE NAVEGADOR ---
        // 1. Separar la cabecera (data:application/pdf;base64) del contenido real
        const arr = mapData.data.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]); // Decodificar base64
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        // 2. Convertir a arreglo de bytes
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        
        // 3. Crear un "Blob" (Archivo virtual en memoria)
        const fileBlob = new Blob([u8arr], {type: mime});
        
        // 4. Generar una URL temporal limpia (blob:http://...)
        const fileURL = URL.createObjectURL(fileBlob);
        
        // 5. Abrir esa URL segura
        window.open(fileURL, '_blank');
    }
}

// --- PDF Y UTILIDADES ---
function openPdfModal() { document.getElementById('pdfModal').style.display = 'block'; }

function generateMatrixPDF() {
    const author = document.getElementById('pdf-author').value || " - ";
    const role = document.getElementById('pdf-role').value || " - ";
    const date = document.getElementById('pdf-date').value || new Date().toLocaleDateString();
    const area = document.getElementById('pdf-area').value || " - ";
    const process = systemData.find(p => p.id === currentProcessId);
    
    const branding = (typeof getCompanyBranding === 'function') ? getCompanyBranding() : {name: "MI EMPRESA"};
    const companyName = branding ? branding.name : "MI EMPRESA";
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); 
    const pageWidth = 297; const pageHeight = 210; const margin = 10; 
    const contentWidth = pageWidth - (2*margin);

    doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.5); doc.roundedRect(margin, margin, contentWidth, pageHeight - (margin * 2), 3, 3, 'S');
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(0, 32, 96); doc.text(companyName.toUpperCase(), pageWidth / 2, 22, { align: 'center' });
    doc.setFontSize(14); doc.setTextColor(0); doc.text("ANÃLISIS DE SEGURIDAD EN EL TRABAJO (AST)", pageWidth / 2, 30, { align: 'center' });

    const infoBoxY = 38; const infoBoxH = 18;
    doc.setFillColor(240, 245, 255); doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.2); doc.roundedRect(margin + 2, infoBoxY, contentWidth - 4, infoBoxH, 2, 2, 'FD');
    doc.setFontSize(10); doc.setTextColor(0);
    doc.setFont("helvetica", "bold"); doc.text("PROCESO:", margin+5, infoBoxY+6); doc.setFont("helvetica", "normal"); doc.text(process.name, margin+28, infoBoxY+6);
    doc.setFont("helvetica", "bold"); doc.text("ÃREA:", margin+120, infoBoxY+6); doc.setFont("helvetica", "normal"); doc.text(area, margin+135, infoBoxY+6);
    doc.setFont("helvetica", "bold"); doc.text("FECHA:", margin+220, infoBoxY+6); doc.setFont("helvetica", "normal"); doc.text(date, margin+235, infoBoxY+6);
    doc.setFont("helvetica", "bold"); doc.text("RESPONSABLE:", margin+5, infoBoxY+12); doc.setFont("helvetica", "normal"); doc.text(`${author} (${role})`, margin+35, infoBoxY+12);

    const tableRows = []; const allEPPs = new Set();
    process.tasks.forEach(task => {
        if(task.ppeList) task.ppeList.forEach(e => allEPPs.add(e));
        if (task.risks.length === 0) { tableRows.push([task.name, "Sin identificar", "-", "-", "-", "-"]); } 
        else {
            task.risks.forEach(risk => {
                let controlsText = risk.controls && risk.controls.length > 0 ? risk.controls.map(c => `â€¢ ${c.description}`).join("\n") : "Ninguno";
                const riskResult = calculateTolerance(risk.severity, risk.frequency);
                tableRows.push([task.name, risk.name, riskResult.sVal, riskResult.fVal, { content: riskResult.score.toString(), styles: { fillColor: riskResult.color, textColor: 0, fontStyle: 'bold', halign: 'center' } }, controlsText]);
            });
        }
    });

    const footerHeight = 35; const bottomGap = 5; const footerY = pageHeight - margin - footerHeight - bottomGap; const tableStartY = infoBoxY + infoBoxH + 5;
    const minRows = 10; if (tableRows.length < minRows) for(let i=0; i<minRows-tableRows.length; i++) tableRows.push(["", "", "", "", "", ""]);

    doc.autoTable({
        startY: tableStartY,
        head: [['TAREA', 'PELIGRO / RIESGO', 'S', 'F', 'TOLERANCIA', 'MEDIDAS DE CONTROL']], body: tableRows, theme: 'grid',
        headStyles: { fillColor: [0, 32, 96], textColor: 255, halign: 'center', valign: 'middle', lineWidth: 0.1, lineColor: 0 },
        bodyStyles: { textColor: 0, lineColor: [100, 100, 100], lineWidth: 0.1, valign: 'middle' },
        columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' }, 1: { cellWidth: 60 }, 2: { cellWidth: 12, halign: 'center' }, 3: { cellWidth: 12, halign: 'center' }, 4: { cellWidth: 28, halign: 'center' }, 5: { cellWidth: 'auto' } },
        styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' }, margin: { bottom: footerHeight + bottomGap + 5 } 
    });

    const gap = 5; const sidePadding = 2; const availableFooterWidth = contentWidth - (sidePadding * 2); const boxWidth = (availableFooterWidth - gap) / 2; const leftBoxX = margin + sidePadding;
    doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.3); doc.roundedRect(leftBoxX, footerY, boxWidth, footerHeight, 2, 2, 'S');
    doc.setFillColor(0, 32, 96); doc.roundedRect(leftBoxX, footerY, 35, 7, 2, 2, 'F');
    doc.setTextColor(255); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("EPPS REQUERIDOS", leftBoxX + 17.5, footerY + 4.5, { align: 'center' });
    doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    let eppY = footerY + 12; if (allEPPs.size > 0) { allEPPs.forEach(epp => { if (eppY < (footerY + footerHeight - 2)) { doc.text(`â€¢ ${epp}`, leftBoxX + 5, eppY); eppY += 4.5; } }); } else { doc.text("-", leftBoxX + 5, eppY); }

    const legendX = leftBoxX + boxWidth + gap; doc.roundedRect(legendX, footerY, boxWidth, footerHeight, 2, 2, 'S');
    doc.setFillColor(0, 32, 96); doc.roundedRect(legendX, footerY, 35, 7, 2, 2, 'F');
    doc.setTextColor(255); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("LEYENDA", legendX + 17.5, footerY + 4.5, { align: 'center' });
    doc.setTextColor(0); doc.setFontSize(7); let legY = footerY + 12;
    const ranges = [{ color: [46, 204, 113], range: "1-4", text: "ACEPTABLE" }, { color: [241, 196, 15], range: "5-8", text: "TOLERABLE" }, { color: [230, 126, 34], range: "9-12", text: "POCO TOLERABLE" }, { color: [231, 76, 60], range: "13-16", text: "INACEPTABLE" }];
    ranges.forEach(r => { doc.setFillColor(r.color[0], r.color[1], r.color[2]); doc.rect(legendX + 5, legY - 3, 4, 4, 'F'); doc.setDrawColor(0); doc.rect(legendX + 5, legY - 3, 4, 4, 'S'); doc.setFont("helvetica", "bold"); doc.text(`[${r.range}]`, legendX + 12, legY); doc.setFont("helvetica", "normal"); doc.text(r.text, legendX + 25, legY); legY += 5; });
    let sY = footerY + 10; const sColX = legendX + 55; doc.setFont("helvetica", "bold"); doc.text("S: SEVERIDAD", sColX, sY); doc.setFont("helvetica", "normal"); doc.text("1: Bajo", sColX, sY + 4); doc.text("2: Medio", sColX, sY + 8); doc.text("3: Alto", sColX, sY + 12); doc.text("4: Muy Alto", sColX, sY + 16);
    let fY = footerY + 10; const fColX = legendX + 90; doc.setFont("helvetica", "bold"); doc.text("F: FRECUENCIA", fColX, fY); doc.setFont("helvetica", "normal"); doc.text("1: Improbable", fColX, fY + 4); doc.text("2: Ocasional", fColX, fY + 8); doc.text("3: Probable", fColX, fY + 12); doc.text("4: Posible", fColX, fY + 16);

    doc.save(`AST_${process.name.replace(/\s+/g, '_')}.pdf`);
    closePdfModal();
}

function startDictation(inputId, btnElement) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Tu navegador no soporta dictado por voz. Por favor usa Google Chrome."); return; }
    const recognition = new SpeechRecognition(); recognition.lang = 'es-ES'; recognition.continuous = false; recognition.interimResults = true; 
    recognition.onstart = function() { btnElement.classList.add('listening'); }; recognition.onend = function() { btnElement.classList.remove('listening'); };
    recognition.onerror = function(event) { console.error("Error de voz:", event.error); btnElement.classList.remove('listening'); if (event.error === 'not-allowed') { alert("Permiso de micrÃ³fono denegado. Revisa el candado junto a la URL."); } };
    recognition.onresult = function(event) { let finalTranscript = ''; for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) { finalTranscript += event.results[i][0].transcript; } } const input = document.getElementById(inputId); if (finalTranscript) { if (input.value.length > 0 && !input.value.endsWith(' ')) { input.value += " "; } const capitalized = finalTranscript.charAt(0).toUpperCase() + finalTranscript.slice(1); input.value += capitalized; } };
    recognition.start();
}

// --- CRUD ---
function saveData() {
    if(currentLevel==='processes' || (isEditing && editingId && !currentProcessId)) {
        const val=document.getElementById('in-name').value; 
        if(val){ 
            if(isEditing) systemData.find(x=>x.id===editingId).name=val; 
            else systemData.push({id:Date.now(),name:val,tasks:[]}); 
        }
    } else if(currentLevel==='tasks' || (isEditing && editingId && currentProcessId && !currentTaskId) || (currentLevel === 'details' && isEditing && editingId === currentTaskId)) {
        const val=document.getElementById('in-name').value; const p=systemData.find(x=>x.id===currentProcessId);
        if(val) {
            const type=document.getElementById('in-type').value; const pers=document.getElementById('in-person').value;
            if(isEditing) { const t=p.tasks.find(x=>x.id===editingId); t.name=val; t.type=type; t.personnel=pers; t.ppeList=[...tempEPPList]; }
            else p.tasks.push({id:Date.now(),name:val,type:type,personnel:pers,ppeList:[...tempEPPList],risks:[]});
            if(currentLevel === 'details') renderView();
        }
    } else if(currentLevel==='details' || (isEditing && editingIndex!==null && !document.getElementById('c-desc'))) {
        const val=document.getElementById('r-name').value;
        if(val) {
            const t=systemData.find(x=>x.id===currentProcessId).tasks.find(x=>x.id===currentTaskId);
            const rData={name:val, severity:document.getElementById('r-sev').value, frequency:document.getElementById('r-freq').value, controls:[]};
            if(isEditing) { const old=t.risks[editingIndex]; t.risks[editingIndex]={...rData, controls:old.controls}; }
            else t.risks.push(rData);
        }
    } else { 
        const desc=document.getElementById('c-desc').value;
        if(desc) {
            const t=systemData.find(x=>x.id===currentProcessId).tasks.find(x=>x.id===currentTaskId);
            const r=t.risks[currentRiskIndex]; if(!r.controls) r.controls=[];
            const cData={description:desc, type:document.getElementById('c-type').value, doc:document.getElementById('c-doc').value, evidence:document.getElementById('c-evid').value, freqDefined:document.getElementById('c-freq').value};
            if(isEditing) r.controls[editingIndex]=cData; else r.controls.push(cData);
        }
    }
    updateSummary(); renderView(); closeModal();
}

function deleteProcess(id){if(confirm('Â¿Borrar?')){systemData=systemData.filter(p=>p.id!==id);updateSummary();renderView();}}
function deleteTask(id){if(confirm('Â¿Borrar?')){const p=systemData.find(x=>x.id===currentProcessId);p.tasks=p.tasks.filter(t=>t.id!==id);updateSummary();renderView();}}
function deleteRisk(idx){if(confirm('Â¿Borrar?')){const t=systemData.find(x=>x.id===currentProcessId).tasks.find(x=>x.id===currentTaskId);t.risks.splice(idx,1);updateSummary();renderView();}}
function deleteControl(idx){if(confirm('Â¿Borrar control?')){const t=systemData.find(x=>x.id===currentProcessId).tasks.find(x=>x.id===currentTaskId);t.risks[currentRiskIndex].controls.splice(idx,1);updateSummary();renderView();}}

function updateSummary(){
    if(typeof saveCompanyData === 'function') saveCompanyData('astData', systemData);
    
    let p=systemData.length,t=0,r=0,c=0;
    systemData.forEach(pr=>{t+=pr.tasks.length; pr.tasks.forEach(tk=>{r+=tk.risks.length; if(tk.risks) tk.risks.forEach(rk=>{if(rk.controls)c+=rk.controls.length;})})});
    document.getElementById('count-processes').innerText=p; document.getElementById('count-tasks').innerText=t; document.getElementById('count-risks').innerText=r; document.getElementById('count-controls').innerText=c;
}

function navigateBack() { window.history.back(); }
function enterProcess(id) { currentProcessId = id; currentLevel = 'tasks'; renderView(true); }
function enterTask(id) { currentTaskId = id; currentLevel = 'details'; renderView(true); }
function enterRisk(idx) { currentRiskIndex = idx; currentLevel = 'controls'; renderView(true); }
function goHome() { window.location.href = 'dashboard.html'; }

function getRiskColorClass(val) { if(val === 'Muy Alto' || val === 'Altamente Posible') return 'bg-red'; if(val === 'Alto' || val === 'Posible') return 'bg-orange'; if(val === 'Medio' || val === 'Ocasional') return 'bg-yellow'; return 'bg-green'; }
function calculateControlQuality(c) { let score = 0; if(c.type === 'Preventivo') score += 3; else if(c.type === 'Detectivo') score += 2; else score += 1; if(c.doc === 'Documentado') score += 2; else if(c.doc === 'Parcial') score += 1; if(c.evidence === 'Si') score += 2; if(c.freqDefined === 'Si') score += 1; return score; }
function getBadge(s) { if (s >= 7) return { text: 'Excelente', cls: 'q-excellent' }; if (s >= 5) return { text: 'Bueno', cls: 'q-good' }; if (s >= 3) return { text: 'Regular', cls: 'q-medium' }; return { text: 'DÃ©bil', cls: 'q-bad' }; }
function calculateTolerance(s, f) { let sVal = 1; if(s==='Medio') sVal=2; if(s==='Alto') sVal=3; if(s==='Muy Alto') sVal=4; let fVal = 1; if(f==='Ocasional') fVal=2; if(f==='Probable') fVal=3; if(f==='Posible') fVal=4; const score = sVal * fVal; if (score <= 4) return { text: "BAJO", color: [46, 204, 113], score: score, sVal: sVal, fVal: fVal }; if (score <= 8) return { text: "MEDIO", color: [241, 196, 15], score: score, sVal: sVal, fVal: fVal }; if (score <= 12) return { text: "ALTO", color: [230, 126, 34], score: score, sVal: sVal, fVal: fVal }; return { text: "CRÃTICO", color: [231, 76, 60], score: score, sVal: sVal, fVal: fVal }; }

function saveOptions() { localStorage.setItem('sgsOptions', JSON.stringify(optionsDB)); }
function addNewOption(type) { const newVal = prompt(`Nuevo ${type==='positions'?'Puesto':'EPP'}:`); if (newVal) { optionsDB[type].push(newVal); saveOptions(); if(type==='positions') loadOptions('in-person', optionsDB.positions); if(type==='ppes') loadOptions('sel-ppe', optionsDB.ppes); } }
function loadOptions(id, arr, sel=null) { const s = document.getElementById(id); if(!s)return; s.innerHTML='<option value="" disabled selected>-- Seleccione --</option>'; arr.forEach(o=>{ let op=document.createElement('option'); op.value=o; op.text=o; if(o===sel)op.selected=true; s.appendChild(op); }); }
function addPPE() { const v=document.getElementById('sel-ppe').value; if(v && !tempEPPList.includes(v)) { tempEPPList.push(v); renderPPETags(); } }
function removePPE(v) { tempEPPList=tempEPPList.filter(e=>e!==v); renderPPETags(); }
function renderPPETags() { document.getElementById('ppe-tags').innerHTML = tempEPPList.map(e=>`<span class="tag">${e} <i class="fa-solid fa-xmark" onclick="removePPE('${e}')"></i></span>`).join(''); }

function openAddModal() { isEditing=false; editingId=null; editingIndex=null; showModal(); }
function openEditModal(type, id, idx=null) { if(event) event.stopPropagation(); isEditing=true; editingId=id; editingIndex=idx; showModal(type); }

function showModal(ovType=null) {
    const modal = document.getElementById('appModal'); const body = document.getElementById('modal-body'); const title = document.getElementById('modal-title');
    modal.style.display = 'block'; modal.onclick = (e) => { if(e.target === modal) closeModal(); };
    let type = ovType || (currentLevel==='processes'?'process':(currentLevel==='tasks'?'task':(currentLevel==='details'?'risk':'control')));

    if(type==='process') {
        title.innerText = isEditing?'Editar Proceso':'Nuevo Proceso'; let val = isEditing ? systemData.find(x=>x.id===editingId).name : '';
        body.innerHTML = `<div class="form-group"><label>Nombre del Proceso:</label><div class="input-with-mic"><input type="text" id="in-name" value="${val}"><button class="btn-mic" onclick="startDictation('in-name', this)"><i class="fa-solid fa-microphone"></i></button></div></div>`;
    } else if(type==='task') {
        title.innerText = isEditing?'Editar Tarea':'Nueva Tarea'; let d={name:'',type:'',personnel:'',ppe:[]};
        if(isEditing) { let pId = currentProcessId; const p=systemData.find(x=>x.id===pId); const t=p.tasks.find(x=>x.id===editingId); d={...t, ppe: t.ppeList||[]}; } tempEPPList = [...d.ppe];
        body.innerHTML = `<div class="form-group"><label>Nombre:</label><div class="input-with-mic"><input type="text" id="in-name" value="${d.name}"><button class="btn-mic" onclick="startDictation('in-name', this)"><i class="fa-solid fa-microphone"></i></button></div></div><div class="form-group"><label>Tipo:</label><select id="in-type"><option value="Manual">Manual</option><option value="MecÃ¡nica">MecÃ¡nica</option><option value="ElÃ©ctrica">ElÃ©ctrica</option><option value="Altura">Trabajo en Altura</option><option value="Caliente">Trabajo en Caliente</option></select></div><div class="form-group"><label>Puesto:</label><div class="input-group-row"><select id="in-person"></select><button class="btn-small-add" onclick="addNewOption('positions')">+</button></div></div><div class="form-group"><label>EPPs:</label><div class="input-group-row"><select id="sel-ppe"></select><button class="btn-small-add" onclick="addNewOption('ppes')">+</button><button class="btn-secondary" onclick="addPPE()">Add</button></div><div id="ppe-tags" class="tags-container"></div></div>`;
        setTimeout(()=>{ loadOptions('in-person',optionsDB.positions,d.personnel); loadOptions('sel-ppe',optionsDB.ppes); if(d.type) document.getElementById('in-type').value = d.type; renderPPETags(); },50);
    } else if(type==='risk') {
        title.innerText = isEditing?'Editar Riesgo':'Nuevo Riesgo'; let r={name:'', severity:'', frequency:''};
        if(isEditing) { const t=systemData.find(x=>x.id===currentProcessId).tasks.find(x=>x.id===currentTaskId); r=t.risks[editingIndex]; }
        body.innerHTML = `<div class="form-group"><label>Riesgo:</label><div class="input-with-mic"><input type="text" id="r-name" value="${r.name}"><button class="btn-mic" onclick="startDictation('r-name', this)"><i class="fa-solid fa-microphone"></i></button></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><div class="form-group"><label>Severidad:</label><select id="r-sev"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Muy Alto</option></select></div><div class="form-group"><label>Frecuencia:</label><select id="r-freq"><option>Improbable</option><option>Ocasional</option><option>Probable</option><option>Posible</option></select></div></div>`;
        setTimeout(()=>{ if(r.severity)document.getElementById('r-sev').value=r.severity; if(r.frequency)document.getElementById('r-freq').value=r.frequency; },50);
    } else if(type==='control') {
        title.innerText = isEditing?'Editar Control':'Nuevo Control'; let c={description:'',type:'',doc:'',evidence:'',freqDefined:''};
        if(isEditing) { const t=systemData.find(x=>x.id===currentProcessId).tasks.find(x=>x.id===currentTaskId); c=t.risks[currentRiskIndex].controls[editingIndex]; }
        body.innerHTML=`<div class="form-group"><label>Medida de Control:</label><div class="input-with-mic"><textarea id="c-desc" rows="2" style="width:100%;">${c.description}</textarea><button class="btn-mic" onclick="startDictation('c-desc', this)"><i class="fa-solid fa-microphone"></i></button></div></div><div class="form-group"><label>Tipo:</label><select id="c-type"><option>Preventivo</option><option>Detectivo</option><option>Correctivo</option></select></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;"><div class="form-group"><label>Doc?</label><select id="c-doc"><option>Documentado</option><option>Parcial</option><option>No</option></select></div><div class="form-group"><label>Evi?</label><select id="c-evid"><option>Si</option><option>No</option></select></div><div class="form-group"><label>Freq?</label><select id="c-freq"><option>Si</option><option>No</option></select></div></div>`;
        setTimeout(()=>{ if(c.type)document.getElementById('c-type').value=c.type; if(c.doc)document.getElementById('c-doc').value=c.doc; if(c.evidence)document.getElementById('c-evid').value=c.evidence; if(c.freqDefined)document.getElementById('c-freq').value=c.freqDefined; },50);
    }
}

function applyPermissionsAST() { const session = JSON.parse(localStorage.getItem('SGS_CURRENT_SESSION')); if (!session || session.role !== 'editor') { const style = document.createElement('style'); style.innerHTML = `#btn-add, .action-group, .btn-small-add, .click-hint, .btn-secondary[onclick*="addPPE"] { display: none !important; } .card, .risk-card, .control-card { cursor: default; } .card:hover, .risk-card:hover { transform: none; box-shadow: 0 3px 10px rgba(0,0,0,0.05); }`; document.head.appendChild(style); window.openAddModal = () => alert("Modo Lectura: No tiene permisos para editar."); window.openEditModal = () => alert("Modo Lectura: No tiene permisos para editar."); } }
function closeModal() { document.getElementById('appModal').style.display = 'none'; isEditing = false; editingId = null; editingIndex = null; tempEPPList = []; }
function closePdfModal() { document.getElementById('pdfModal').style.display = 'none'; }