        // --- MODO DE DESARROLLO ---
// Cambia a 'true' para trabajar sin login (usando localStorage).
// Cambia a 'false' para activar Firebase y el login de Google.
const DEVELOPMENT_MODE = true;

// --- 1. IMPORTAR FUNCIONES DE FIREBASE ---
import { getApp, initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, serverTimestamp, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- 2. INICIALIZACIÓN DE FIREBASE Y SERVICIOS ---
let app, auth, db, provider;
if (!DEVELOPMENT_MODE) {
    const firebaseConfig = {
      apiKey: "AIzaSyD0gGVvxwFxEnfbOYIhwVDExSR9HZy1YG4",
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

// --- ESTADO GLOBAL Y REFERENCIAS A ELEMENTOS ---
let tasks = [], activities = [], inboxItems = [], achievements = {}, routineCompletions = {};
let currentTheme = 'light', userId = null;
let activityDistributionChart = null, dailyProgressChart = null, routineConsistencyChart = null;
let activityTimer = { interval: null, startTime: null };
let pomodoro = { interval: null, state: 'idle', timeLeft: 25 * 60 };
let unsubscribers = [];

// --- DEFINICIONES DE LA APP ---
const OBLIGATORY_ROUTINES = [
    { id: 'take_pill', text: 'Tomar la pastilla' },
    { id: 'litter_morning', text: 'Limpiar areneros (mañana)' },
    { id: 'water_up', text: 'Cambiar el agua arriba' },
    { id: 'water_down', text: 'Cambiar el agua abajo' },
    { id: 'water_out', text: 'Cambiar el agua afuera' },
    { id: 'feed_trained', text: 'Dar de comer a los entrenados' },
    { id: 'litter_night', text: 'Limpiar areneros (noche)' },
    { id: 'clean_pee', text: 'Trapear la pis de la vereda' },
    { id: 'wash_dishes_pets', text: 'Lavar los platos (chiquis)' },
    { id: 'wash_dishes_us', text: 'Lavar platos nuestros' },
    { id: 'sweep_room', text: 'Barrer mi cuarto' },
    { id: 'sweep_living', text: 'Barrer la sala' },
    { id: 'mop_room', text: 'Trapear mi cuarto' },
    { id: 'mop_living', text: 'Trapear la sala' },
    { id: 'dust_furniture', text: 'Sacudir muebles' },
    { id: 'change_covers', text: 'Cambiar fundas muebles' },
    { id: 'wash_clothes', text: 'Lavar la ropa' },
    { id: 'wash_clothes_pets', text: 'Lavar ropa (chiquis)' },
];
const EXTRA_ROUTINES = [
    { id: 'meditate', text: 'Meditar 5 minutos' },
    { id: 'read_book', text: 'Leer un capítulo' },
];
const ACHIEVEMENT_LIST = {
    firstTask: { title: '¡Primer Paso!', icon: '📝', description: 'Completa tu primera tarea de proyecto.', condition: () => tasks.some(t => t.completed) },
    tenTasks: { title: 'Decena Cumplida', icon: '✍️', description: 'Completa 10 tareas de proyecto.', condition: () => tasks.filter(t => t.completed).length >= 10 },
    firstHour: { title: 'Artista Enfocada', icon: '🎨', description: 'Registra tu primera hora de trabajo.', condition: () => activities.reduce((sum, a) => sum + a.duration, 0) >= 60 },
    inboxZero: { title: 'Mente Clara', icon: '🧘‍♀️', description: 'Vacía tu bandeja de ideas.', condition: (args) => args?.justDeleted && inboxItems.length === 0 },
    routinePerfectDay: { title: 'Día Perfecto', icon: '🌟', description: 'Completa todas las rutinas obligatorias en un día.', condition: (args) => args?.perfectDay },
    streak3: { title: 'Constancia', icon: '🔥', description: 'Mantén una racha de 3 días de actividad.', condition: () => calculateFocusStreak() >= 3 },
    streak7: { title: 'Imparable', icon: '🚀', description: 'Mantén una racha de 7 días de actividad.', condition: () => calculateFocusStreak() >= 7 },
};
const LOCAL_STORAGE_PREFIX = 'creaInfantilApp_';

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
            if (user) {
                // Usuario ha iniciado sesión
                userId = user.uid;
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('app-container').style.display = 'block';
                document.getElementById('user-display').textContent = `Hola, ${user.displayName.split(' ')[0]}`;
                setupRealtimeListeners();
            } else {
                // Usuario no ha iniciado sesión
                userId = null;
                document.getElementById('login-container').style.display = 'flex';
                document.getElementById('app-container').style.display = 'none';
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
    activities = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PREFIX + 'activities')) || [];
    inboxItems = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PREFIX + 'inboxItems')) || [];
    routineCompletions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PREFIX + 'routines')) || {};
    achievements = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PREFIX + 'achievements')) || {};
    currentTheme = localStorage.getItem(LOCAL_STORAGE_PREFIX + 'theme') || 'light';
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
    document.getElementById('startActivityBtn').addEventListener('click', startActivity);
    document.getElementById('stopActivityBtn').addEventListener('click', stopActivity);
    document.getElementById('pomodoroStartWork').addEventListener('click', () => startPomodoro('work'));
    document.querySelectorAll('.report-controls button').forEach(button => {
        button.addEventListener('click', (e) => renderReport(e.target.id.split('-')[1]));
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
        } else {
            setDoc(userDocRef, { achievements: {}, theme: 'light' });
        }
        applyTheme(currentTheme);
        renderAchievements();
    });

    const tasksQuery = query(collection(db, 'users', userId, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
        tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), completedAt: d.data().completedAt?.toDate() }));
        loadTasks();
        checkAndUnlockAchievements();
        updateReportsIfVisible();
    });

    const activitiesQuery = query(collection(db, 'users', userId, 'activities'), orderBy('timestamp', 'desc'));
    const unsubActivities = onSnapshot(activitiesQuery, (snapshot) => {
        activities = snapshot.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate() }));
        loadActivities();
        updateFocusStreak();
        checkAndUnlockAchievements();
        updateReportsIfVisible();
    });
    
    const routinesQuery = query(collection(db, 'users', userId, 'routineCompletions'));
    const unsubRoutines = onSnapshot(routinesQuery, (snapshot) => {
        routineCompletions = {};
        snapshot.forEach(doc => { routineCompletions[doc.id] = doc.data().completedIds; });
        renderRoutines();
    });

    const inboxQuery = query(collection(db, 'users', userId, 'inboxItems'), orderBy('createdAt', 'desc'));
    const unsubInbox = onSnapshot(inboxQuery, (snapshot) => {
        inboxItems = snapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() }));
        loadInboxItems();
    });

    unsubscribers = [unsubProfile, unsubTasks, unsubActivities, unsubInbox, unsubRoutines];
}

function saveData() {
    if(DEVELOPMENT_MODE) {
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'tasks', JSON.stringify(tasks));
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'activities', JSON.stringify(activities));
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'inboxItems', JSON.stringify(inboxItems));
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'routines', JSON.stringify(routineCompletions));
        checkAndUnlockAchievements();
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'achievements', JSON.stringify(achievements));
        renderAllComponents();
    }
    // En modo producción, los listeners de Firebase se encargan de todo.
}

function renderAllComponents() {
    loadTasks();
    loadActivities();
    loadInboxItems();
    renderRoutines();
    renderAchievements();
    updateFocusStreak();
    updateReportsIfVisible();
    updatePomodoroUI();
}
function clearLocalData() {
    Object.keys(localStorage).filter(k => k.startsWith(LOCAL_STORAGE_PREFIX)).forEach(k => localStorage.removeItem(k));
    tasks = []; activities = []; inboxItems = []; achievements = {}; routineCompletions = {};
}
function updateReportsIfVisible(){
    if (document.getElementById('reports').classList.contains('active')) {
        const activePeriod = document.querySelector('.report-controls .active')?.id.split('-')[1] || 'week';
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
    if (!DEVELOPMENT_MODE && userId) {
        await setDoc(doc(db, 'users', userId), { theme: currentTheme }, { merge: true });
    } else if (DEVELOPMENT_MODE) {
        localStorage.setItem(LOCAL_STORAGE_PREFIX + 'theme', currentTheme);
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
    el.classList.add('show');
    if(isAchievement) el.classList.add('achievement');
    setTimeout(() => {
        el.classList.remove('show');
        if(isAchievement) el.classList.remove('achievement');
    }, duration);
}

// --- RUTINAS DIARIAS ---
function renderRoutines() {
    renderWeeklyView();
    const todayStr = new Date().toISOString().split('T')[0];
    const completedToday = routineCompletions[todayStr] || [];
    
    const obligatoryList = document.getElementById('routine-obligatorias-list');
    obligatoryList.innerHTML = '';
    OBLIGATORY_ROUTINES.forEach(r => obligatoryList.appendChild(createRoutineElement(r, completedToday)));

    const extraList = document.getElementById('routine-extras-list');
    extraList.innerHTML = '';
    EXTRA_ROUTINES.forEach(r => extraList.appendChild(createRoutineElement(r, completedToday)));
}
function createRoutineElement(routine, completedToday) {
    const item = document.createElement('div');
    const isCompleted = completedToday.includes(routine.id);
    item.className = `list-item ${isCompleted ? 'completed' : ''}`;
    item.innerHTML = `<input type="checkbox" onchange="window.toggleRoutine('${routine.id}')" ${isCompleted ? 'checked' : ''}> <div class="item-text-content"><span class="item-text">${routine.text}</span></div>`;
    return item;
}
async function toggleRoutine(routineId) {
    const todayStr = new Date().toISOString().split('T')[0];
    const completedToday = routineCompletions[todayStr] || [];
    const isCompleted = completedToday.includes(routineId);
    
    if (isCompleted) {
        routineCompletions[todayStr] = completedToday.filter(id => id !== routineId);
    } else {
        routineCompletions[todayStr] = [...completedToday, routineId];
    }
    
    if (!DEVELOPMENT_MODE && userId) {
        const todayDocRef = doc(db, 'users', userId, 'routineCompletions', todayStr);
        await setDoc(todayDocRef, { completedIds: routineCompletions[todayStr] });
    }
    
    const allObligatoryDone = OBLIGATORY_ROUTINES.every(r => routineCompletions[todayStr].includes(r.id));
    if(!isCompleted && allObligatoryDone){
        showNotification("¡Misión Cumplida! Has completado todas tus rutinas obligatorias de hoy. 🎉", 4000, true);
        checkAndUnlockAchievements({ perfectDay: true });
    }
    
    if (DEVELOPMENT_MODE) saveData();
    else renderRoutines(); // In production, onSnapshot will handle re-render
}
function renderWeeklyView() {
    const container = document.getElementById('weekly-view');
    container.innerHTML = '';
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Lunes como inicio

    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        const dayStr = day.toISOString().split('T')[0];
        const dayName = day.toLocaleDateString('es-ES', { weekday: 'short' });
        const dayNum = day.getDate();
        
        const completedToday = routineCompletions[dayStr] || [];
        const obligatoryCompletedCount = OBLIGATORY_ROUTINES.filter(r => completedToday.includes(r.id)).length;
        const completionRatio = OBLIGATORY_ROUTINES.length > 0 ? (obligatoryCompletedCount / OBLIGATORY_ROUTINES.length) : 0;
        
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
    const newTask = { id: Date.now(), text: input.value, completed: false, createdAt: new Date().toISOString() };
    
    if (!DEVELOPMENT_MODE && userId) {
        await addDoc(collection(db, 'users', userId, 'tasks'), { text: newTask.text, completed: false, createdAt: serverTimestamp() });
    } else {
        tasks.unshift(newTask);
        saveData();
    }
    input.value = '';
    showNotification('Tarea agregada ✅');
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

    pendingList.innerHTML = pendingTasks.length > 0 ? '' : '<p style="text-align:center; opacity:0.7; padding: 20px 0;">¡No tienes tareas pendientes!</p>';
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
        <input type="checkbox" onchange="window.toggleTask('${task.id}')" ${task.completed ? 'checked' : ''}>
        <div class="item-text-content"><span class="item-text">${task.text}</span></div>
        <div class="item-actions">
            <button class="btn-icon" onclick="window.editTask('${task.id}')" title="Editar"><svg class="icon"><use href="#icon-edit"/></svg></button>
            <button class="btn-icon" onclick="window.deleteTask('${task.id}')" title="Eliminar"><svg class="icon"><use href="#icon-delete"/></svg></button>
        </div>`;
    return item;
}

// --- BANDEJA DE IDEAS ---
async function addInboxItem() {
    const textEl = document.getElementById('inboxText');
    const urlEl = document.getElementById('inboxUrl');
    if (!textEl.value.trim() && !urlEl.value.trim()) return;
    
    const newItem = { id: Date.now(), text: textEl.value, url: urlEl.value, createdAt: new Date().toISOString() };

    if (!DEVELOPMENT_MODE && userId) {
        await addDoc(collection(db, 'users', userId, 'inboxItems'), { text: newItem.text, url: newItem.url, createdAt: serverTimestamp() });
    } else {
        inboxItems.unshift(newItem);
        saveData();
    }
    
    textEl.value = ''; urlEl.value = '';
    showNotification('Idea guardada en la bandeja ✨');
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
            <button class="btn-icon" title="Editar Idea" onclick="window.editInboxItem('${item.id}')"><svg class="icon"><use href="#icon-edit"/></svg></button>
            <button class="btn-icon" title="Convertir en Tarea" onclick="window.convertInboxToTask('${item.id}')"><svg class="icon"><use href="#icon-forward"/></svg></button>
            <button class="btn-icon" title="Eliminar Idea" onclick="window.deleteInboxItem('${item.id}')"><svg class="icon"><use href="#icon-delete"/></svg></button>
        </div>`;
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
    checkAndUnlockAchievements({ justDeleted: true });
}
async function convertInboxToTask(id) {
    const item = inboxItems.find(i => i.id == id);
    if (item) {
        let taskText = item.text;
        if (item.url) taskText += ` (ver: ${item.url})`;
        
        if (!DEVELOPMENT_MODE && userId) {
            await addDoc(collection(db, 'users', userId, 'tasks'), { text: taskText, completed: false, createdAt: serverTimestamp() });
            await deleteDoc(doc(db, 'users', userId, 'inboxItems', String(id)));
        } else {
            tasks.unshift({ id: Date.now(), text: taskText, completed: false, createdAt: new Date().toISOString() });
            inboxItems = inboxItems.filter(i => i.id != id);
            saveData();
        }

        showNotification('Idea convertida en tarea 👍');
        switchTab('tasks');
    }
}

// --- CRONOMETRAR ACTIVIDAD Y POMODORO ---
// El resto de funciones (startActivity, stopActivity, Pomodoro, reportes, logros, etc.) son muy similares.
// La clave es que cada función que modifica datos debe tener una condición:
// if (!DEVELOPMENT_MODE && userId) { /* Lógica de Firebase */ } else { /* Lógica de LocalStorage */ saveData(); }

window.startActivity = function() {
    const type = document.getElementById('activityType').value;
    const description = document.getElementById('activityDescription').value.trim();
    if(!description) { showNotification('Añade una descripción.'); return; }
    activityTimer.startTime = Date.now();
    document.getElementById('activityForm').style.display = 'none';
    document.getElementById('currentActivity').style.display = 'block';
    document.getElementById('currentActivityInfo').textContent = `${type}: ${description}`;
    activityTimer.interval = setInterval(window.updateActivityTimer, 1000);
}
window.updateActivityTimer = function() {
    const elapsed = Math.floor((Date.now() - activityTimer.startTime) / 1000);
    const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('activityTimer').textContent = `${h}:${m}:${s}`;
}
window.stopActivity = async function() {
    clearInterval(activityTimer.interval);
    if (!activityTimer.startTime) return;
    const duration = Math.max(1, Math.round((Date.now() - activityTimer.startTime) / (1000 * 60)));
    const type = document.getElementById('activityType').value;
    const description = document.getElementById('activityDescription').value.trim();
    const newActivity = { type, description, duration, date: new Date().toISOString().split('T')[0], timestamp: new Date().toISOString() };

    if(!DEVELOPMENT_MODE && userId) {
        newActivity.timestamp = serverTimestamp(); // Usar timestamp del servidor para producción
        await addDoc(collection(db, 'users', userId, 'activities'), newActivity);
    } else {
        activities.unshift(newActivity);
        saveData();
    }
    
    document.getElementById('activityForm').style.display = 'block';
    document.getElementById('currentActivity').style.display = 'none';
    document.getElementById('activityDescription').value = '';
    activityTimer = { interval: null, startTime: null };
    showNotification(`Actividad de ${duration} min registrada 👍`);
}
function loadActivities() {
    const list = document.getElementById('activityList');
    list.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    const todayActivities = activities.filter(a => a.date === today);

    if(todayActivities.length === 0) { list.innerHTML = '<p style="text-align:center; opacity:0.7; padding: 20px 0;">No has registrado actividades hoy.</p>'; return; }
    todayActivities.forEach(act => list.prepend(createActivityElement(act)));
}
function createActivityElement(act) {
    const item = document.createElement('div');
    item.className = 'list-item';
    const activityTime = act.timestamp ? new Date(act.timestamp?.seconds ? act.timestamp.seconds * 1000 : act.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
    item.innerHTML = `
        <div class="item-text-content">
            <span class="item-text">${act.type}: ${act.description}</span>
            <span class="item-details">${act.duration} minutos - ${activityTime}</span>
        </div>
        <div class="item-actions">
             <button class="btn-icon" title="Editar Actividad" onclick="window.editActivity('${act.id}')"><svg class="icon"><use href="#icon-edit"/></svg></button>
            <button class="btn-icon" title="Añadir a Google Calendar" onclick="window.createGoogleCalendarEvent('${act.id}')">
                <svg class="icon" style="width: 20px; height: 20px;"><use href="#icon-google"/></svg>
            </button>
        </div>`;
    return item;
}
async function editActivity(id) {
    const activity = activities.find(a => a.id == id);
    if (!activity) return;
    const newDesc = prompt("Edita la descripción:", activity.description);
    if (newDesc && newDesc.trim() !== activity.description) {
        if (!DEVELOPMENT_MODE && userId) {
            await updateDoc(doc(db, 'users', userId, 'activities', String(id)), { description: newDesc.trim() });
        } else {
            activity.description = newDesc.trim();
            saveData();
        }
    }
}
window.createGoogleCalendarEvent = (activityId) => {
    const activity = activities.find(a => a.id == activityId);
    if (!activity || !activity.timestamp) return;
    const startTime = new Date(activity.timestamp.seconds ? activity.timestamp.seconds * 1000 : activity.timestamp);
    const endTime = new Date(startTime.getTime() + activity.duration * 60000);
    const formatGCDate = (date) => date.toISOString().replace(/[-:]|\.\d{3}/g, '');
    const url = new URL('https://www.google.com/calendar/render');
    url.searchParams.append('action', 'TEMPLATE');
    url.searchParams.append('text', `${activity.type}: ${activity.description}`);
    url.searchParams.append('dates', `${formatGCDate(startTime)}/${formatGCDate(endTime)}`);
    window.open(url, '_blank');
}
window.startPomodoro = (type) => {
    clearInterval(pomodoro.interval);
    pomodoro.state = type;
    pomodoro.timeLeft = type === 'work' ? (25 * 60) : (5 * 60);
    pomodoro.interval = setInterval(tickPomodoro, 1000);
    updatePomodoroUI();
}
function tickPomodoro() {
    pomodoro.timeLeft--;
    if (pomodoro.timeLeft < 0) {
        clearInterval(pomodoro.interval);
        const completedType = pomodoro.state;
        if (completedType === 'work') {
            pomodoro.state = 'break';
            pomodoro.timeLeft = 5 * 60;
            showNotification('¡Pomodoro completado! Toma un descanso ☕', 5000, true);
        } else {
            pomodoro.state = 'idle';
            pomodoro.timeLeft = 25 * 60;
            showNotification('¡Descanso terminado! A seguir creando 💪', 5000);
        }
    }
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
            statusText = 'Enfócate... 🧠';
            controlsHtml = `<button class="btn-secondary" onclick="window.pausePomodoro()"><svg class="icon"><use href="#icon-pause"/></svg> Pausar</button> <button class="btn-danger" onclick="window.resetPomodoro()"><svg class="icon"><use href="#icon-reset"/></svg> Detener</button>`;
            break;
        case 'break':
            statusText = 'Toma un respiro... ☕';
            controlsHtml = `<button class="btn-danger" onclick="window.resetPomodoro()"><svg class="icon"><use href="#icon-reset"/></svg> Omitir</button>`;
            break;
        case 'paused':
            statusText = 'En pausa.';
             controlsHtml = `<button class="btn-primary" onclick="window.startPomodoro('work')"><svg class="icon"><use href="#icon-play"/></svg> Reanudar</button> <button class="btn-danger" onclick="window.resetPomodoro()"><svg class="icon"><use href="#icon-reset"/></svg> Detener</button>`;
            break;
        default:
            statusText = 'Listo para empezar.';
            controlsHtml = `<button class="btn-primary" onclick="window.startPomodoro('work')"><svg class="icon"><use href="#icon-play"/></svg> Iniciar Trabajo</button>`;
    }
    statusEl.textContent = statusText;
    controlsEl.innerHTML = controlsHtml;
}
window.pausePomodoro = () => { clearInterval(pomodoro.interval); pomodoro.state = 'paused'; updatePomodoroUI(); }
window.resetPomodoro = () => { clearInterval(pomodoro.interval); pomodoro.state = 'idle'; pomodoro.timeLeft = 25*60; updatePomodoroUI(); }

// --- REPORTES Y GRÁFICOS ---
window.renderReport = (period) => {
    document.querySelectorAll('.report-controls button').forEach(b => b.classList.remove('active'));
    document.getElementById(`report-${period}`).classList.add('active');

    const { periodActivities, periodTasksCompleted, labels, timeUnit, formatLabel } = getPeriodData(period);
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border-color');

    const activityDistributionData = periodActivities.reduce((acc, curr) => {
        acc[curr.type] = (acc[curr.type] || 0) + curr.duration; return acc; }, {});
    renderDoughnutChart(document.getElementById('activityDistributionChart'), activityDistributionData, 'Distribución de Tiempo (min)', textColor);
    
    const progressData = labels.map(labelDate => {
        const labelKey = formatLabel(labelDate);
        const time = periodActivities.filter(a => formatLabel(new Date(a.date + "T12:00:00Z")) === labelKey).reduce((sum, a) => sum + a.duration, 0);
        const taskCount = periodTasksCompleted.filter(t => t.completedAt && formatLabel(new Date(t.completedAt)) === labelKey).length;
        return { time, taskCount };
    });
    renderBarChart(document.getElementById('dailyProgressChart'), labels.map(formatLabel), progressData, `Progreso ${timeUnit}`, textColor, gridColor);
    
    const routineData = getRoutineConsistency(7);
    renderRoutineChart(document.getElementById('routineConsistencyChart'), routineData, 'Consistencia de Rutinas (Últ. 7 Días)', textColor, gridColor);
    
    const totalMinutes = periodActivities.reduce((sum, a) => sum + a.duration, 0);
    document.getElementById('reportSummary').innerHTML = `<hr class="divider"><p>En este período has dedicado <strong>${(totalMinutes / 60).toFixed(1)} horas</strong> a crear y has completado <strong>${periodTasksCompleted.length} tareas de proyecto</strong>.</p>`;
}
function getPeriodData(period) {
    const now = new Date(); now.setHours(23, 59, 59, 999);
    let startDate = new Date(); startDate.setHours(0, 0, 0, 0);
    let labels = [], timeUnit = '', formatLabel;

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
    
    const periodActivities = activities.filter(a => a.date && new Date(a.date) >= startDate && new Date(a.date) <= now);
    const periodTasksCompleted = tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt) >= startDate && new Date(t.completedAt) <= now);

    return { periodActivities, periodTasksCompleted, labels, timeUnit, formatLabel };
}
function getRoutineConsistency(days) {
    let data = { labels: [], percentages: [] };
    const today = new Date();
    for(let i = days - 1; i >= 0; i--) {
        const day = new Date(today); day.setDate(today.getDate() - i);
        const dayStr = day.toISOString().split('T')[0];
        const dayLabel = day.toLocaleDateString('es-ES', {weekday: 'short'});
        const completed = routineCompletions[dayStr] || [];
        const completedObligatory = OBLIGATORY_ROUTINES.filter(r => completed.includes(r.id)).length;
        const percentage = OBLIGATORY_ROUTINES.length > 0 ? (completedObligatory / OBLIGATORY_ROUTINES.length) * 100 : 0;
        data.labels.push(dayLabel);
        data.percentages.push(percentage);
    }
    return data;
}
function renderDoughnutChart(canvas, data, title, textColor) {
    if (activityDistributionChart) activityDistributionChart.destroy();
    activityDistributionChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut', data: { labels: Object.keys(data), datasets: [{ data: Object.values(data), backgroundColor: ['#1D9A8D', '#f4a261', '#e76f51', '#2a9d8f', '#e9c46a', '#264653'], borderColor: getComputedStyle(document.body).getPropertyValue('--card-bg'), borderWidth: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: Object.keys(data).length > 0, position: 'right', labels: { color: textColor, padding: 15 } },
                title: { display: true, text: title, color: textColor },
                tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} min` } }
            }
        }
    });
}
function renderBarChart(canvas, labels, data, title, textColor, gridColor) {
    if (dailyProgressChart) dailyProgressChart.destroy();
    dailyProgressChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Minutos de Foco', data: data.map(d => d.time), backgroundColor: '#2a9d8f', yAxisID: 'yTime' },
                { label: 'Tareas Completadas', data: data.map(d => d.taskCount), backgroundColor: '#e9c46a', yAxisID: 'yTasks' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                yTime: { beginAtZero: true, position: 'left', title: { display: true, text: 'Minutos', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                yTasks: { beginAtZero: true, position: 'right', title: { display: true, text: 'Tareas', color: textColor }, ticks: { color: textColor, stepSize: 1 }, grid: { drawOnChartArea: false } }
            },
            plugins: {
                title: { display: true, text: title, color: textColor },
                legend: { labels: { color: textColor } }
            }
        }
    });
}
function renderRoutineChart(canvas, data, title, textColor, gridColor) {
    if (routineConsistencyChart) routineConsistencyChart.destroy();
    routineConsistencyChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: '% de Rutinas Obligatorias Completadas',
                data: data.percentages,
                backgroundColor: '#f4a261'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { beginAtZero: true, max: 100, ticks: { color: textColor, callback: (v) => v + '%' }, grid: { color: gridColor } }
            },
            plugins: {
                title: { display: true, text: title, color: textColor },
                legend: { display: false }
            }
        }
    });
}

// --- LOGROS ---
async function checkAndUnlockAchievements(args = {}) {
    if ((!DEVELOPMENT_MODE && !userId) || DEVELOPMENT_MODE) {
        // En modo desarrollo, opera sobre el estado local
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
            if (DEVELOPMENT_MODE) {
                localStorage.setItem(LOCAL_STORAGE_PREFIX + 'achievements', JSON.stringify(achievements));
            } else if (userId) {
                const docRef = doc(db, 'users', userId);
                await updateDoc(docRef, { achievements: achievements });
            }
            renderAchievements();
        }
        return;
    }

    // Lógica para modo producción
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    const currentAchievements = docSnap.exists() ? docSnap.data().achievements || {} : {};
    const updates = {};
    let newAchievementUnlocked = false;
    
    for (const key in ACHIEVEMENT_LIST) {
        const ach = ACHIEVEMENT_LIST[key];
        if (!currentAchievements[key] && ach.condition(args)) {
            updates[`achievements.${key}`] = true;
            newAchievementUnlocked = true;
            showNotification(`🏆 ¡Logro Desbloqueado: ${ach.title}!`, 4000, true);
        }
    }
    if (newAchievementUnlocked) {
        await updateDoc(docRef, updates);
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
function calculateFocusStreak() {
    const activityDates = [...new Set(activities.map(a => a.date.split('T')[0]))].sort((a,b) => new Date(b) - new Date(a));
    if (activityDates.length === 0) return 0;
    
    let streak = 0;
    let checkDate = new Date(); checkDate.setHours(0,0,0,0);
    let lastActivityDate = new Date(activityDates[0]); lastActivityDate.setHours(0,0,0,0);
    const diffToday = (checkDate.getTime() - lastActivityDate.getTime()) / (1000 * 3600 * 24);

    if (diffToday > 1) return 0;
    streak = (diffToday <= 1) ? 1 : 0;
    if (streak === 0) return 0;

    for (let i = 0; i < activityDates.length - 1; i++) {
        const current = new Date(activityDates[i]);
        const previous = new Date(activityDates[i+1]);
        const diffDays = Math.round((current.getTime() - previous.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) streak++; else break;
    }
    return streak;
}
function updateFocusStreak() {
    const streak = calculateFocusStreak();
    document.getElementById('focusStreak').innerHTML = `🔥 Racha de ${streak} día${streak === 1 ? '' : 's'}`;
}

// --- EXPORTAR FUNCIONES AL ÁMBITO GLOBAL PARA 'onclick' EN HTML ---
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.editTask = editTask;
window.toggleRoutine = toggleRoutine;
window.convertInboxToTask = convertInboxToTask;
window.deleteInboxItem = deleteInboxItem;
window.editInboxItem = editInboxItem;
window.editActivity = editActivity;
window.createGoogleCalendarEvent = createGoogleCalendarEvent;
window.startPomodoro = startPomodoro;
window.pausePomodoro = pausePomodoro;
window.resetPomodoro = resetPomodoro;
