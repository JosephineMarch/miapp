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
    modal: document.createElement('div'),
};
ui.modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 hidden z-50';
document.body.appendChild(ui.modal);

// --- Estado de la Aplicación ---
const state = {
    tasks: [],
    projects: [],
    transactions: [],
};

// --- Textos de la Interfaz (i18n) ---
const texts = {
    welcome: "¡Bienvenido/a!",
    progress: "Tu progreso",
    tasksCompleted: "Tareas Completadas",
    unlockKitten: "¡Completa más tareas para un nuevo logro!",
    yourKittens: "Tus Logros",
    seeAll: "Ver todo",
    recentTasks: "Tareas Recientes",
    quickStats: "Estadísticas",
    finances: "Dinero",
    streak: "Racha",
    daysInARow: "días seguidos",
    // Vistas
    home: "¡Hola!",
    tasks: "Tareas",
    projects: "Proyectos",
    money: "Dinero",
    achievements: "Logros",
    // Modales
    new_task: "Nueva Tarea",
    edit_task: "Editar Tarea",
    task_title: "Título de la tarea",
    new_project: "Nuevo Proyecto",
    edit_project: "Editar Proyecto",
    project_title: "Título del proyecto",
    due_date: "Fecha Límite",
    steps: "Pasos",
    new_transaction: "Nueva Transacción",
    description: "Descripción",
    amount: "Monto",
    type: "Tipo",
    expense: "Gasto",
    income: "Ingreso",
    category: "Categoría",
    date: "Fecha",
    save: "Guardar",
    cancel: "Cancelar",
    // Otros
    no_tasks: "No hay tareas. ¡Añade una!",
    no_projects: "No hay proyectos. ¡Añade uno!",
    no_transactions: "No hay transacciones.",
    loading: "Cargando...",
    are_you_sure: "¿Estás seguro/a?",
};


// =================================================================================
// --- AUTENTICACIÓN ---
// =================================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        ui.mainContent.classList.remove('hidden');
        ui.bottomNav.classList.remove('hidden');
        ui.loginView.classList.add('hidden');
        ui.userProfileIcon.innerHTML = `<img src="${user.photoURL}" alt="User" class="w-8 h-8 rounded-full cursor-pointer">`;
        initializeAppShell();
    } else {
        currentUser = null;
        ui.mainContent.classList.add('hidden');
        ui.bottomNav.classList.add('hidden');
        ui.loginView.classList.remove('hidden');
        ui.userProfileIcon.innerHTML = `<i class="fas fa-user"></i>`;
    }
});

ui.loginButton.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
ui.userProfileIcon.onclick = () => { if (currentUser) signOut(auth); };


// =================================================================================
// --- INICIALIZACIÓN DE LA APP ---
// =================================================================================
function initializeAppShell() {
    renderAppLayout();
    attachBaseEventListeners();
    setupRealtimeListeners();
}

function setupRealtimeListeners() {
    if (!currentUser) return;
    const collections = ['tasks', 'projects', 'transactions'];
    collections.forEach(name => {
        const q = query(collection(db, 'users', currentUser.uid, name), orderBy('createdAt', 'desc'));
        onSnapshot(q, (snapshot) => {
            state[name] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const currentView = document.querySelector('.tab-btn.tab-active')?.dataset.view || 'dashboard-view';
            renderView(currentView);
        });
    });
}

// =================================================================================
// --- RENDERIZADO PRINCIPAL Y NAVEGACIÓN ---
// =================================================================================
function renderAppLayout() {
    ui.mainContent.innerHTML = `
        <div id="dashboard-view"></div>
        <div id="tasks-view" class="hidden"></div>
        <div id="projects-view" class="hidden"></div>
        <div id="finances-view" class="hidden"></div>
        <div id="kittens-view" class="hidden"><p class="p-4 text-center text-gray-500">Logros próximamente...</p></div>
    `;
    ui.bottomNav.innerHTML = `
        <div class="flex justify-around">
            <button data-view="dashboard-view" class="tab-btn p-2 text-center text-indigo-600 tab-active"><i class="fas fa-home block text-xl mb-1"></i><span class="text-xs">${texts.home}</span></button>
            <button data-view="tasks-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-tasks block text-xl mb-1"></i><span class="text-xs">${texts.tasks}</span></button>
            <button data-view="projects-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-project-diagram block text-xl mb-1"></i><span class="text-xs">${texts.projects}</span></button>
            <button data-view="finances-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-wallet block text-xl mb-1"></i><span class="text-xs">${texts.money}</span></button>
            <button data-view="kittens-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-paw block text-xl mb-1"></i><span class="text-xs">${texts.achievements}</span></button>
        </div>
    `;
}

function attachBaseEventListeners() {
    ui.bottomNav.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            const viewId = e.currentTarget.dataset.view;
            ui.bottomNav.querySelector('.tab-active')?.classList.remove('tab-active', 'text-indigo-600');
            e.currentTarget.classList.add('tab-active', 'text-indigo-600');
            renderView(viewId);
        };
    });
}

function renderView(viewId) {
    ui.mainContent.querySelectorAll('div[id$="-view"]').forEach(v => v.classList.add('hidden'));
    const viewContainer = document.getElementById(viewId);
    if (viewContainer) {
        viewContainer.classList.remove('hidden');
        switch (viewId) {
            case 'dashboard-view': renderDashboard(); break;
            case 'tasks-view': renderTasks(); break;
            case 'projects-view': renderProjects(); break;
            case 'finances-view': renderFinances(); break;
        }
    }
}

// =================================================================================
// --- SISTEMA DE MODALES DINÁMICO ---
// =================================================================================
function openModal({ title, fields, onSave, data = {} }) {
    // ... (la lógica del modal se mantiene, pero usará los textos del objeto 'texts')
    let fieldsHTML = '';
    for (const field of fields) {
        const value = data[field.id] || field.default || '';
        switch (field.type) {
            case 'hidden':
                fieldsHTML += `<input type="hidden" id="${field.id}" value="${value}">`;
                break;
            case 'text':
                fieldsHTML += `<div class="mb-4"><label for="${field.id}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><input type="text" id="${field.id}" value="${value}" class="w-full border-gray-300 rounded-md shadow-sm" ${field.required ? 'required' : ''}></div>`;
                break;
            case 'number':
                 fieldsHTML += `<div class="mb-4"><label for="${field.id}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><input type="number" id="${field.id}" value="${value}" step="0.01" class="w-full border-gray-300 rounded-md shadow-sm" ${field.required ? 'required' : ''}></div>`;
                break;
            case 'select':
                fieldsHTML += `<div class="mb-4"><label for="${field.id}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><select id="${field.id}" class="w-full border-gray-300 rounded-md shadow-sm">${field.options.map(opt => `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`).join('')}</select></div>`;
                break;
            case 'date':
                 fieldsHTML += `<div class="mb-4"><label for="${field.id}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><input type="date" id="${field.id}" value="${value}" class="w-full border-gray-300 rounded-md shadow-sm"></div>`;
                break;
            case 'steps':
                fieldsHTML += `<div class="mb-4"><h4 class="text-sm font-medium text-gray-700 mb-2">${texts.steps}</h4><div id="steps-container" class="space-y-2">${(value || []).map((step, i) => renderStepInput(step, i)).join('')}</div><button type="button" id="add-step-btn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800">+ Añadir paso</button></div>`;
                break;
        }
    }

    ui.modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <form id="modal-form" class="max-h-[90vh] flex flex-col">
                <div class="p-4 border-b flex justify-between items-center"><h3 class="text-lg font-medium">${title}</h3><button type="button" id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button></div>
                <div class="p-4 overflow-y-auto">${fieldsHTML}</div>
                <div class="p-4 bg-gray-50 flex justify-end space-x-2"><button type="button" id="cancel-modal-btn" class="px-4 py-2 bg-gray-200 rounded-md text-sm">${texts.cancel}</button><button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm">${texts.save}</button></div>
            </form>
        </div>
    `;

     document.getElementById('modal-form').onsubmit = (e) => {
        e.preventDefault();
        const result = {};
        for(const field of fields){
            if(field.type !== 'steps') {
                 result[field.id] = document.getElementById(field.id).value;
            } else {
                result.steps = Array.from(document.querySelectorAll('#steps-container > div')).map(div => ({
                    title: div.querySelector('input[type="text"]').value,
                    completed: div.querySelector('input[type="checkbox"]').checked,
                }));
            }
        }
        onSave(result);
        closeModal();
    };
    
    if(document.getElementById('add-step-btn')){
        document.getElementById('add-step-btn').onclick = () => document.getElementById('steps-container').insertAdjacentHTML('beforeend', renderStepInput({}));
    }

    document.getElementById('close-modal-btn').onclick = closeModal;
    document.getElementById('cancel-modal-btn').onclick = closeModal;
    ui.modal.classList.remove('hidden');
}

function closeModal() {
    ui.modal.classList.add('hidden');
    ui.modal.innerHTML = '';
}
function renderStepInput(step = {}, index = 0) {
    return `<div class="flex items-center space-x-2"><input type="checkbox" ${step.completed ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-indigo-600"><input type="text" value="${step.title || ''}" class="w-full border-0 border-b-2 p-1 focus:ring-0 focus:border-indigo-500 text-sm" placeholder="Descripción del paso"><button type="button" onclick="this.parentElement.remove()" class="remove-step-btn text-gray-400 hover:text-red-500"><i class="fas fa-trash-alt"></i></button></div>`;
}

// =================================================================================
// --- VISTAS ESPECÍFICAS (TRADUCIDAS) ---
// =================================================================================

function renderDashboard() {
    const container = document.getElementById('dashboard-view');
     const completedTasks = state.tasks.filter(t => t.completed).length;
    const totalTasks = state.tasks.length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    container.innerHTML = `
        <div class="p-4">
            <h2 class="text-lg font-semibold mb-3">${texts.welcome} ${currentUser.displayName.split(' ')[0]}</h2>
            <div class="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl p-4 text-white shadow-md mb-6">
                <p class="text-sm opacity-90">${texts.progress}</p>
                <h3 class="text-xl font-bold mt-1">${completedTasks}/${totalTasks} ${texts.tasksCompleted}</h3>
                <div class="w-full bg-white bg-opacity-30 rounded-full h-2 mt-4">
                    <div class="progress-bar bg-white h-2 rounded-full" style="width: ${progress}%"></div>
                </div>
                <p class="text-xs mt-2 opacity-90">${texts.unlockKitten}</p>
            </div>
            
             <div class="mb-6">
                <div class="flex justify-between items-center mb-3">
                    <h2 class="text-lg font-semibold">${texts.recentTasks}</h2>
                    <a href="#" onclick="document.querySelector('[data-view='tasks-view']').click()" class="text-sm text-indigo-500">${texts.seeAll}</a>
                </div>
                <div class="space-y-3">
                    ${state.tasks.slice(0, 2).map(task => `
                        <div class="card-hover bg-white rounded-xl p-4 shadow-sm flex items-center">
                             <div class="w-8 h-8 rounded-full ${task.completed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} flex items-center justify-center mr-3">
                                <i class="fas ${task.completed ? 'fa-check' : 'fa-times'} text-sm"></i>
                            </div>
                            <div class="flex-1"><h3 class="font-medium ${task.completed ? 'line-through' : ''}">${task.title}</h3></div>
                        </div>
                    `).join('') || `<p class="text-center text-gray-500">${texts.no_tasks}</p>`}
                </div>
            </div>

            <div>
                <h2 class="text-lg font-semibold mb-3">${texts.quickStats}</h2>
                <div class="grid grid-cols-2 gap-3">
                     <div class="card-hover bg-white rounded-xl p-4 shadow-sm">
                        <div class="flex items-center mb-2">
                            <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2"><i class="fas fa-wallet text-sm"></i></div>
                            <h3 class="font-medium">${texts.money}</h3>
                        </div>
                        <p class="text-xs text-gray-500">Resumen pronto...</p>
                    </div>
                    <div class="card-hover bg-white rounded-xl p-4 shadow-sm">
                         <div class="flex items-center mb-2">
                            <div class="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mr-2"><i class="fas fa-star text-sm"></i></div>
                            <h3 class="font-medium">${texts.streak}</h3>
                        </div>
                        <p class="text-xs text-gray-500">0 ${texts.daysInARow}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTasks() {
    const container = document.getElementById('tasks-view');
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6"><h2 class="text-lg font-semibold">${texts.tasks}</h2><button id="add-task-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md"><i class="fas fa-plus"></i></button></div>
        <div class="space-y-3">${state.tasks.length > 0 ? state.tasks.map(task => `
            <div class="bg-white rounded-xl p-4 shadow-sm flex items-start card-hover">
                <button data-id="${task.id}" data-completed="${task.completed}" class="task-check w-6 h-6 rounded-full border-2 ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-indigo-500'} flex items-center justify-center mr-3 mt-1 flex-shrink-0">${task.completed ? '<i class="fas fa-check text-xs"></i>' : ''}</button>
                <div class="flex-grow font-medium ${task.completed ? 'line-through' : ''}">${task.title}</div>
                 <button class="delete-btn text-gray-400 hover:text-red-500" data-id="${task.id}"><i class="fas fa-trash-alt"></i></button>
            </div>`).join('') : `<p class="text-center text-gray-500">${texts.no_tasks}</p>`}
        </div>`;
    
    document.getElementById('add-task-btn').onclick = () => openModal({
        title: texts.new_task,
        fields: [{ id: 'title', label: texts.task_title, type: 'text', required: true }],
        onSave: async (data) => {
            await addDoc(collection(db, 'users', currentUser.uid, 'tasks'), { ...data, completed: false, createdAt: serverTimestamp() });
        }
    });
    container.querySelectorAll('.task-check').forEach(btn => btn.onclick = async e => {
        await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', e.currentTarget.dataset.id), { completed: e.currentTarget.dataset.completed !== 'true' });
    });
    container.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = async e => {
        if(confirm(texts.are_you_sure)) await deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', e.currentTarget.dataset.id));
    });
}

function renderProjects() {
    const container = document.getElementById('projects-view');
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6"><h2 class="text-lg font-semibold">${texts.projects}</h2><button id="add-project-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md"><i class="fas fa-plus"></i></button></div>
        <div class="space-y-4">${state.projects.length > 0 ? state.projects.map(p => {
            const { progress, completedSteps, totalSteps } = calculateProjectProgress(p);
            return `<div data-project='${JSON.stringify(p)}' class="project-card bg-white rounded-xl p-4 shadow-sm cursor-pointer card-hover">
                <div class="flex justify-between items-start mb-2"><h3 class="font-medium">${p.title}</h3></div>
                <div class="w-full bg-gray-200 rounded-full h-2"><div class="bg-indigo-500 h-2 rounded-full progress-bar" style="width: ${progress}%"></div></div>
                <div class="flex justify-between text-xs text-gray-500 mt-1"><span>${Math.round(progress)}%</span><span>${completedSteps}/${totalSteps} ${texts.steps}</span></div>
            </div>`;
        }).join('') : `<p class="text-center text-gray-500">${texts.no_projects}</p>`}</div>`;

    document.getElementById('add-project-btn').onclick = () => openModal({
        title: texts.new_project,
        fields: [
            { id: 'title', label: texts.project_title, type: 'text', required: true },
            { id: 'dueDate', label: texts.due_date, type: 'date' },
            { id: 'steps', type: 'steps' }
        ],
        onSave: async (data) => await addDoc(collection(db, 'users', currentUser.uid, 'projects'), { ...data, createdAt: serverTimestamp() })
    });
    container.querySelectorAll('.project-card').forEach(card => card.onclick = () => {
        const projectData = JSON.parse(card.dataset.project);
        openModal({
            title: texts.edit_project,
            fields: [
                { id: 'id', type: 'hidden' },
                { id: 'title', label: texts.project_title, type: 'text', required: true },
                { id: 'dueDate', label: texts.due_date, type: 'date' },
                { id: 'steps', type: 'steps' }
            ],
            data: projectData,
            onSave: async (data) => await updateDoc(doc(db, 'users', currentUser.uid, 'projects', data.id), data)
        });
    });
}
function calculateProjectProgress(project) {
    if (!project.steps || project.steps.length === 0) return { progress: 0, completedSteps: 0, totalSteps: 0 };
    const total = project.steps.length;
    const completed = project.steps.filter(s => s.completed).length;
    return { progress: (completed / total) * 100, completedSteps: completed, totalSteps: total };
}

function renderFinances() {
    const container = document.getElementById('finances-view');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthly = state.transactions.filter(t => t.createdAt && t.createdAt.toDate() >= startOfMonth);
    const income = monthly.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthly.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    const expenseByCategory = monthly.filter(t => t.type === 'expense').reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
    }, {});
    
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6"><h2 class="text-lg font-semibold">${texts.money}</h2><button id="add-transaction-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md"><i class="fas fa-plus"></i></button></div>
        
        <div class="bg-white rounded-xl shadow-md p-4 mb-6 card-hover">
            <div class="flex justify-between items-center mb-4"><h3 class="font-medium">Balance Mensual</h3><span class="text-sm text-gray-500">${now.toLocaleString('es-ES', { month: 'long' })}</span></div>
            <div class="grid grid-cols-3 text-center">
                 <div><p class="text-sm text-gray-500">${texts.income}</p><p class="font-bold text-green-500 text-lg">$${income.toFixed(2)}</p></div>
                <div><p class="text-sm text-gray-500">${texts.expense}</p><p class="font-bold text-red-500 text-lg">$${expenses.toFixed(2)}</p></div>
                <div><p class="text-sm text-gray-500">Ahorro</p><p class="font-bold text-blue-500 text-lg">$${(income - expenses).toFixed(2)}</p></div>
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-md p-4 mb-6 card-hover">
             <h3 class="font-medium mb-3">Categorías de Gasto</h3>
             <div class="space-y-3">${Object.keys(expenseByCategory).length > 0 ? Object.entries(expenseByCategory).map(([cat, amt]) => {
                const percentage = (amt / expenses) * 100;
                return `<div>
                    <div class="flex justify-between text-sm mb-1"><span>${cat}</span><span>$${amt.toFixed(2)}</span></div>
                    <div class="w-full bg-gray-200 rounded-full h-1.5"><div class="bg-red-500 h-1.5 rounded-full" style="width: ${percentage}%"></div></div>
                </div>`
             }).join('') : `<p class="text-sm text-gray-500">${texts.no_transactions}</p>`}</div>
        </div>
        <div>
            <h3 class="font-medium mb-3">Transacciones Recientes</h3>
            <div class="space-y-3">${state.transactions.slice(0, 5).map(t => `
                <div class="bg-white rounded-xl p-3 shadow-sm flex items-center card-hover">
                    <div class="w-10 h-10 rounded-full ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} flex items-center justify-center mr-3"><i class="fas fa-dollar-sign"></i></div>
                    <div class="flex-grow"><p class="font-medium">${t.title}</p><p class="text-xs text-gray-500">${t.category}</p></div>
                    <p class="font-medium ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}">${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)}</p>
                </div>`).join('')}
            </div>
        </div>
    `;

    document.getElementById('add-transaction-btn').onclick = () => openModal({
        title: texts.new_transaction,
        fields: [
            { id: 'title', label: texts.description, type: 'text', required: true },
            { id: 'amount', label: texts.amount, type: 'number', required: true },
            { id: 'type', label: texts.type, type: 'select', options: [{label: texts.expense, value: 'expense'}, {label: texts.income, value: 'income'}], default: 'expense' },
            { id: 'category', label: texts.category, type: 'text', required: true, default: 'General' },
            { id: 'createdAt', label: texts.date, type: 'date', default: new Date().toISOString().split('T')[0] }
        ],
        onSave: async (data) => {
            data.amount = parseFloat(data.amount);
            data.createdAt = new Date(data.createdAt);
            await addDoc(collection(db, 'users', currentUser.uid, 'transactions'), { ...data });
        }
    });
}