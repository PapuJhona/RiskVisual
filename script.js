// --- VARIABLES GLOBALES ---
const canvasViewport = document.getElementById('canvas-viewport');
const canvasContent = document.getElementById('canvas-content');
const uploadInput = document.getElementById('uploadPlan');
const planImage = document.getElementById('plan-image');
const placeholder = document.getElementById('placeholder-text');

let scale = 1;
const scaleStep = 0.1;
const maxScale = 5;
const minScale = 0.5;
let panning = false;
let pointX = 0, pointY = 0, startX = 0, startY = 0;

// Estado de la leyenda usando Sets
const activeLegendItems = {
    'Advertencia': new Set(),
    'ProhibiciÃ³n': new Set(),
    'ObligaciÃ³n': new Set(),
    'InformaciÃ³n': new Set()
};

// HELPER: Convertir categorÃ­a a nombre de carpeta para evitar errores de ruta
function getFolderByCategory(category) {
    const map = {
        'Advertencia': 'ADVERTENCIA',
        'ProhibiciÃ³n': 'PROHIBICION',
        'ObligaciÃ³n': 'OBLIGACION',
        'InformaciÃ³n': 'INFORMACION'
    };
    return map[category] || 'OTROS';
}

document.addEventListener('DOMContentLoaded', () => {
    const session = verifySession();
    if(!session) return;
    loadMapState();
    updatePrintLegend();
    fitPaperToScreen();
});

window.addEventListener('resize', fitPaperToScreen);

function verifySession() {
    const session = JSON.parse(localStorage.getItem('SGS_CURRENT_SESSION'));
    if (!session || session.type !== 'COMPANY_USER') {
        window.location.replace('index.html'); 
        return null;
    }
    const branding = getCompanyBranding();
    const mainInput = document.querySelector('.tb-input-main');
    if (mainInput && !mainInput.value && branding) { mainInput.value = branding.name; }

    if (session.role !== 'editor') {
        document.body.classList.add('viewer-mode');
        window.drag = (e) => { e.preventDefault(); return false; };
        window.drop = (e) => { e.preventDefault(); return false; };
    }
    return session;
}

function saveMapState() {
    const session = JSON.parse(localStorage.getItem('SGS_CURRENT_SESSION'));
    if (!session || session.role !== 'editor') return;

    const hasImg = canvasContent.style.backgroundImage && canvasContent.style.backgroundImage !== 'none' && canvasContent.style.backgroundImage !== '';
    const bgImageSrc = hasImg ? planImage.src : null;

    const icons = [];
    document.querySelectorAll('.placed-icon').forEach(icon => {
        icons.push({
            // SOLUCIÃ“N: getAttribute asegura que se guarde "ADVERTENCIA/0.png" (relativo) y no una ruta absoluta larga.
            src: icon.getAttribute('src'), 
            id: icon.dataset.id, 
            category: icon.dataset.category,
            x: icon.style.left,
            y: icon.style.top,
            w: icon.style.width,
            h: icon.style.height,
            transform: icon.style.transform
        });
    });

    const textInputs = {};
    document.querySelectorAll('.tb-input, .tb-input-main').forEach((input, index) => {
        textInputs['input_' + index] = input.value;
    });

    saveCompanyData('mapState', { hasImage: hasImg, bgImage: bgImageSrc, icons: icons, texts: textInputs });
}

function loadMapState() {
    const companyData = getCompanyData();
    if (!companyData || !companyData.mapState) return;
    const state = companyData.mapState;

    if (state.hasImage && state.bgImage) {
        planImage.onload = () => {
            adjustCanvasSize();
            document.getElementById('placeholder-text').style.display = 'none';
        };
        planImage.src = state.bgImage;
        canvasContent.style.backgroundImage = `url(${state.bgImage})`; 
    }

    if (state.icons && state.icons.length > 0) {
        state.icons.forEach(data => {
            if(data.id && data.category) {
                // SOLUCIÃ“N: Reconstruir siempre la ruta para "curar" los Ã­conos corruptos guardados en PCs anteriores
                const folder = getFolderByCategory(data.category);
                const safeSrc = `${folder}/${data.id}.png`;
                
                createIconDOM(safeSrc, data.id, data.category, data.x, data.y, data.w, data.h, data.transform);
                if (activeLegendItems[data.category]) {
                    activeLegendItems[data.category].add(data.id.toString());
                }
            }
        });
        updatePrintLegend();
    }

    if (state.texts) {
        document.querySelectorAll('.tb-input, .tb-input-main').forEach((input, index) => {
            if (state.texts['input_' + index]) input.value = state.texts['input_' + index];
            input.addEventListener('input', saveMapState);
        });
    } else {
        document.querySelectorAll('.tb-input, .tb-input-main').forEach(input => {
            input.addEventListener('input', saveMapState);
        });
    }
}

function fitPaperToScreen() {
    const container = document.querySelector('.workspace');
    const paper = document.getElementById('printable-area');
    if(container && paper) {
        const scale = Math.min(1, (container.clientWidth - 40) / 1123);
        paper.style.transform = `scale(${scale})`;
    }
}

function toggleCategory(header) {
    header.classList.toggle('active');
    header.nextElementSibling.classList.toggle('open');
}

function setTransform() { canvasContent.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`; }

canvasViewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.placed-icon')) return;
    e.preventDefault();
    startX = e.clientX - pointX; startY = e.clientY - pointY;
    panning = true; canvasViewport.style.cursor = 'grabbing';
});
window.addEventListener('mouseup', () => { if(panning) { panning = false; canvasViewport.style.cursor = 'grab'; } });
canvasViewport.addEventListener('mousemove', (e) => {
    if (!panning) return;
    e.preventDefault();
    pointX = e.clientX - startX; pointY = e.clientY - startY;
    setTransform();
});
canvasViewport.addEventListener('wheel', (e) => {
    if (e.target.closest('.placed-icon')) return;
    e.preventDefault();
    const rect = canvasViewport.getBoundingClientRect();
    const viewportX = e.clientX - rect.left; const viewportY = e.clientY - rect.top;
    const contentX = (viewportX - pointX) / scale; const contentY = (viewportY - pointY) / scale;
    const zoomIntensity = 0.001; 
    let newScale = scale * Math.exp(e.deltaY * -zoomIntensity); 
    newScale = Math.min(Math.max(newScale, minScale), maxScale);
    pointX = viewportX - (contentX * newScale); pointY = viewportY - (contentY * newScale);
    scale = newScale; setTransform();
}, { passive: false });

// --- DRAG & DROP ---
function drag(ev) {
    if(document.body.classList.contains('viewer-mode')) { ev.preventDefault(); return; }
    const target = ev.target;
    if(!target.classList.contains('symbol-img') && !target.classList.contains('placed-icon')) return;

    // SOLUCIÃ“N: Usar la ruta relativa
    ev.dataTransfer.setData("src", target.getAttribute('src'));
    ev.dataTransfer.setData("id", target.dataset.id);
    ev.dataTransfer.setData("category", target.dataset.category);
    ev.dataTransfer.setData("type", "new");
    ev.dataTransfer.effectAllowed = "copyMove";
}

function allowDrop(ev) { if(!document.body.classList.contains('viewer-mode')) ev.preventDefault(); }

function drop(ev) {
    if(document.body.classList.contains('viewer-mode')) return;
    ev.preventDefault();
    const contentRect = canvasContent.getBoundingClientRect();
    const finalX = (ev.clientX - contentRect.left) / scale;
    const finalY = (ev.clientY - contentRect.top) / scale;
    const type = ev.dataTransfer.getData("type");

    if (type === "new") {
        const id = ev.dataTransfer.getData("id");
        const category = ev.dataTransfer.getData("category");
        
        // SOLUCIÃ“N: Generamos la ruta aquÃ­ para asegurarnos de que siempre sea perfecta y limpia
        const folder = getFolderByCategory(category);
        const safeSrc = `${folder}/${id}.png`;
        
        createIconDOM(safeSrc, id, category, (finalX - 20) + "px", (finalY - 20) + "px", '40px', '40px', 'rotate(0deg)');
        
        if(activeLegendItems[category]) activeLegendItems[category].add(id.toString());
        updatePrintLegend();
        saveMapState(); 
    } else if (type === "move") {
        const domId = ev.dataTransfer.getData("domId");
        const el = document.getElementById(domId);
        if(el){
            const w = parseFloat(el.style.width) || 40; const h = parseFloat(el.style.height) || 40;
            el.style.left = (finalX - (w / 2)) + "px"; el.style.top = (finalY - (h / 2)) + "px";
            saveMapState();
        }
    }
}

function createIconDOM(src, id, category, x, y, w, h, transform) {
    const img = document.createElement('img');
    img.src = src;
    img.className = `placed-icon`;
    img.dataset.id = id;
    img.dataset.category = category;
    
    img.style.width = w; img.style.height = h;
    img.style.left = x; img.style.top = y; img.style.transform = transform;
    img.id = "icon-" + Date.now() + Math.random().toString(16).slice(2);
    
    if (!document.body.classList.contains('viewer-mode')) {
        img.draggable = true; img.style.cursor = 'move';
        
        img.addEventListener('dragstart', (ev) => { 
            ev.dataTransfer.setData("type", "move"); 
            ev.dataTransfer.setData("domId", ev.target.id); 
            ev.stopPropagation(); 
        });
        
        img.addEventListener('dblclick', (e) => { 
            e.stopPropagation(); 
            img.remove(); 
            checkLegendRemoval(id, category); 
            saveMapState(); 
        });
        
        img.addEventListener('wheel', (ev) => {
            ev.preventDefault(); ev.stopPropagation(); 
            if (ev.shiftKey) {
                let currentRot = 0;
                if(img.style.transform.includes('rotate')) { const match = img.style.transform.match(/rotate\((-?\d+)deg\)/); if(match) currentRot = parseInt(match[1]); }
                currentRot += (ev.deltaY < 0 ? 15 : -15); img.style.transform = `rotate(${currentRot}deg)`;
            } else {
                let width = parseFloat(img.style.width); let change = (ev.deltaY < 0 ? 5 : -5); let newSize = width + change;
                if(newSize >= 20 && newSize <= 300) {
                    img.style.width = newSize + "px"; img.style.height = newSize + "px"; 
                    let offset = change / 2; img.style.left = (parseFloat(img.style.left) - offset) + "px"; img.style.top = (parseFloat(img.style.top) - offset) + "px";
                }
            }
            saveMapState();
        }, { passive: false });
    }
    canvasContent.appendChild(img);
}

// --- LEYENDA REESCALABLE INTELIGENTE ---
function checkLegendRemoval(id, category) {
    const remaining = canvasContent.querySelectorAll(`.placed-icon[data-id="${id}"]`);
    if (remaining.length === 0) {
        if (activeLegendItems[category]) activeLegendItems[category].delete(id.toString());
        updatePrintLegend();
    }
}

function updatePrintLegend() {
    const container = document.getElementById('print-legend-container');
    if(!container) return;
    container.innerHTML = ''; 
    
    let totalItems = 0;
    let activeCats = 0;
    for (const itemSet of Object.values(activeLegendItems)) {
        if (itemSet.size > 0) {
            totalItems += itemSet.size;
            activeCats++;
        }
    }

    if (totalItems === 0) {
        container.innerHTML = '<div class="empty-legend">Sin riesgos aÃ±adidos</div>';
        return;
    }

    let cols = 2; 
    let gap = 8;
    let headerSize = 0.65;
    let maxWidth = 70; 

    let volume = totalItems + (activeCats * 2);
    
    if (volume > 24) {
        cols = 4; gap = 4; headerSize = 0.5; maxWidth = 45;
    } else if (volume > 14) {
        cols = 3; gap = 5; headerSize = 0.55; maxWidth = 55;
    } else if (volume > 6) {
        cols = 2; gap = 6; headerSize = 0.6; maxWidth = 65;
    }

    for (const [categoryName, itemSet] of Object.entries(activeLegendItems)) {
        if (itemSet.size > 0) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'legend-group';
            groupDiv.style.marginBottom = `${gap}px`;
            
            groupDiv.innerHTML = `<div class="legend-group-header" style="font-size: ${headerSize}rem; margin-bottom: ${gap/2}px; padding-bottom: 2px;">${categoryName}</div>`;
            
            const itemsGrid = document.createElement('div'); 
            itemsGrid.className = 'legend-group-items';
            
            itemsGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            itemsGrid.style.gap = `${gap}px`;

            itemSet.forEach((id) => {
                const item = document.createElement('div'); 
                item.className = 'legend-item-box';
                item.innerHTML = `<img src="LEYENDA/${id}.png" class="legend-original-img" style="max-width: ${maxWidth}px;">`;
                itemsGrid.appendChild(item);
            });
            
            groupDiv.appendChild(itemsGrid); 
            container.appendChild(groupDiv);
        }
    }
}

// --- SUBIDA DE PLANO Y PDF ---
uploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if(file.size > 2000000) { alert("La imagen es muy pesada (Max 2MB). Por favor comprÃ­mela."); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            planImage.onload = () => {
                adjustCanvasSize(); 
                document.getElementById('placeholder-text').style.display = 'none';
                scale = 1; pointX = 0; pointY = 0; setTransform();
                saveMapState();
            };
            planImage.src = ev.target.result;
        }
        reader.readAsDataURL(file);
    }
});

window.downloadPDF = function() {
    if (window.getSelection) window.getSelection().removeAllRanges();
    document.activeElement.blur();
    
    const s = scale, x = pointX, y = pointY;
    scale = 1; pointX = 0; pointY = 0; setTransform();
    
    const element = document.getElementById('printable-area');
    const elementOriginalScale = element.style.transform;
    element.style.transform = 'scale(1)'; 
    
    const inputs = element.querySelectorAll('input'); const replacements = [];
    inputs.forEach(input => {
        const div = document.createElement('div'); div.textContent = input.value; div.className = input.classList.contains('tb-input-main') ? 'pdf-text-main' : 'pdf-text-replacement'; div.style.textAlign = "left";
        input.style.display = 'none'; input.parentNode.insertBefore(div, input); replacements.push({ input: input, div: div });
    });

    const btnPdf = document.querySelector('.btn-download'); const originalBtnText = btnPdf.innerHTML;
    btnPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...'; btnPdf.disabled = true;

    setTimeout(() => {
        html2canvas(element, { scale: 2, useCORS: true, allowTaint: true }).then(canvas => {
            element.style.transform = elementOriginalScale;
            replacements.forEach(r => { r.div.remove(); r.input.style.display = 'block'; });
            scale = s; pointX = x; pointY = y; setTransform();
            
            btnPdf.innerHTML = originalBtnText; btnPdf.disabled = false;

            const { jsPDF } = window.jspdf; const doc = new jsPDF('l', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const pdfW = doc.internal.pageSize.getWidth(); const pdfH = (canvas.height * pdfW) / canvas.width;
            
            doc.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH); doc.save('Mapa_Riesgos.pdf');
        }).catch(err => {
            console.error(err); alert("Error al crear PDF");
            element.style.transform = elementOriginalScale;
            replacements.forEach(r => { r.div.remove(); r.input.style.display = 'block'; });
            scale = s; pointX = x; pointY = y; setTransform();
            btnPdf.innerHTML = originalBtnText; btnPdf.disabled = false;
        });
    }, 150);
};

function adjustCanvasSize() {
    if (!planImage.src || planImage.src === window.location.href) return;
    const viewW = canvasViewport.clientWidth; const viewH = canvasViewport.clientHeight;
    const imgW = planImage.naturalWidth; const imgH = planImage.naturalHeight;
    if(imgW === 0 || imgH === 0) return;
    const imgRatio = imgW / imgH; const viewRatio = viewW / viewH;
    let finalW, finalH;
    if (imgRatio > viewRatio) { finalW = viewW; finalH = viewW / imgRatio; } else { finalH = viewH; finalW = viewH * imgRatio; }
    canvasContent.style.width = finalW + "px"; canvasContent.style.height = finalH + "px";
    canvasContent.style.left = ((viewW - finalW) / 2) + "px"; canvasContent.style.top = ((viewH - finalH) / 2) + "px";
    canvasContent.style.backgroundImage = `url(${planImage.src})`;
}