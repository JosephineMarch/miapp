// Importa las funciones necesarias del SDK de Firebase v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Configuración de Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyD0gGVvxwFxEnfbOYIhwVDExSR9HZy1YG4",
    authDomain: "miapp-e4dc6.firebaseapp.com",
    projectId: "miapp-e4dc6",
    storageBucket: "miapp-e4dc6.appspot.com",
    messagingSenderId: "815058398646",
    appId: "1:815058398646:web:15d8a49b50ac5c660de517",
    measurementId: "G-ZG1T9MZ8MD"
};

// --- Inicialización de Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;

// --- Referencias a Elementos UI ---
const ui = {
    loginView: document.getElementById('login-view'),
    mainContent: document.getElementById('main-content'),
    bottomNav: document.getElementById('bottom-nav'),
    userProfileIcon: document.getElementById('user-profile-icon'),
    loginButton: document.getElementById('login-button'),
    fabContainer: document.getElementById('fab-container'),
    fabButton: document.getElementById('fab-add-button'),
    modal: document.createElement('div'),
};
ui.modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 hidden z-50';
document.body.appendChild(ui.modal);

// --- Estado de la Aplicación ---
const state = {
    currentView: 'dashboard-view',
    tasks: [],
    projects: [],
    transactions: [],
};

// --- Textos de la Interfaz (i18n) ---
const texts = {
    welcome: "¡Bienvenido/a de nuevo!",
    progress: "Tu progreso",
    tasksCompleted: "Tareas Completadas",
    unlockKitten: "¡Sigue así para desbloquear un nuevo gatito!",
    seeAll: "Ver todo",
    recentTasks: "Tareas Recientes",
    quickStats: "Estadísticas Rápidas",
    financesSummary: "Resumen Financiero",
    balance: "Balance Actual",
    streak: "Racha",
    daysInARow: "días seguidos",
    home: "Inicio",
    tasks: "Tareas",
    projects: "Proyectos",
    money: "Dinero",
    achievements: "Logros",
    new_task: "Nueva Tarea",
    edit_task: "Editar Tarea",
    task_title: "Título de la tarea",
    new_project: "Nuevo Proyecto",
    edit_project: "Editar Proyecto",
    project_title: "Título del proyecto",
    description: "Descripción",
    due_date: "Fecha Límite",
    steps: "Pasos",
    add_step: "+ Añadir paso",
    new_transaction: "Nueva Transacción",
    edit_transaction: "Editar Transacción",
    amount: "Monto",
    type: "Tipo",
    expense: "Gasto",
    income: "Ingreso",
    category: "Categoría",
    date: "Fecha",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    no_tasks: "No hay tareas pendientes. ¡Buen trabajo!",
    no_projects: "No hay proyectos activos. ¡Empieza uno nuevo!",
    no_transactions: "Aún no hay transacciones.",
    are_you_sure: "¿Estás seguro/a de que quieres eliminar esto?",
    confirm_delete: "Confirmar Eliminación",
    completed: "Completado",
};

// =================================================================================
// --- AUTENTICACIÓN (CON LA CORRECCIÓN PARA EL MÓVIL) ---
// =================================================================================
onAuthStateChanged(auth, async (user) => { // <-- Se añade 'async' aquí
    if (user) {
        currentUser = user;
        document.body.classList.add('logged-in');
        ui.mainContent.classList.remove('hidden');
        ui.bottomNav.classList.remove('hidden');
        ui.fabContainer.classList.remove('hidden');
        ui.loginView.classList.add('hidden');
        ui.userProfileIcon.innerHTML = `<img src="${user.photoURL}" alt="User" class="w-9 h-9 rounded-full cursor-pointer">`;
        
        initializeAppShell();
        await initCloudExplorer(); // <-- Se añade 'await' para esperar a que los datos carguen
        
        // Una vez cargado todo, renderizamos la vista por defecto
        renderView(state.currentView);

    } else {
        currentUser = null;
        document.body.classList.remove('logged-in');
        ui.mainContent.classList.add('hidden');
        ui.bottomNav.classList.add('hidden');
        ui.fabContainer.classList.add('hidden');
        ui.loginView.classList.remove('hidden');
        ui.userProfileIcon.innerHTML = `<i class="fa-regular fa-user text-primary-dark text-lg"></i>`;
        // Limpiamos los datos al cerrar sesión
        state.tasks = [];
        state.projects = [];
        state.transactions = [];
        cloudData = []; // <-- Limpiamos los datos de la nube también
    }
});

ui.loginButton.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
ui.userProfileIcon.onclick = () => { if (currentUser) signOut(auth); };


// =================================================================================
// --- INICIALIZACIÓN Y NAVEGACIÓN (LIGERO CAMBIO) ---
// =================================================================================
function initializeAppShell() {
    renderAppLayout();
    attachBaseEventListeners();
    setupRealtimeListeners();
    // Ya no renderizamos la vista aquí, lo hacemos después de cargar los datos
}

function renderAppLayout() {
    const navIcons = {
        'dashboard-view': 'fa-regular fa-house',
        'tasks-view': 'fa-regular fa-square-check',
        'projects-view': 'fa-regular fa-diagram-project',
        'cloud-explorer-view': 'fa-regular fa-cloud',
        'finances-view': 'fa-regular fa-wallet',
        'kittens-view': 'fa-regular fa-cat'
    };
    const navLabels = {
        'dashboard-view': texts.home,
        'tasks-view': texts.tasks,
        'projects-view': texts.projects,
        'cloud-explorer-view': 'Nubes',
        'finances-view': texts.money,
        'kittens-view': texts.achievements
    };

    ui.mainContent.innerHTML = `
        <div id="dashboard-view" class="p-6"></div>
        <div id="tasks-view" class="p-6 hidden"></div>
        <div id="projects-view" class="p-6 hidden"></div>
        <div id="cloud-explorer-view" class="p-6 hidden"></div>
        <div id="finances-view" class="p-6 hidden"></div>
        <div id="kittens-view" class="p-6 hidden"><p class="text-center text-text-muted">${texts.achievements} próximamente...</p></div>
    `;

    ui.bottomNav.innerHTML = `
        <div class="flex justify-around items-center h-full">
            ${Object.keys(navIcons).map(view => `
                <button data-view="${view}" class="tab-btn flex flex-col items-center justify-center w-full h-full">
                    <i class="${navIcons[view]} text-2xl"></i>
                    <span class="text-xs mt-1 font-semibold">${navLabels[view]}</span>
                </button>
            `).join('')}
        </div>
    `;
    
    ui.bottomNav.querySelector('[data-view="dashboard-view"]')?.classList.add('tab-active');
}

function attachBaseEventListeners() {
    ui.bottomNav.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            const viewId = e.currentTarget.dataset.view;
            ui.bottomNav.querySelector('.tab-active')?.classList.remove('tab-active');
            e.currentTarget.classList.add('tab-active');
            renderView(viewId);
        };
    });

    ui.fabButton.onclick = () => {
        switch (state.currentView) {
            case 'tasks-view': handleAddTask(); break;
            case 'projects-view': handleAddProject(); break;
            case 'finances-view': handleAddTransaction(); break;
            default: handleAddTask();
        }
    };
}

function setupRealtimeListeners() {
    if (!currentUser) return;
    const collections = ['tasks', 'projects', 'transactions'];
    collections.forEach(name => {
        const q = query(collection(db, 'users', currentUser.uid, name), orderBy('createdAt', 'desc'));
        onSnapshot(q, (snapshot) => {
            state[name] = snapshot.docs.map(doc => {
                const data = doc.data();
                const toDateSafe = (field) => (field && typeof field.toDate === 'function') ? field.toDate() : (field ? new Date(field) : null);
                return { id: doc.id, ...data, createdAt: toDateSafe(data.createdAt), dueDate: toDateSafe(data.dueDate), date: toDateSafe(data.date) };
            });
            renderView(state.currentView);
        });
    });
}

function renderView(viewId) {
    state.currentView = viewId;
    ui.mainContent.querySelectorAll('div[id$="-view"]').forEach(v => v.classList.add('hidden'));
    const viewContainer = document.getElementById(viewId);
    if (viewContainer) {
        viewContainer.classList.remove('hidden');
        switch (viewId) {
            case 'dashboard-view': renderDashboard(); break;
            case 'tasks-view': renderTasks(); break;
            case 'projects-view': renderProjects(); break;
            case 'cloud-explorer-view': renderCloudExplorer(); break;
            case 'finances-view': renderFinances(); break;
        }
    }
}

// =================================================================================
// --- LÓGICA DEL EXPLORADOR DE NUBES (VERSIÓN 2.0 con ÁRBOL DE CARPETAS) ---
// =================================================================================

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTo02xMWzMN--bzWUEjCM4qPnt0irknRoH5oA5pW1q_JJ6zX1e5_Q1C1FQxa3anNLgw7zrvI-CPCTyX/pub?gid=0&single=true&output=csv';
let cloudData = [];
let folderTree = {};

async function initCloudExplorer() {
    if (cloudData.length > 0) return;
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) { throw new Error(`Error en la red: ${response.statusText}`); }
        const csvText = await response.text();
        cloudData = parseCSV(csvText);
        folderTree = buildFolderTree(cloudData);
        console.log(`Cargados ${cloudData.length} archivos y árbol de carpetas construido.`);
    } catch (error) {
        console.error("Error al cargar los datos del explorador:", error);
        cloudData = []; // Asegurarse de que esté vacío si falla
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const values = lines[i].split(',');
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = values[j] ? values[j].trim() : '';
        }
        result.push(obj);
    }
    return result;
}

function buildFolderTree(data) {
    const tree = {};
    const paths = [...new Set(data.map(item => item['Ruta (Path)']))].filter(Boolean);

    paths.forEach(path => {
        let currentNode = tree;
        const parts = path.split('/');
        parts.forEach(part => {
            if (!currentNode[part]) {
                currentNode[part] = {};
            }
            currentNode = currentNode[part];
        });
    });
    return tree;
}

function renderCloudExplorer() {
    const container = document.getElementById('cloud-explorer-view');
    if (!container) return;

    container.innerHTML = `
        <h2 class="text-3xl font-bold text-accent-purple mb-6 text-center">Explorador de Nubes</h2>
        <div class="explorer-layout">
            <aside class="explorer-sidebar">
                <div id="folder-tree-container"></div>
            </aside>
            <main class="explorer-content">
                <input type="text" id="file-search-input" placeholder="Buscar en todos los archivos..." class="w-full bg-gray-100 border-transparent rounded-lg p-3 text-sm focus:ring-2 focus:ring-accent-purple mb-4">
                <div id="files-container" class="space-y-2"></div>
            </main>
        </div>
    `;

    if (cloudData.length === 0) {
        document.getElementById('files-container').innerHTML = '<p class="text-text-muted text-center py-8">Cargando datos...</p>';
        return;
    }

    renderFolderTree(folderTree, document.getElementById('folder-tree-container'));
    displayFiles(cloudData); // Muestra todos al inicio
    
    document.getElementById('file-search-input').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (!searchTerm) {
            displayFiles(cloudData);
            return;
        }
        const filteredData = cloudData.filter(file => file['Nombre Archivo'].toLowerCase().includes(searchTerm));
        displayFiles(filteredData, true);
    });
}

function renderFolderTree(node, parentElement, currentPath = '') {
    const ul = document.createElement('ul');
    if(currentPath !== '') ul.className = 'ml-4 hidden'; // Oculto por defecto, excepto el nivel raíz

    // Botón para mostrar todos los archivos si estamos en la raíz
    if (currentPath === '') {
        const allFilesLi = document.createElement('li');
        allFilesLi.innerHTML = `<i class="fa-regular fa-folder-open mr-2"></i> Todos los Archivos`;
        allFilesLi.className = 'folder-item font-bold cursor-pointer p-2 rounded-lg tab-active';
        allFilesLi.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('tab-active'));
            allFilesLi.classList.add('tab-active');
            displayFiles(cloudData);
        };
        ul.appendChild(allFilesLi);
    }
    
    Object.keys(node).sort().forEach(key => {
        const newPath = currentPath ? `${currentPath}/${key}` : key;
        const li = document.createElement('li');
        li.className = 'folder-item cursor-pointer p-2 rounded-lg hover:bg-gray-100';
        
        const hasChildren = Object.keys(node[key]).length > 0;
        const icon = hasChildren ? '<i class="fa-solid fa-chevron-right text-xs mr-2 transition-transform"></i>' : '<i class="fa-regular fa-folder mr-2"></i>';
        
        li.innerHTML = `<div>${icon} ${key}</div>`;
        
        li.onclick = (e) => {
            e.stopPropagation();
            // Lógica de selección
            document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('tab-active'));
            li.classList.add('tab-active');

            // Muestra los archivos de esta carpeta
            const filtered = cloudData.filter(file => file['Ruta (Path)'] === newPath);
            displayFiles(filtered, true);

            // Expande/contrae el sub-árbol
            if (hasChildren) {
                const subUl = li.querySelector('ul');
                const chevron = li.querySelector('.fa-chevron-right');
                if (subUl) {
                    subUl.classList.toggle('hidden');
                    chevron.classList.toggle('rotate-90');
                }
            }
        };

        if (hasChildren) {
            renderFolderTree(node[key], li, newPath);
        }
        ul.appendChild(li);
    });
    parentElement.appendChild(ul);
}

function displayFiles(files, isFiltered = false) {
    // ... (Esta función no necesita grandes cambios, la pego por completitud)
    const filesContainer = document.getElementById('files-container');
    filesContainer.innerHTML = '';

    if (files.length === 0) {
        filesContainer.innerHTML = `<p class="text-text-muted text-center py-8">${isFiltered ? 'No hay archivos en esta carpeta.' : 'No se encontraron archivos.'}</p>`;
        return;
    }

    files.sort((a, b) => {
        if (a.Tipo === 'Carpeta' && b.Tipo !== 'Carpeta') return -1;
        if (a.Tipo !== 'Carpeta' && b.Tipo === 'Carpeta') return 1;
        return a['Nombre Archivo'].localeCompare(b['Nombre Archivo']);
    }).forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.className = 'bg-surface p-3 rounded-lg flex items-center justify-between card-hover';
        
        let fileIcon = 'fa-regular fa-file';
        if (file.Tipo === 'Carpeta') fileIcon = 'fa-regular fa-folder text-yellow-500';
        else if (file['Nombre Archivo'].includes('.pdf')) fileIcon = 'fa-regular fa-file-pdf text-red-500';
        else if (/\.(png|jpg|jpeg|gif|svg)$/i.test(file['Nombre Archivo'])) fileIcon = 'fa-regular fa-file-image text-blue-500';
        else if (/\.(doc|docx)$/i.test(file['Nombre Archivo'])) fileIcon = 'fa-regular fa-file-word text-blue-600';

        const hasPublicLink = file['Enlace compartir'] && file['Enlace compartir'] !== 'Privado';

        fileElement.innerHTML = `
            <div class="flex items-center flex-grow overflow-hidden mr-4">
                <i class="${fileIcon} text-xl mr-4"></i>
                <a href="${file['Enlace al original']}" target="_blank" class="font-semibold text-primary-dark hover:underline truncate" title="${file['Nombre Archivo']}">${file['Nombre Archivo']}</a>
            </div>
            ${hasPublicLink ? `<a href="${file['Enlace compartir']}" target="_blank" class="text-accent-purple hover:opacity-80 flex-shrink-0" title="Abrir enlace compartido"><i class="fa-solid fa-share-nodes"></i></a>` : ''}
        `;
        filesContainer.appendChild(fileElement);
    });
}


// =================================================================================
// --- SISTEMA DE MODALES ---
// =================================================================================
function openModal({ title, fields, onSave, data = {}, onDelete }) {
    let fieldsHTML = '';
    for (const field of fields) {
        const value = data[field.id] || field.default || '';
        const inputId = `modal-input-${field.id}`;
        const inputClasses = "w-full bg-gray-100 border-transparent rounded-lg p-3 focus:ring-2 focus:ring-accent-purple focus:border-transparent";
        switch (field.type) {
            case 'text':
                fieldsHTML += `<div class="mb-4"><label for="${inputId}" class="block text-sm font-medium text-text-muted mb-1">${field.label}</label><input type="text" id="${inputId}" value="${value}" class="${inputClasses}" ${field.required ? 'required' : ''}></div>`;
                break;
            case 'textarea':
                 fieldsHTML += `<div class="mb-4"><label for="${inputId}" class="block text-sm font-medium text-text-muted mb-1">${field.label}</label><textarea id="${inputId}" class="${inputClasses}" rows="3">${value}</textarea></div>`;
                break;
            case 'number':
                fieldsHTML += `<div class="mb-4"><label for="${inputId}" class="block text-sm font-medium text-text-muted mb-1">${field.label}</label><input type="number" id="${inputId}" value="${value}" step="0.01" class="${inputClasses}" ${field.required ? 'required' : ''}></div>`;
                break;
            case 'select':
                fieldsHTML += `<div class="mb-4"><label for="${inputId}" class="block text-sm font-medium text-text-muted mb-1">${field.label}</label><select id="${inputId}" class="${inputClasses}">${field.options.map(opt => `<option value="${opt.value}" ${opt.value == value ? 'selected' : ''}>${opt.label}</option>`).join('')}</select></div>`;
                break;
            case 'date':
                const dateValue = value instanceof Date ? value.toISOString().split('T')[0] : value || new Date().toISOString().split('T')[0];
                fieldsHTML += `<div class="mb-4"><label for="${inputId}" class="block text-sm font-medium text-text-muted mb-1">${field.label}</label><input type="date" id="${inputId}" value="${dateValue}" class="${inputClasses}"></div>`;
                break;
            case 'steps':
                fieldsHTML += `<div class="mb-4"><h4 class="text-sm font-medium text-text-muted mb-2">${texts.steps}</h4><div id="steps-container" class="space-y-2">${(value || []).map((step, i) => renderStepInput(step)).join('')}</div><button type="button" id="add-step-btn" class="mt-2 text-sm text-accent-purple hover:underline">${texts.add_step}</button></div>`;
                break;
        }
    }

    ui.modal.innerHTML = `
        <div class="bg-surface rounded-3xl shadow-xl w-full max-w-md m-4 transform transition-all">
            <header class="flex justify-between items-center p-4 border-b border-gray-100">
                <h3 class="text-lg font-bold text-primary-dark">${title}</h3>
                <button class="cancel-btn text-text-muted hover:text-primary-dark"><i class="fas fa-times"></i></button>
            </header>
            <form id="modal-form" class="p-6">
                ${fieldsHTML}
            </form>
            <footer class="flex justify-end items-center p-4 bg-gray-50 rounded-b-3xl space-x-3">
                ${onDelete ? `<button class="delete-btn bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600">${texts.delete}</button>` : ''}
                <button class="cancel-btn bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">${texts.cancel}</button>
                <button class="save-btn bg-accent-purple text-white font-bold py-2 px-4 rounded-lg hover:opacity-90">${texts.save}</button>
            </footer>
        </div>
    `;
    ui.modal.classList.remove('hidden');

    const form = document.getElementById('modal-form');
    form.onsubmit = (e) => e.preventDefault();
    document.querySelector('.save-btn').onclick = () => {
        const newData = {};
        for (const field of fields) {
            if (field.type === 'steps') {
                newData[field.id] = Array.from(document.querySelectorAll('#steps-container > div')).map(div => ({
                    title: div.querySelector('input[type="text"]').value,
                    completed: div.querySelector('input[type="checkbox"]').checked,
                }));
            } else {
                const input = document.getElementById(`modal-input-${field.id}`);
                newData[field.id] = (input.type === 'date' || input.type === 'datetime-local') ? new Date(input.value) : (input.type === 'number' ? parseFloat(input.value) : input.value);
            }
        }
        onSave(newData);
        closeModal();
    };
    if (onDelete) { document.querySelector('.delete-btn').onclick = () => { if (confirm(texts.are_you_sure)) { onDelete(); closeModal(); } }; }
    document.querySelectorAll('.cancel-btn').forEach(btn => btn.onclick = closeModal);
    const addStepBtn = document.getElementById('add-step-btn');
    if (addStepBtn) { addStepBtn.onclick = () => document.getElementById('steps-container').insertAdjacentHTML('beforeend', renderStepInput()); }
}

function closeModal() {
    ui.modal.classList.add('hidden');
    ui.modal.innerHTML = '';
}

function renderStepInput(step = { title: '', completed: false }) {
    return `
        <div class="flex items-center space-x-2">
            <input type="checkbox" ${step.completed ? 'checked' : ''} class="h-5 w-5 rounded-md border-gray-300 text-accent-purple focus:ring-accent-purple">
            <input type="text" value="${step.title || ''}" class="flex-grow border-0 border-b-2 bg-transparent p-1 focus:ring-0 focus:border-accent-purple text-sm" placeholder="Descripción del paso">
            <button type="button" onclick="this.parentElement.remove()" class="remove-step-btn text-text-muted hover:text-red-500"><i class="fas fa-trash-alt"></i></button>
        </div>`;
}

// =================================================================================
// --- LÓGICA DE COLECCIONES (CRUD) ---
// =================================================================================
function handleAddTask() { openModal({ title: texts.new_task, fields: [{ id: 'title', label: texts.task_title, type: 'text', required: true }], onSave: (data) => addDoc(collection(db, 'users', currentUser.uid, 'tasks'), { ...data, completed: false, createdAt: serverTimestamp() }) }); }
function handleEditTask(task) { openModal({ title: texts.edit_task, fields: [{ id: 'title', label: texts.task_title, type: 'text', required: true }], data: task, onSave: (data) => updateDoc(doc(db, 'users', currentUser.uid, 'tasks', task.id), data), onDelete: () => deleteTask(task.id) }); }
function handleToggleTask(task) { updateDoc(doc(db, 'users', currentUser.uid, 'tasks', task.id), { completed: !task.completed }); }
function deleteTask(id) { deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', id)); }
function handleAddProject() { openModal({ title: texts.new_project, fields: [ { id: 'title', label: texts.project_title, type: 'text', required: true }, { id: 'description', label: texts.description, type: 'textarea' }, { id: 'dueDate', label: texts.due_date, type: 'date' }, { id: 'steps', label: texts.steps, type: 'steps' } ], onSave: (data) => addDoc(collection(db, 'users', currentUser.uid, 'projects'), { ...data, createdAt: serverTimestamp() }) }); }
function handleEditProject(project) { openModal({ title: texts.edit_project, data: project, fields: [ { id: 'title', label: texts.project_title, type: 'text', required: true }, { id: 'description', label: texts.description, type: 'textarea' }, { id: 'dueDate', label: texts.due_date, type: 'date' }, { id: 'steps', label: texts.steps, type: 'steps' } ], onSave: (data) => updateDoc(doc(db, 'users', currentUser.uid, 'projects', project.id), data), onDelete: () => deleteDoc(doc(db, 'users', currentUser.uid, 'projects', project.id)) }); }
function handleToggleProjectStep(projectId, stepIndex) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project || !project.steps) return;
    const updatedSteps = project.steps.map((step, index) => {
        if (index === stepIndex) { return { ...step, completed: !step.completed }; }
        return step;
    });
    updateDoc(doc(db, 'users', currentUser.uid, 'projects', projectId), { steps: updatedSteps });
}
function handleAddTransaction() { openModal({ title: texts.new_transaction, fields: [ { id: 'description', label: texts.description, type: 'text', required: true }, { id: 'amount', label: texts.amount, type: 'number', required: true }, { id: 'type', label: texts.type, type: 'select', options: [{value: 'expense', label: texts.expense}, {value: 'income', label: texts.income}]}, { id: 'category', label: texts.category, type: 'text' }, { id: 'date', label: texts.date, type: 'date' } ], onSave: (data) => addDoc(collection(db, 'users', currentUser.uid, 'transactions'), { ...data, createdAt: serverTimestamp() }) }); }
function handleEditTransaction(transaction) { openModal({ title: texts.edit_transaction, data: transaction, fields: [ { id: 'description', label: texts.description, type: 'text', required: true }, { id: 'amount', label: texts.amount, type: 'number', required: true }, { id: 'type', label: texts.type, type: 'select', options: [{value: 'expense', label: texts.expense}, {value: 'income', label: texts.income}]}, { id: 'category', label: texts.category, type: 'text' }, { id: 'date', label: texts.date, type: 'date' } ], onSave: (data) => updateDoc(doc(db, 'users', currentUser.uid, 'transactions', transaction.id), data), onDelete: () => deleteDoc(doc(db, 'users',currentUser.uid, 'transactions', transaction.id)) }); }

// =================================================================================
// --- LÓGICA DEL EXPLORADOR DE NUBES ---
// =================================================================================

// Pega aquí el enlace CSV que publicaste en Google Sheets
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTo02xMWzMN--bzWUEjCM4qPnt0irknRoH5oA5pW1q_JJ6zX1e5_Q1C1FQxa3anNLgw7zrvI-CPCTyX/pub?gid=0&single=true&output=csv';
let cloudData = []; // Guardaremos los datos aquí para no pedirlos cada vez

async function initCloudExplorer() {
    if (cloudData.length > 0) return; // Si ya los tenemos, no hacemos nada
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) { throw new Error(`Error en la red: ${response.statusText}`); }
        const csvText = await response.text();
        // Usamos una función de parseo más robusta
        cloudData = parseCSV(csvText);
        console.log(`Cargados ${cloudData.length} archivos de la nube.`);
        // Si el usuario está viendo el explorador, lo renderizamos de nuevo
        if(state.currentView === 'cloud-explorer-view') {
            renderCloudExplorer();
        }
    } catch (error) {
        console.error("Error al cargar los datos del explorador:", error);
        const container = document.getElementById('cloud-explorer-view');
        if (container) {
             container.innerHTML = '<p class="text-center text-red-500">No se pudieron cargar los datos de la nube. Revisa el enlace CSV.</p>';
        }
    }
}

function parseCSV(text) {
    // Función de parseo mejorada que maneja comas dentro de los campos
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        // Esta expresión regular simple asume que no hay comas escapadas dentro de comillas
        const values = lines[i].split(',');
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = values[j] ? values[j].trim() : '';
        }
        result.push(obj);
    }
    return result;
}

function renderCloudExplorer() {
    const container = document.getElementById('cloud-explorer-view');
    if (!container) return;

    // Estructura HTML del explorador
    container.innerHTML = `
        <h2 class="text-3xl font-bold text-accent-purple mb-6 text-center">Explorador de Nubes</h2>
        <div class="explorer-layout">
            <aside class="explorer-sidebar">
                <h4 class="font-bold mb-2">Carpetas</h4>
                <ul id="folder-list"></ul>
            </aside>
            <main class="explorer-content">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-bold">Archivos</h4>
                    <input type="text" id="file-search-input" placeholder="Buscar archivos..." class="w-1/2 bg-gray-100 border-transparent rounded-lg p-2 text-sm focus:ring-2 focus:ring-accent-purple">
                </div>
                <div id="files-container" class="space-y-2"></div>
            </main>
        </div>
    `;

    if (cloudData.length === 0) {
        document.getElementById('files-container').innerHTML = '<p class="text-text-muted text-center py-8">Cargando datos...</p>';
        return;
    }

    displayFolders(cloudData);
    displayFiles(cloudData);
    
    // Añadimos el listener para el buscador
    document.getElementById('file-search-input').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredData = cloudData.filter(file => file['Nombre Archivo'].toLowerCase().includes(searchTerm));
        displayFiles(filteredData);
    });
}

function displayFolders(data) {
    const folderListElement = document.getElementById('folder-list');
    const paths = [...new Set(data.map(item => item['Ruta (Path)']))].filter(Boolean); // Obtiene rutas únicas y elimina vacías
    
    folderListElement.innerHTML = '';
    
    const allFoldersLi = document.createElement('li');
    allFoldersLi.innerHTML = `<i class="fa-regular fa-folder-open mr-2"></i> Todas las carpetas`;
    allFoldersLi.className = 'p-2 cursor-pointer rounded-lg font-semibold tab-active'; // Usamos la clase de tu app
    allFoldersLi.onclick = () => {
        document.querySelectorAll('#folder-list li').forEach(li => li.classList.remove('tab-active'));
        allFoldersLi.classList.add('tab-active');
        displayFiles(data);
    };
    folderListElement.appendChild(allFoldersLi);

    paths.sort().forEach(path => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<i class="fa-regular fa-folder mr-2"></i> ${path.replace('Mi unidad/', '')}`;
        listItem.className = 'p-2 cursor-pointer rounded-lg text-text-muted hover:bg-gray-100';
        listItem.onclick = () => {
            document.querySelectorAll('#folder-list li').forEach(li => li.classList.remove('tab-active'));
            listItem.classList.add('tab-active');
            const filtered = data.filter(item => item['Ruta (Path)'] === path);
            displayFiles(filtered, true);
        };
        folderListElement.appendChild(listItem);
    });
}

function displayFiles(files, isFiltered = false) {
    const filesContainer = document.getElementById('files-container');
    filesContainer.innerHTML = '';

    if (files.length === 0) {
        filesContainer.innerHTML = `<p class="text-text-muted text-center py-8">${isFiltered ? 'No hay archivos en esta carpeta.' : 'No se encontraron archivos.'}</p>`;
        return;
    }

    files.sort((a, b) => a['Nombre Archivo'].localeCompare(b['Nombre Archivo'])).forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.className = 'bg-surface p-3 rounded-lg flex items-center justify-between card-hover';
        
        let fileIcon = 'fa-regular fa-file';
        if (file.Tipo === 'Carpeta') fileIcon = 'fa-regular fa-folder text-yellow-500';
        else if (file['Nombre Archivo'].includes('.pdf')) fileIcon = 'fa-regular fa-file-pdf text-red-500';
        else if (/\.(png|jpg|jpeg|gif|svg)$/i.test(file['Nombre Archivo'])) fileIcon = 'fa-regular fa-file-image text-blue-500';
        else if (/\.(doc|docx)$/i.test(file['Nombre Archivo'])) fileIcon = 'fa-regular fa-file-word text-blue-600';

        const hasPublicLink = file['Enlace compartir'] && file['Enlace compartir'] !== 'Privado';

        fileElement.innerHTML = `
            <div class="flex items-center flex-grow">
                <i class="${fileIcon} text-xl mr-4"></i>
                <a href="${file['Enlace al original']}" target="_blank" class="font-semibold text-primary-dark hover:underline">${file['Nombre Archivo']}</a>
            </div>
            ${hasPublicLink ? `<a href="${file['Enlace compartir']}" target="_blank" class="text-accent-purple hover:opacity-80" title="Abrir enlace compartido"><i class="fa-solid fa-share-nodes"></i></a>` : ''}
        `;
        filesContainer.appendChild(fileElement);
    });
}

// =================================================================================
// --- RENDERIZADO DE VISTAS ---
// =================================================================================
function renderDashboard() {
    const container = document.getElementById('dashboard-view');
    const completedTasks = state.tasks.filter(t => t.completed).length;
    const totalTasks = state.tasks.length;

    container.innerHTML = `
        <h2 class="text-3xl font-bold text-primary-dark mb-6">${texts.welcome} <span class="text-accent-purple">${currentUser.displayName.split(' ')[0]}</span>!</h2>
        
        <div class="mb-8">
            <h3 class="text-xl font-bold text-primary-dark mb-4">${texts.quickStats}</h3>
            <div class="grid grid-cols-2 gap-4">
                <!-- TARJETA CON FONDO MORADO SUAVE -->
                <div class="bg-accent-purple-soft rounded-2xl p-4 shadow-sm">
                    <div class="flex items-center mb-2">
                        <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center mr-3"><i class="fa-regular fa-square-check text-accent-purple"></i></div>
                        <h4 class="font-bold text-primary-dark">${texts.tasks}</h4>
                    </div>
                    <p class="text-lg font-bold text-primary-dark">${completedTasks}/${totalTasks} <span class="text-sm font-normal text-text-muted">${texts.completed}</span></p>
                </div>
                <!-- TARJETA CON FONDO ROSA SUAVE -->
                <div class="bg-accent-pink-soft rounded-2xl p-4 shadow-sm">
                    <div class="flex items-center mb-2">
                        <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center mr-3"><i class="fa-regular fa-star text-accent-magenta"></i></div>
                        <h4 class="font-bold text-primary-dark">${texts.streak}</h4>
                    </div>
                    <p class="text-lg font-bold text-primary-dark">0 <span class="text-sm font-normal text-text-muted">${texts.daysInARow}</span></p>
                </div>
            </div>
        </div>

        <div class="mb-8">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-primary-dark">${texts.recentTasks}</h3>
                <a href="#" class="text-sm text-accent-purple font-semibold hover:underline" onclick="document.querySelector('[data-view=\\'tasks-view\\']').click()">${texts.seeAll}</a>
            </div>
            <div class="space-y-3">
                ${state.tasks.slice(0, 3).map(task => `
                    <div class="bg-surface rounded-2xl p-4 shadow-sm flex items-center">
                        <i class="fa-regular ${task.completed ? 'fa-circle-check text-accent-purple' : 'fa-circle text-text-muted'} text-2xl mr-4"></i>
                        <div class="flex-grow font-semibold text-primary-dark ${task.completed ? 'line-through text-text-muted' : ''}">${task.title}</div>
                    </div>
                `).join('') || `<p class="text-center text-text-muted py-4">${texts.no_tasks}</p>`}
            </div>
        </div>
    `;
}

function renderTasks() {
    const container = document.getElementById('tasks-view');
    container.innerHTML = `
        <div class="flex justify-center items-center mb-4">
            <h2 class="text-3xl font-bold text-accent-purple">${texts.tasks}</h2>
        </div>
        <div class="flex justify-center mb-6">
             <img src="https://cdn.prod.website-files.com/5d5e2ff58f10c53dcffd8683/5db1e0e7e74e34610bcb4951_sprinting.gif" class="w-48 h-auto rounded-2xl illustration" alt="Task illustration">
        </div>
        <div class="space-y-4">
            ${state.tasks.length > 0 ? state.tasks.map(task => `
                <div class="bg-accent-purple-soft rounded-2xl p-5 shadow-sm flex items-center card-hover">
                    <button data-id="${task.id}" class="task-check-btn flex-shrink-0 mr-4">
                        <i class="fa-regular ${task.completed ? 'fa-circle-check text-accent-purple' : 'fa-circle text-text-muted'} text-3xl"></i>
                    </button>
                    <div class="flex-grow font-semibold text-primary-dark ${task.completed ? 'line-through text-text-muted' : ''}">${task.title}</div>
                    <button class="edit-task-btn text-text-muted hover:text-accent-purple" data-id="${task.id}"><i class="fa-regular fa-pen-to-square"></i></button>
                </div>
            `).join('') : `<p class="text-center text-text-muted py-8">${texts.no_tasks}</p>`}
        </div>
    `;
    container.querySelectorAll('.task-check-btn').forEach(btn => btn.onclick = () => handleToggleTask(state.tasks.find(t => t.id === btn.dataset.id)));
    container.querySelectorAll('.edit-task-btn').forEach(btn => btn.onclick = () => handleEditTask(state.tasks.find(t => t.id === btn.dataset.id)));
}

function renderProjects() {
    const container = document.getElementById('projects-view');
    container.innerHTML = `
        <div class="flex justify-center items-center mb-4"><h2 class="text-3xl font-bold text-accent-purple">${texts.projects}</h2></div>
        <div class="flex justify-center mb-6">
             <img src="https://cdn.prod.website-files.com/5d5e2ff58f10c53dcffd8683/5d5e30d9898356c023c60de1_loving.svg" class="w-48 h-auto rounded-2xl illustration" alt="Project illustration">
        </div>
        <div class="space-y-5">
            ${state.projects.length > 0 ? state.projects.map(project => {
                const totalSteps = project.steps?.length || 0;
                const completedSteps = project.steps?.filter(s => s.completed).length || 0;
                const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
                
                const stepsHTML = (project.steps && project.steps.length > 0) ? `
                    <div class="mt-4 pt-4 border-t border-gray-100 space-y-3">
                        ${project.steps.map((step, index) => `
                            <div class="flex items-center">
                                <input type="checkbox" id="step-${project.id}-${index}" data-project-id="${project.id}" data-step-index="${index}" class="step-checkbox h-5 w-5 rounded-md border-gray-300 text-accent-purple focus:ring-accent-purple mr-3 cursor-pointer" ${step.completed ? 'checked' : ''}>
                                <label for="step-${project.id}-${index}" class="text-sm font-medium ${step.completed ? 'line-through text-text-muted' : 'text-primary-dark'} cursor-pointer">${step.title}</label>
                            </div>
                        `).join('')}
                    </div>
                ` : '';

                return `
                <div class="bg-accent-pink-soft rounded-3xl p-5 shadow-sm card-hover">
                    <div class="project-header cursor-pointer" data-id="${project.id}">
                        <h3 class="font-bold text-lg text-accent-purple">${project.title}</h3>
                        <p class="text-sm text-text-muted mt-1 mb-3">${project.description || ''}</p>
                    </div>
                    
                    <div class="w-full bg-accent-purple rounded-full h-2.5 mb-2">
                        <div class="text-accent-purple h-2.5 rounded-full" style="width: ${progress}%"></div>
                    </div>
                    <div class="flex justify-between text-xs text-text-muted">
                        <span>${completedSteps}/${totalSteps} ${texts.completed}</span>
                        <span>${progress.toFixed(0)}%</span>
                    </div>

                    ${stepsHTML}
                </div>
            `}).join('') : `<p class="text-center text-text-muted py-8">${texts.no_projects}</p>`}
        </div>
    `;

    container.querySelectorAll('.project-header').forEach(header => {
        header.onclick = () => handleEditProject(state.projects.find(p => p.id === header.dataset.id));
    });

    container.querySelectorAll('.step-checkbox').forEach(checkbox => {
        checkbox.onchange = () => {
            const projectId = checkbox.dataset.projectId;
            const stepIndex = parseInt(checkbox.dataset.stepIndex, 10);
            handleToggleProjectStep(projectId, stepIndex);
        };
    });
}

function renderFinances() {
    const container = document.getElementById('finances-view');
    const balance = state.transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
    const income = state.transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expenses = state.transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    container.innerHTML = `
        <div class="flex justify-center items-center mb-4"><h2 class="text-3xl font-bold text-accent-purple">${texts.money}</h2></div>
        <div class="flex justify-center mb-6">
             <img src="https://cdn.prod.website-files.com/5d5e2ff58f10c53dcffd8683/5d73852f7a6dfa5b3e1e829f_clumsy.svg" class="w-48 h-auto rounded-2xl illustration" alt="Money illustration">
        </div>
        <div class="text-white bg-accent-purple rounded-3xl p-6 shadow-lg mb-6">
            <p class="text-sm opacity-90">${texts.balance}</p>
            <h3 class="text-4xl font-bold mt-1">$${balance.toFixed(2)}</h3>
            <div class="flex justify-between items-end mt-4">
                <div><p class="text-xs opacity-80">${texts.income}</p><h4 class="font-semibold">$${income.toFixed(2)}</h4></div>
                <div><p class="text-xs opacity-80">${texts.expense}</p><h4 class="font-semibold">$${expenses.toFixed(2)}</h4></div>
            </div>
        </div>
        <div>
            <h3 class="font-bold text-lg text-primary-dark mb-4">Transacciones Recientes</h3>
            <div class="space-y-3">
                ${state.transactions.length > 0 ? state.transactions.map(t => `
                    <div class="bg-surface rounded-2xl p-4 shadow-sm flex items-center card-hover cursor-pointer transaction-card" data-id="${t.id}">
                        <div class="w-12 h-12 rounded-xl ${t.type === 'income' ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'} flex items-center justify-center mr-4">
                           <i class="fa-regular ${t.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                        </div>
                        <div class="flex-1">
                            <h4 class="font-semibold text-primary-dark">${t.description}</h4>
                            <p class="text-xs text-text-muted">${new Date(t.date).toLocaleDateString()} • ${t.category || 'Sin categoría'}</p>
                        </div>
                        <div class="font-bold ${t.type === 'income' ? 'text-green-500' : 'text-red-500'}">${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)}</div>
                    </div>
                `).join('') : `<p class="text-center text-text-muted py-8">${texts.no_transactions}</p>`}
            </div>
        </div>
    `;

    container.querySelectorAll('.transaction-card').forEach(card => card.onclick = () => handleEditTransaction(state.transactions.find(t => t.id === card.dataset.id)));
}
