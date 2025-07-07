// --- MODO DE DESARROLLO ---
// Cambia a 'true' para trabajar sin login (usando localStorage).
// Cambia a 'false' para activar Firebase y el login de Google para producción.
const DEVELOPMENT_MODE = true;

// --- 1. IMPORTAR FUNCIONES DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, serverTimestamp, arrayUnion, arrayRemove, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- 2. INICIALIZACIÓN DE FIREBASE Y SERVICIOS ---
let app, auth, db, provider;
try {
  if (!DEVELOPMENT_MODE) {
      const firebaseConfig = {
        apiKey: "AIzaSyD0gGVvxwFxEnfbOYIhwVDExSR9HZy1YG4", // REEMPLAZA CON TU API KEY
        authDomain: "miapp-e4dc6.firebaseapp.com",
        projectId: "miapp-e4dc6",
        storageBucket: "miapp-e4dc6.appspot.com",
        messagingSenderId: "815058398646",
        appId: "1:815058398646:web:15d8a49b50ac5c660de517",
        measurementId: "G-ZG1T9MZ8MD"
      };
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      provider = new GoogleAuthProvider();
  }
} catch (e) {
  console.error("Error inicializando Firebase. Revisa tu configuración.", e);
  if (!DEVELOPMENT_MODE) alert("Error de configuración de Firebase. La app no funcionará online.");
}

// --- ESTADO GLOBAL ---
let tasks = [], inboxItems = [], achievements = {}, routineCompletions = {}, transactions = [];
let obligatoryRoutines = [], extraRoutines = [];
let currentTheme = 'light', userId = null;
let tasksChart = null, routineChart = null;
let pomodoro = { interval: null, state: 'idle', timeLeft: 25 * 60 };
let unsubscribers = [];

// --- DEFINICIONES ---
const DEFAULT_OBLIGATORY_ROUTINES = [
    { id: 'take_pill', text: 'Tomar la pastilla' }, { id: 'litter_morning', text: 'Limpiar areneros (mañana)' },
    { id: 'water_up', text: 'Cambiar el agua arriba' }, { id: 'water_down', text: 'Cambiar el agua abajo' },
    { id: 'water_out', text: 'Cambiar el agua afuera' }, { id: 'feed_trained', text: 'Dar de comer a los entrenados' },
    { id: 'litter_night', text: 'Limpiar areneros (noche)' }, { id: 'clean_pee', text: 'Trapear la pis de la vereda' },
    { id: 'wash_dishes_pets', text: 'Lavar los platos (chiquis)' }, { id: 'wash_dishes_us', text: 'Lavar platos nuestros' },
    { id: 'sweep_room', text: 'Barrer mi cuarto' }, { id: 'sweep_living', text: 'Barrer la sala' },
    { id: 'mop_room', text: 'Trapear mi cuarto' }, { id: 'mop_living', text: 'Trapear la sala' },
    { id: 'dust_furniture', text: 'Sacudir muebles' }, { id: 'change_covers', text: 'Cambiar fundas muebles' },
    { id: 'wash_clothes', text: 'Lavar la ropa' }, { id: 'wash_clothes_pets', text: 'Lavar ropa (chiquis)' },
];
const DEFAULT_EXTRA_ROUTINES = [ { id: 'meditate', text: 'Meditar 5 minutos' }, { id: 'read_book', text: 'Leer un capítulo' } ];
const ACHIEVEMENT_LIST = {
    firstTask: { title: '¡Primer Proyecto!', icon: '📝', description: 'Completa tu primera tarea de proyecto.', condition: () => tasks.some(t => t.completed) },
    tenTasks: { title: 'Maestra de Proyectos', icon: '✍️', description: 'Completa 10 tareas de proyecto.', condition: () => tasks.filter(t => t.completed).length >= 10 },
    firstPomodoro: { title: 'Foco Total', icon: '🍅', description: 'Completa tu primer Pomodoro.', condition: (args) => args?.pomodoro_completed },
    inboxZero: { title: 'Mente Clara', icon: '🧘‍♀️', description: 'Vacía tu bandeja de ideas.', condition: (args) => args?.justDeleted && inboxItems.length === 0 },
    routinePerfectDay: { title: 'Día Perfecto', icon: '🌟', description: 'Completa todas las rutinas obligatorias en un día.', condition: (args) => args?.perfectDay },
    streak3: { title: 'Constancia', icon: '🔥', description: 'Mantén una racha de 3 días completando rutinas.', condition: () => calculateRoutineStreak() >= 3 },
    firstIncome: { title: '¡Primer Ingreso!', icon: '💰', description: 'Registra tu primera ganancia.', condition: () => transactions.some(t => t.type === 'income') },
};
const LOCAL_STORAGE_PREFIX = 'creaInfantilApp_v3_';

// --- ARRANQUE DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    if (DEVELOPMENT_MODE) {
        console.warn("MODO DE DESARROLLO ACTIVO. Los datos se guardan en localStorage.");
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        document.getElementById('user-display').textContent = 'Modo Local';
        loadStateFromLocalStorage();
        renderAllComponents();
    } else {
        onAuthStateChanged(auth, user => {
            const loginContainer = document.getElementById('login-container');
            const appContainer = document.getElementById('app-container');
            if (user) {
                userId = user.uid;
                loginContainer.style.display = 'none';
                appContainer.style.display = 'block';
                document.getElementById('user-display').textContent = `Hola, ${user.displayName.split(' ')[0]}`;
                setupRealtimeListeners();
            } else {
                userId = null;
                loginContainer.style.display = 'flex';
                appContainer.style.display = 'none';
                unsubscribers.forEach(unsub => unsub());
                unsubscribers = [];
                clearLocalData();
                renderAllComponents();
            }
        });
    }
});

function loadStateFromLocalStorage() {
    tasks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PREFIX + 'tasks')) || [];
    inboxItems = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PREFIX + 'inboxItems')) || [];
    transactions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PREFIX + 'transactions')) || [];
    routineCompletions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PREFIX + 'routines')) || {};
    const profile = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PREFIX + 'profile')) || {};
    achievements = profile.achievements || {};
    currentTheme = profile.theme || 'light';
    obligatoryRoutines = profile.obligatoryRoutines || DEFAULT_OBLIGATORY_ROUTINES;
    extraRoutines = profile.extraRoutines || DEFAULT_EXTRA_ROUTINES;
    applyTheme(currentTheme);
}

function setupEventListeners() {
    if (!DEVELOPMENT_MODE) {
        document.getElementById('loginBtn').addEventListener('click', () => signInWithPopup(auth, provider).catch(error => console.error("Error en login:", error)));
        document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
    }
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.querySelectorAll('.nav-tab').forEach(tab => tab.addEventListener('click', (e) => switchTab(e.currentTarget.dataset.tab)));
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
        if (button.id.includes('Resume')) startPomodoro(pomodoro.state, false);
        if (button.id.includes('Reset')) resetPomodoro();
    });

    document.querySelectorAll('.report-controls button').forEach(button => {
        button.addEventListener('click', (e) => renderReport(e.currentTarget.dataset.period));
    });
}

function setupRealtimeListeners() {
    if (!userId) return;
    const userDocRef = doc(db, 'users', userId);

    const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
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
    });

    const tasksQuery = query(collection(db, 'users', userId, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
        tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), completedAt: d.data().completedAt?.toDate() }));
        loadTasks();
        checkAndUnlockAchievements();
        updateReportsIfVisible();
    });
    
    const routinesQuery = query(collection(db, 'users', userId, 'routineCompletions'));
    const unsubRoutines = onSnapshot(routinesQuery, (snapshot) => {
        routineCompletions = {};
        snapshot.forEach(doc => { routineCompletions[doc.id] = doc.data().completedIds; });
        renderRoutines();
        updateReportsIfVisible();
        updateFocusStreak();
    });

    const inboxQuery = query(collection(db, 'users', userId, 'inboxItems'), orderBy('createdAt', 'desc'));
    const unsubInbox = onSnapshot(inboxQuery, (snapshot) => {
        inboxItems = snapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() }));
        loadInboxItems();
    });

    const financeQuery = query(collection(db, 'users', userId, 'transactions'), orderBy('date', 'desc'));
    const unsubFinances = onSnapshot(financeQuery, (snapshot) => {
        transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data(), date: d.data().date?.toDate() }));
        renderTransactions();
    });

    unsubscribers = [unsubProfile, unsubTasks, unsubInbox, unsubRoutines, unsubFinances];
}

function saveData() {
    if(DEVELOPMENT_MODE) {
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'tasks', JSON.stringify(tasks));
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'inboxItems', JSON.stringify(inboxItems));
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'transactions', JSON.stringify(transactions));
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'routines', JSON.stringify(routineCompletions));
        const profile = { achievements, theme: currentTheme, obligatoryRoutines, extraRoutines };
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'profile', JSON.stringify(profile));
        renderAllComponents();
    }
}

function renderAllComponents() {
    renderRoutines();
    loadTasks();
    loadInboxItems();
    renderTransactions();
    renderAchievements();
    updateFocusStreak();
    updateReportsIfVisible();
    updatePomodoroUI();
}
function clearLocalData() {
    Object.keys(localStorage).forEach(k => {
        if (k.startsWith('creaInfantilApp_')) localStorage.removeItem(k);
    });
    tasks = []; inboxItems = []; achievements = {}; routineCompletions = {}; transactions = [];
}
function updateReportsIfVisible(){
    if (document.getElementById('reports').classList.contains('active')) {
        const activePeriod = document.querySelector('.report-controls .active')?.dataset.period || 'week';
        renderReport(activePeriod);
    }
}
function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    if (tabName === 'reports') renderReport('week');
}
async function toggleTheme() {
    currentTheme = (currentTheme === 'light') ? 'dark' : 'light';
    applyTheme(currentTheme);
    await saveProfileData();
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
    setTimeout(() => {
        el.classList.remove('show', 'achievement');
    }, duration);
}

// --- RUTINAS DIARIAS ---
function renderRoutines() {
    renderWeeklyView();
    const todayStr = new Date().toISOString().split('T')[0];
    const completedToday = routineCompletions[todayStr] || [];
    
    const obligatoryList = document.getElementById('routine-obligatorias-list');
    obligatoryList.innerHTML = '';
    obligatoryRoutines.forEach(r => obligatoryList.appendChild(createRoutineElement(r, completedToday, 'obligatory')));

    const extraList = document.getElementById('routine-extras-list');
    extraList.innerHTML = '';
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
            <button class="btn-icon" data-action="edit-routine" data-type="${type}" data-id="${routine.id}" title="Editar Rutina"><svg class="icon"><use href="#icon-edit"/></svg></button>
            <button class="btn-icon" data-action="delete-routine" data-type="${type}" data-id="${routine.id}" title="Eliminar Rutina"><svg class="icon"><use href="#icon-delete"/></svg></button>
        </div>`;
    item.querySelector('input').addEventListener('change', (e) => toggleRoutine(e.target.dataset.routineId));
    item.querySelector('[data-action="edit-routine"]').addEventListener('click', (e) => editRoutine(e.currentTarget.dataset.type, e.currentTarget.dataset.id));
    item.querySelector('[data-action="delete-routine"]').addEventListener('click', (e) => deleteRoutine(e.currentTarget.dataset.type, e.currentTarget.dataset.id));
    return item;
}
async function addRoutine(type) {
    const newText = prompt(`Añadir nueva rutina ${type === 'obligatory' ? 'obligatoria' : 'extra'}:`);
    if (!newText || !newText.trim()) return;
    const newId = `custom_${Date.now()}`;
    const newRoutine = { id: newId, text: newText.trim() };

    if (type === 'obligatory') obligatoryRoutines.push(newRoutine);
    else extraRoutines.push(newRoutine);
    await saveProfileData();
}
async function editRoutine(type, id) {
    const list = type === 'obligatory' ? obligatoryRoutines : extraRoutines;
    const routine = list.find(r => r.id === id);
    if (!routine) return;
    const newText = prompt("Editar rutina:", routine.text);
    if (newText && newText.trim() !== routine.text) {
        routine.text = newText.trim();
        await saveProfileData();
    }
}
async function deleteRoutine(type, id) {
    if (!confirm("¿Estás segura de que quieres eliminar esta rutina?")) return;
    if (type === 'obligatory') {
        obligatoryRoutines = obligatoryRoutines.filter(r => r.id !== id);
    } else {
        extraRoutines = extraRoutines.filter(r => r.id !== id);
    }
    await saveProfileData();
}
async function saveProfileData() {
    const profileData = { theme: currentTheme, achievements, obligatoryRoutines, extraRoutines };
    if (!DEVELOPMENT_MODE && userId) {
        await setDoc(doc(db, 'users', userId), profileData, { merge: true });
    } else {
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'profile', JSON.stringify(profileData));
        renderRoutines();
    }
}
async function toggleRoutine(routineId) {
    const todayStr = new Date().toISOString().split('T')[0];
    const completedToday = [...(routineCompletions[todayStr] || [])];
    const isCompleted = completedToday.includes(routineId);
    
    if (isCompleted) {
        const index = completedToday.indexOf(routineId);
        completedToday.splice(index, 1);
    } else {
        completedToday.push(routineId);
    }
    routineCompletions[todayStr] = completedToday;
    
    if (!DEVELOPMENT_MODE && userId) {
        const todayDocRef = doc(db, 'users', userId, 'routineCompletions', todayStr);
        await setDoc(todayDocRef, { completedIds: routineCompletions[todayStr] });
    }
    
    const allObligatoryDone = obligatoryRoutines.every(r => routineCompletions[todayStr].includes(r.id));
    if (!isCompleted && allObligatoryDone) {
        showNotification("¡Misión Cumplida! Has completado tus rutinas obligatorias. 🎉", 4000, true);
        await checkAndUnlockAchievements({ perfectDay: true });
    }
    
    if (DEVELOPMENT_MODE) saveData(); 
    else renderRoutines();
}
function renderWeeklyView() {
    const container = document.getElementById('weekly-view');
    container.innerHTML = '';
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        const dayStr = day.toISOString().split('T')[0];
        const dayName = day.toLocaleDateString('es-ES', { weekday: 'short' });
        const dayNum = day.getDate();
        
        const completedToday = routineCompletions[dayStr] || [];
        const obligatoryCompletedCount = obligatoryRoutines.filter(r => completedToday.includes(r.id)).length;
        const completionRatio = obligatoryRoutines.length > 0 ? (obligatoryCompletedCount / obligatoryRoutines.length) : 0;
        
        let completionClass = '';
        if (completionRatio >= 1) completionClass = 'completed-perfect';
        else if (completionRatio > 0) completionClass = 'completed-partial';

        const dayEl = document.createElement('div');
        dayEl.className = `day-of-week ${dayStr === today.toISOString().split('T')[0] ? 'today' : ''} ${completionClass}`;
        dayEl.innerHTML = `<span class="day-name">${dayName}</span><span class="day-circle">${dayNum}</span>`;
        container.appendChild(dayEl);
    }
}
// --- TAREAS DE PROYECTO ---
async function addTask() {
    const input = document.getElementById('taskInput');
    if (!input.value.trim()) return;
    const newTask = { text: input.value, completed: false, createdAt: new Date().toISOString() };

    if (!DEVELOPMENT_MODE && userId) {
        await addDoc(collection(db, 'users', userId, 'tasks'), { ...newTask, createdAt: serverTimestamp() });
    } else {
        tasks.unshift({ ...newTask, id: Date.now() });
        saveData();
    }
    input.value = '';
    showNotification('Tarea de proyecto agregada ✅');
}

async function editTask(id) {
    const task = tasks.find(t => t.id == id);
    if (!task) return;
    const newText = prompt("Edita tu tarea:", task.text);
    if (newText && newText.trim() !== task.text) {
        if (!DEVELOPMENT_MODE && userId) {
            await updateDoc(doc(db, 'users', userId, 'tasks', String(id)), { text: newText.trim() });
        } else {
            task.text = newText.trim();
            saveData();
        }
    }
}

async function toggleTask(id) {
    const task = tasks.find(t => t.id == id);
    if (task) {
        if (!DEVELOPMENT_MODE && userId) {
            await updateDoc(doc(db, 'users', userId, 'tasks', String(id)), { completed: !task.completed, completedAt: !task.completed ? serverTimestamp() : null });
        } else {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            saveData();
        }
    }
}

async function deleteTask(id) {
    if (!DEVELOPMENT_MODE && userId) {
        await deleteDoc(doc(db, 'users', userId, 'tasks', String(id)));
    } else {
        tasks = tasks.filter(t => t.id != id);
        saveData();
    }
}

function loadTasks() {
    const pendingList = document.getElementById('taskListPending');
    const completedList = document.getElementById('taskListCompleted');
    pendingList.innerHTML = ''; completedList.innerHTML = '';
    
    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    pendingList.innerHTML = pendingTasks.length > 0 ? '' : '<p style="text-align:center; opacity:0.7; padding: 20px 0;">¡No tienes tareas pendientes de proyecto!</p>';
    pendingTasks.forEach(task => pendingList.appendChild(createTaskElement(task)));

    const showCompleted = completedTasks.length > 0;
    document.getElementById('completed-divider').style.display = showCompleted ? 'block' : 'none';
    document.getElementById('completed-title').style.display = showCompleted ? 'block' : 'none';
    if(showCompleted) completedTasks.forEach(task => completedList.appendChild(createTaskElement(task)));
}

function createTaskElement(task) {
    const item = document.createElement('div');
    item.className = `list-item ${task.completed ? 'completed' : ''}`;
    item.innerHTML = `
        <input type="checkbox" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
        <div class="item-text-content"><span class="item-text">${task.text}</span></div>
        <div class="item-actions">
            <button class="btn-icon" data-action="edit-task" data-id="${task.id}"><svg class="icon" title="Editar"><use href="#icon-edit"/></svg></button>
            <button class="btn-icon" data-action="delete-task" data-id="${task.id}"><svg class="icon" title="Eliminar"><use href="#icon-delete"/></svg></button>
        </div>`;
    item.querySelector('input').addEventListener('change', (e) => toggleTask(e.target.dataset.taskId));
    item.querySelector('[data-action="edit-task"]').addEventListener('click', (e) => editTask(e.currentTarget.dataset.id));
    item.querySelector('[data-action="delete-task"]').addEventListener('click', (e) => deleteTask(e.currentTarget.dataset.id));
    return item;
}

// --- BANDEJA DE IDEAS ---
async function addInboxItem() {
    const textEl = document.getElementById('inboxText');
    const urlEl = document.getElementById('inboxUrl');
    if (!textEl.value.trim() && !urlEl.value.trim()) return;
    const newItem = { text: textEl.value.trim(), url: urlEl.value.trim(), createdAt: new Date().toISOString() };
    
    if (!DEVELOPMENT_MODE && userId) {
        await addDoc(collection(db, 'users', userId, 'inboxItems'), { ...newItem, createdAt: serverTimestamp() });
    } else {
        inboxItems.unshift({ ...newItem, id: Date.now() });
        saveData();
    }
    
    textEl.value = ''; urlEl.value = '';
    showNotification('Idea guardada ✨');
}

function loadInboxItems() {
    const list = document.getElementById('inboxList');
    list.innerHTML = inboxItems.length > 0 ? '' : '<p style="text-align:center; opacity:0.7; padding: 20px 0;">Tu bandeja de ideas está vacía.</p>';
    inboxItems.forEach(item => list.appendChild(createInboxElement(item)));
}

function createInboxElement(item) {
    const el = document.createElement('div');
    el.className = 'list-item';
    const createdAtDate = item.createdAt ? new Date(item.createdAt.seconds ? item.createdAt.seconds * 1000 : item.createdAt).toLocaleDateString() : 'Ahora';
    el.innerHTML = `
        <div class="item-text-content">
            <p class="inbox-text">${item.text}</p>
            ${item.url ? `<a href="${item.url.startsWith('http') ? '' : '//'}${item.url}" target="_blank" class="inbox-link">${item.url}</a>` : ''}
            <p class="item-details">${createdAtDate}</p>
        </div>
        <div class="item-actions">
            <button class="btn-icon" data-id="${item.id}" data-action="edit-inbox" title="Editar Idea"><svg class="icon"><use href="#icon-edit"/></svg></button>
            <button class="btn-icon" data-id="${item.id}" data-action="convert-inbox" title="Convertir en Tarea"><svg class="icon"><use href="#icon-forward"/></svg></button>
            <button class="btn-icon" data-id="${item.id}" data-action="delete-inbox" title="Eliminar Idea"><svg class="icon"><use href="#icon-delete"/></svg></button>
        </div>`;
    el.querySelector('[data-action="edit-inbox"]').addEventListener('click', (e) => editInboxItem(e.currentTarget.dataset.id));
    el.querySelector('[data-action="convert-inbox"]').addEventListener('click', (e) => convertInboxToTask(e.currentTarget.dataset.id));
    el.querySelector('[data-action="delete-inbox"]').addEventListener('click', (e) => deleteInboxItem(e.currentTarget.dataset.id));
    return el;
}
async function editInboxItem(id) {
    const item = inboxItems.find(i => i.id == id);
    if (!item) return;
    const newText = prompt("Edita tu idea:", item.text);
    if (newText && newText.trim() !== item.text) {
        if (!DEVELOPMENT_MODE && userId) {
            await updateDoc(doc(db, 'users', userId, 'inboxItems', String(id)), { text: newText.trim() });
        } else {
            item.text = newText.trim();
            saveData();
        }
    }
}
async function deleteInboxItem(id) {
    if (!DEVELOPMENT_MODE && userId) {
        await deleteDoc(doc(db, 'users', userId, 'inboxItems', String(id)));
    } else {
        inboxItems = inboxItems.filter(i => i.id != id);
        saveData();
    }
    await checkAndUnlockAchievements({ justDeleted: true });
}
async function convertInboxToTask(id) {
    const item = inboxItems.find(i => i.id == id);
    if (item) {
        let taskText = item.text;
        if (item.url) taskText += ` (ver: ${item.url})`;
        
        await addTaskFromText(taskText);
        await deleteInboxItem(id);

        showNotification('Idea convertida en tarea de proyecto 👍');
        switchTab('tasks');
    }
}
async function addTaskFromText(text) {
    const newTask = { text: text, completed: false, createdAt: new Date().toISOString() };
    if (!DEVELOPMENT_MODE && userId) {
        await addDoc(collection(db, 'users', userId, 'tasks'), { ...newTask, createdAt: serverTimestamp() });
    } else {
        tasks.unshift({ ...newTask, id: Date.now() });
        // No llamamos a saveData aquí, se llama desde convertInboxToTask
    }
}

// --- FINANZAS ---
async function addTransaction(event) {
    event.preventDefault();
    const amountEl = document.getElementById('financeAmount');
    const descEl = document.getElementById('financeDescription');
    const typeEl = document.getElementById('financeType');

    const amount = parseFloat(amountEl.value);
    const description = descEl.value.trim();
    if (!amount || !description) {
        showNotification("Completa todos los campos de finanzas.");
        return;
    }
    
    const newTransaction = { 
        amount, 
        description, 
        type: typeEl.value, 
        date: new Date().toISOString()
    };

    if (!DEVELOPMENT_MODE && userId) {
        await addDoc(collection(db, 'users', userId, 'transactions'), {...newTransaction, date: serverTimestamp() });
    } else {
        transactions.unshift({ ...newTransaction, id: Date.now() });
        saveData();
    }
    
    amountEl.value = '';
    descEl.value = '';
    showNotification(`Movimiento de ${newTransaction.type} registrado.`);
    await checkAndUnlockAchievements();
}

function renderTransactions() {
    const list = document.getElementById('transactionList');
    list.innerHTML = '';
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const monthTransactions = transactions.filter(t => new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date) >= firstDayOfMonth);
    
    let totalIncome = 0;
    let totalExpense = 0;

    if (monthTransactions.length === 0) {
        list.innerHTML = '<p style="text-align:center; opacity:0.7; padding: 20px 0;">No hay movimientos este mes.</p>';
    } else {
        monthTransactions.forEach(trans => {
            if (trans.type === 'income') totalIncome += trans.amount;
            else totalExpense += trans.amount;

            const item = document.createElement('div');
            item.className = 'list-item';
            const transDate = new Date(trans.date?.seconds ? trans.date.seconds * 1000 : trans.date).toLocaleDateString();
            item.innerHTML = `
                <div class="item-text-content">
                    <span class="item-text">${trans.description}</span>
                    <span class="item-details">${transDate}</span>
                </div>
                <span class="transaction-amount ${trans.type}">
                    ${trans.type === 'income' ? '+' : '-'}$${trans.amount.toFixed(2)}
                </span>`;
            list.appendChild(item);
        });
    }

    document.getElementById('summaryIncome').textContent = `$${totalIncome.toFixed(2)}`;
    document.getElementById('summaryExpense').textContent = `$${totalExpense.toFixed(2)}`;
    const balance = totalIncome - totalExpense;
    const balanceEl = document.getElementById('summaryBalance');
    balanceEl.textContent = `$${balance.toFixed(2)}`;
    balanceEl.classList.toggle('income', balance >= 0);
    balanceEl.classList.toggle('expense', balance < 0);
}


// --- POMODORO ---
function startPomodoro(type, resetTime = true) {
    clearInterval(pomodoro.interval);
    pomodoro.state = type;
    if (resetTime) {
      pomodoro.timeLeft = type === 'work' ? (25 * 60) : (5 * 60);
    }
    pomodoro.interval = setInterval(tickPomodoro, 1000);
    updatePomodoroUI();
}
function tickPomodoro() {
    pomodoro.timeLeft--;
    updatePomodoroUI();
    if (pomodoro.timeLeft < 0) {
        clearInterval(pomodoro.interval);
        const completedType = pomodoro.state;
        if (completedType === 'work') {
            pomodoro.state = 'break';
            pomodoro.timeLeft = 5 * 60;
            showNotification('¡Pomodoro completado! Toma un descanso ☕', 5000, true);
            checkAndUnlockAchievements({pomodoro_completed: true});
        } else {
            pomodoro.state = 'idle';
            pomodoro.timeLeft = 25 * 60;
            showNotification('¡Descanso terminado! A seguir creando 💪', 5000);
        }
        updatePomodoroUI();
    }
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
            statusText = 'Enfócate... 🧠';
            controlsHtml = `<button class="btn-secondary" id="pomodoroPause"><svg class="icon"><use href="#icon-pause"/></svg> Pausar</button> <button class="btn-danger" id="pomodoroReset"><svg class="icon"><use href="#icon-reset"/></svg> Detener</button>`;
            break;
        case 'break':
            statusText = 'Toma un respiro... ☕';
            controlsHtml = `<button class="btn-danger" id="pomodoroReset"><svg class="icon"><use href="#icon-reset"/></svg> Omitir</button>`;
            break;
        case 'paused':
            statusText = 'En pausa.';
             controlsHtml = `<button class="btn-primary" id="pomodoroResume"><svg class="icon"><use href="#icon-play"/></svg> Reanudar</button> <button class="btn-danger" id="pomodoroReset"><svg class="icon"><use href="#icon-reset"/></svg> Detener</button>`;
            break;
        default:
            statusText = 'Listo para empezar.';
            controlsHtml = `<button class="btn-primary" id="pomodoroStartWork"><svg class="icon"><use href="#icon-play"/></svg> Iniciar Trabajo</button>`;
    }
    statusEl.textContent = statusText;
    controlsEl.innerHTML = controlsHtml;
}
function pausePomodoro() { clearInterval(pomodoro.interval); pomodoro.state = 'paused'; updatePomodoroUI(); }
function resetPomodoro() { clearInterval(pomodoro.interval); pomodoro.state = 'idle'; pomodoro.timeLeft = 25*60; updatePomodoroUI(); }

// --- REPORTES Y GRÁFICOS ---
function renderReport(period) {
    document.querySelectorAll('.report-controls button').forEach(b => b.classList.remove('active'));
    document.querySelector(`.report-controls [data-period="${period}"]`).classList.add('active');

    const { periodTasksCompleted, labels, timeUnit, formatLabel } = getPeriodData(period);
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border-color');

    // Gráfico de Tareas Completadas
    const tasksData = labels.map(labelDate => {
        const labelKey = formatLabel(labelDate);
        return periodTasksCompleted.filter(t => t.completedAt && formatLabel(new Date(t.completedAt)) === labelKey).length;
    });
    renderBarChart(document.getElementById('tasksCompletedChart'), labels.map(d => formatLabel(d)), tasksData, `Tareas de Proyecto Completadas (${timeUnit})`, textColor, gridColor);
    
    // Gráfico de consistencia de rutinas
    const routineData = getRoutineConsistency(7);
    renderRoutineChart(document.getElementById('routineConsistencyChart'), routineData, 'Consistencia de Rutinas (Últ. 7 Días)', textColor, gridColor);
    
    const totalTasks = periodTasksCompleted.length;
    document.getElementById('reportSummary').innerHTML = `<hr class="divider"><p>En este período has completado <strong>${totalTasks} tareas de proyecto</strong>.</p>`;
}
function getPeriodData(period) {
    const now = new Date(); now.setHours(23, 59, 59, 999);
    let startDate = new Date(); startDate.setHours(0, 0, 0, 0);
    let labels = [], timeUnit = '', formatLabel;
    
    const parseDate = (d) => d?.seconds ? new Date(d.seconds * 1000) : new Date(d);

    switch(period) {
        case 'week':
            startDate.setDate(now.getDate() - 6);
            for(let i=0; i<=6; i++){ const d = new Date(startDate); d.setDate(d.getDate() + i); labels.push(d); }
            timeUnit = 'Semanal';
            formatLabel = (d) => d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
            break;
        case 'month':
            startDate.setDate(now.getDate() - 29);
            for(let i=0; i<=29; i++){ const d = new Date(startDate); d.setDate(d.getDate() + i); labels.push(d); }
            timeUnit = 'Mensual';
            formatLabel = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            break;
        case 'year':
            labels = []; const currentYear = now.getFullYear();
            for(let i = 0; i < 12; i++) { labels.push(new Date(currentYear, i, 15)); }
            startDate = new Date(currentYear, 0, 1);
            timeUnit = 'Anual';
            formatLabel = (d) => d.toLocaleDateString('es-ES', { month: 'short' });
            break;
    }
    const periodTasksCompleted = tasks.filter(t => t.completed && t.completedAt && parseDate(t.completedAt) >= startDate && parseDate(t.completedAt) <= now);
    return { periodTasksCompleted, labels, timeUnit, formatLabel };
}
function getRoutineConsistency(days) {
    let data = { labels: [], percentages: [] };
    const today = new Date();
    for(let i = days - 1; i >= 0; i--) {
        const day = new Date(today); day.setDate(today.getDate() - i);
        const dayStr = day.toISOString().split('T')[0];
        const dayLabel = day.toLocaleDateString('es-ES', {weekday: 'short'});
        const completed = routineCompletions[dayStr] || [];
        const completedObligatory = obligatoryRoutines.filter(r => completed.includes(r.id)).length;
        const percentage = obligatoryRoutines.length > 0 ? (completedObligatory / obligatoryRoutines.length) * 100 : 0;
        data.labels.push(dayLabel);
        data.percentages.push(percentage);
    }
    return data;
}
function renderBarChart(canvas, labels, data, title, textColor, gridColor) {
    if (tasksChart) tasksChart.destroy();
    tasksChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Tareas Completadas', data, backgroundColor: '#e9c46a' }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { beginAtZero: true, ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } }
            },
            plugins: { title: { display: true, text: title, color: textColor }, legend: { display: false } }
        }
    });
}
function renderRoutineChart(canvas, data, title, textColor, gridColor) {
    if (routineChart) routineChart.destroy();
    routineChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: data.labels, datasets: [{ label: '% de Rutinas Obligatorias', data: data.percentages, backgroundColor: '#f4a261' }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { beginAtZero: true, max: 100, ticks: { color: textColor, callback: (v) => v + '%' } }
            },
            plugins: { title: { display: true, text: title, color: textColor }, legend: { display: false } }
        }
    });
}

// --- LOGROS Y RACHA ---
async function checkAndUnlockAchievements(args = {}) {
    let newAchievementUnlocked = false;
    for (const key in ACHIEVEMENT_LIST) {
        const ach = ACHIEVEMENT_LIST[key];
        if (!achievements[key] && ach.condition(args)) {
            achievements[key] = true;
            newAchievementUnlocked = true;
            showNotification(`🏆 ¡Logro Desbloqueado: ${ach.title}!`, 4000, true);
        }
    }
    if (newAchievementUnlocked) {
        await saveProfileData(); // Guarda los nuevos logros en el perfil
        renderAchievements();
    }
}
function renderAchievements() {
    const grid = document.getElementById('achievementsGrid');
    grid.innerHTML = '';
    for (const key in ACHIEVEMENT_LIST) {
        const ach = ACHIEVEMENT_LIST[key];
        const unlocked = achievements[key];
        const card = document.createElement('div');
        card.className = `achievement-card ${unlocked ? 'unlocked' : 'locked'}`;
        card.title = unlocked ? ach.description : `Bloqueado: ${ach.description}`;
        card.innerHTML = `<span class="icon" style="font-size: 3em;">${ach.icon}</span><p>${ach.title}</p>`;
        grid.appendChild(card);
    }
}
function calculateRoutineStreak() {
    const completionDates = Object.keys(routineCompletions).filter(date => {
        const completedIds = routineCompletions[date] || [];
        return obligatoryRoutines.every(r => completedIds.includes(r.id));
    }).sort((a,b) => new Date(b) - new Date(a));

    if (completionDates.length === 0) return 0;
    
    let streak = 0;
    let checkDate = new Date(); checkDate.setHours(0,0,0,0);
    
    let lastCompletionDate = new Date(completionDates[0]); lastCompletionDate.setHours(0,0,0,0);
    const diffToday = (checkDate.getTime() - lastCompletionDate.getTime()) / (1000 * 3600 * 24);

    if (diffToday > 1) return 0;
    streak = (diffToday <= 1) ? 1 : 0;
    if (streak === 0) return 0;

    for (let i = 0; i < completionDates.length - 1; i++) {
        const current = new Date(completionDates[i]);
        const previous = new Date(completionDates[i+1]);
        const diffDays = Math.round((current.getTime() - previous.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) streak++; else break;
    }
    return streak;
}
function updateFocusStreak() {
    const streak = calculateRoutineStreak();
    document.getElementById('focusStreak').innerHTML = `🌟 Racha de ${streak} día${streak === 1 ? '' : 's'}`;
}
function renderBarChart(canvas, labels, data, title, textColor, gridColor) {
    if (tasksChart) tasksChart.destroy();
    tasksChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{ 
                label: 'Tareas Completadas', 
                data, 
                backgroundColor: '#e9c46a' 
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { beginAtZero: true, ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } }
            },
            plugins: { 
                title: { display: true, text: title, color: textColor }, 
                legend: { display: false } 
            }
        }
    });
}
function renderRoutineChart(canvas, data, title, textColor, gridColor) {
    if (routineChart) routineChart.destroy();
    routineChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: '% de Rutinas Obligatorias',
                data: data.percentages,
                backgroundColor: '#f4a261'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { beginAtZero: true, max: 100, ticks: { color: textColor, callback: (v) => v + '%' } }
            },
            plugins: { 
                title: { display: true, text: title, color: textColor }, 
                legend: { display: false } 
            }
        }
    });
}

// --- LOGROS Y RACHA ---
async function checkAndUnlockAchievements(args = {}) {
    let newAchievementUnlocked = false;
    let currentAchievements = achievements;

    // Si estamos en modo producción, obtenemos la versión más fresca de los logros
    if (!DEVELOPMENT_MODE && userId) {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            currentAchievements = docSnap.data().achievements || {};
        }
    }

    for (const key in ACHIEVEMENT_LIST) {
        const ach = ACHIEVEMENT_LIST[key];
        if (!currentAchievements[key] && ach.condition(args)) {
            achievements[key] = true; // Actualiza el estado local
            newAchievementUnlocked = true;
            showNotification(`🏆 ¡Logro Desbloqueado: ${ach.title}!`, 4000, true);
        }
    }

    if (newAchievementUnlocked) {
        await saveProfileData(); // Guarda el perfil actualizado (que incluye los logros)
        renderAchievements();
    }
}
function renderAchievements() {
    const grid = document.getElementById('achievementsGrid');
    grid.innerHTML = '';
    for (const key in ACHIEVEMENT_LIST) {
        const ach = ACHIEVEMENT_LIST[key];
        const unlocked = achievements[key];
        const card = document.createElement('div');
        card.className = `achievement-card ${unlocked ? 'unlocked' : 'locked'}`;
        card.title = unlocked ? ach.description : `Bloqueado: ${ach.description}`;
        card.innerHTML = `<span class="icon" style="font-size: 3em;">${ach.icon}</span><p>${ach.title}</p>`;
        grid.appendChild(card);
    }
}
function calculateRoutineStreak() {
    const completionDates = Object.keys(routineCompletions).filter(date => {
        const completedIds = routineCompletions[date] || [];
        // Considera un día completo solo si todas las rutinas OBLIGATORIAS están hechas
        return obligatoryRoutines.every(r => completedIds.includes(r.id));
    }).sort((a,b) => new Date(b) - new Date(a));

    if (completionDates.length === 0) return 0;
    
    let streak = 0;
    let checkDate = new Date(); 
    checkDate.setHours(0,0,0,0);
    
    let lastCompletionDate = new Date(completionDates[0]); 
    lastCompletionDate.setHours(0,0,0,0);
    
    const diffToday = (checkDate.getTime() - lastCompletionDate.getTime()) / (1000 * 3600 * 24);

    if (diffToday > 1) return 0;
    streak = (diffToday <= 1) ? 1 : 0;
    if (streak === 0) return 0;

    for (let i = 0; i < completionDates.length - 1; i++) {
        const current = new Date(completionDates[i]);
        const previous = new Date(completionDates[i+1]);
        const diffDays = Math.round((current.getTime() - previous.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}
function updateFocusStreak() {
    const streak = calculateRoutineStreak();
    document.getElementById('focusStreak').innerHTML = `🌟 Racha de ${streak} día${streak === 1 ? '' : 's'}`;
}
