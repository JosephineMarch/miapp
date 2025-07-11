// --- Global Scope Functions for Inline HTML ---
// This makes functions like signInWithGoogle available to the HTML file.
window.signInWithGoogle = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(error => {
        console.error("Error during sign-in:", error);
    });
};

window.signOutUser = () => {
    firebase.auth().signOut();
};

window.openProjectModal = (project = {}) => {
    const event = new CustomEvent('open-project-modal', { detail: { project } });
    document.dispatchEvent(event);
};

window.closeProjectModal = () => {
    document.getElementById('project-modal').classList.add('hidden');
};

window.addProjectStep = (event) => {
    if(event) event.preventDefault();
    const eventDispatch = new CustomEvent('add-project-step');
    document.dispatchEvent(eventDispatch);
};


document.addEventListener('DOMContentLoaded', () => {
    // --- Initialize Firebase ---
    // This MUST be the first Firebase-related action.
    firebase.initializeApp(firebaseConfig);

    // --- Firebase Services ---
    const auth = firebase.auth();
    const db = firebase.firestore();
    let currentUser = null;

    // --- UI Elements ---
    const elements = {
        userProfileIcon: document.getElementById('user-profile-icon'),
        mainContent: document.getElementById('main-content'),
        loginView: document.getElementById('login-view'),
        bottomNav: document.getElementById('bottom-nav'),
        tasksContainer: document.getElementById('tasks-container'),
        projectsContainer: document.getElementById('projects-container'),
        projectModal: document.getElementById('project-modal'),
        projectForm: document.getElementById('project-form'),
        projectModalTitle: document.getElementById('project-modal-title'),
        projectId: document.getElementById('project-id'),
        projectTitle: document.getElementById('project-title'),
        projectDueDate: document.getElementById('project-due-date'),
        projectStepsContainer: document.getElementById('project-steps-container'),
        dashboard: {
             progressText: document.getElementById('dashboard-progress-text'),
             progressBar: document.getElementById('dashboard-progress-bar'),
             progressSubtext: document.getElementById('dashboard-progress-subtext'),
             projectsContainer: document.getElementById('dashboard-projects-container'),
        }
    };

    // --- Authentication Logic ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            elements.mainContent.classList.remove('hidden');
            elements.bottomNav.classList.remove('hidden');
            elements.loginView.classList.add('hidden');
            elements.userProfileIcon.innerHTML = `<img src="${user.photoURL}" alt="User" class="w-8 h-8 rounded-full">`;
            loadAllData();
        } else {
            elements.mainContent.classList.add('hidden');
            elements.bottomNav.classList.add('hidden');
            elements.loginView.classList.remove('hidden');
            elements.userProfileIcon.innerHTML = `<i class="fas fa-user"></i>`;
        }
    });
    
    elements.userProfileIcon.addEventListener('click', () => {
        if (currentUser) {
            signOutUser();
        }
    });

    // --- Data Loading ---
    function loadAllData() {
        if (!currentUser) return;
        loadTasks();
        loadProjects();
    }

    function loadTasks() {
        db.collection('users').doc(currentUser.uid).collection('tasks').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderTasks(tasks);
            updateDashboard(tasks);
        });
    }

    function loadProjects() {
        db.collection('users').doc(currentUser.uid).collection('projects').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderProjects(projects);
            renderDashboardProjects(projects);
        });
    }

    // --- Rendering ---
    function renderTasks(tasks) {
        elements.tasksContainer.innerHTML = '';
        if (tasks.length === 0) {
            elements.tasksContainer.innerHTML = '<p class="text-center text-gray-500">No tasks. Add one!</p>';
            return;
        }
        tasks.forEach(task => {
             const taskEl = document.createElement('div');
             taskEl.className = `card-hover bg-white rounded-xl p-4 shadow-sm ${task.completed ? 'opacity-60' : ''}`;
             taskEl.innerHTML = `
                <div class="flex items-start">
                    <button class="w-6 h-6 rounded-full border-2 ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-indigo-500'} flex items-center justify-center mr-3 mt-1 flex-shrink-0"></button>
                    <div class="flex-1">
                        <h3 class="font-medium ${task.completed ? 'line-through' : ''}">${task.title}</h3>
                    </div>
                </div>`;
            taskEl.querySelector('button').addEventListener('click', () => {
                db.collection('users').doc(currentUser.uid).collection('tasks').doc(task.id).update({ completed: !task.completed });
            });
            elements.tasksContainer.appendChild(taskEl);
        });
    }
    
    function renderProjects(projects) {
        elements.projectsContainer.innerHTML = '';
        if (projects.length === 0) {
            elements.projectsContainer.innerHTML = '<p class="text-center text-gray-500">No projects yet. Add one!</p>';
            return;
        }
        projects.forEach(project => {
            const { progress, completedSteps, totalSteps } = calculateProjectProgress(project);
            const projectCard = document.createElement('div');
            projectCard.className = 'card-hover bg-white rounded-xl p-4 shadow-sm cursor-pointer';
            projectCard.addEventListener('click', () => openProjectModal(project));
            projectCard.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-medium">${project.title}</h3>
                    <span class="px-2 py-0.5 ${progress === 100 ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-700'} rounded-full text-xs">${progress === 100 ? 'Completed' : 'Active'}</span>
                </div>
                ${project.dueDate ? `<p class="text-xs text-gray-500 mb-3"><i class="fas fa-calendar-alt mr-1"></i> Due: ${project.dueDate}</p>` : ''}
                <div class="w-full bg-gray-200 rounded-full h-2"><div class="bg-indigo-500 h-2 rounded-full" style="width: ${progress}%"></div></div>
                <div class="flex justify-between text-xs text-gray-500 mt-1"><span>${Math.round(progress)}%</span><span>${completedSteps}/${totalSteps} steps</span></div>`;
            elements.projectsContainer.appendChild(projectCard);
        });
    }

    function updateDashboard(tasks) {
        const completed = tasks.filter(t => t.completed).length;
        const total = tasks.length;
        const progress = total > 0 ? (completed / total) * 100 : 0;
        elements.dashboard.progressText.textContent = `${completed}/${total} Tasks Completed`;
        elements.dashboard.progressBar.style.width = `${progress}%`;
        elements.dashboard.progressSubtext.textContent = total > completed ? `Just ${total - completed} to go!` : 'All tasks done! Great job!';
    }
    
    function renderDashboardProjects(projects) {
        const activeProjects = projects.filter(p => calculateProjectProgress(p).progress < 100).slice(0, 3);
        elements.dashboard.projectsContainer.innerHTML = '';
        if (activeProjects.length === 0) {
            elements.dashboard.projectsContainer.innerHTML = '<p class="text-center text-gray-500">No active projects.</p>';
            return;
        }
        activeProjects.forEach(project => {
            const { progress } = calculateProjectProgress(project);
            const projectEl = document.createElement('div');
            projectEl.className = 'bg-white p-3 rounded-lg shadow-sm';
            projectEl.innerHTML = `<div class="flex justify-between items-center"><span class="text-sm font-medium">${project.title}</span><span class="text-xs text-gray-500">${Math.round(progress)}%</span></div>`;
            elements.dashboard.projectsContainer.appendChild(projectEl);
        });
    }

    // --- Project Modal Logic ---
    document.addEventListener('open-project-modal', ({ detail }) => {
        const { project } = detail;
        elements.projectForm.reset();
        elements.projectStepsContainer.innerHTML = ''; // Clear old steps
        elements.projectModalTitle.textContent = project.id ? 'Edit Project' : 'New Project';
        elements.projectId.value = project.id || '';
        elements.projectTitle.value = project.title || '';
        elements.projectDueDate.value = project.dueDate || '';
        if (project.steps) {
            project.steps.forEach(step => addStepToModal(step));
        }
        elements.projectModal.classList.remove('hidden');
    });

    document.addEventListener('add-project-step', () => addStepToModal());

    function addStepToModal(step = { title: '', completed: false }) {
        const stepEl = document.createElement('div');
        stepEl.className = 'flex items-center space-x-2';
        stepEl.innerHTML = `
            <input type="checkbox" ${step.completed ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-indigo-600">
            <input type="text" value="${step.title}" class="w-full border-0 border-b-2 p-1 focus:ring-0 focus:border-indigo-500 text-sm" placeholder="Step description">
            <button type="button" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash-alt"></i></button>`;
        stepEl.querySelector('button').addEventListener('click', () => stepEl.remove());
        elements.projectStepsContainer.appendChild(stepEl);
    }
    
    elements.projectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser || !elements.projectTitle.value) return;

        const steps = [];
        elements.projectStepsContainer.querySelectorAll('.flex').forEach(el => {
            const title = el.querySelector('input[type="text"]').value;
            if (title) steps.push({ title, completed: el.querySelector('input[type="checkbox"]').checked });
        });

        const id = elements.projectId.value;
        const data = {
            title: elements.projectTitle.value,
            dueDate: elements.projectDueDate.value,
            steps,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const collectionRef = db.collection('users').doc(currentUser.uid).collection('projects');
        (id ? collectionRef.doc(id).update(data) : collectionRef.add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() }))
            .then(() => closeProjectModal())
            .catch(err => console.error("Error saving project:", err));
    });

    // --- Navigation & Add Buttons ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
            this.classList.add('tab-active');
            document.querySelectorAll('#main-content > div[id$="-view"]').forEach(v => v.classList.add('hidden'));
            document.getElementById(this.dataset.view).classList.remove('hidden');
        });
    });

     document.querySelectorAll('.add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const currentView = document.querySelector('#main-content > div:not(.hidden)');
            if (currentView.id === 'tasks-view') {
                const title = prompt("New Task Title:");
                if (title) db.collection('users').doc(currentUser.uid).collection('tasks').add({ title, completed: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            } else if (currentView.id === 'projects-view') {
                openProjectModal();
            }
        });
    });
    
    // --- Utility ---
    function calculateProjectProgress(project) {
        const totalSteps = project.steps ? project.steps.length : 0;
        if (totalSteps === 0) return { progress: 0, completedSteps: 0, totalSteps: 0 };
        const completedSteps = project.steps.filter(s => s.completed).length;
        return {
            progress: (completedSteps / totalSteps) * 100,
            completedSteps,
            totalSteps
        };
    }
});