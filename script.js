// --- 1. IMPORTACIONES Y CONFIGURACIÓN DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD0gGVvxwFxEnfbOYIhwVDExSR9HZy1YG4",
    authDomain: "miapp-e4dc6.firebaseapp.com",
    projectId: "miapp-e4dc6",
    storageBucket: "miapp-e4dc6.appspot.com",
    messagingSenderId: "815058398646",
    appId: "1:815058398646:web:15d8a49b50ac5c660de517",
    measurementId: "G-ZG1T9MZ8MD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- 2. ESTADO GLOBAL DE LA APLICACIÓN ---
let userId = null;
let currentTheme = 'light';
let selectedDate = getTodayString();
let activeTab = 'dashboard-content';

// Contenedores de datos
let dailyData = {}; // Almacena rutinas y otra info diaria por fecha
let projects = [];
let finances = [];
let ideas = [];

// Listeners de Firestore para poder cancelarlos
let unsubscribers = [];

// --- 3. HELPERS Y UTILIDADES ---
function getTodayString(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
}

function getStartOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function showNotification(message, type = 'success') {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = `notification show ${type}`;
    setTimeout(() => { el.classList.remove('show'); }, 3000);
}

// --- 4. LÓGICA DE AUTENTICACIÓN Y ARRANQUE ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    onAuthStateChanged(auth, handleAuthStateChange);
});

function handleAuthStateChange(user) {
    const loginContainer = document.getElementById('login-container');
    const appWrapper = document.getElementById('app-wrapper');

    if (user) {
        userId = user.uid;
        document.getElementById('user-display-name').textContent = user.displayName?.split(' ')[0] || "Usuario";
        document.getElementById('user-avatar').src = user.photoURL || 'https://i.pravatar.cc/40';
        
        loginContainer.classList.remove('visible');
        appWrapper.classList.add('visible');
        
        loadInitialData();
    } else {
        userId = null;
        loginContainer.classList.add('visible');
        appWrapper.classList.remove('visible');
        
        cleanupFirestoreListeners();
        clearLocalData();
    }
}

function loadInitialData() {
    setupFirestoreListeners();
    switchTab(activeTab); // Ir a la última pestaña activa o al dashboard
}

function cleanupFirestoreListeners() {
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
}

function clearLocalData() {
    dailyData = {};
    projects = [];
    finances = [];
    ideas = [];
}

// --- 5. GESTIÓN DE PESTAÑAS Y UI ---
function switchTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.nav-button').forEach(el => el.classList.toggle('active', el.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.toggle('active', el.id === tabId));
    renderContentForActiveTab();
}

function renderContentForActiveTab() {
    switch (activeTab) {
        case 'dashboard-content':
            renderDashboard();
            break;
        case 'projects-content':
            renderProjects();
            break;
        case 'finances-content':
            renderFinances();
            break;
        case 'inbox-content':
            renderIdeas();
            break;
        case 'progress-content':
            renderProgress();
            break;
    }
}

async function toggleTheme() {
    currentTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    applyTheme(currentTheme);
    if (userId) {
        await setDoc(doc(db, 'users', userId), { theme: currentTheme }, { merge: true });
    }
}

function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    currentTheme = theme;
    const icon = theme === 'dark' ? '#icon-sun' : '#icon-moon';
    document.querySelectorAll('#theme-toggle use, #mobile-theme-toggle use').forEach(use => use.setAttribute('href', icon));
}


// --- 6. LISTENERS DE FIRESTORE ---
function setupFirestoreListeners() {
    if (!userId) return;
    cleanupFirestoreListeners(); // Limpiar listeners antiguos

    // Listener para datos del usuario (tema)
    const userDocRef = doc(db, 'users', userId);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            applyTheme(docSnap.data().theme || 'light');
        }
    });

    // Listener para el día seleccionado (rutinas)
    const dailyDocRef = doc(db, 'users', userId, 'dailyData', selectedDate);
    const unsubDaily = onSnapshot(dailyDocRef, (docSnap) => {
        dailyData[selectedDate] = docSnap.exists() ? docSnap.data() : { routines: [] };
        if (activeTab === 'dashboard-content') {
            renderRoutinesForSelectedDay();
        }
    });

    // Listeners para colecciones principales
    const collections = ['projects', 'finances', 'ideas'];
    const dataStores = { projects, finances, ideas };
    
    collections.forEach(colName => {
        const q = query(collection(db, 'users', userId, colName), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            dataStores[colName] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            renderContentForActiveTab(); // Re-renderizar al recibir datos
        });
        unsubscribers.push(unsub);
    });

    unsubscribers.push(unsubUser, unsubDaily);
}


// --- 7. MÓDULO: DASHBOARD ---

function renderDashboard() {
    renderWeeklyDashboard();
    renderRoutinesForSelectedDay();
}

function renderWeeklyDashboard() {
    const grid = document.getElementById('weekly-dashboard-grid');
    if (!grid) return;
    const title = document.getElementById('dashboardMonthTitle');
    const today = new Date();
    const start = getStartOfWeek(new Date(selectedDate));

    title.textContent = start.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
    grid.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        const dayStr = getTodayString(day);

        const card = document.createElement('div');
        card.className = 'day-card';
        card.dataset.date = dayStr;
        if (dayStr === selectedDate) card.classList.add('active');
        if (dayStr === getTodayString(today)) card.classList.add('today');

        card.innerHTML = `
            <h4>${day.toLocaleString('es-ES', { weekday: 'short' })}</h4>
            <p class="date">${day.getDate()}</p>
        `;
        card.addEventListener('click', () => handleDaySelection(dayStr));
        grid.appendChild(card);
    }
}

function handleDaySelection(dateStr) {
    selectedDate = dateStr;
    setupFirestoreListeners(); // Re-establece el listener para el nuevo día
    renderWeeklyDashboard(); // Re-render para actualizar el día activo
}

function renderRoutinesForSelectedDay() {
    const container = document.getElementById('routines-list');
    if (!container) return;
    const title = document.getElementById('routines-title');
    const routines = dailyData[selectedDate]?.routines || [];
    
    const dateObj = new Date(selectedDate + 'T00:00:00');
    title.textContent = `Rutinas para ${dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}`;
    container.innerHTML = '';

    if (routines.length === 0) {
        container.innerHTML = '<p class="empty-list-message">No hay rutinas. ¡Añade una!</p>';
    } else {
        routines.forEach(routine => container.appendChild(createRoutineElement(routine)));
    }
}

function createRoutineElement(routine) {
    const item = document.createElement('div');
    item.className = `list-item ${routine.completed ? 'completed' : ''}`;
    item.innerHTML = `
        <input type="checkbox" data-id="${routine.id}" ${routine.completed ? 'checked' : ''}>
        <div class="item-text-content">
            <input type="text" class="item-text-input" value="${routine.text}" data-id="${routine.id}" ${routine.completed ? 'readonly' : ''}>
        </div>
        <div class="item-actions">
            <button class="btn-icon" data-action="delete" data-id="${routine.id}"><svg class="icon"><use href="#icon-delete"/></svg></button>
        </div>
    `;
    // Add event listeners for this specific element
    item.querySelector('input[type="checkbox"]').addEventListener('change', (e) => toggleRoutine(e.target.dataset.id));
    item.querySelector('.item-text-input').addEventListener('blur', (e) => updateRoutineText(e.target.dataset.id, e.target.value));
    item.querySelector('[data-action="delete"]').addEventListener('click', (e) => deleteRoutine(e.currentTarget.dataset.id));
    return item;
}

// CRUD Rutinas
async function addRoutine() {
    const input = document.getElementById('new-routine-input');
    const text = input.value.trim();
    if (!text || !userId) return;

    const newRoutine = { id: 'r' + Date.now(), text, completed: false };
    const currentRoutines = dailyData[selectedDate]?.routines || [];
    const updatedRoutines = [...currentRoutines, newRoutine];

    await setDoc(doc(db, 'users', userId, 'dailyData', selectedDate), { routines: updatedRoutines }, { merge: true });
    input.value = '';
}

async function updateRoutines(updatedRoutines) {
    await setDoc(doc(db, 'users', userId, 'dailyData', selectedDate), { routines: updatedRoutines }, { merge: true });
}

function toggleRoutine(id) {
    const routines = dailyData[selectedDate]?.routines || [];
    const updated = routines.map(r => r.id === id ? { ...r, completed: !r.completed } : r);
    updateRoutines(updated);
}

function updateRoutineText(id, text) {
    const routines = dailyData[selectedDate]?.routines || [];
    const updated = routines.map(r => r.id === id ? { ...r, text } : r);
    updateRoutines(updated);
}

function deleteRoutine(id) {
    const routines = dailyData[selectedDate]?.routines || [];
    const updated = routines.filter(r => r.id !== id);
    updateRoutines(updated);
}


// --- 8. MÓDULO: PROYECTOS ---
function renderProjects() {
    const container = document.getElementById('projects-content');
    if (!container) return;
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Proyectos</h3>
            </div>
            <div class="item-list" id="projects-list"></div>
            <div class="input-group">
                <input type="text" id="new-project-input" placeholder="Añadir nuevo proyecto...">
                <button class="btn-icon btn-primary" id="add-project-btn" title="Añadir Proyecto"><svg class="icon"><use href="#icon-add"/></svg></button>
            </div>
        </div>
    `;
    const list = container.querySelector('#projects-list');
    if (projects.length === 0) {
        list.innerHTML = '<p class="empty-list-message">No hay proyectos. ¡Crea el primero!</p>';
    } else {
        projects.forEach(p => list.appendChild(createProjectElement(p)));
    }

    document.getElementById('add-project-btn').addEventListener('click', addProject);
    document.getElementById('new-project-input').addEventListener('keydown', e => e.key === 'Enter' && addProject());
}

function createProjectElement(project) {
    const item = document.createElement('div');
    item.className = 'project-item'; // You might need to style this class
    item.innerHTML = `
      <h4>${project.name}</h4>
      <p>${project.description || ''}</p>
      <button data-id="${project.id}">Eliminar</button>
    `;
    item.querySelector('button').addEventListener('click', (e) => deleteProject(e.target.dataset.id));
    return item;
}

async function addProject() {
    const input = document.getElementById('new-project-input');
    if (!input.value.trim()) return;
    await addDoc(collection(db, 'users', userId, 'projects'), {
        name: input.value.trim(),
        createdAt: new Date()
    });
    input.value = '';
}

async function deleteProject(id) {
    await deleteDoc(doc(db, 'users', userId, 'projects', id));
}

// --- 9. MÓDULO: FINANZAS ---
function renderFinances() {
    const container = document.getElementById('finances-content');
    if (!container) return;
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Finanzas</h3>
            </div>
            <div id="finance-summary"></div>
            <div class="item-list" id="transactions-list"></div>
            <div class="input-group">
                <input type="text" id="new-transaction-desc" placeholder="Descripción...">
                <input type="number" id="new-transaction-amount" placeholder="Monto...">
                <select id="new-transaction-type">
                    <option value="income">Ingreso</option>
                    <option value="expense">Gasto</option>
                </select>
                <button class="btn-icon btn-primary" id="add-transaction-btn"><svg class="icon"><use href="#icon-add"/></svg></button>
            </div>
        </div>
    `;

    // Render summary
    const summaryEl = container.querySelector('#finance-summary');
    const income = finances.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = finances.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    summaryEl.innerHTML = `
        <p>Ingresos: <span style="color:var(--income-color)">$${income.toFixed(2)}</span></p>
        <p>Gastos: <span style="color:var(--expense-color)">$${expense.toFixed(2)}</span></p>
        <h4>Balance: $${(income - expense).toFixed(2)}</h4>
    `;

    // Render list
    const list = container.querySelector('#transactions-list');
    if (finances.length === 0) {
        list.innerHTML = '<p class="empty-list-message">No hay transacciones.</p>';
    } else {
        finances.forEach(t => list.appendChild(createTransactionElement(t)));
    }

    document.getElementById('add-transaction-btn').addEventListener('click', addTransaction);
}

function createTransactionElement(transaction) {
    const item = document.createElement('div');
    const sign = transaction.type === 'income' ? '+' : '-';
    const color = transaction.type === 'income' ? 'var(--income-color)' : 'var(--expense-color)';
    item.className = 'list-item';
    item.innerHTML = `
        <span class="item-text-content">${transaction.description}</span>
        <span style="color:${color}; margin-left: auto;">${sign}$${transaction.amount.toFixed(2)}</span>
        <button class="btn-icon" data-id="${transaction.id}"><svg class="icon"><use href="#icon-delete"/></svg></button>
    `;
    item.querySelector('button').addEventListener('click', (e) => deleteTransaction(e.currentTarget.dataset.id));
    return item;
}

async function addTransaction() {
    const descInput = document.getElementById('new-transaction-desc');
    const amountInput = document.getElementById('new-transaction-amount');
    const typeInput = document.getElementById('new-transaction-type');

    const amount = parseFloat(amountInput.value);
    if (!descInput.value.trim() || !amount || amount <= 0) {
        showNotification("Por favor, introduce una descripción y un monto válidos.", "danger");
        return;
    }

    await addDoc(collection(db, 'users', userId, 'finanzas'), {
        description: descInput.value.trim(),
        amount: amount,
        type: typeInput.value,
        createdAt: new Date()
    });

    descInput.value = '';
    amountInput.value = '';
}

async function deleteTransaction(id) {
    await deleteDoc(doc(db, 'users', userId, 'finances', id));
}

// --- 10. MÓDULO: IDEAS (INBOX) ---
function renderIdeas() {
    const container = document.getElementById('inbox-content');
    if (!container) return;
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Bandeja de Ideas</h3>
            </div>
            <div class="item-list" id="ideas-list"></div>
            <div class="input-group">
                <input type="text" id="new-idea-input" placeholder="Captura una nueva idea...">
                <button class="btn-icon btn-primary" id="add-idea-btn"><svg class="icon"><use href="#icon-add"/></svg></button>
            </div>
        </div>
    `;

    const list = container.querySelector('#ideas-list');
    if (ideas.length === 0) {
        list.innerHTML = '<p class="empty-list-message">Tu bandeja de entrada está vacía.</p>';
    } else {
        ideas.forEach(idea => list.appendChild(createIdeaElement(idea)));
    }

    document.getElementById('add-idea-btn').addEventListener('click', addIdea);
    document.getElementById('new-idea-input').addEventListener('keydown', e => e.key === 'Enter' && addIdea());
}

function createIdeaElement(idea) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
        <span class="item-text-content">${idea.text}</span>
        <button class="btn-icon" data-id="${idea.id}"><svg class="icon"><use href="#icon-delete"/></svg></button>
    `;
    item.querySelector('button').addEventListener('click', (e) => deleteIdea(e.currentTarget.dataset.id));
    return item;
}

async function addIdea() {
    const input = document.getElementById('new-idea-input');
    if (!input.value.trim()) return;
    await addDoc(collection(db, 'users', userId, 'ideas'), {
        text: input.value.trim(),
        createdAt: new Date()
    });
    input.value = '';
}

async function deleteIdea(id) {
    await deleteDoc(doc(db, 'users', userId, 'ideas', id));
}


// --- 11. MÓDULO: PROGRESO ---
function renderProgress() {
    const container = document.getElementById('progress-content');
    if (!container) return;
    container.innerHTML = `
        <div class="card">
            <h3 class="card-title">Tu Progreso</h3>
            <p>Sección en construcción. ¡Vuelve pronto para ver tus estadísticas!</p>
            <canvas id="progress-chart"></canvas>
        </div>
    `;
    // Aquí podrías agregar lógica para renderizar un gráfico con Chart.js
}

// --- 12. SETUP DE EVENT LISTENERS GLOBALES ---
function setupEventListeners() {
    // Autenticación
    document.getElementById('loginBtn').addEventListener('click', () => signInWithPopup(auth, provider));
    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
    
    // UI General
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('mobile-theme-toggle').addEventListener('click', toggleTheme);
    
    // Navegación principal
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', (e) => switchTab(e.currentTarget.dataset.tab));
    });

    // Dashboard (los que son permanentes)
    document.getElementById('add-routine-btn').addEventListener('click', addRoutine);
    document.getElementById('new-routine-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') addRoutine();
    });
}
