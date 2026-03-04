// db-manager.js - GESTOR DE BASE DE DATOS SIMULADA
const DB_KEY = 'SGS_MASTER_DB';
const SESSION_KEY = 'SGS_CURRENT_SESSION';

// Base de datos inicial (Solo tÃƒÂº existes al principio)
const initialDB = {
    superAdmin: { email: 'admin', pass: 'admin123' }, // TUS CREDENCIALES MAESTRAS
    companies: {} 
};

// Inicializar si estÃƒÂ¡ vacÃƒÂ­o
if (!localStorage.getItem(DB_KEY)) {
    localStorage.setItem(DB_KEY, JSON.stringify(initialDB));
}

// --- FUNCIONES DE ACCESO ---
function getMasterDB() { return JSON.parse(localStorage.getItem(DB_KEY)); }
function saveMasterDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

// LÃƒÂ³gica de Login
function attemptLogin(email, password) {
    const db = getMasterDB();

    // 1. Ã‚Â¿Eres tÃƒÂº (SuperAdmin)?
    if (email === db.superAdmin.email && password === db.superAdmin.pass) {
        const session = { type: 'SUPER_ADMIN' };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { success: true, type: 'SUPER_ADMIN' };
    }

    // 2. Ã‚Â¿Es un usuario de empresa?
    // Buscamos en todas las empresas registradas
    for (const [companyId, companyData] of Object.entries(db.companies)) {
        const user = companyData.users.find(u => u.email === email && u.pass === password);
        if (user) {
            const session = {
                type: 'COMPANY_USER',
                companyId: companyId,
                companyName: companyData.name,
                email: user.email,
                role: user.role // 'admin' (editor) o 'viewer' (lector)
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            // Guardamos compatibilidad para tus scripts viejos
            localStorage.setItem('sgsUserRole', user.role === 'editor' ? 'admin' : 'guest');
            return { success: true, type: 'COMPANY_USER' };
        }
    }
    return { success: false, msg: 'Usuario o contraseÃƒÂ±a incorrectos' };
}

// Para guardar datos del AST/Mapa especÃƒÂ­ficos de la empresa
function getCompanyData() {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!session || session.type !== 'COMPANY_USER') return null;
    const db = getMasterDB();
    return db.companies[session.companyId].data || {};
}

function saveCompanyData(key, data) {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!session || session.type !== 'COMPANY_USER') return;
    const db = getMasterDB();
    if (!db.companies[session.companyId].data) db.companies[session.companyId].data = {};
    db.companies[session.companyId].data[key] = data; // Ej: data['astData'] = [...]
    saveMasterDB(db);
}

function logout() {
    // 1. Borrar la llave
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('sgsUserRole');

    // 2. Reemplazar la historia actual para que no se pueda volver
    // Usamos 'replace' en vez de 'href' para matar el historial
    window.location.replace('index.html');
}

// --- FUNCIÃƒâ€œN PARA OBTENER MARCA (LOGO/NOMBRE) ---
// Nota para el futuro: Cuando pasemos a Nube, esta funciÃƒÂ³n pedirÃƒÂ¡ la URL de la imagen.
function getCompanyBranding() {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    // Si no hay sesiÃƒÂ³n o es super admin, devolvemos valores por defecto
    if (!session || session.type !== 'COMPANY_USER') return null;

    const db = getMasterDB();
    const comp = db.companies[session.companyId];
    
    return {
        name: comp.name,
        // Si existe la propiedad 'logo', la devuelve, si no, devuelve null
        logo: comp.logo || null 
    };
}