// --- 1. IMPORTAR FUNCIONES DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, serverTimestamp, arrayUnion, arrayRemove, writeBatch } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- 2. INICIALIZACIÓN DE FIREBASE Y SERVICIOS ---
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

// --- ESTADO GLOBAL ---
let tasks = [], inboxItems = [], achievements = {}, routineCompletions = {}, transactions = [];
let routines = []; 
let currentTheme = 'light', userId = null, selectedDate = getTodayString();
let tasksChart = null;
let unsubscribers = [];

// --- DEFINICIONES ---
const DEFAULT_ROUTINES = [
    { id: 'take_pill', text: 'Tomar la pastilla' },
    { id: 'litter_morning', text: 'Limpiar areneros (mañana)' },
    { id: 'water_up', text: 'Cambiar el agua arriba' },
    { id: 'water_down', text: 'Cambiar el agua abajo' },
    { id: 'meditate', text: 'Meditar 5 minutos' },
    { id: 'read_book', text: 'Leer un capítulo' }
];
const ACHIEVEMENT_LIST = {
    firstTask: { title: '¡Primer Proyecto!', icon: '📝', description: 'Completa tu primera tarea de proyecto.', condition: () => tasks.some(t => t.completed) },
    tenTasks: { title: 'Maestra de Proyectos', icon: '✍️', description: 'Completa 10 tareas de proyecto.', condition: () => tasks.filter(t => t.completed).length >= 10 },
    inboxZero: { title: 'Mente Clara', icon: '🧘‍♀️', description: 'Vacía tu bandeja de ideas.', condition: (args) => args?.justDeleted && inboxItems.length === 0 },
    routinePerfectDay: { title: 'Día Perfecto', icon: '🌟', description: 'Completa todas las rutinas en un día.', condition: (args) => args?.perfectDay },
    streak3: { title: 'Constancia', icon: '🔥', description: 'Mantén una racha de 3 días completando rutinas.', condition: (args) => args?.streak >= 3 },
    firstIncome: { title: '¡Primer Ingreso!', icon: '💰', description: 'Registra tu primera ganancia.', condition: () => transactions.some(t => t.type === 'income') },
};

// --- HELPERS DE FECHA ---
const getTodayString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const getStartOfWeek = (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

// --- ARRANQUE DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    onAuthStateChanged(auth, user => {
        handleAuthStateChange(user);
    });
});

function handleAuthStateChange(user) {
    const loginContainer = document.getElementById('login-container');
    const appWrapper = document.getElementById('app-wrapper');
    const bottomNav = document.querySelector('.bottom-nav');

    if (user) {
        if (userId !== user.uid) { 
            userId = user.uid;
            
            document.getElementById('user-display-name').textContent = user.displayName.split(' ')[0];
            document.getElementById('user-avatar').src = user.photoURL || 'https://i.pravatar.cc/40';

            loginContainer.classList.remove('visible');
            appWrapper.classList.add('visible');
            bottomNav.classList.add('visible');
            
            setupRealtimeListeners();
            switchTab('dashboard-content');
        }
    } else {
        userId = null;
        
        loginContainer.classList.add('visible');
        appWrapper.classList.remove('visible');
        bottomNav.classList.remove('visible');
        
        unsubscribers.forEach(unsub => unsub());
        unsubscribers = [];
        clearLocalData();
    }
}

function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', () => signInWithPopup(auth, provider).catch(error => console.error("Error en login:", error)));
    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
    
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('mobile-theme-toggle').addEventListener('click', toggleTheme);

    document.querySelectorAll('.nav-button').forEach(tab => {
        tab.addEventListener('click', (e) => switchTab(e.currentTarget.dataset.tab));
    });

    document.getElementById('addTaskBtn').addEventListener('click', addTask);
    document.getElementById('taskInput').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
    document.getElementById('addInboxBtn').addEventListener('click', addInboxItem);
    document.getElementById('finance-form').addEventListener('submit', addTransaction);
    
    // Listeners para nuevas rutinas
    document.getElementById('add-routine-btn').addEventListener('click', addRoutine);
    document.getElementById('new-routine-input').addEventListener('keydown', e => { if (e.key === 'Enter') addRoutine(); });
}

function setupRealtimeListeners() {
    if (!userId) return;
    const userDocRef = doc(db, 'users', userId);

    unsubscribers.push(onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            achievements = data.achievements || {};
            currentTheme = data.theme || 'light';
            routines = data.routines || DEFAULT_ROUTINES;
        } else {
            setDoc(userDocRef, { achievements: {}, theme: 'light', routines: DEFAULT_ROUTINES });
        }
        applyTheme(currentTheme);
        renderAchievements();
        renderDailyRoutines(); // Renderizar rutinas con los datos actualizados
    }));
    
    unsubscribers.push(onSnapshot(query(collection(db, 'users', userId, 'routineCompletions')), (snapshot) => {
        routineCompletions = {};
        snapshot.docs.forEach(d => { routineCompletions[d.id] = d.data().completedIds; });
        if (document.getElementById('dashboard-content').classList.contains('active')) {
            renderWeeklyDashboard();
            renderDailyRoutines();
        }
    }));
    
    unsubscribers.push(onSnapshot(query(collection(db, 'users', userId, 'tasks'), orderBy('createdAt', 'desc')), (snapshot) => {
        tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        loadTasks();
        checkAndUnlockAchievements();
        renderSummaryStats();
    }));
    unsubscribers.push(onSnapshot(query(collection(db, 'users', userId, 'inboxItems'), orderBy('createdAt', 'desc')), (snapshot) => {
        inboxItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        loadInboxItems();
        renderSummaryStats();
    }));
    unsubscribers.push(onSnapshot(query(collection(db, 'users', userId, 'transactions'), orderBy('date', 'desc')), (snapshot) => {
        transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTransactions();
        checkAndUnlockAchievements();
        renderSummaryStats();
    }));
}

// --- LÓGICA DE UI ---
function switchTab(tabId) {
    document.querySelectorAll('.nav-button').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabId);
    });
    
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.toggle('active', el.id === tabId);
    });
    
    if (tabId === 'dashboard-content') {
        selectedDate = getTodayString(); // Reset a hoy al cambiar a la pestaña
        renderWeeklyDashboard();
        renderDailyRoutines();
    } else if (tabId === 'progress-content') {
        renderReport('week');
    }
}

async function toggleTheme() {
    currentTheme = (currentTheme === 'light') ? 'dark' : 'light';
    applyTheme(currentTheme);
    if (userId) {
        try {
            await updateDoc(doc(db, 'users', userId), { theme: currentTheme });
        } catch (error) { showNotification("Error al guardar el tema."); }
    }
}

function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    const themeIconUse = theme === 'dark' ? '#icon-sun' : '#icon-moon';
    document.querySelector('#theme-toggle use').setAttribute('href', themeIconUse);
    document.querySelector('#mobile-theme-toggle use').setAttribute('href', themeIconUse);
}

function showNotification(message, duration = 3000, isAchievement = false) {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = 'notification show';
    if(isAchievement) el.classList.add('achievement');
    setTimeout(() => { el.classList.remove('show'); }, duration);
}

function clearLocalData() {
    tasks = []; inboxItems = []; achievements = {}; routineCompletions = {}; transactions = [];
    routines = DEFAULT_ROUTINES;
    selectedDate = getTodayString();
}

// --- DASHBOARD DE RUTINAS ---
function renderWeeklyDashboard() {
    const grid = document.getElementById('weekly-dashboard-grid');
    const title = document.getElementById('dashboardMonthTitle');
    if (!grid || !title) return;

    const startOfWeek = getStartOfWeek(new Date(selectedDate.replace(/-/g, '/'))); // Usar fecha seleccionada
    title.textContent = startOfWeek.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
    grid.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        const dayStr = getTodayString(day);

        const card = document.createElement('div');
        card.className = 'day-card';
        card.dataset.date = dayStr;
        if (dayStr === selectedDate) {
            card.classList.add('active');
        }
        if (dayStr === getTodayString()) {
            card.classList.add('today');
        }

        const completedToday = routineCompletions[dayStr] || [];
        const completedCount = completedToday.length;
        
        let summaryText = 'Pendiente';
        if (completedCount > 0 && completedCount === routines.length) {
            summaryText = 'Completado';
        } else if (completedCount > 0) {
            summaryText = `${completedCount}/${routines.length}`;
        }

        card.innerHTML = `
            <h4>${day.toLocaleString('es-ES', { weekday: 'long' })}</h4>
            <p class="date">${day.getDate()}</p>
            <p class="routine-summary">${summaryText}</p>
        `;
        card.addEventListener('click', () => {
            selectedDate = dayStr;
            renderWeeklyDashboard(); // Re-render para mostrar la selección
            renderDailyRoutines();
        });
        grid.appendChild(card);
    }
}

function renderDailyRoutines() {
    const container = document.getElementById('routines-list');
    const titleEl = document.getElementById('routines-title');
    if (!container || !titleEl) return;
    
    const date = new Date(selectedDate.replace(/-/g, '/'));
    const isToday = selectedDate === getTodayString();
    titleEl.textContent = `Rutinas para ${isToday ? 'Hoy' : date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}`;
    
    container.innerHTML = '';
    const completedOnDate = routineCompletions[selectedDate] || [];

    routines.forEach(routine => {
        const isCompleted = completedOnDate.includes(routine.id);
        const item = document.createElement('div');
        item.className = `list-item routine-item ${isCompleted ? 'completed' : ''}`;
        item.innerHTML = `
            <input type="checkbox" data-routine-id="${routine.id}" ${isCompleted ? 'checked' : ''}>
            <div class="item-text-content">
                <input type="text" class="item-text-input" value="${routine.text}" ${isCompleted ? 'readonly' : ''} data-routine-id="${routine.id}">
            </div>
            <div class="item-actions">
                <button class="btn-icon" data-action="delete-routine" data-id="${routine.id}"><svg class="icon" title="Eliminar"><use href="#icon-delete"/></svg></button>
            </div>`;
        
        const checkbox = item.querySelector('input[type="checkbox"]');
        const textInput = item.querySelector('input[type="text"]');
        
        checkbox.addEventListener('change', (e) => {
            toggleRoutineCompletion(e.target.dataset.routineId);
            textInput.readOnly = e.target.checked; // Hacer no editable si está chequeado
        });
        
        textInput.addEventListener('change', (e) => {
            updateRoutineText(e.target.dataset.routineId, e.target.value);
        });

        item.querySelector('[data-action="delete-routine"]').addEventListener('click', (e) => deleteRoutine(e.currentTarget.dataset.id));
        
        container.appendChild(item);
    });
}


// --- CRUD DE RUTINAS ---
async function addRoutine() {
    const input = document.getElementById('new-routine-input');
    const text = input.value.trim();
    if (!text || !userId) return;

    const newRoutine = {
        id: 'r' + new Date().getTime(), // ID simple basado en timestamp
        text: text
    };
    
    const updatedRoutines = [...routines, newRoutine];
    
    try {
        await updateDoc(doc(db, 'users', userId), { routines: updatedRoutines });
        input.value = '';
    } catch(e) {
        showNotification("Error al añadir la rutina.");
        console.error(e);
    }
}

async function updateRoutineText(id, newText) {
    if (!userId) return;
    const updatedRoutines = routines.map(r => r.id === id ? { ...r, text: newText } : r);
    try {
        await updateDoc(doc(db, 'users', userId), { routines: updatedRoutines });
        showNotification("Rutina actualizada.");
    } catch (e) {
        showNotification("Error al actualizar la rutina.");
    }
}

async function deleteRoutine(id) {
    if (!userId) return;
    const updatedRoutines = routines.filter(r => r.id !== id);
    try {
        await updateDoc(doc(db, 'users', userId), { routines: updatedRoutines });
        showNotification("Rutina eliminada.");
    } catch(e) {
        showNotification("Error al eliminar la rutina.");
    }
}

async function toggleRoutineCompletion(routineId) {
    if (!userId) return;
    const dateDocRef = doc(db, 'users', userId, 'routineCompletions', selectedDate);
    const completedOnDate = routineCompletions[selectedDate] || [];
    const isCompleted = completedOnDate.includes(routineId);
    
    try {
        if (isCompleted) {
            await setDoc(dateDocRef, { completedIds: arrayRemove(routineId) }, { merge: true });
        } else {
            await setDoc(dateDocRef, { completedIds: arrayUnion(routineId) }, { merge: true });
            // Comprobación de logros cuando se completa una rutina
            const allCompleted = routines.every(r => [...completedOnDate, routineId].includes(r.id));
            if (allCompleted) {
                checkAndUnlockAchievements({ perfectDay: true });
            }
        }
    } catch (e) { 
        showNotification("Error al actualizar la rutina.");
        console.error(e);
    }
}


// --- PROYECTOS ---
async function addTask() {
    const input = document.getElementById('taskInput');
    if (!input.value.trim() || !userId) return;
    try {
        await addDoc(collection(db, 'users', userId, 'tasks'), { text: input.value, completed: false, createdAt: serverTimestamp() });
        input.value = '';
    } catch(e) { showNotification("Error al añadir tarea."); }
}
async function toggleTask(id) {
    if (!userId) return;
    const task = tasks.find(t => t.id == id);
    if (task) {
        try {
            await updateDoc(doc(db, 'users', userId, 'tasks', id), { completed: !task.completed, completedAt: !task.completed ? serverTimestamp() : null });
        } catch(e) { showNotification("Error al actualizar tarea."); }
    }
}
async function deleteTask(id) {
    if (!userId) return;
    try {
        await deleteDoc(doc(db, 'users', userId, 'tasks', id));
    } catch(e) { showNotification("Error al eliminar tarea."); }
}
function loadTasks() {
    const pendingList = document.getElementById('taskListPending');
    const completedList = document.getElementById('taskListCompleted');
    pendingList.innerHTML = ''; completedList.innerHTML = '';
    
    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    pendingList.innerHTML = pendingTasks.length > 0 ? '' : '<p style="text-align:center; opacity:0.7; padding: 20px 0;">¡No tienes tareas pendientes!</p>';
    pendingTasks.forEach(task => pendingList.appendChild(createTaskElement(task)));

    document.getElementById('completed-title').style.display = completedTasks.length > 0 ? 'block' : 'none';
    if(completedTasks.length > 0) completedTasks.forEach(task => completedList.appendChild(createTaskElement(task)));
}
function createTaskElement(task) {
    const item = document.createElement('div');
    item.className = `list-item ${task.completed ? 'completed' : ''}`;
    item.innerHTML = `
        <input type="checkbox" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
        <div class="item-text-content"><span class="item-text">${task.text}</span></div>
        <div class="item-actions">
            <button class="btn-icon" data-action="delete-task" data-id="${task.id}"><svg class="icon" title="Eliminar"><use href="#icon-delete"/></svg></button>
        </div>`;
    item.querySelector('input').addEventListener('change', (e) => toggleTask(e.target.dataset.taskId));
    item.querySelector('[data-action="delete-task"]').addEventListener('click', (e) => deleteTask(e.currentTarget.dataset.id));
    return item;
}

// --- IDEAS (INBOX) ---
async function addInboxItem() {
    const textEl = document.getElementById('inboxText');
    const urlEl = document.getElementById('inboxUrl');
    if ((!textEl.value.trim() && !urlEl.value.trim()) || !userId) return;
    
    try {
        await addDoc(collection(db, 'users', userId, 'inboxItems'), { text: textEl.value.trim(), url: urlEl.value.trim(), createdAt: serverTimestamp() });
        textEl.value = ''; urlEl.value = '';
        showNotification('Idea guardada ✨');
    } catch(e) { showNotification("Error al guardar idea."); }
}
function loadInboxItems() {
    const list = document.getElementById('inboxList');
    list.innerHTML = inboxItems.length > 0 ? '' : '<p style="text-align:center; opacity:0.7; padding: 20px 0;">Tu bandeja de ideas está vacía.</p>';
    inboxItems.forEach(item => list.appendChild(createInboxElement(item)));
}
function createInboxElement(item) {
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `
        <div class="icon-placeholder">💡</div>
        <div class="item-text-content">
            <p class="item-text">${item.text}</p>
            ${item.url ? `<a href="${item.url.startsWith('http') ? '' : '//'}${item.url}" target="_blank" class="item-details">${item.url}</a>` : ''}
        </div>
        <div class="item-actions">
            <button class="btn-icon" data-id="${item.id}" data-action="delete-inbox" title="Eliminar Idea"><svg class="icon"><use href="#icon-delete"/></svg></button>
        </div>`;
    el.querySelector('[data-action="delete-inbox"]').addEventListener('click', (e) => deleteInboxItem(e.currentTarget.dataset.id));
    return el;
}
async function deleteInboxItem(id) {
    if (!userId) return;
    try {
        await deleteDoc(doc(db, 'users', userId, 'inboxItems', id));
        await checkAndUnlockAchievements({ justDeleted: true });
    } catch(e) { showNotification("Error al eliminar idea."); }
}

// --- FINANZAS ---
async function addTransaction(event) {
    event.preventDefault();
    if (!userId) return;
    const amountEl = document.getElementById('financeAmount');
    const descEl = document.getElementById('financeDescription');
    const typeEl = document.getElementById('financeType');

    const amount = parseFloat(amountEl.value);
    const description = descEl.value.trim();
    if (!amount || !description) return showNotification("Completa todos los campos.");
    
    try {
        await addDoc(collection(db, 'users', userId, 'transactions'), { amount, description, type: typeEl.value, date: serverTimestamp() });
        amountEl.value = ''; descEl.value = '';
        showNotification(`Movimiento registrado.`);
    } catch(e) { showNotification("Error al registrar movimiento."); }
}
function renderTransactions() {
    const list = document.getElementById('transactionList');
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const monthTransactions = transactions.filter(t => (t.date?.toDate() || new Date(t.date)) >= firstDayOfMonth);
    
    let totalIncome = 0, totalExpense = 0;

    list.innerHTML = monthTransactions.length === 0 ? '<p style="text-align:center; opacity:0.7; padding: 20px 0;">No hay movimientos este mes.</p>' : '';
    monthTransactions.forEach(trans => {
        if (trans.type === 'income') totalIncome += trans.amount;
        else totalExpense += trans.amount;
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="item-text-content">
                <span class="item-text">${trans.description}</span>
                <span class="item-details">${(trans.date?.toDate() || new Date(trans.date)).toLocaleDateString()}</span>
            </div>
            <span class="transaction-amount ${trans.type === 'income' ? 'income' : 'expense'}">
                ${trans.type === 'income' ? '+' : '-'}$${trans.amount.toFixed(2)}
            </span>`;
        list.appendChild(item);
    });

    document.getElementById('summaryIncome').textContent = `$${totalIncome.toFixed(2)}`;
    document.getElementById('summaryExpense').textContent = `$${totalExpense.toFixed(2)}`;
    const balance = totalIncome - totalExpense;
    const balanceEl = document.getElementById('summaryBalance');
    balanceEl.textContent = `$${balance.toFixed(2)}`;
    balanceEl.className = balance >= 0 ? 'finance-hero-balance income' : 'finance-hero-balance expense';
}

// --- GRÁFICOS Y PROGRESO ---
function renderReport(period) {
    const canvas = document.getElementById('tasksCompletedChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-muted');
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border-color');
    
    const now = new Date();
    const chartLabels = [];
    const chartData = [];

    if (period === 'week') {
        for (let i = 6; i >= 0; i--) {
            const day = new Date(now);
            day.setDate(now.getDate() - i);
            chartLabels.push(day.toLocaleDateString('es-ES', { weekday: 'short' }));
            const dayStr = getTodayString(day);
            const tasksOnDay = tasks.filter(t => t.completedAt && getTodayString(t.completedAt.toDate()) === dayStr).length;
            chartData.push(tasksOnDay);
        }
    } else { // 'month'
        for (let i = 3; i >= 0; i--) { // Últimas 4 semanas
            const endOfWeek = new Date(now);
            endOfWeek.setDate(now.getDate() - (i * 7));
            const startOfWeek = new Date(endOfWeek);
            startOfWeek.setDate(endOfWeek.getDate() - 6);
            chartLabels.push(`Sem ${startOfWeek.getDate()}/${startOfWeek.getMonth()+1}`);
            const tasksInWeek = tasks.filter(t => {
                const completedDate = t.completedAt?.toDate();
                return completedDate && completedDate >= startOfWeek && completedDate <= endOfWeek;
            }).length;
            chartData.push(tasksInWeek);
        }
    }

    if (tasksChart) tasksChart.destroy();
    tasksChart = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: chartLabels, 
            datasets: [{ 
                label: 'Tareas Completadas', 
                data: chartData, 
                backgroundColor: 'rgba(34, 211, 238, 0.6)',
                borderColor: 'rgba(34, 211, 238, 1)',
                borderWidth: 2, borderRadius: 8, barThickness: 20,
            }] 
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 }, beginAtZero: true },
                x: { grid: { display: false }, ticks: { color: textColor } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderSummaryStats() {
    const tasksCompleted = tasks.filter(t => t.completed).length;
    const ideasCount = inboxItems.length;
    
    const todayStr = getTodayString();
    const routinesToday = (routineCompletions[todayStr] || []).length;
    
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const financesMonth = transactions.filter(t => (t.date?.toDate() || new Date(t.date)) >= firstDayOfMonth).length;

    document.getElementById('stat-tasks').textContent = tasksCompleted;
    document.getElementById('stat-inbox').textContent = ideasCount;
    document.getElementById('stat-routines').textContent = routinesToday;
    document.getElementById('stat-finances').textContent = financesMonth;
}

// --- LOGROS Y RACHA ---
async function checkAndUnlockAchievements(args = {}) {
    if (!userId) return;
    let newAchievementUnlocked = false;
    // Streak calculation needs to be adapted if you want to keep it
    const streak = calculateRoutineStreak(); 
    const passedArgs = {...args, streak};

    for (const key in ACHIEVEMENT_LIST) {
        if (!achievements[key] && ACHIEVEMENT_LIST[key].condition(passedArgs)) {
            achievements[key] = true;
            newAchievementUnlocked = true;
            showNotification(`🏆 ¡Logro Desbloqueado: ${ACHIEVEMENT_LIST[key].title}!`, 4000, true);
        }
    }
    if (newAchievementUnlocked) {
        try {
            await updateDoc(doc(db, 'users', userId), { achievements: achievements });
        } catch(e) { console.error("Error saving achievements", e); }
    }
}
function renderAchievements() {
    const grid = document.getElementById('achievementsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const key in ACHIEVEMENT_LIST) {
        const ach = ACHIEVEMENT_LIST[key];
        const unlocked = achievements[key];
        const card = document.createElement('div');
        card.className = `achievement-card ${unlocked ? 'unlocked' : 'locked'}`;
        card.title = unlocked ? ach.description : `Bloqueado: ${ach.description}`;
        card.innerHTML = `<span class="icon">${ach.icon}</span><p>${ach.title}</p>`;
        grid.appendChild(card);
    }
}
function calculateRoutineStreak() {
    if (!routines || routines.length === 0) return 0;
    const completionDates = Object.keys(routineCompletions).filter(date => {
        const completedIds = routineCompletions[date] || [];
        return routines.every(r => completedIds.includes(r.id));
    }).sort((a, b) => new Date(b) - new Date(a));

    if (completionDates.length === 0) return 0;

    let streak = 0;
    const today = new Date(getTodayString());
    let lastCompletion = new Date(completionDates[0]);
    
    let diffDays = Math.round((today - lastCompletion) / (1000 * 3600 * 24));

    if (diffDays > 1) return 0;
    
    streak = (diffDays === 0 || diffDays === 1) ? 1 : 0;
    if (streak === 0) return 0;

    for (let i = 0; i < completionDates.length - 1; i++) {
        const current = new Date(completionDates[i]);
        const previous = new Date(completionDates[i + 1]);
        const diff = Math.round((current - previous) / (1000 * 3600 * 24));
        if (diff === 1) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}
