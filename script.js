// Importa las funciones necesarias del SDK de Firebase v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
    // Modales y botones
    new_task: "Nueva Tarea",
    edit_task: "Editar Tarea",
    task_title: "Título de la tarea",
    new_project: "Nuevo Proyecto",
    edit_project: "Editar Proyecto",
    project_title: "Título del proyecto",
    due_date: "Fecha Límite",
    steps: "Pasos",
    new_transaction: "Nueva Transacción",
    edit_transaction: "Editar Transacción",
    description: "Descripción",
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
    // Otros
    no_tasks: "No hay tareas. ¡Añade una!",
    no_projects: "No hay proyectos. ¡Añade uno!",
    no_transactions: "No hay transacciones.",
    loading: "Cargando...",
    are_you_sure: "¿Estás seguro/a de que quieres eliminar esto?",
};


// =================================================================================
// --- AUTENTICACIÓN ---
// =================================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.body.classList.add('logged-in');
        ui.mainContent.classList.remove('hidden');
        ui.bottomNav.classList.remove('hidden');
        ui.loginView.classList.add('hidden');
        ui.userProfileIcon.innerHTML = `<img src="${user.photoURL}" alt="User" class="w-8 h-8 rounded-full cursor-pointer">`;
        initializeAppShell();
    } else {
        currentUser = null;
        document.body.classList.remove('logged-in');
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
            state[name] = snapshot.docs.map(doc => {
                const data = doc.data();
                // Convertir Timestamps de Firestore a objetos Date de JS
                if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                    data.createdAt = data.createdAt.toDate();
                }
                if (data.dueDate && typeof data.dueDate.toDate === 'function') {
                    data.dueDate = data.dueDate.toDate();
                }
                return { id: doc.id, ...data };
            });
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
        <div id="dashboard-view" class="p-4"></div>
        <div id="tasks-view" class="p-4 hidden"></div>
        <div id="projects-view" class="p-4 hidden"></div>
        <div id="finances-view" class="p-4 hidden"></div>
        <div id="kittens-view" class="p-4 hidden"><p class="text-center text-gray-500">Logros próximamente...</p></div>
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
            document.querySelector('.tab-active')?.classList.remove('tab-active', 'text-indigo-600');
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
// --- SISTEMA DE MODALES ---
// =================================================================================
function openModal({ title, fields, onSave, data = {} }) {
    let fieldsHTML = '';
    for (const field of fields) {
        const value = data[field.id] || field.default || '';
        switch (field.type) {
            case 'hidden':
                fieldsHTML += `<input type="hidden" id="modal-${field.id}" value="${value}">`;
                break;
            case 'text':
                fieldsHTML += `<div class="mb-4"><label for="modal-${field.id}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><input type="text" id="modal-${field.id}" value="${value}" class="w-full border-gray-300 rounded-md shadow-sm" ${field.required ? 'required' : ''}></div>`;
                break;
            case 'number':
                fieldsHTML += `<div class="mb-4"><label for="modal-${field.id}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><input type="number" id="modal-${field.id}" value="${value}" step="0.01" class="w-full border-gray-300 rounded-md shadow-sm" ${field.required ? 'required' : ''}></div>`;
                break;
            case 'select':
                fieldsHTML += `<div class="mb-4"><label for="modal-${field.id}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><select id="modal-${field.id}" class="w-full border-gray-300 rounded-md shadow-sm">${field.options.map(opt => `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`).join('')}</select></div>`;
                break;
            case 'date':
                const dateValue = value instanceof Date ? value.toISOString().split('T')[0] : value;
                fieldsHTML += `<div class="mb-4"><label for="modal-${field.id}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><input type="date" id="modal-${field.id}" value="${dateValue}" class="w-full border-gray-300 rounded-md shadow-sm"></div>`;
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
        for (const field of fields) {
            const el = document.getElementById(`modal-${field.id}`);
            if (field.type !== 'steps') {
                result[field.id] = el.value;
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

    if (document.getElementById('add-step-btn')) {
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
    return `<div class="flex items-center space-x-2"><input type="checkbox" ${step.completed ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"><input type="text" value="${step.title || ''}" class="w-full border-0 border-b-2 p-1 focus:ring-0 focus:border-indigo-500 text-sm" placeholder="Descripción del paso"><button type="button" onclick="this.parentElement.remove()" class="remove-step-btn text-gray-400 hover:text-red-500"><i class="fas fa-trash-alt"></i></button></div>`;
}


// =================================================================================
// --- VISTAS ESPECÍFICAS ---
// =================================================================================

function renderDashboard() {
    const container = document.getElementById('dashboard-view');
    // ... El resto del dashboard se mantiene igual
    container.innerHTML = `<div>Dashboard...</div>`; // Simplificado por brevedad
}

// --- VISTA DE TAREAS ---
function renderTasks() {
    const container = document.getElementById('tasks-view');
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6"><h2 class="text-2xl font-bold">${texts.tasks}</h2><button id="add-task-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-indigo-600"><i class="fas fa-plus"></i></button></div>
        <div class="space-y-3">${state.tasks.length > 0 ? state.tasks.map(task => `
            <div class="bg-white rounded-xl p-4 shadow-sm flex items-center card-hover">
                <button data-id="${task.id}" data-completed="${task.completed}" class="task-check-btn w-6 h-6 rounded-full border-2 ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300'} flex items-center justify-center mr-4 flex-shrink-0 transition-colors">${task.completed ? '<i class="fas fa-check text-xs"></i>' : ''}</button>
                <div class="flex-grow font-medium ${task.completed ? 'line-through text-gray-400' : ''}">${task.title}</div>
                <button class="edit-task-btn text-gray-400 hover:text-indigo-500 mr-3" data-id="${task.id}"><i class="fas fa-pencil-alt"></i></button>
                <button class="delete-task-btn text-gray-400 hover:text-red-500" data-id="${task.id}"><i class="fas fa-trash-alt"></i></button>
            </div>`).join('') : `<p class="text-center text-gray-500 py-8">${texts.no_tasks}</p>`}
        </div>`;
    
    // Event Listeners para Tareas
    document.getElementById('add-task-btn').onclick = () => openModal({
        title: texts.new_task,
        fields: [{ id: 'title', label: texts.task_title, type: 'text', required: true }],
        onSave: async (data) => await addDoc(collection(db, 'users', currentUser.uid, 'tasks'), { ...data, completed: false, createdAt: serverTimestamp() })
    });

    container.querySelectorAll('.task-check-btn').forEach(btn => btn.onclick = async e => {
        const id = e.currentTarget.dataset.id;
        const isCompleted = e.currentTarget.dataset.completed === 'true';
        await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', id), { completed: !isCompleted });
    });

    container.querySelectorAll('.edit-task-btn').forEach(btn => btn.onclick = e => {
        const id = e.currentTarget.dataset.id;
        const task = state.tasks.find(t => t.id === id);
        openModal({
            title: texts.edit_task,
            fields: [
                { id: 'id', type: 'hidden' },
                { id: 'title', label: texts.task_title, type: 'text', required: true }
            ],
            data: task,
            onSave: async (data) => await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', data.id), { title: data.title })
        });
    });

    container.querySelectorAll('.delete-task-btn').forEach(btn => btn.onclick = async e => {
        const id = e.currentTarget.dataset.id;
        if (confirm(texts.are_you_sure)) {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', id));
        }
    });
}

// --- VISTA DE PROYECTOS ---
function renderProjects() {
    const container = document.getElementById('projects-view');
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6"><h2 class="text-2xl font-bold">${texts.projects}</h2><button id="add-project-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-indigo-600"><i class="fas fa-plus"></i></button></div>
        <div class="space-y-4">${state.projects.length > 0 ? state.projects.map(p => {
            const { progress, completedSteps, totalSteps } = calculateProjectProgress(p);
            return `
            <div class="project-card bg-white rounded-xl shadow-sm card-hover overflow-hidden" data-id="${p.id}">
                <div class="p-4">
                    <div class="flex justify-between items-start">
                        <h3 class="font-bold text-lg mb-2">${p.title}</h3>
                        <div class="flex items-center space-x-2">
                             <button class="edit-project-btn text-gray-400 hover:text-indigo-500"><i class="fas fa-pencil-alt"></i></button>
                             <button class="delete-project-btn text-gray-400 hover:text-red-500"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5 mb-2"><div class="bg-indigo-500 h-2.5 rounded-full" style="width: ${progress}%"></div></div>
                    <div class="flex justify-between text-xs text-gray-500"><span>${Math.round(progress)}% Completado</span><span>${completedSteps}/${totalSteps} Pasos</span></div>
                </div>
                ${ p.steps && p.steps.length > 0 ? `
                <div class="project-steps-container border-t border-gray-200 p-4 space-y-3">
                    ${p.steps.map((step, index) => `
                        <label class="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" data-project-id="${p.id}" data-step-index="${index}" class="project-step-check h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" ${step.completed ? 'checked' : ''}>
                            <span class="${step.completed ? 'line-through text-gray-400' : ''}">${step.title}</span>
                        </label>
                    `).join('')}
                </div>` : '' }
            </div>`;
        }).join('') : `<p class="text-center text-gray-500 py-8">${texts.no_projects}</p>`}</div>`;

    // Event Listeners para Proyectos
    document.getElementById('add-project-btn').onclick = () => openModal({
        title: texts.new_project,
        fields: [
            { id: 'title', label: texts.project_title, type: 'text', required: true },
            { id: 'dueDate', label: texts.due_date, type: 'date' },
            { id: 'steps', type: 'steps' }
        ],
        onSave: async (data) => {
            const { title, dueDate, steps } = data;
            await addDoc(collection(db, 'users', currentUser.uid, 'projects'), { title, dueDate: dueDate ? new Date(dueDate) : null, steps, createdAt: serverTimestamp() });
        }
    });

    container.querySelectorAll('.project-card').forEach(card => {
        const id = card.dataset.id;
        card.querySelector('.edit-project-btn').onclick = (e) => {
            e.stopPropagation();
            const project = state.projects.find(p => p.id === id);
            openModal({
                title: texts.edit_project,
                fields: [
                    { id: 'id', type: 'hidden' },
                    { id: 'title', label: texts.project_title, type: 'text', required: true },
                    { id: 'dueDate', label: texts.due_date, type: 'date' },
                    { id: 'steps', type: 'steps' }
                ],
                data: project,
                onSave: async (data) => {
                    const { id, title, dueDate, steps } = data;
                    await updateDoc(doc(db, 'users', currentUser.uid, 'projects', id), { title, dueDate: dueDate ? new Date(dueDate) : null, steps });
                }
            });
        };

        card.querySelector('.delete-project-btn').onclick = async (e) => {
            e.stopPropagation();
            if (confirm(texts.are_you_sure)) {
                await deleteDoc(doc(db, 'users', currentUser.uid, 'projects', id));
            }
        };
    });

    container.querySelectorAll('.project-step-check').forEach(box => {
        box.onchange = async (e) => {
            const projectId = e.target.dataset.projectId;
            const stepIndex = parseInt(e.target.dataset.stepIndex, 10);
            const isChecked = e.target.checked;
            
            const projectRef = doc(db, 'users', currentUser.uid, 'projects', projectId);

            await runTransaction(db, async (transaction) => {
                const projectDoc = await transaction.get(projectRef);
                if (!projectDoc.exists()) { throw "¡El documento no existe!"; }
                
                const projectData = projectDoc.data();
                projectData.steps[stepIndex].completed = isChecked;
                transaction.update(projectRef, { steps: projectData.steps });
            });
        };
    });
}

function calculateProjectProgress(project) {
    if (!project.steps || project.steps.length === 0) return { progress: 0, completedSteps: 0, totalSteps: 0 };
    const totalSteps = project.steps.length;
    const completedSteps = project.steps.filter(s => s.completed).length;
    return { progress: (completedSteps / totalSteps) * 100, completedSteps, totalSteps };
}

// --- VISTA DE FINANZAS ---
function renderFinances() {
    const container = document.getElementById('finances-view');
    // ... Lógica de cálculo ...
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6"><h2 class="text-2xl font-bold">${texts.money}</h2><button id="add-transaction-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-indigo-600"><i class="fas fa-plus"></i></button></div>
        <div class="space-y-3">${state.transactions.length > 0 ? state.transactions.map(t => `
            <div class="bg-white rounded-xl p-3 shadow-sm flex items-center card-hover">
                <div class="w-10 h-10 rounded-full ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} flex items-center justify-center mr-3 flex-shrink-0">
                    <i class="fas ${t.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                </div>
                <div class="flex-grow">
                    <p class="font-medium">${t.title}</p>
                    <p class="text-xs text-gray-500">${t.category || 'General'}</p>
                </div>
                <div class="text-right mr-4">
                    <p class="font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}">${t.type === 'income' ? '+' : '-'}$${(t.amount || 0).toFixed(2)}</p>
                    <p class="text-xs text-gray-400">${t.createdAt ? t.createdAt.toLocaleDateString() : ''}</p>
                </div>
                <div class="relative dropdown">
                     <button class="text-gray-400 hover:text-gray-600"><i class="fas fa-ellipsis-v"></i></button>
                     <div class="dropdown-menu absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 hidden">
                        <a href="#" class="edit-transaction-btn block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" data-id="${t.id}">${texts.edit}</a>
                        <a href="#" class="delete-transaction-btn block px-4 py-2 text-sm text-red-600 hover:bg-gray-100" data-id="${t.id}">${texts.delete}</a>
                     </div>
                </div>
            </div>`).join('') : `<p class="text-center text-gray-500 py-8">${texts.no_transactions}</p>`}
        </div>
    `;

    // Event Listeners para Finanzas
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
            await addDoc(collection(db, 'users', currentUser.uid, 'transactions'), data);
        }
    });

    container.querySelectorAll('.dropdown > button').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation();
            // Oculta otros menús abiertos
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
            // Muestra el menú actual
            button.nextElementSibling.classList.toggle('hidden');
        };
    });
    
    container.querySelectorAll('.edit-transaction-btn').forEach(btn => btn.onclick = (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.id;
        const transaction = state.transactions.find(t => t.id === id);
        openModal({
            title: texts.edit_transaction,
            fields: [
                { id: 'id', type: 'hidden'},
                { id: 'title', label: texts.description, type: 'text', required: true },
                { id: 'amount', label: texts.amount, type: 'number', required: true },
                { id: 'type', label: texts.type, type: 'select', options: [{label: texts.expense, value: 'expense'}, {label: texts.income, value: 'income'}] },
                { id: 'category', label: texts.category, type: 'text', required: true },
                { id: 'createdAt', label: texts.date, type: 'date' }
            ],
            data: transaction,
            onSave: async (data) => {
                const { id, ...updateData } = data;
                updateData.amount = parseFloat(updateData.amount);
                updateData.createdAt = new Date(updateData.createdAt);
                await updateDoc(doc(db, 'users', currentUser.uid, 'transactions', id), updateData);
            }
        });
    });

    container.querySelectorAll('.delete-transaction-btn').forEach(btn => btn.onclick = async (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.id;
        if (confirm(texts.are_you_sure)) {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'transactions', id));
        }
    });
}

// Cierra los dropdowns si se hace clic fuera
window.onclick = function(event) {
    if (!event.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    }
}
