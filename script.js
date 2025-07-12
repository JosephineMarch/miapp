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
    welcome: "¡Bienvenido/a!",
    progress: "Tu progreso",
    tasksCompleted: "Tareas Completadas",
    unlockKitten: "¡Sigue así para desbloquear un nuevo gatito!",
    seeAll: "Ver todo",
    recentTasks: "Tareas Recientes",
    quickStats: "Estadísticas",
    financesSummary: "Resumen Financiero",
    balance: "Balance",
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
    no_tasks: "No hay tareas. ¡Añade una!",
    no_projects: "No hay proyectos. ¡Añade uno!",
    no_transactions: "No hay transacciones este mes.",
    are_you_sure: "¿Estás seguro/a de que quieres eliminar esto?",
    confirm_delete: "Confirmar Eliminación",
    completed: "Completado",
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
        ui.fabContainer.classList.remove('hidden');
        ui.loginView.classList.add('hidden');
        ui.userProfileIcon.innerHTML = `<img src="${user.photoURL}" alt="User" class="w-8 h-8 rounded-full cursor-pointer">`;
        initializeAppShell();
    } else {
        currentUser = null;
        document.body.classList.remove('logged-in');
        ui.mainContent.classList.add('hidden');
        ui.bottomNav.classList.add('hidden');
        ui.fabContainer.classList.add('hidden');
        ui.loginView.classList.remove('hidden');
        ui.userProfileIcon.innerHTML = `<i class="fas fa-user"></i>`;
        state.tasks = [];
        state.projects = [];
        state.transactions = [];
    }
});

ui.loginButton.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
ui.userProfileIcon.onclick = () => { if (currentUser) signOut(auth); };

// =================================================================================
// --- INICIALIZACIÓN Y NAVEGACIÓN ---
// =================================================================================
function initializeAppShell() {
    renderAppLayout();
    attachBaseEventListeners();
    setupRealtimeListeners();
    renderView('dashboard-view'); // Iniciar en el dashboard
}

function renderAppLayout() {
    ui.mainContent.innerHTML = `
        <div id="dashboard-view" class="p-4"></div>
        <div id="tasks-view" class="p-4 hidden"></div>
        <div id="projects-view" class="p-4 hidden"></div>
        <div id="finances-view" class="p-4 hidden"></div>
        <div id="kittens-view" class="p-4 hidden"><p class="text-center text-gray-500">${texts.achievements} próximamente...</p></div>
    `;
    ui.bottomNav.innerHTML = `
        <div class="flex justify-around">
            <button data-view="dashboard-view" class="tab-btn p-2 text-center tab-active"><i class="fas fa-home block text-xl mb-1"></i><span class="text-xs">${texts.home}</span></button>
            <button data-view="tasks-view" class="tab-btn p-2 text-center"><i class="fas fa-tasks block text-xl mb-1"></i><span class="text-xs">${texts.tasks}</span></button>
            <button data-view="projects-view" class="tab-btn p-2 text-center"><i class="fas fa-project-diagram block text-xl mb-1"></i><span class="text-xs">${texts.projects}</span></button>
            <button data-view="finances-view" class="tab-btn p-2 text-center"><i class="fas fa-wallet block text-xl mb-1"></i><span class="text-xs">${texts.money}</span></button>
            <button data-view="kittens-view" class="tab-btn p-2 text-center"><i class="fas fa-paw block text-xl mb-1"></i><span class="text-xs">${texts.achievements}</span></button>
        </div>
    `;
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
            default: handleAddTask(); // Default action: add task
        }
    };
}

function setupRealtimeListeners() {
    if (!currentUser) return;
    const collections = ['tasks', 'projects', 'transactions'];
    collections.forEach(name => {
        // Esta consulta asegura que SOLO se obtienen los datos del usuario actual.
        const q = query(collection(db, 'users', currentUser.uid, name), orderBy('createdAt', 'desc'));
        onSnapshot(q, (snapshot) => {
            state[name] = snapshot.docs.map(doc => {
                const data = doc.data();
                const toDateSafe = (field) => (field && typeof field.toDate === 'function') ? field.toDate() : (field ? new Date(field) : null);
                return { 
                    id: doc.id, 
                    ...data,
                    createdAt: toDateSafe(data.createdAt),
                    dueDate: toDateSafe(data.dueDate),
                    date: toDateSafe(data.date)
                };
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
            case 'finances-view': renderFinances(); break;
        }
    }
}

// =================================================================================
// --- SISTEMA DE MODALES (Sin cambios) ---
// =================================================================================
function openModal({ title, fields, onSave, data = {}, onDelete }) {
    let fieldsHTML = '';
    for (const field of fields) {
        const value = data[field.id] || field.default || '';
        const inputId = `modal-input-${field.id}`;
        switch (field.type) {
            case 'text':
                fieldsHTML += `<div class="mb-4"><label for="${inputId}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><input type="text" id="${inputId}" value="${value}" class="w-full border-gray-300 rounded-md shadow-sm p-2" ${field.required ? 'required' : ''}></div>`;
                break;
            case 'textarea':
                 fieldsHTML += `<div class="mb-4"><label for="${inputId}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><textarea id="${inputId}" class="w-full border-gray-300 rounded-md shadow-sm p-2" rows="3">${value}</textarea></div>`;
                break;
            case 'number':
                fieldsHTML += `<div class="mb-4"><label for="${inputId}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><input type="number" id="${inputId}" value="${value}" step="0.01" class="w-full border-gray-300 rounded-md shadow-sm p-2" ${field.required ? 'required' : ''}></div>`;
                break;
            case 'select':
                fieldsHTML += `<div class="mb-4"><label for="${inputId}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><select id="${inputId}" class="w-full border-gray-300 rounded-md shadow-sm p-2">${field.options.map(opt => `<option value="${opt.value}" ${opt.value == value ? 'selected' : ''}>${opt.label}</option>`).join('')}</select></div>`;
                break;
            case 'date':
                const dateValue = value instanceof Date ? value.toISOString().split('T')[0] : value || new Date().toISOString().split('T')[0];
                fieldsHTML += `<div class="mb-4"><label for="${inputId}" class="block text-sm font-medium text-gray-700 mb-1">${field.label}</label><input type="date" id="${inputId}" value="${dateValue}" class="w-full border-gray-300 rounded-md shadow-sm p-2"></div>`;
                break;
            case 'steps':
                fieldsHTML += `<div class="mb-4"><h4 class="text-sm font-medium text-gray-700 mb-2">${texts.steps}</h4><div id="steps-container" class="space-y-2">${(value || []).map((step, i) => renderStepInput(step)).join('')}</div><button type="button" id="add-step-btn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800">${texts.add_step}</button></div>`;
                break;
        }
    }

    ui.modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md m-4 transform transition-all">
            <header class="flex justify-between items-center p-4 border-b">
                <h3 class="text-lg font-medium">${title}</h3>
                <button class="cancel-btn text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
            </header>
            <form id="modal-form" class="p-6">
                ${fieldsHTML}
            </form>
            <footer class="flex justify-end items-center p-4 bg-gray-50 rounded-b-lg space-x-3">
                ${onDelete ? `<button class="delete-btn bg-red-500 text-white font-bold py-2 px-4 rounded-md hover:bg-red-600">${texts.delete}</button>` : ''}
                <button class="cancel-btn bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300">${texts.cancel}</button>
                <button class="save-btn bg-indigo-500 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-600">${texts.save}</button>
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

    if (onDelete) {
        document.querySelector('.delete-btn').onclick = () => {
            if (confirm(texts.are_you_sure)) {
                onDelete();
                closeModal();
            }
        };
    }
    
    document.querySelectorAll('.cancel-btn').forEach(btn => btn.onclick = closeModal);

    const addStepBtn = document.getElementById('add-step-btn');
    if (addStepBtn) {
        addStepBtn.onclick = () => document.getElementById('steps-container').insertAdjacentHTML('beforeend', renderStepInput());
    }
}

function closeModal() {
    ui.modal.classList.add('hidden');
    ui.modal.innerHTML = '';
}

function renderStepInput(step = { title: '', completed: false }) {
    return `
        <div class="flex items-center space-x-2">
            <input type="checkbox" ${step.completed ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
            <input type="text" value="${step.title || ''}" class="flex-grow border-0 border-b-2 p-1 focus:ring-0 focus:border-indigo-500 text-sm" placeholder="Descripción del paso">
            <button type="button" onclick="this.parentElement.remove()" class="remove-step-btn text-gray-400 hover:text-red-500"><i class="fas fa-trash-alt"></i></button>
        </div>`;
}

// =================================================================================
// --- LÓGICA DE COLECCIONES (CRUD) ---
// =================================================================================

// --- TAREAS (Sin cambios) ---
function handleAddTask() { openModal({ title: texts.new_task, fields: [{ id: 'title', label: texts.task_title, type: 'text', required: true }], onSave: (data) => addDoc(collection(db, 'users', currentUser.uid, 'tasks'), { ...data, completed: false, createdAt: serverTimestamp() }) }); }
function handleEditTask(task) { openModal({ title: texts.edit_task, fields: [{ id: 'title', label: texts.task_title, type: 'text', required: true }], data: task, onSave: (data) => updateDoc(doc(db, 'users', currentUser.uid, 'tasks', task.id), data), onDelete: () => deleteTask(task.id) }); }
function handleToggleTask(task) { updateDoc(doc(db, 'users', currentUser.uid, 'tasks', task.id), { completed: !task.completed }); }
function deleteTask(id) { deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', id)); }

// --- PROYECTOS ---
function handleAddProject() { openModal({ title: texts.new_project, fields: [ { id: 'title', label: texts.project_title, type: 'text', required: true }, { id: 'description', label: texts.description, type: 'textarea' }, { id: 'dueDate', label: texts.due_date, type: 'date' }, { id: 'steps', label: texts.steps, type: 'steps' } ], onSave: (data) => addDoc(collection(db, 'users', currentUser.uid, 'projects'), { ...data, createdAt: serverTimestamp() }) }); }
function handleEditProject(project) { openModal({ title: texts.edit_project, data: project, fields: [ { id: 'title', label: texts.project_title, type: 'text', required: true }, { id: 'description', label: texts.description, type: 'textarea' }, { id: 'dueDate', label: texts.due_date, type: 'date' }, { id: 'steps', label: texts.steps, type: 'steps' } ], onSave: (data) => updateDoc(doc(db, 'users', currentUser.uid, 'projects', project.id), data), onDelete: () => deleteDoc(doc(db, 'users', currentUser.uid, 'projects', project.id)) }); }
// *** NUEVA FUNCIÓN *** para marcar/desmarcar un paso de un proyecto
function handleToggleProjectStep(projectId, stepIndex) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project || !project.steps) return;

    // Crea una copia actualizada de los pasos
    const updatedSteps = project.steps.map((step, index) => {
        if (index === stepIndex) {
            return { ...step, completed: !step.completed };
        }
        return step;
    });

    // Actualiza el documento en Firebase solo con los pasos modificados
    updateDoc(doc(db, 'users', currentUser.uid, 'projects', projectId), {
        steps: updatedSteps
    });
}

// --- FINANZAS (Sin cambios) ---
function handleAddTransaction() { openModal({ title: texts.new_transaction, fields: [ { id: 'description', label: texts.description, type: 'text', required: true }, { id: 'amount', label: texts.amount, type: 'number', required: true }, { id: 'type', label: texts.type, type: 'select', options: [{value: 'expense', label: texts.expense}, {value: 'income', label: texts.income}]}, { id: 'category', label: texts.category, type: 'text' }, { id: 'date', label: texts.date, type: 'date' } ], onSave: (data) => addDoc(collection(db, 'users', currentUser.uid, 'transactions'), { ...data, createdAt: serverTimestamp() }) }); }
function handleEditTransaction(transaction) { openModal({ title: texts.edit_transaction, data: transaction, fields: [ { id: 'description', label: texts.description, type: 'text', required: true }, { id: 'amount', label: texts.amount, type: 'number', required: true }, { id: 'type', label: texts.type, type: 'select', options: [{value: 'expense', label: texts.expense}, {value: 'income', label: texts.income}]}, { id: 'category', label: texts.category, type: 'text' }, { id: 'date', label: texts.date, type: 'date' } ], onSave: (data) => updateDoc(doc(db, 'users', currentUser.uid, 'transactions', transaction.id), data), onDelete: () => deleteDoc(doc(db, 'users',currentUser.uid, 'transactions', transaction.id)) }); }

// =================================================================================
// --- RENDERIZADO DE VISTAS ---
// =================================================================================

// --- DASHBOARD (Sin cambios) ---
function renderDashboard() {
    const container = document.getElementById('dashboard-view');
    const completedTasks = state.tasks.filter(t => t.completed).length;
    const totalTasks = state.tasks.length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    container.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">${texts.welcome} ${currentUser.displayName.split(' ')[0]}</h2>
        <div class="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl p-4 text-white shadow-lg mb-6 card-hover">
            <p class="text-sm opacity-90">${texts.progress}</p>
            <h3 class="text-2xl font-bold mt-1">${completedTasks}/${totalTasks} ${texts.tasksCompleted}</h3>
            <div class="w-full bg-white bg-opacity-30 rounded-full h-2.5 mt-4"><div class="bg-white h-2.5 rounded-full progress-bar" style="width: ${progress}%"></div></div>
            <p class="text-xs mt-2 opacity-90">${texts.unlockKitten}</p>
        </div>
        <div class="mb-6">
            <div class="flex justify-between items-center mb-3"><h3 class="text-lg font-semibold">${texts.recentTasks}</h3><a href="#" class="text-sm text-indigo-500 hover:underline" onclick="document.querySelector('[data-view=\\'tasks-view\\']').click()">${texts.seeAll}</a></div>
            <div class="space-y-3">${state.tasks.slice(0, 3).map(task => `<div class="bg-white rounded-xl p-4 shadow-sm flex items-center"><div class="flex-grow font-medium ${task.completed ? 'line-through text-gray-400' : ''}">${task.title}</div><i class="fas ${task.completed ? 'fa-check-circle text-green-500' : 'fa-circle text-gray-300'}"></i></div>`).join('') || `<p class="text-center text-gray-500 py-4">${texts.no_tasks}</p>`}</div>
        </div>
        <div>
            <h3 class="text-lg font-semibold mb-3">${texts.quickStats}</h3>
            <div class="grid grid-cols-2 gap-4">
                 <div class="bg-white rounded-xl p-4 shadow-sm flex items-center"><div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3"><i class="fas fa-wallet"></i></div><div><h4 class="font-semibold">${texts.money}</h4><p class="text-xs text-gray-500">${texts.balance}: $${(state.transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0)).toFixed(2)}</p></div></div>
                <div class="bg-white rounded-xl p-4 shadow-sm flex items-center"><div class="w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mr-3"><i class="fas fa-star"></i></div><div><h4 class="font-semibold">${texts.streak}</h4><p class="text-xs text-gray-500">0 ${texts.daysInARow}</p></div></div>
            </div>
        </div>
    `;
}

// --- TAREAS (Sin cambios) ---
function renderTasks() {
    const container = document.getElementById('tasks-view');
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6"><h2 class="text-2xl font-bold">${texts.tasks}</h2></div>
        <div class="space-y-3">
            ${state.tasks.length > 0 ? state.tasks.map(task => `
                <div class="bg-white rounded-xl p-4 shadow-sm flex items-center card-hover">
                    <button data-id="${task.id}" class="task-check-btn w-6 h-6 rounded-full border-2 ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300'} flex items-center justify-center mr-4 flex-shrink-0 transition-colors">${task.completed ? '<i class="fas fa-check text-xs"></i>' : ''}</button>
                    <div class="flex-grow font-medium ${task.completed ? 'line-through text-gray-400' : ''}">${task.title}</div>
                    <button class="edit-task-btn text-gray-400 hover:text-indigo-500" data-id="${task.id}"><i class="fas fa-pencil-alt"></i></button>
                </div>
            `).join('') : `<p class="text-center text-gray-500 py-8">${texts.no_tasks}</p>`}
        </div>
    `;
    container.querySelectorAll('.task-check-btn').forEach(btn => btn.onclick = () => handleToggleTask(state.tasks.find(t => t.id === btn.dataset.id)));
    container.querySelectorAll('.edit-task-btn').forEach(btn => btn.onclick = () => handleEditTask(state.tasks.find(t => t.id === btn.dataset.id)));
}

// --- PROYECTOS (*** FUNCIÓN MODIFICADA ***) ---
function renderProjects() {
    const container = document.getElementById('projects-view');
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6"><h2 class="text-2xl font-bold">${texts.projects}</h2></div>
        <div class="space-y-4">
            ${state.projects.length > 0 ? state.projects.map(project => {
                const totalSteps = project.steps?.length || 0;
                const completedSteps = project.steps?.filter(s => s.completed).length || 0;
                const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
                
                // Genera el HTML para la lista de pasos
                const stepsHTML = (project.steps && project.steps.length > 0) ? `
                    <div class="mt-4 pt-4 border-t border-gray-100 space-y-2">
                        ${project.steps.map((step, index) => `
                            <div class="flex items-center">
                                <input type="checkbox" id="step-${project.id}-${index}" data-project-id="${project.id}" data-step-index="${index}" class="step-checkbox h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-3 cursor-pointer" ${step.completed ? 'checked' : ''}>
                                <label for="step-${project.id}-${index}" class="text-sm ${step.completed ? 'line-through text-gray-500' : ''} cursor-pointer">${step.title}</label>
                            </div>
                        `).join('')}
                    </div>
                ` : '';

                return `
                <div class="bg-white rounded-xl p-4 shadow-sm card-hover">
                    <div class="project-header cursor-pointer" data-id="${project.id}">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-medium">${project.title}</h3>
                            <span class="px-2 py-0.5 ${progress === 100 ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'} rounded-full text-xs">${progress === 100 ? texts.completed : 'Activo'}</span>
                        </div>
                        <p class="text-sm text-gray-600 mb-3">${project.description || ''}</p>
                    </div>
                    
                    <!-- Aquí se inserta la lista de pasos -->
                    ${stepsHTML}

                    <!-- La barra de progreso se mantiene -->
                    <div class="mt-4">
                        <div class="w-full bg-gray-200 rounded-full h-2"><div class="bg-indigo-500 h-2 rounded-full" style="width: ${progress}%"></div></div>
                        <div class="flex justify-between text-xs text-gray-500 mt-1"><span>${progress.toFixed(0)}% ${texts.completed}</span><span>${completedSteps}/${totalSteps}</span></div>
                    </div>
                </div>
            `}).join('') : `<p class="text-center text-gray-500 py-8">${texts.no_projects}</p>`}
        </div>
    `;

    // Event listener para abrir el modal de edición (al hacer clic en el encabezado)
    container.querySelectorAll('.project-header').forEach(header => {
        header.onclick = () => handleEditProject(state.projects.find(p => p.id === header.dataset.id));
    });

    // Event listener para los checkboxes de los pasos
    container.querySelectorAll('.step-checkbox').forEach(checkbox => {
        checkbox.onchange = () => {
            const projectId = checkbox.dataset.projectId;
            const stepIndex = parseInt(checkbox.dataset.stepIndex, 10);
            handleToggleProjectStep(projectId, stepIndex);
        };
    });
}

// --- FINANZAS (Sin cambios) ---
function renderFinances() {
    const container = document.getElementById('finances-view');
    const balance = state.transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
    const income = state.transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expenses = state.transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6"><h2 class="text-2xl font-bold">${texts.money}</h2></div>
        <div class="bg-white rounded-xl p-4 shadow-sm mb-6">
            <h3 class="font-medium mb-4">${texts.financesSummary}</h3>
            <div class="flex justify-between items-end">
                <div><p class="text-xs text-gray-500">${texts.income}</p><h4 class="text-lg font-bold text-green-500">$${income.toFixed(2)}</h4></div>
                <div><p class="text-xs text-gray-500">${texts.expense}</p><h4 class="text-lg font-bold text-red-500">$${expenses.toFixed(2)}</h4></div>
                <div><p class="text-xs text-gray-500">${texts.balance}</p><h4 class="text-lg font-bold ${balance >= 0 ? 'text-indigo-500' : 'text-red-500'}">$${balance.toFixed(2)}</h4></div>
            </div>
        </div>
        <div>
            <h3 class="font-medium mb-3">Transacciones Recientes</h3>
            <div class="space-y-3">
                ${state.transactions.length > 0 ? state.transactions.map(t => `
                    <div class="bg-white rounded-xl p-4 shadow-sm flex items-center card-hover cursor-pointer transaction-card" data-id="${t.id}">
                        <div class="w-10 h-10 rounded-full ${t.type === 'income' ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'} flex items-center justify-center mr-3"><i class="fas ${t.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i></div>
                        <div class="flex-1"><h4 class="font-medium">${t.description}</h4><p class="text-xs text-gray-500">${new Date(t.date).toLocaleDateString()} • ${t.category || 'Sin categoría'}</p></div>
                        <div class="font-medium ${t.type === 'income' ? 'text-green-500' : 'text-red-500'}">${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)}</div>
                    </div>
                `).join('') : `<p class="text-center text-gray-500 py-8">${texts.no_transactions}</p>`}
            </div>
        </div>
    `;
    container.querySelectorAll('.transaction-card').forEach(card => card.onclick = () => handleEditTransaction(state.transactions.find(t => t.id === card.dataset.id)));
}