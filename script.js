document.addEventListener('DOMContentLoaded', () => {
    // Firebase services
    const auth = firebase.auth();
    const db = firebase.firestore();
    let currentUser = null;

    // UI Elements
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
    };

    // --- Authentication ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            elements.mainContent.classList.remove('hidden');
            elements.bottomNav.classList.remove('hidden');
            elements.loginView.classList.add('hidden');
            elements.userProfileIcon.innerHTML = `<img src="${user.photoURL}" alt="User" class="w-8 h-8 rounded-full">`;
            loadAllData();
        } else {
            currentUser = null;
            elements.mainContent.classList.add('hidden');
            elements.bottomNav.classList.add('hidden');
            elements.loginView.classList.remove('hidden');
            elements.userProfileIcon.innerHTML = `<i class="fas fa-user"></i>`;
        }
    });
    
    function loadAllData() {
        loadTasks();
        loadProjects();
    }

    // --- Project Management ---
    function loadProjects() {
        if (!currentUser) return;
        db.collection('users').doc(currentUser.uid).collection('projects').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderProjects(projects);
        });
    }

    function renderProjects(projects) {
        if (!elements.projectsContainer) return;
        elements.projectsContainer.innerHTML = '';
        if (projects.length === 0) {
            elements.projectsContainer.innerHTML = '<p class="text-center text-gray-500">No projects yet. Add one!</p>';
            return;
        }
        projects.forEach(project => {
            const completedSteps = project.steps ? project.steps.filter(s => s.completed).length : 0;
            const totalSteps = project.steps ? project.steps.length : 0;
            const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

            const projectCard = document.createElement('div');
            projectCard.className = 'card-hover bg-white rounded-xl p-4 shadow-sm cursor-pointer';
            projectCard.onclick = () => openProjectModal(project);
            projectCard.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-medium">${project.title}</h3>
                    <span class="px-2 py-0.5 bg-green-100 text-green-600 rounded-full text-xs">${progress === 100 ? 'Completed' : 'Active'}</span>
                </div>
                ${project.dueDate ? `<p class="text-xs text-gray-500 mb-3"><i class="fas fa-calendar-alt mr-1"></i> Due: ${project.dueDate}</p>` : ''}
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-indigo-500 h-2 rounded-full" style="width: ${progress}%"></div>
                </div>
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                    <span>${Math.round(progress)}% complete</span>
                    <span>${completedSteps}/${totalSteps} steps</span>
                </div>
            `;
            elements.projectsContainer.appendChild(projectCard);
        });
    }
    
    window.openProjectModal = (project = {}) => {
        elements.projectForm.reset();
        elements.projectModalTitle.textContent = project.id ? 'Edit Project' : 'New Project';
        elements.projectId.value = project.id || '';
        elements.projectTitle.value = project.title || '';
        elements.projectDueDate.value = project.dueDate || '';
        
        renderProjectSteps(project.steps || []);
        
        elements.projectModal.classList.remove('hidden');
    }

    window.closeProjectModal = () => {
        elements.projectModal.classList.add('hidden');
    }
    
    function renderProjectSteps(steps = []) {
        elements.projectStepsContainer.innerHTML = '';
        steps.forEach((step, index) => {
            addProjectStep(null, step);
        });
    }
    
    window.addProjectStep = (event, step = { title: '', completed: false }) => {
        if(event) event.preventDefault();
        const index = elements.projectStepsContainer.children.length;

        const stepEl = document.createElement('div');
        stepEl.className = 'flex items-center space-x-2';
        stepEl.innerHTML = `
            <input type="checkbox" ${step.completed ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-indigo-600" data-step-index="${index}">
            <input type="text" value="${step.title}" class="w-full border-0 border-b-2 border-gray-200 focus:ring-0 focus:border-indigo-500 text-sm p-1" placeholder="Step description">
            <button type="button" onclick="this.parentElement.remove()" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash-alt"></i></button>
        `;
        elements.projectStepsContainer.appendChild(stepEl);
    }
    
    function getStepsFromModal() {
        const steps = [];
        elements.projectStepsContainer.querySelectorAll('.flex').forEach(stepEl => {
            const titleInput = stepEl.querySelector('input[type="text"]');
            if (titleInput.value) { // Only add steps that have a title
                steps.push({
                    title: titleInput.value,
                    completed: stepEl.querySelector('input[type="checkbox"]').checked
                });
            }
        });
        return steps;
    }

    elements.projectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;
        
        const id = elements.projectId.value;
        const data = {
            title: elements.projectTitle.value,
            dueDate: elements.projectDueDate.value,
            steps: getStepsFromModal(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            db.collection('users').doc(currentUser.uid).collection('projects').doc(id).update(data);
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            db.collection('users').doc(currentUser.uid).collection('projects').add(data);
        }
        
        closeProjectModal();
    });
    
    // --- Global Functions ---
    window.signInWithGoogle = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    window.signOutUser = () => auth.signOut();
    
    // --- Navigation ---
     document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('tab-active');
                b.classList.add('text-gray-600');
            });
            this.classList.add('tab-active');
            this.classList.remove('text-gray-600');
            
            document.querySelectorAll('#main-content > div[id$="-view"]').forEach(v => v.classList.add('hidden'));
            
            const viewId = this.dataset.view;
            if (document.getElementById(viewId)) {
                document.getElementById(viewId).classList.remove('hidden');
            }
        });
    });

     document.querySelectorAll('.add-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const currentView = document.querySelector('#main-content > div:not(.hidden)');
            if (!currentView) return;

            if (currentView.id === 'tasks-view') {
                const title = prompt("Enter new task title:");
                if (title) {
                    // This is a simplified addTask, you might want to expand it
                    db.collection('users').doc(currentUser.uid).collection('tasks').add({
                        title: title,
                        completed: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } else if (currentView.id === 'projects-view') {
                openProjectModal();
            }
        });
    });
});
