// Import functions from the Firebase v9 SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Your Firebase Configuration ---
// IMPORTANT: This configuration is now directly in the script.
const firebaseConfig = {
    apiKey: "AIzaSyD0gGVvxwFxEnfbOYIhwVDExSR9HZy1YG4",
    authDomain: "miapp-e4dc6.firebaseapp.com",
    projectId: "miapp-e4dc6",
    storageBucket: "miapp-e4dc6.appspot.com",
    messagingSenderId: "815058398646",
    appId: "1:815058398646:web:15d8a49b50ac5c660de517",
    measurementId: "G-ZG1T9MZ8MD"
};

// --- Initialize Firebase and Services ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;

// --- UI Element References ---
const ui = {
    loginView: document.getElementById('login-view'),
    mainContent: document.getElementById('main-content'),
    bottomNav: document.getElementById('bottom-nav'),
    userProfileIcon: document.getElementById('user-profile-icon'),
    loginButton: document.getElementById('login-button'),
    projectModal: document.getElementById('project-modal'),
};

// --- App Structure Templates ---
const appShellHTML = `
    <div id="dashboard-view"></div>
    <div id="tasks-view" class="hidden"></div>
    <div id="projects-view" class="hidden"></div>
    <div id="finances-view" class="hidden"><p class="p-4 text-center text-gray-500">Finances coming soon!</p></div>
    <div id="kittens-view" class="hidden"><p class="p-4 text-center text-gray-500">Kittens coming soon!</p></div>
`;

const bottomNavHTML = `
    <div class="flex justify-around">
        <button data-view="dashboard-view" class="tab-btn p-2 text-center text-indigo-600 tab-active"><i class="fas fa-home block text-xl mb-1"></i><span class="text-xs">Home</span></button>
        <button data-view="tasks-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-tasks block text-xl mb-1"></i><span class="text-xs">Tasks</span></button>
        <button data-view="projects-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-project-diagram block text-xl mb-1"></i><span class="text-xs">Projects</span></button>
        <button data-view="finances-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-wallet block text-xl mb-1"></i><span class="text-xs">Finances</span></button>
        <button data-view="kittens-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-paw block text-xl mb-1"></i><span class="text-xs">Kittens</span></button>
    </div>
`;

const projectModalHTML = `
    <div class="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <form id="project-form">
            <div class="p-4 border-b flex justify-between items-center">
                <h3 id="project-modal-title" class="text-lg font-medium">New Project</h3>
                <button type="button" id="close-modal-btn" class="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div class="p-4 max-h-96 overflow-y-auto">
                <input id="project-id" type="hidden">
                <div class="mb-4">
                    <label for="project-title" class="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input type="text" id="project-title" class="w-full border-gray-300 rounded-md shadow-sm" required>
                </div>
                <div class="mb-4">
                    <label for="project-due-date" class="block text-sm font-medium text-gray-700 mb-1">Due Date (Optional)</label>
                    <input type="date" id="project-due-date" class="w-full border-gray-300 rounded-md shadow-sm">
                </div>
                <div class="mb-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Steps</h4>
                    <div id="project-steps-container" class="space-y-2"></div>
                    <button type="button" id="add-step-btn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800">+ Add step</button>
                </div>
            </div>
            <div class="p-4 bg-gray-50 flex justify-end space-x-2">
                <button type="button" id="cancel-modal-btn" class="px-4 py-2 bg-gray-200 rounded-md text-sm">Cancel</button>
                <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm">Save Project</button>
            </div>
        </form>
    </div>
`;


// --- Authentication ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        renderAppLayout();
        attachEventListeners();
        loadAllData();
        ui.mainContent.classList.remove('hidden');
        ui.bottomNav.classList.remove('hidden');
        ui.loginView.classList.add('hidden');
        ui.userProfileIcon.innerHTML = `<img src="${user.photoURL}" alt="User" class="w-8 h-8 rounded-full cursor-pointer">`;
    } else {
        currentUser = null;
        ui.mainContent.classList.add('hidden');
        ui.bottomNav.classList.add('hidden');
        ui.loginView.classList.remove('hidden');
        ui.userProfileIcon.innerHTML = `<i class="fas fa-user"></i>`;
    }
});

// --- Main App Rendering & Logic ---
function renderAppLayout() {
    ui.mainContent.innerHTML = appShellHTML;
    ui.bottomNav.innerHTML = bottomNavHTML;
    ui.projectModal.innerHTML = projectModalHTML;
}

function attachEventListeners() {
    // Auth
    ui.loginButton.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
    ui.userProfileIcon.onclick = () => {
        if (currentUser) signOut(auth);
    };

    // Navigation
    ui.bottomNav.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            const viewId = e.currentTarget.dataset.view;
            // Update active tab style
            ui.bottomNav.querySelector('.tab-active').classList.remove('tab-active', 'text-indigo-600');
            e.currentTarget.classList.add('tab-active', 'text-indigo-600');
            // Show selected view
            ui.mainContent.querySelectorAll('div[id$="-view"]').forEach(v => v.classList.add('hidden'));
            ui.mainContent.querySelector(`#${viewId}`).classList.remove('hidden');
        };
    });

    // Project Modal
    const projectForm = document.getElementById('project-form');
    projectForm.onsubmit = saveProject;
    document.getElementById('add-step-btn').onclick = () => addStepToModal();
    document.getElementById('close-modal-btn').onclick = closeProjectModal;
    document.getElementById('cancel-modal-btn').onclick = closeProjectModal;
}

function loadAllData() {
    if (!currentUser) return;
    setupRealtimeListener('tasks', renderTasks);
    setupRealtimeListener('projects', renderProjects);
}

function setupRealtimeListener(collectionName, renderFunction) {
    const q = query(collection(db, 'users', currentUser.uid, collectionName), orderBy('createdAt', 'desc'));
    onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFunction(items);
    });
}

// --- TASKS ---
function renderTasks(tasks) {
    const container = document.getElementById('tasks-view');
    if (!container) return;
    // Simple rendering for now, can be expanded
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-semibold">Your Tasks</h2>
            <button id="add-task-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md"><i class="fas fa-plus"></i></button>
        </div>
        <div class="space-y-3">
            ${tasks.length > 0 ? tasks.map(task => `
                <div class="card-hover bg-white rounded-xl p-4 shadow-sm flex items-start">
                    <button data-id="${task.id}" data-completed="${task.completed}" class="task-check w-6 h-6 rounded-full border-2 ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-indigo-500'} flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                        ${task.completed ? '<i class="fas fa-check text-xs"></i>' : ''}
                    </button>
                    <div class="font-medium ${task.completed ? 'line-through' : ''}">${task.title}</div>
                </div>
            `).join('') : '<p class="text-center text-gray-500">No tasks. Add one!</p>'}
        </div>
    `;
    // Add event listeners after rendering
    container.querySelectorAll('.task-check').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.dataset.id;
            const isCompleted = e.currentTarget.dataset.completed === 'true';
            await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', id), { completed: !isCompleted });
        };
    });
    document.getElementById('add-task-btn').onclick = async () => {
        const title = prompt("New Task Title:");
        if (title) {
            await addDoc(collection(db, 'users', currentUser.uid, 'tasks'), {
                title,
                completed: false,
                createdAt: serverTimestamp()
            });
        }
    };
}


// --- PROJECTS ---
function renderProjects(projects) {
    const container = document.getElementById('projects-view');
     if (!container) return;
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-semibold">Your Projects</h2>
            <button id="add-project-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md"><i class="fas fa-plus"></i></button>
        </div>
         <div class="space-y-4">
            ${projects.length > 0 ? projects.map(p => {
                const { progress, completedSteps, totalSteps } = calculateProjectProgress(p);
                return `
                <div data-project='${JSON.stringify(p)}' class="project-card card-hover bg-white rounded-xl p-4 shadow-sm cursor-pointer">
                    <div class="flex justify-between items-start mb-2"><h3 class="font-medium">${p.title}</h3></div>
                    <div class="w-full bg-gray-200 rounded-full h-2"><div class="bg-indigo-500 h-2 rounded-full" style="width: ${progress}%"></div></div>
                    <div class="flex justify-between text-xs text-gray-500 mt-1"><span>${Math.round(progress)}%</span><span>${completedSteps}/${totalSteps} steps</span></div>
                </div>`;
            }).join('') : '<p class="text-center text-gray-500">No projects. Add one!</p>'}
        </div>
    `;
     container.querySelectorAll('.project-card').forEach(card => {
        card.onclick = () => openProjectModal(JSON.parse(card.dataset.project));
    });
    document.getElementById('add-project-btn').onclick = () => openProjectModal();
}

function openProjectModal(project = {}) {
    const form = document.getElementById('project-form');
    form.reset();
    document.getElementById('project-modal-title').textContent = project.id ? 'Edit Project' : 'New Project';
    document.getElementById('project-id').value = project.id || '';
    document.getElementById('project-title').value = project.title || '';
    document.getElementById('project-due-date').value = project.dueDate || '';
    
    const stepsContainer = document.getElementById('project-steps-container');
    stepsContainer.innerHTML = '';
    if (project.steps) {
        project.steps.forEach(step => addStepToModal(step));
    }
    ui.projectModal.classList.remove('hidden');
}

function addStepToModal(step = { title: '', completed: false }) {
    const stepsContainer = document.getElementById('project-steps-container');
    const stepEl = document.createElement('div');
    stepEl.className = 'flex items-center space-x-2';
    stepEl.innerHTML = `
        <input type="checkbox" ${step.completed ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-indigo-600">
        <input type="text" value="${step.title}" class="w-full border-0 border-b-2 p-1 focus:ring-0 focus:border-indigo-500 text-sm" placeholder="Step description">
        <button type="button" class="remove-step-btn text-gray-400 hover:text-red-500"><i class="fas fa-trash-alt"></i></button>`;
    stepEl.querySelector('.remove-step-btn').onclick = () => stepEl.remove();
    stepsContainer.appendChild(stepEl);
}

function closeProjectModal() {
    ui.projectModal.classList.add('hidden');
}

async function saveProject(e) {
    e.preventDefault();
    if (!currentUser) return;
    const title = document.getElementById('project-title').value;
    if (!title) return;

    const steps = [];
    document.querySelectorAll('#project-steps-container .flex').forEach(el => {
        const stepTitle = el.querySelector('input[type="text"]').value;
        if (stepTitle) steps.push({ title: stepTitle, completed: el.querySelector('input[type="checkbox"]').checked });
    });

    const id = document.getElementById('project-id').value;
    const data = {
        title,
        dueDate: document.getElementById('project-due-date').value,
        steps,
        updatedAt: serverTimestamp()
    };
    
    const collectionRef = collection(db, 'users', currentUser.uid, 'projects');
    if (id) {
        await updateDoc(doc(db, 'users', currentUser.uid, 'projects', id), data);
    } else {
        data.createdAt = serverTimestamp();
        await addDoc(collectionRef, data);
    }
    closeProjectModal();
}

function calculateProjectProgress(project) {
    if (!project.steps || project.steps.length === 0) return { progress: 0, completedSteps: 0, totalSteps: 0 };
    const totalSteps = project.steps.length;
    const completedSteps = project.steps.filter(s => s.completed).length;
    return { progress: (completedSteps / totalSteps) * 100, completedSteps, totalSteps };
}
