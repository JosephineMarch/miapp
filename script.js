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
    modal: document.createElement('div'), // El modal se crea dinámicamente
};
ui.modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 hidden z-50';
document.body.appendChild(ui.modal);

// --- Estado de la Aplicación ---
const state = {
    tasks: [],
    projects: [],
    transactions: [],
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
            // Llama a la función de renderizado específica para la vista actual
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
        <div id="kittens-view" class="p-4 hidden"><p class="text-center text-gray-500">Kittens coming soon!</p></div>
    `;
    ui.bottomNav.innerHTML = `
        <div class="flex justify-around">
            <button data-view="dashboard-view" class="tab-btn p-2 text-center text-indigo-600 tab-active"><i class="fas fa-home block text-xl mb-1"></i><span class="text-xs">Home</span></button>
            <button data-view="tasks-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-tasks block text-xl mb-1"></i><span class="text-xs">Tasks</span></button>
            <button data-view="projects-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-project-diagram block text-xl mb-1"></i><span class="text-xs">Projects</span></button>
            <button data-view="finances-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-wallet block text-xl mb-1"></i><span class="text-xs">Finances</span></button>
            <button data-view="kittens-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-paw block text-xl mb-1"></i><span class="text-xs">Kittens</span></button>
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
        // Llama a la función de renderizado específica
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
                fieldsHTML += `<div class="mb-4"><h4 class="text-sm font-medium text-gray-700 mb-2">Steps</h4><div id="steps-container" class="space-y-2">${(value || []).map((step, i) => renderStepInput(step, i)).join('')}</div><button type="button" id="add-step-btn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800">+ Add step</button></div>`;
                break;
        }
    }

    ui.modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <form id="modal-form" class="max-h-[90vh] flex flex-col">
                <div class="p-4 border-b flex justify-between items-center"><h3 class="text-lg font-medium">${title}</h3><button type="button" id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button></div>
                <div class="p-4 overflow-y-auto">${fieldsHTML}</div>
                <div class="p-4 bg-gray-50 flex justify-end space-x-2"><button type="button" id="cancel-modal-btn" class="px-4 py-2 bg-gray-200 rounded-md text-sm">Cancel</button><button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm">Save</button></div>
            </form>
        </div>
    `;

    document.getElementById('modal-form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
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
    return `<div class="flex items-center space-x-2"><input type="checkbox" ${step.completed ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-indigo-600"><input type="text" value="${step.title || ''}" class="w-full border-0 border-b-2 p-1 focus:ring-0 focus:border-indigo-500 text-sm" placeholder="Step description"><button type="button" onclick="this.parentElement.remove()" class="remove-step-btn text-gray-400 hover:text-red-500"><i class="fas fa-trash-alt"></i></button></div>`;
}

// =================================================================================
// --- VISTAS ESPECÍFICAS ---
// =================================================================================

// --- Dashboard ---
function renderDashboard() {
    const container = document.getElementById('dashboard-view');
    // ... (la lógica del dashboard puede ir aquí, por ahora es simple)
    container.innerHTML = `<h2 class="text-xl font-bold mb-4">Dashboard</h2><p>Welcome back, ${currentUser.displayName}!</p><div id="finance-summary"></div>`;
    renderFinanceSummary(document.getElementById('finance-summary'));
}

// --- Tareas ---
function renderTasks() {
    const container = document.getElementById('tasks-view');
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6"><h2 class="text-lg font-semibold">Your Tasks</h2><button id="add-task-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md"><i class="fas fa-plus"></i></button></div>
        <div class="space-y-3">${state.tasks.length > 0 ? state.tasks.map(task => `
            <div class="bg-white rounded-xl p-4 shadow-sm flex items-start">
                <button data-id="${task.id}" data-completed="${task.completed}" class="task-check w-6 h-6 rounded-full border-2 ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-indigo-500'} flex items-center justify-center mr-3 mt-1 flex-shrink-0">${task.completed ? '<i class="fas fa-check text-xs"></i>' : ''}</button>
                <div class="flex-grow font-medium ${task.completed ? 'line-through' : ''}">${task.title}</div>
                 <button class="delete-btn text-gray-400 hover:text-red-500" data-id="${task.id}"><i class="fas fa-trash-alt"></i></button>
            </div>`).join('') : '<p class="text-center text-gray-500">No tasks. Add one!</p>'}
        </div>`;
    
    document.getElementById('add-task-btn').onclick = () => openModal({
        title: 'New Task',
        fields: [{ id: 'title', label: 'Task Title', type: 'text', required: true }],
        onSave: async (data) => {
            await addDoc(collection(db, 'users', currentUser.uid, 'tasks'), { ...data, completed: false, createdAt: serverTimestamp() });
        }
    });
    container.querySelectorAll('.task-check').forEach(btn => btn.onclick = async e => {
        await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', e.currentTarget.dataset.id), { completed: e.currentTarget.dataset.completed !== 'true' });
    });
    container.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = async e => {
        if(confirm('Are you sure?')) await deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', e.currentTarget.dataset.id));
    });
}

// --- Proyectos ---
function renderProjects() {
    const container = document.getElementById('projects-view');
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6"><h2 class="text-lg font-semibold">Your Projects</h2><button id="add-project-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md"><i class="fas fa-plus"></i></button></div>
        <div class="space-y-4">${state.projects.length > 0 ? state.projects.map(p => {
            const { progress, completedSteps, totalSteps } = calculateProjectProgress(p);
            return `<div data-project='${JSON.stringify(p)}' class="project-card bg-white rounded-xl p-4 shadow-sm cursor-pointer">
                <div class="flex justify-between items-start mb-2"><h3 class="font-medium">${p.title}</h3></div>
                <div class="w-full bg-gray-200 rounded-full h-2"><div class="bg-indigo-500 h-2 rounded-full" style="width: ${progress}%"></div></div>
                <div class="flex justify-between text-xs text-gray-500 mt-1"><span>${Math.round(progress)}%</span><span>${completedSteps}/${totalSteps} steps</span></div>
            </div>`;
        }).join('') : '<p class="text-center text-gray-500">No projects. Add one!</p>'}</div>`;

    document.getElementById('add-project-btn').onclick = () => openModal({
        title: 'New Project',
        fields: [
            { id: 'title', label: 'Project Title', type: 'text', required: true },
            { id: 'dueDate', label: 'Due Date', type: 'date' },
            { id: 'steps', type: 'steps' }
        ],
        onSave: async (data) => await addDoc(collection(db, 'users', currentUser.uid, 'projects'), { ...data, createdAt: serverTimestamp() })
    });
    container.querySelectorAll('.project-card').forEach(card => card.onclick = () => {
        const projectData = JSON.parse(card.dataset.project);
        openModal({
            title: 'Edit Project',
            fields: [
                { id: 'id', type: 'hidden' },
                { id: 'title', label: 'Project Title', type: 'text', required: true },
                { id: 'dueDate', label: 'Due Date', type: 'date' },
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


// --- Finanzas ---
function renderFinances() {
    const container = document.getElementById('finances-view');
    container.innerHTML = `<div class="flex justify-between items-center mb-6"><h2 class="text-lg font-semibold">Your Finances</h2><button id="add-transaction-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md"><i class="fas fa-plus"></i></button></div><div id="finance-content"></div>`;
    
    renderFinanceSummary(document.getElementById('finance-content'));

    document.getElementById('add-transaction-btn').onclick = () => openModal({
        title: 'New Transaction',
        fields: [
            { id: 'title', label: 'Description', type: 'text', required: true },
            { id: 'amount', label: 'Amount', type: 'number', required: true },
            { id: 'type', label: 'Type', type: 'select', options: [{label: 'Expense', value: 'expense'}, {label: 'Income', value: 'income'}], default: 'expense' },
            { id: 'category', label: 'Category', type: 'text', required: true, default: 'General' },
            { id: 'createdAt', label: 'Date', type: 'date', default: new Date().toISOString().split('T')[0] }
        ],
        onSave: async (data) => {
            data.amount = parseFloat(data.amount);
            // Convert date string back to timestamp for Firestore
            data.createdAt = new Date(data.createdAt);
            await addDoc(collection(db, 'users', currentUser.uid, 'transactions'), data);
        }
    });
}

function renderFinanceSummary(container) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthly = state.transactions.filter(t => t.createdAt.toDate() >= startOfMonth);
    const income = monthly.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthly.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    const expenseByCategory = monthly.filter(t => t.type === 'expense').reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
    }, {});
    const maxExpense = Math.max(...Object.values(expenseByCategory), 1);

    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-md p-4 mb-6">
            <h3 class="font-bold">Monthly Balance</h3>
            <div class="grid grid-cols-3 text-center my-2">
                <div><p class="text-sm text-gray-500">Income</p><p class="font-bold text-green-500 text-lg">$${income.toFixed(2)}</p></div>
                <div><p class="text-sm text-gray-500">Expenses</p><p class="font-bold text-red-500 text-lg">$${expenses.toFixed(2)}</p></div>
                <div><p class="text-sm text-gray-500">Savings</p><p class="font-bold text-blue-500 text-lg">$${(income - expenses).toFixed(2)}</p></div>
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-md p-4 mb-6">
            <h3 class="font-bold mb-4">Expense Categories</h3>
            <div class="flex justify-around items-end h-32">${Object.keys(expenseByCategory).length > 0 ? Object.entries(expenseByCategory).map(([cat, amt]) => `
                <div class="flex flex-col items-center w-1/4" title="${cat}: $${amt.toFixed(2)}">
                    <div class="w-1/2 bg-indigo-200 rounded-t-lg" style="height: ${(amt / maxExpense) * 100}%"></div>
                    <p class="text-xs mt-1 truncate">${cat}</p>
                </div>`).join('') : '<p class="text-sm text-gray-500 w-full text-center">No expenses this month.</p>'}
            </div>
        </div>
        <div>
            <h3 class="font-bold mb-4">Recent Transactions</h3>
            <div class="space-y-3">${state.transactions.slice(0, 5).map(t => `
                <div class="bg-white rounded-xl p-3 shadow-sm flex items-center">
                    <div class="flex-grow"><p class="font-medium">${t.title}</p><p class="text-xs text-gray-500">${t.category}</p></div>
                    <p class="font-medium ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}">${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)}</p>
                </div>`).join('')}
            </div>
        </div>`;
}