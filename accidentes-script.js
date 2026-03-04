// --- BASE DE DATOS FAKE ---
const companyData = (typeof getCompanyData === 'function') ? getCompanyData() : null; 
let systemData = (companyData && companyData.incidentsData) ? companyData.incidentsData : [];

// --- VARIABLES ESTADO ---
let currentLevel = 'list'; 
let currentIncidentId = null;
let isEditing = false;

// --- INICIALIZACIÃƒâ€œN ---
document.addEventListener('DOMContentLoaded', () => {
    applyPermissions();
    renderView();
    updateSummary();
});

// --- RENDERIZADO PRINCIPAL ---
function renderView() {
    const mainArea = document.getElementById('main-area');
    const dynamicActions = document.getElementById('dynamic-actions');
    const btnBack = document.getElementById('btn-back');
    const pageTitle = document.getElementById('page-title');
    
    mainArea.classList.remove('fade-in'); void mainArea.offsetWidth; mainArea.classList.add('fade-in');
    mainArea.innerHTML = '';
    
    dynamicActions.innerHTML = `<button id="btn-add" class="btn btn-highlight" onclick="openAddModal()"><i class="fa-solid fa-plus-circle"></i> NUEVO REPORTE</button>`;
    applyPermissions();

    // VISTA 1: LISTA GENERAL
    if (currentLevel === 'list') {
        pageTitle.style.display = 'block';
        pageTitle.innerHTML = 'Registro de Eventos';
        document.getElementById('page-subtitle').innerText = 'Historial de accidentes e incidentes laborales.';
        document.getElementById('breadcrumb').innerText = 'Listado General';
        btnBack.style.display = 'none';

        if (systemData.length === 0) mainArea.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999;">No hay eventos registrados.</div>`;

        // Ordenar por fecha mÃƒÂ¡s reciente
        const sortedData = [...systemData].sort((a,b) => new Date(b.date) - new Date(a.date));

        sortedData.forEach(inc => {
            const isAccident = inc.type === 'Accidente';
            const icon = isAccident ? '<i class="fa-solid fa-truck-medical" style="color:#e74c3c"></i>' : '<i class="fa-solid fa-triangle-exclamation" style="color:#f39c12"></i>';
            const statusClass = inc.status === 'Abierto' ? 'abierto' : 'cerrado';
            const sevClass = 'sev-' + inc.severity.toLowerCase();

            const card = document.createElement('div'); card.className = 'card';
            card.style.borderTopColor = isAccident ? '#e74c3c' : '#f39c12';
            card.onclick = (e) => { if(!e.target.closest('button')) enterDetail(inc.id); };
            
            card.innerHTML = `
                <div class="card-header-row">
                    <h3>${icon} ${inc.type} en ${inc.location}</h3>
                    <div class="action-group">
                        <button onclick="openEditModal(${inc.id})" class="btn-icon btn-edit"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteIncident(${inc.id})" class="btn-icon btn-delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="attributes-list">
                    <div class="attribute-pill"><i class="fa-regular fa-calendar"></i> <strong>${formatDate(inc.date)}</strong> - ${inc.time}</div>
                    <div class="attribute-pill pill-status ${statusClass}"><i class="fa-solid ${inc.status === 'Abierto'?'fa-folder-open':'fa-folder-closed'}"></i> ${inc.status}</div>
                    <div class="attribute-pill"><i class="fa-solid fa-circle-exclamation ${sevClass}"></i> Severidad: <strong>${inc.severity}</strong></div>
                </div>`;
            mainArea.appendChild(card);
        });

    // VISTA 2: DETALLE DEL EVENTO
    } else if (currentLevel === 'detail') {
        const inc = systemData.find(i => i.id === currentIncidentId);
        if(!inc) { goHome(); return; }

        pageTitle.style.display = 'flex';
        pageTitle.innerHTML = `Detalle del ${inc.type} <button class="btn-pdf-title" onclick="openPdfModal()"><i class="fa-solid fa-file-pdf"></i> EXPORTAR FLASH</button>`;
        document.getElementById('page-subtitle').innerText = 'RevisiÃƒÂ³n e investigaciÃƒÂ³n del caso.';
        document.getElementById('breadcrumb').innerText = `Listado > Detalle #${inc.id.toString().slice(-4)}`;
        btnBack.style.display = 'flex';
        
        // Ocultar boton nuevo en detalle para evitar confusiones
        dynamicActions.innerHTML = ''; 

        const isAccident = inc.type === 'Accidente';
        const statusClass = inc.status === 'Abierto' ? 'abierto' : 'cerrado';

        const card = document.createElement('div'); 
        card.className = `incident-detail-card ${!isAccident ? 'is-inc' : ''}`;
        
        card.innerHTML = `
            <div class="detail-header-row">
                <div class="detail-title-block">
                    <h4>Reporte #${inc.id}</h4>
                    <h2 class="detail-event-name">${inc.type} en ${inc.location}</h2>
                </div>
                <div class="action-group">
                    <button onclick="openEditModal(${inc.id})" class="btn-icon btn-edit"><i class="fa-solid fa-pen"></i></button>
                </div>
            </div>
            
            <div class="detail-grid">
                <div class="detail-item"><label>Fecha y Hora</label><span>${formatDate(inc.date)} a las ${inc.time}</span></div>
                <div class="detail-item"><label>Estado del Caso</label><span class="attribute-pill pill-status ${statusClass}" style="border:none; margin:0;">${inc.status}</span></div>
                <div class="detail-item"><label>Severidad</label><span>${inc.severity}</span></div>
                <div class="detail-item"><label>Persona(s) Involucrada(s)</label><span>${inc.involved || 'Ninguna / No especificado'}</span></div>
                <div class="detail-item"><label>Lugar Exacto</label><span>${inc.location}</span></div>
            </div>

            <div class="detail-full-text">
                <label style="font-weight:bold; color:#888; font-size:0.75rem; text-transform:uppercase; margin-bottom:8px; display:block;">DescripciÃƒÂ³n de los hechos</label>
                <p>${inc.description || 'Sin descripciÃƒÂ³n detallada.'}</p>
            </div>
            
            <div class="detail-full-text" style="background:#eafaf1; border-color:#2ecc71;">
                <label style="font-weight:bold; color:#27ae60; font-size:0.75rem; text-transform:uppercase; margin-bottom:8px; display:block;">Acciones Inmediatas / Correctivas</label>
                <p>${inc.actions || 'No se han registrado acciones aÃƒÂºn.'}</p>
            </div>
        `;
        mainArea.appendChild(card);
    }
}

// --- CRUD ---
function saveData() {
    const type = document.getElementById('i-type').value;
    const date = document.getElementById('i-date').value;
    const time = document.getElementById('i-time').value;
    const location = document.getElementById('i-loc').value;
    
    if(!type || !date || !location) { alert("Completa los campos obligatorios (Tipo, Fecha, Lugar)."); return; }

    const data = {
        type: type, date: date, time: time, location: location,
        severity: document.getElementById('i-sev').value,
        status: document.getElementById('i-status').value,
        involved: document.getElementById('i-inv').value,
        description: document.getElementById('i-desc').value,
        actions: document.getElementById('i-act').value
    };

    if(isEditing) {
        const index = systemData.findIndex(x => x.id === currentIncidentId);
        systemData[index] = { ...systemData[index], ...data };
    } else {
        data.id = Date.now();
        systemData.push(data);
    }

    updateSummary(); 
    renderView(); 
    closeModal();
}

function deleteIncident(id) {
    if(confirm('Ã‚Â¿EstÃƒÂ¡s seguro de eliminar este registro? Esta acciÃƒÂ³n no se puede deshacer.')) {
        systemData = systemData.filter(i => i.id !== id);
        updateSummary();
        renderView();
    }
}

function updateSummary() {
    if(typeof saveCompanyData === 'function') saveCompanyData('incidentsData', systemData);
    
    let total = systemData.length;
    let acc = systemData.filter(i => i.type === 'Accidente').length;
    let inc = systemData.filter(i => i.type === 'Incidente').length;
    let open = systemData.filter(i => i.status === 'Abierto').length;

    document.getElementById('count-total').innerText = total;
    document.getElementById('count-accidents').innerText = acc;
    document.getElementById('count-incidents').innerText = inc;
    document.getElementById('count-open').innerText = open;
}

// --- NAVEGACIÃƒâ€œN ---
function navigateBack() { currentLevel = 'list'; renderView(); }
function enterDetail(id) { currentIncidentId = id; currentLevel = 'detail'; renderView(); }
function goHome() { window.location.href = 'dashboard.html'; }
function formatDate(dateStr) { 
    if(!dateStr) return '';
    const [y,m,d] = dateStr.split('-'); 
    return `${d}/${m}/${y}`; 
}

// --- MODALES ---
function openAddModal() { isEditing=false; currentIncidentId=null; showModal(); }
function openEditModal(id) { if(event) event.stopPropagation(); isEditing=true; currentIncidentId=id; showModal(); }

function showModal() {
    const modal = document.getElementById('appModal'); const body = document.getElementById('modal-body'); const title = document.getElementById('modal-title');
    modal.style.display = 'block'; modal.onclick = (e) => { if(e.target === modal) closeModal(); };
    
    title.innerText = isEditing ? 'Editar Registro' : 'Nuevo Reporte de Evento';
    let d = {type:'Incidente', date: new Date().toISOString().split('T')[0], time:'', location:'', severity:'Leve', status:'Abierto', involved:'', description:'', actions:''};
    
    if(isEditing) { d = systemData.find(x => x.id === currentIncidentId); }
    
    body.innerHTML = `
        <div class="two-col">
            <div class="form-group"><label>Tipo de Evento *</label><select id="i-type"><option value="Incidente">Incidente (Near Miss)</option><option value="Accidente">Accidente</option></select></div>
            <div class="form-group"><label>Estado</label><select id="i-status"><option value="Abierto">Abierto (En investigaciÃƒÂ³n)</option><option value="Cerrado">Cerrado</option></select></div>
        </div>
        <div class="two-col">
            <div class="form-group"><label>Fecha *</label><input type="date" id="i-date" value="${d.date}"></div>
            <div class="form-group"><label>Hora</label><input type="time" id="i-time" value="${d.time}"></div>
        </div>
        <div class="two-col">
            <div class="form-group"><label>Severidad / Potencial</label><select id="i-sev"><option>Leve</option><option>Moderado</option><option>Grave</option><option>Fatal</option></select></div>
            <div class="form-group"><label>Lugar Exacto *</label><input type="text" id="i-loc" value="${d.location}" placeholder="Ej: Taller MecÃƒÂ¡nico"></div>
        </div>
        <div class="form-group"><label>Personal Involucrado</label><input type="text" id="i-inv" value="${d.involved}" placeholder="Nombres de afectados o testigos"></div>
        
        <div class="form-group"><label>Relato de los Hechos (Usa el micrÃ³fono)</label>
            <div class="input-with-mic">
                <textarea id="i-desc" rows="3" placeholder="Describe quÃ© ocurriÃ³, cÃ³mo ocurriÃ³...">${d.description}</textarea>
                <button class="btn-mic" onclick="startDictation('i-desc', this)" title="Dictar por voz"><i class="fa-solid fa-microphone"></i></button>
            </div>
        </div>
        <div class="form-group"><label>Acciones Inmediatas Tomadas</label>
            <div class="input-with-mic">
                <textarea id="i-act" rows="2" placeholder="Primeros auxilios, paralizaciÃ³n, limpieza...">${d.actions}</textarea>
                <button class="btn-mic" onclick="startDictation('i-act', this)"><i class="fa-solid fa-microphone"></i></button>
            </div>
        </div>
    `;
    setTimeout(()=>{ 
        document.getElementById('i-type').value=d.type; 
        document.getElementById('i-status').value=d.status;
        document.getElementById('i-sev').value=d.severity;
    },50);
}

function closeModal() { document.getElementById('appModal').style.display = 'none'; isEditing = false; }
function closePdfModal() { document.getElementById('pdfModal').style.display = 'none'; }
function openPdfModal() { document.getElementById('pdfModal').style.display = 'block'; }

// --- DICTADO POR VOZ ---
function startDictation(inputId, btnElement) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Tu navegador no soporta dictado por voz. Por favor usa Chrome o Edge."); return; }
    const recognition = new SpeechRecognition(); recognition.lang = 'es-ES'; recognition.continuous = false; recognition.interimResults = true; 
    recognition.onstart = function() { btnElement.classList.add('listening'); }; recognition.onend = function() { btnElement.classList.remove('listening'); };
    recognition.onerror = function(event) { console.error("Error voz:", event.error); btnElement.classList.remove('listening'); };
    recognition.onresult = function(event) { 
        let finalTranscript = ''; 
        for (let i = event.resultIndex; i < event.results.length; ++i) { 
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; 
        } 
        const input = document.getElementById(inputId); 
        if (finalTranscript) { 
            if (input.value.length > 0 && !input.value.endsWith(' ')) input.value += " "; 
            input.value += finalTranscript.charAt(0).toUpperCase() + finalTranscript.slice(1); 
        } 
    };
    recognition.start();
}

// --- PERMISOS ---
function applyPermissions() { 
    const session = JSON.parse(localStorage.getItem('SGS_CURRENT_SESSION')); 
    if (!session || session.role !== 'editor') { 
        const style = document.createElement('style'); 
        style.innerHTML = `#btn-add, .action-group { display: none !important; } .card { cursor: default; } .card:hover { transform: none; }`; 
        document.head.appendChild(style); 
        window.openAddModal = () => alert("Modo Lectura."); window.openEditModal = () => alert("Modo Lectura."); 
    } 
}

// --- PDF REPORT (REPORTE FLASH) ---
function generateReportPDF() {
    const author = document.getElementById('pdf-author').value || "No especificado";
    const role = document.getElementById('pdf-role').value || "-";
    const inc = systemData.find(i => i.id === currentIncidentId);
    if(!inc) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4'); 
    
    // Encabezado
    doc.setFillColor(192, 57, 43); // Rojo oscuro
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("REPORTE FLASH DE " + inc.type.toUpperCase(), 105, 16, {align:'center'});

    // Info General
    doc.setTextColor(0,0,0);
    doc.setFontSize(10);
    doc.setDrawColor(200);
    doc.setFillColor(245);
    doc.rect(15, 35, 180, 25, 'FD');
    
    doc.setFont("helvetica", "bold"); doc.text("FECHA:", 20, 42); doc.setFont("helvetica", "normal"); doc.text(formatDate(inc.date), 40, 42);
    doc.setFont("helvetica", "bold"); doc.text("HORA:", 90, 42); doc.setFont("helvetica", "normal"); doc.text(inc.time || "N/A", 110, 42);
    doc.setFont("helvetica", "bold"); doc.text("ESTADO:", 145, 42); doc.setFont("helvetica", "normal"); doc.text(inc.status, 165, 42);
    
    doc.setFont("helvetica", "bold"); doc.text("LUGAR:", 20, 52); doc.setFont("helvetica", "normal"); doc.text(inc.location, 40, 52);
    doc.setFont("helvetica", "bold"); doc.text("SEVERIDAD:", 145, 52); doc.setFont("helvetica", "normal"); doc.text(inc.severity, 170, 52);

    // Relato
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(192, 57, 43);
    doc.text("1. DESCRIPCIÃ“N DEL EVENTO", 15, 75);
    doc.setTextColor(0,0,0); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const splitDesc = doc.splitTextToSize(inc.description || "Sin descripciÃƒÂ³n.", 180);
    doc.text(splitDesc, 15, 83);

    // Involucrados
    let y = 83 + (splitDesc.length * 5) + 10;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(192, 57, 43);
    doc.text("2. PERSONAL INVOLUCRADO", 15, y);
    doc.setTextColor(0,0,0); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(inc.involved || "No especificado.", 15, y + 8);

    // Acciones
    y = y + 20;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(192, 57, 43);
    doc.text("3. ACCIONES INMEDIATAS", 15, y);
    doc.setTextColor(0,0,0); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const splitAct = doc.splitTextToSize(inc.actions || "Ninguna registrada.", 180);
    doc.text(splitAct, 15, y + 8);

    // Firmas
    doc.setDrawColor(0);
    doc.line(60, 260, 150, 260);
    doc.setFont("helvetica", "bold");
    doc.text(author, 105, 265, {align:'center'});
    doc.setFont("helvetica", "normal");
    doc.text(role, 105, 270, {align:'center'});

    doc.save(`Reporte_${inc.type}_${inc.id}.pdf`);
    closePdfModal();
}