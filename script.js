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
let obligatoryRoutines = [], extraRoutines = [];
let currentTheme = 'light', userId = null;
let weeklyRoutineChart = null, tasksChart = null;
let pomodoro = { interval: null, state: 'idle', timeLeft: 25 * 60, targetTime: 0 };
let unsubscribers = [];

// --- DEFINICIONES ---
const DEFAULT_OBLIGATORY_ROUTINES = [
    { id: 'take_pill', text: 'Tomar la pastilla' }, { id: 'litter_morning', text: 'Limpiar areneros (mañana)' },
    { id: 'water_up', text: 'Cambiar el agua arriba' }, { id: 'water_down', text: 'Cambiar el agua abajo' },
];
const DEFAULT_EXTRA_ROUTINES = [ { id: 'meditate', text: 'Meditar 5 minutos' }, { id: 'read_book', text: 'Leer un capítulo' } ];
const ACHIEVEMENT_LIST = {
    firstTask: { title: '¡Primer Proyecto!', icon: '📝', description: 'Completa tu primera tarea de proyecto.', condition: () => tasks.some(t => t.completed) },
    tenTasks: { title: 'Maestra de Proyectos', icon: '✍️', description: 'Completa 10 tareas de proyecto.', condition: () => tasks.filter(t => t.completed).length >= 10 },
    firstPomodoro: { title: 'Foco Total', icon: '🍅', description: 'Completa tu primer Pomodoro.', condition: (args) => args?.pomodoro_completed },
    inboxZero: { title: 'Mente Clara', icon: '🧘‍♀️', description: 'Vacía tu bandeja de ideas.', condition: (args) => args?.justDeleted && inboxItems.length === 0 },
    routinePerfectDay: { title: 'Día Perfecto', icon: '🌟', description: 'Completa todas las rutinas obligatorias en un día.', condition: (args) => args?.perfectDay },
    streak3: { title: 'Constancia', icon: '🔥', description: 'Mantén una racha de 3 días completando rutinas.', condition: (args) => args?.streak >= 3 },
    firstIncome: { title: '¡Primer Ingreso!', icon: '💰', description: 'Registra tu primera ganancia.', condition: () => transactions.some(t => t.type === 'income') },
};

// --- HELPERS ---
const getTodayString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- ARRANQUE DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    onAuthStateChanged(auth, user => {
        const loginContainer = document.getElementById('login-container');
        const appContainer = document.getElementById('app-container');
        const bottomNav = document.querySelector('.bottom-nav');

        if (user) {
            if (userId !== user.uid) { 
                userId = user.uid;
                loginContainer.style.display = 'none';
                appContainer.style.display = 'flex';
                bottomNav.style.display = 'flex';

                document.getElementById('user-display-name').textContent = user.displayName.split(' ')[0];
                document.getElementById('user-avatar').src = user.photoURL || 'https://i.pravatar.cc/40';

                setupRealtimeListeners();
            }
        } else {
            userId = null;
            loginContainer.style.display = 'flex';
            appContainer.style.display = 'none';
            bottomNav.style.display = 'none';
            unsubscribers.forEach(unsub => unsub());
            unsubscribers = [];
            clearLocalData();
        }
    });
});

function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', () => signInWithPopup(auth, provider).catch(error => console.error("Error en login:", error)));
    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.querySelectorAll('.bottom-nav-item').forEach(tab => tab.addEventListener('click', (e) => switchTab(e.currentTarget.dataset.tab)));

    document.getElementById('addTaskBtn').addEventListener('click', addTask);
    document.getElementById('taskInput').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
    document.getElementById('addInboxBtn').addEventListener('click', addInboxItem);
    document.getElementById('addObligatoryRoutineBtn').addEventListener('click', () => addRoutine('obligatory'));
    document.getElementById('addExtraRoutineBtn').addEventListener('click', () => addRoutine('extra'));
    document.getElementById('finance-form').addEventListener('submit', addTransaction);
    
    document.getElementById('pomodoroControls').addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        if (button.id.includes('StartWork')) startPomodoro('work');
        if (button.id.includes('Pause')) pausePomodoro();
        if (button.id.includes('Resume')) resumePomodoro();
    });

    document.querySelectorAll('.report-controls button').forEach(button => {
        button.addEventListener('click', (e) => renderReport(e.currentTarget.dataset.period));
    });
}

function setupRealtimeListeners() {
    if (!userId) return;
    const userDocRef = doc(db, 'users', userId);

    unsubscribers.push(onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            achievements = data.achievements || {};
            currentTheme = data.theme || 'light';
            obligatoryRoutines = data.obligatoryRoutines || DEFAULT_OBLIGATORY_ROUTINES;
            extraRoutines = data.extraRoutines || DEFAULT_EXTRA_ROUTINES;
        } else {
            setDoc(userDocRef, { achievements: {}, theme: 'light', obligatoryRoutines: DEFAULT_OBLIGATORY_ROUTINES, extraRoutines: DEFAULT_EXTRA_ROUTINES });
        }
        applyTheme(currentTheme);
        renderAchievements();
        renderRoutines();
    }));

    unsubscribers.push(onSnapshot(query(collection(db, 'users', userId, 'tasks'), orderBy('createdAt', 'desc')), (snapshot) => {
        tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        loadTasks();
        checkAndUnlockAchievements();
        updateReportsIfVisible();
    }));
    
    unsubscribers.push(onSnapshot(query(collection(db, 'users', userId, 'routineCompletions')), (snapshot) => {
        const oldCompletions = { ...routineCompletions };
        routineCompletions = {};
        snapshot.forEach(doc => { routineCompletions[doc.id] = doc.data().completedIds; });
        
        const todayStr = getTodayString();
        const oldTodayCompletions = oldCompletions[todayStr] || [];
        const newTodayCompletions = routineCompletions[todayStr] || [];

        if (newTodayCompletions.length > oldTodayCompletions.length) {
            const allObligatoryDone = obligatoryRoutines.every(r => newTodayCompletions.includes(r.id));
            if (allObligatoryDone) {
                showNotification("¡Misión Cumplida! Completaste tus rutinas. 🎉", 4000, true);
                checkAndUnlockAchievements({ perfectDay: true });
            }
        }
        
        const currentStreak = calculateRoutineStreak();
        checkAndUnlockAchievements({ streak: currentStreak });
        
        renderRoutines();
        updateReportsIfVisible();
    }));

    unsubscribers.push(onSnapshot(query(collection(db, 'users', userId, 'inboxItems'), orderBy('createdAt', 'desc')), (snapshot) => {
        inboxItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        loadInboxItems();
    }));

    unsubscribers.push(onSnapshot(query(collection(db, 'users', userId, 'transactions'), orderBy('date', 'desc')), (snapshot) => {
        transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTransactions();
        checkAndUnlockAchievements();
    }));

    // CORRECCIÓN: Inicializar el Pomodoro al cargar
    updatePomodoroUI();
}

// --- LÓGICA DE UI (NAVEGACIÓN, TEMA, NOTIFICACIONES) ---
function switchTab(tabId) {
    document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    if (tabId === 'progress-content') renderReport('week');
}

async function toggleTheme() {
    currentTheme = (currentTheme === 'light') ? 'dark' : 'light';
    applyTheme(currentTheme);
    if (userId) {
        try {
            await updateDoc(doc(db, 'users', userId), { theme: currentTheme });
        } catch (error) { showNotification("Error al guardar el tema."); }
    }
    updateReportsIfVisible();
}

function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    document.getElementById('theme-toggle').innerHTML = theme === 'dark' ? '<svg class="icon"><use href="#icon-sun"/></svg>' : '<svg class="icon"><use href="#icon-moon"/></svg>';
}

function showNotification(message, duration = 3000, isAchievement = false) {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = 'notification show';
    if(isAchievement) el.classList.add('achievement');
    setTimeout(() => { el.classList.remove('show', 'achievement'); }, duration);
}

function updateReportsIfVisible(){
    if (document.getElementById('progress-content').classList.contains('active')) {
        const activePeriod = document.querySelector('.report-controls .active')?.dataset.period || 'week';
        renderReport(activePeriod);
    }
}

function clearLocalData() {
    tasks = []; inboxItems = []; achievements = {}; routineCompletions = {}; transactions = [];
    obligatoryRoutines = DEFAULT_OBLIGATORY_ROUTINES; extraRoutines = DEFAULT_EXTRA_ROUTINES;
}

// --- DASHBOARD (RUTINAS) ---
function renderRoutines() {
    renderWeeklyRoutineChart();
    const todayStr = getTodayString();
    const completedToday = routineCompletions[todayStr] || [];
    
    const obligatoryList = document.getElementById('obligatory-routines-list');
    obligatoryList.innerHTML = obligatoryRoutines.length > 0 ? '' : '<p style="text-align:center; opacity:0.7; padding: 20px 0;">Añade rutinas obligatorias.</p>';
    obligatoryRoutines.forEach(r => obligatoryList.appendChild(createRoutineElement(r, completedToday, 'obligatory')));

    const extraList = document.getElementById('extra-routines-list');
    extraList.innerHTML = extraRoutines.length > 0 ? '' : '<p style="text-align:center; opacity:0.7; padding: 20px 0;">Añade rutinas extra.</p>';
    extraRoutines.forEach(r => extraList.appendChild(createRoutineElement(r, completedToday, 'extra')));
}
function createRoutineElement(routine, completedToday, type) {
    const item = document.createElement('div');
    const isCompleted = completedToday.includes(routine.id);
    item.className = `list-item ${isCompleted ? 'completed' : ''}`;
    item.innerHTML = `
        <input type="checkbox" data-routine-id="${routine.id}" ${isCompleted ? 'checked' : ''}>
        <div class="item-text-content"><span class="item-text">${routine.text}</span></div>
        <div class="item-actions">
            <button class="btn-icon" data-action="edit-routine" data-type="${type}" data-id="${routine.id}" title="Editar"><svg class="icon"><use href="#icon-edit"/></svg></button>
            <button class="btn-icon" data-action="delete-routine" data-type="${type}" data-id="${routine.id}" title="Eliminar"><svg class="icon"><use href="#icon-delete"/></svg></button>
        </div>`;
    item.querySelector('input').addEventListener('change', (e) => toggleRoutine(e.target.dataset.routineId));
    item.querySelector('[data-action="edit-routine"]').addEventListener('click', (e) => editRoutine(e.currentTarget.dataset.type, e.currentTarget.dataset.id));
    item.querySelector('[data-action="delete-routine"]').addEventListener('click', (e) => deleteRoutine(e.currentTarget.dataset.type, e.currentTarget.dataset.id));
    return item;
}

async function addRoutine(type) {
    const newText = prompt(`Añadir nueva rutina ${type === 'obligatory' ? 'obligatoria' : 'extra'}:`);
    if (!newText || !newText.trim() || !userId) return;
    const newId = `custom_${Date.now()}`;
    const newRoutine = { id: newId, text: newText.trim() };
    const field = type === 'obligatory' ? 'obligatoryRoutines' : 'extraRoutines';
    try {
        await updateDoc(doc(db, 'users', userId), { [field]: arrayUnion(newRoutine) });
    } catch (e) { showNotification("Error al añadir la rutina."); }
}
async function editRoutine(type, id) {
    if (!userId) return;
    const list = type === 'obligatory' ? obligatoryRoutines : extraRoutines;
    const routine = list.find(r => r.id === id);
    if (!routine) return;
    const newText = prompt("Editar rutina:", routine.text);
    if (newText && newText.trim() !== routine.text) {
        const newList = list.map(r => r.id === id ? { ...r, text: newText.trim() } : r);
        const field = type === 'obligatory' ? 'obligatoryRoutines' : 'extraRoutines';
        try {
            await updateDoc(doc(db, 'users', userId), { [field]: newList });
        } catch (e) { showNotification("Error al editar la rutina."); }
    }
}
async function deleteRoutine(type, id) {
    if (!confirm("¿Estás segura de que quieres eliminar esta rutina?") || !userId) return;
    const list = type === 'obligatory' ? obligatoryRoutines : extraRoutines;
    const newList = list.filter(r => r.id !== id);
    const field = type === 'obligatory' ? 'obligatoryRoutines' : 'extraRoutines';
    try {
        await updateDoc(doc(db, 'users', userId), { [field]: newList });
    } catch (e) { showNotification("Error al eliminar la rutina."); }
}

async function toggleRoutine(routineId) {
    if (!userId) return;
    const todayStr = getTodayString();
    const todayDocRef = doc(db, 'users', userId, 'routineCompletions', todayStr);
    const completedToday = routineCompletions[todayStr] || [];
    const isCompleted = completedToday.includes(routineId);
    try {
        if (isCompleted) {
            await setDoc(todayDocRef, { completedIds: arrayRemove(routineId) }, { merge: true });
        } else {
            await setDoc(todayDocRef, { completedIds: arrayUnion(routineId) }, { merge: true });
        }
    } catch (e) { showNotification("Error al actualizar la rutina."); }
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
            <span class="transaction-amount ${trans.type}">
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

// --- POMODORO ---
function startPomodoro(type) {
    clearInterval(pomodoro.interval);
    pomodoro.state = type;
    const duration = type === 'work' ? (25 * 60) : (5 * 60);
    pomodoro.timeLeft = duration;
    pomodoro.targetTime = Date.now() + duration * 1000;
    pomodoro.interval = setInterval(tickPomodoro, 500);
    updatePomodoroUI();
}
function resumePomodoro() {
    if (pomodoro.state !== 'paused') return;
    pomodoro.state = pomodoro.timeLeft > (5 * 60) ? 'work' : 'break';
    pomodoro.targetTime = Date.now() + pomodoro.timeLeft * 1000;
    pomodoro.interval = setInterval(tickPomodoro, 500);
    updatePomodoroUI();
}
function tickPomodoro() {
    pomodoro.timeLeft = Math.round((pomodoro.targetTime - Date.now()) / 1000);
    if (pomodoro.timeLeft <= 0) {
        pomodoro.timeLeft = 0;
        clearInterval(pomodoro.interval);
        const completedType = pomodoro.state;
        if (completedType === 'work') {
            pomodoro.state = 'break';
            showNotification('¡Pomodoro completado! Toma un descanso ☕', 5000, true);
            checkAndUnlockAchievements({pomodoro_completed: true});
            pomodoro.timeLeft = 5 * 60;
        } else {
            pomodoro.state = 'idle';
            pomodoro.timeLeft = 25 * 60;
            showNotification('¡Descanso terminado! A seguir creando 💪', 5000);
        }
    }
    updatePomodoroUI();
}
function pausePomodoro() {
    clearInterval(pomodoro.interval);
    pomodoro.state = 'paused';
    updatePomodoroUI();
}
function updatePomodoroUI() {
    const timerEl = document.getElementById('pomodoroTimer');
    const statusEl = document.getElementById('pomodoroStatus');
    const controlsEl = document.getElementById('pomodoroControls');
    if(!timerEl) return;

    const minutes = Math.floor(pomodoro.timeLeft / 60).toString().padStart(2, '0');
    const seconds = (pomodoro.timeLeft % 60).toString().padStart(2, '0');
    timerEl.textContent = `${minutes}:${seconds}`;
    
    let statusText, controlsHtml;
    switch (pomodoro.state) {
        case 'work':
            statusText = 'Enfócate...';
            controlsHtml = `<button class="btn-primary" id="pomodoroPause"><svg class="icon"><use href="#icon-pause"/></svg> Pausar</button>`;
            break;
        case 'paused':
            statusText = 'En pausa.';
             controlsHtml = `<button class="btn-primary" id="pomodoroResume"><svg class="icon"><use href="#icon-play"/></svg> Reanudar</button>`;
            break;
        case 'break':
             statusText = 'Toma un respiro...';
             controlsHtml = `<button class="btn-primary" id="pomodoroStartWork"><svg class="icon"><use href="#icon-play"/></svg> Empezar otro</button>`;
             break;
        default:
            statusText = 'Listo para empezar.';
            controlsHtml = `<button class="btn-primary" id="pomodoroStartWork"><svg class="icon"><use href="#icon-play"/></svg> Iniciar Trabajo</button>`;
    }
    statusEl.textContent = statusText;
    controlsEl.innerHTML = controlsHtml;
}

// --- GRÁFICOS Y PROGRESO ---
function renderWeeklyRoutineChart() {
    const canvas = document.getElementById('weekly-routine-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const labels = [];
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const day = new Date(today);
        day.setDate(today.getDate() - i);
        labels.push(day.toLocaleDateString('es-ES', { weekday: 'short' }));
        const dayStr = getTodayString(day);
        const completed = routineCompletions[dayStr] || [];
        const completedObligatory = obligatoryRoutines.filter(r => completed.includes(r.id)).length;
        const percentage = obligatoryRoutines.length > 0 ? (completedObligatory / obligatoryRoutines.length) * 100 : 0;
        data.push(percentage);
    }
    if (weeklyRoutineChart) weeklyRoutineChart.destroy();
    weeklyRoutineChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '% Completado', data: data,
                backgroundColor: 'rgba(123, 97, 255, 0.6)',
                borderColor: 'rgba(123, 97, 255, 1)',
                borderWidth: 2, borderRadius: 8, barThickness: 15,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { display: false, beginAtZero: true, max: 100 },
                x: { grid: { display: false }, ticks: { color: '#718096' } }
            },
            plugins: { legend: { display: false }, title: { display: false } }
        }
    });
}
function renderReport(period) {
    document.querySelectorAll('.report-controls button').forEach(b => b.classList.remove('active'));
    document.querySelector(`.report-controls [data-period="${period}"]`).classList.add('active');
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
    } else {
        for (let i = 3; i >= 0; i--) {
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
        data: { labels: chartLabels, datasets: [{
            label: 'Tareas Completadas', data: chartData,
            backgroundColor: 'rgba(255, 141, 133, 0.6)', borderColor: 'rgba(255, 141, 133, 1)',
            borderWidth: 2, borderRadius: 8, barThickness: 20,
        }] },
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

// --- LOGROS Y RACHA ---
async function checkAndUnlockAchievements(args = {}) {
    if (!userId) return;
    let newAchievementUnlocked = false;
    for (const key in ACHIEVEMENT_LIST) {
        if (!achievements[key] && ACHIEVEMENT_LIST[key].condition(args)) {
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
    if (!obligatoryRoutines || obligatoryRoutines.length === 0) return 0;
    const completionDates = Object.keys(routineCompletions).filter(date => {
        const completedIds = routineCompletions[date] || [];
        return obligatoryRoutines.every(r => completedIds.includes(r.id));
    }).sort((a, b) => new Date(b) - new Date(a));
    if (completionDates.length === 0) return 0;
    let streak = 0;
    let today = new Date(getTodayString());
    let lastCompletion = new Date(completionDates[0]);
    let diffDays = Math.round((today - lastCompletion) / (1000 * 3600 * 24));
    if (diffDays > 1) return 0;
    streak = (diffDays <= 1) ? 1 : 0;
    if (streak === 0) return 0;
    for (let i = 0; i < completionDates.length - 1; i++) {
        const current = new Date(completionDates[i]);
        const previous = new Date(completionDates[i + 1]);
        const diff = Math.round((current - previous) / (1000 * 3600 * 24));
        if (diff === 1) streak++; else break;
    }
    return streak;
}
function updateFocusStreak() {
    // Esta función no está en el código original, pero es necesaria para mostrar la racha
    // La llamaremos desde el listener de 'routineCompletions'
    // Por ahora, la dejamos vacía ya que no hay un elemento en el nuevo HTML para la racha.
    // Si quieres añadirla, crea un <div id="focusStreak"></div> en el header y descomenta esto.
    /*
    const streak = calculateRoutineStreak();
    const streakEl = document.getElementById('focusStreak');
    if (streak > 0) {
        streakEl.innerHTML = `🌟 Racha de ${streak} día${streak === 1 ? '' : 's'}`;
        streakEl.style.display = 'block';
    } else {
        streakEl.style.display = 'none';
    }
    */
}
