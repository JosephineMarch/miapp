// --- 1. IMPORTAR FUNCIONES DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- 2. INICIALIZACIÓN DE FIREBASE ---
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

// --- 3. ESTADO GLOBAL ---
let userId = null;
let currentTheme = 'light';
let selectedDate = getTodayString();
let routineTemplates = []; // Plantillas de rutinas
let dailyRoutines = {}; // Almacena las rutinas por fecha
let unsubscribers = [];

// --- 4. HELPERS DE FECHA ---
const getTodayString = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];

const getStartOfWeek = (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

// --- 5. ARRANQUE DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    setupAuthListener();
    setupEventListeners();
});

function setupAuthListener() {
    onAuthStateChanged(auth, user => {
        const loginContainer = document.getElementById('login-container');
        const appWrapper = document.getElementById('app-wrapper');
        const bottomNav = document.querySelector('.bottom-nav'); // <- ¡Añadido!

        if (user) {
            userId = user.uid;
            document.getElementById('user-display-name').textContent = user.displayName?.split(' ')[0] || "Usuario";
            document.getElementById('user-avatar').src = user.photoURL || 'https://i.pravatar.cc/40';
            
            loginContainer.classList.remove('visible');
            appWrapper.classList.add('visible');
            bottomNav.classList.add('visible'); // <- ¡Añadido!
            
            cleanupListeners();
            setupRealtimeListeners();
            switchTab('dashboard-content');
        } else {
            userId = null;
            loginContainer.classList.add('visible');
            appWrapper.classList.remove('visible');
            bottomNav.classList.remove('visible'); // <- ¡Añadido!
            cleanupListeners();
            clearLocalData();
        }
    });
}

// --- 6. GESTIÓN DE EVENTOS ---
function setupEventListeners() {
    // Autenticación
    document.getElementById('loginBtn').addEventListener('click', () => signInWithPopup(auth, provider).catch(handleAuthError));
    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
    
    // UI General
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('mobile-theme-toggle').addEventListener('click', toggleTheme);
    document.querySelectorAll('.nav-button').forEach(tab => {
        tab.addEventListener('click', (e) => switchTab(e.currentTarget.dataset.tab));
    });

    // Dashboard
    document.getElementById('add-routine-btn').addEventListener('click', addRoutine);
    document.getElementById('new-routine-input').addEventListener('keydown', e => { if (e.key === 'Enter') addRoutine(); });

    // Modal de Copiar
    document.getElementById('copy-routines-btn').addEventListener('click', openCopyModal);
    document.getElementById('close-copy-modal-btn').addEventListener('click', closeCopyModal);
    document.getElementById('cancel-copy-btn').addEventListener('click', closeCopyModal);
    document.getElementById('confirm-copy-btn').addEventListener('click', handleConfirmCopy);
}

function handleAuthError(error) {
    console.error("Error de autenticación:", error);
    showNotification("Error al iniciar sesión. Por favor, intenta de nuevo.", "danger");
}

// --- 7. LISTENERS DE FIRESTORE ---
function setupRealtimeListeners() {
    if (!userId) return;

    // Listener para datos del usuario (plantillas, tema)
    const userDocRef = doc(db, 'users', userId);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            routineTemplates = data.routineTemplates || [
                { id: 'default1', text: 'Limpiar la casa' },
                { id: 'default2', text: 'Cocinar' },
            ];
            applyTheme(data.theme || 'light');
        } else {
            // Crear documento si no existe, con plantillas por defecto
            setDoc(userDocRef, { routineTemplates });
        }
    });

    // Listener para las rutinas del día seleccionado
    // Importante: Este listener se creará y destruirá cada vez que selectedDate cambie.
    // No se usa una colección general, sino el documento específico del día.
    const unsubRoutines = onSnapshot(doc(db, 'users', userId, 'dailyRoutines', selectedDate), (docSnap) => {
        if (docSnap.exists()) {
            dailyRoutines[selectedDate] = docSnap.data().routines || [];
        } else {
            // Si no hay rutinas para este día, usar las plantillas
            dailyRoutines[selectedDate] = routineTemplates.map(rt => ({ ...rt, id: 'r' + Date.now() + Math.random() }));
            // Guardarlas para futuras modificaciones
            setDoc(doc(db, 'users', userId, 'dailyRoutines', selectedDate), { routines: dailyRoutines[selectedDate] });
        }
        renderRoutinesForSelectedDay();
    });

    unsubscribers.push(unsubUser, unsubRoutines);
}

function cleanupListeners() {
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
}

function clearLocalData() {
    selectedDate = getTodayString();
    routineTemplates = [];
    dailyRoutines = {};
}

// --- 8. LÓGICA DE PESTAÑAS Y UI ---
function switchTab(tabId) {
    document.querySelectorAll('.nav-button').forEach(el => el.classList.toggle('active', el.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.toggle('active', el.id === tabId));

    // Asegurarse de que los listeners se configuran/limpian correctamente al cambiar de pestaña
    if (tabId === 'dashboard-content') {
        selectedDate = getTodayString(); // Siempre volvemos al día actual al ir al dashboard
        renderWeeklyDashboard(); // Renderiza la cuadrícula semanal
        cleanupListeners(); // Limpia listeners anteriores antes de establecer los nuevos
        setupRealtimeListeners(); // Establece los listeners para el día actual del dashboard
    } else {
        cleanupListeners(); // Limpia todos los listeners de Firestore cuando no estamos en el dashboard
    }
}

async function toggleTheme() {
    currentTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    applyTheme(currentTheme);
    if (userId) {
        await updateDoc(doc(db, 'users', userId), { theme: currentTheme });
    }
}

function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    const icon = theme === 'dark' ? '#icon-sun' : '#icon-moon';
    document.querySelector('#theme-toggle use').setAttribute('href', icon);
    document.querySelector('#mobile-theme-toggle use').setAttribute('href', icon);
}

function showNotification(message, type = 'success') {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = `notification show ${type}`;
    setTimeout(() => { el.classList.remove('show'); }, 3000);
}

// --- 9. LÓGICA DEL DASHBOARD ---
function renderWeeklyDashboard() {
    const grid = document.getElementById('weekly-dashboard-grid');
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
    // Limpiamos y re-establecemos los listeners para el nuevo día seleccionado
    cleanupListeners();
    setupRealtimeListeners(); 
    renderWeeklyDashboard(); // Re-render para actualizar el día activo
}

function renderRoutinesForSelectedDay() {
    const container = document.getElementById('routines-list');
    const title = document.getElementById('routines-title');
    container.innerHTML = '';

    const routines = dailyRoutines[selectedDate] || [];
    const dateObj = new Date(selectedDate + 'T00:00:00'); // Evitar problemas de zona horaria
    title.textContent = `Rutinas para ${dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}`;

    if (routines.length === 0) {
        container.innerHTML = '<p class="empty-list-message">No hay rutinas para este día. ¡Añade una!</p>';
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

    item.querySelector('input[type="checkbox"]').addEventListener('change', (e) => toggleRoutine(e.target.dataset.id));
    item.querySelector('.item-text-input').addEventListener('blur', (e) => updateRoutineText(e.target.dataset.id, e.target.value));
    item.querySelector('[data-action="delete"]').addEventListener('click', (e) => deleteRoutine(e.currentTarget.dataset.id));

    return item;
}

// --- 10. CRUD DE RUTINAS ---
async function addRoutine() {
    const input = document.getElementById('new-routine-input');
    const text = input.value.trim();
    if (!text || !userId) return;

    const newRoutine = {
        id: 'r' + Date.now(),
        text,
        completed: false
    };

    const currentRoutines = dailyRoutines[selectedDate] || [];
    const updatedRoutines = [...currentRoutines, newRoutine];
    
    try {
        await setDoc(doc(db, 'users', userId, 'dailyRoutines', selectedDate), { routines: updatedRoutines });
        input.value = '';
    } catch (e) {
        showNotification("Error al añadir la rutina.", "danger");
    }
}

async function updateRoutine(updatedRoutines) {
    try {
        await setDoc(doc(db, 'users', userId, 'dailyRoutines', selectedDate), { routines: updatedRoutines });
    } catch (e) {
        showNotification("Error al actualizar la rutina.", "danger");
    }
}

function toggleRoutine(id) {
    const updatedRoutines = (dailyRoutines[selectedDate] || []).map(r => 
        r.id === id ? { ...r, completed: !r.completed } : r
    );
    updateRoutine(updatedRoutines);
}

function updateRoutineText(id, text) {
    const updatedRoutines = (dailyRoutines[selectedDate] || []).map(r => 
        r.id === id ? { ...r, text } : r
    );
    // Solo actualizar si el texto realmente cambió para evitar escrituras innecesarias
    if (JSON.stringify(updatedRoutines) !== JSON.stringify(dailyRoutines[selectedDate])) {
        updateRoutine(updatedRoutines);
    }
}

function deleteRoutine(id) {
    const updatedRoutines = (dailyRoutines[selectedDate] || []).filter(r => r.id !== id);
    updateRoutine(updatedRoutines);
}

// --- 11. LÓGICA PARA COPIAR RUTINAS ---
function openCopyModal() {
    const modal = document.getElementById('copy-routines-modal');
    const sourceList = document.getElementById('copy-source-routines-list');
    const targetList = document.getElementById('copy-target-days-list');
    
    const sourceRoutines = dailyRoutines[selectedDate] || [];
    if (sourceRoutines.length === 0) {
        showNotification("No hay rutinas en este día para copiar.", "danger");
        return;
    }

    // Llenar lista de rutinas a copiar
    sourceList.innerHTML = '';
    sourceRoutines.forEach(r => {
        sourceList.innerHTML += `
            <div class="list-item">
                <input type="checkbox" id="copy-${r.id}" data-id="${r.id}" checked>
                <label for="copy-${r.id}" class="item-text-content">${r.text}</label>
            </div>
        `;
    });

    // Llenar lista de días de destino
    targetList.innerHTML = '';
    const startOfWeek = getStartOfWeek(new Date(selectedDate));
    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        const dayStr = getTodayString(day);
        if (dayStr === selectedDate) continue; // No copiar al mismo día

        targetList.innerHTML += `
            <div class="day-checkbox-item">
                <input type="checkbox" id="target-${dayStr}" data-date="${dayStr}">
                <label for="target-${dayStr}">${day.toLocaleDateString('es-ES', { weekday: 'long' })}</label>
            </div>
        `;
    }
    
    modal.classList.add('visible');
}

function closeCopyModal() {
    document.getElementById('copy-routines-modal').classList.remove('visible');
}

async function handleConfirmCopy() {
    const sourceRoutinesToCopy = Array.from(document.querySelectorAll('#copy-source-routines-list input:checked'))
        .map(checkbox => (dailyRoutines[selectedDate] || []).find(r => r.id === checkbox.dataset.id))
        .filter(Boolean) // Filtrar por si alguna rutina fue eliminada mientras el modal estaba abierto
        .map(({ id, ...rest }) => ({ ...rest, id: 'r' + (Date.now() + Math.random()), completed: false })); // Crear nuevas con IDs únicos

    const targetDates = Array.from(document.querySelectorAll('#copy-target-days-list input:checked'))
        .map(checkbox => checkbox.dataset.date);

    if (sourceRoutinesToCopy.length === 0 || targetDates.length === 0) {
        showNotification("Selecciona al menos una rutina y un día de destino.", "danger");
        return;
    }

    const batch = writeBatch(db);

    for (const date of targetDates) {
        const docRef = doc(db, 'users', userId, 'dailyRoutines', date);
        const docSnap = await getDoc(docRef);
        const existingRoutines = docSnap.exists() ? docSnap.data().routines : [];
        
        // Filtrar rutinas duplicadas antes de añadir
        const newRoutinesToAdd = sourceRoutinesToCopy.filter(copyRoutine => 
            !existingRoutines.some(existingRoutine => existingRoutine.text === copyRoutine.text)
        );
        
        const combinedRoutines = [...existingRoutines, ...newRoutinesToAdd];
        batch.set(docRef, { routines: combinedRoutines });
    }

    try {
        await batch.commit();
        showNotification("Rutinas copiadas con éxito.");
        closeCopyModal();
    } catch (e) {
        showNotification("Error al copiar las rutinas.", "danger");
    }
}
