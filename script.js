document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    let currentUser = null;

    // UI Elements
    const userProfileIcon = document.getElementById('user-profile-icon');
    const mainContent = document.getElementById('main-content');
    const loginView = document.getElementById('login-view');
    const bottomNav = document.getElementById('bottom-nav');
    const tasksContainer = document.getElementById('tasks-container');

    // --- Authentication ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            // Show main app, hide login
            mainContent.classList.remove('hidden');
            bottomNav.classList.remove('hidden');
            loginView.classList.add('hidden');
            
            // Update profile icon
            userProfileIcon.innerHTML = `<img src="${user.photoURL}" alt="User" class="w-8 h-8 rounded-full">`;
            
            // Load user data
            loadTasks();
        } else {
            currentUser = null;
            // Show login, hide main app
            mainContent.classList.add('hidden');
            bottomNav.classList.add('hidden');
            loginView.classList.remove('hidden');

            // Reset UI
            userProfileIcon.innerHTML = `<i class="fas fa-user"></i>`;
            if(tasksContainer) renderTasks([]); // Clear tasks if container exists
        }
    });

    window.signInWithGoogle = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(error => {
            console.error("Error during sign-in:", error);
        });
    }

    window.signOutUser = () => {
        auth.signOut();
    }

    userProfileIcon.addEventListener('click', () => {
        if (currentUser) {
            signOutUser();
        } else {
            signInWithGoogle();
        }
    });


    // --- Task Management ---
    function loadTasks() {
        if (!currentUser || !tasksContainer) return;

        tasksContainer.innerHTML = '<p class="text-center text-gray-500">Loading tasks...</p>';

        db.collection('users').doc(currentUser.uid).collection('tasks').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderTasks(tasks);
        }, error => {
            console.error("Error loading tasks:", error);
            tasksContainer.innerHTML = '<p class="text-center text-red-500">Could not load tasks.</p>';
        });
    }

    function renderTasks(tasks) {
        if (!tasksContainer) return;
        tasksContainer.innerHTML = ''; // Clear previous tasks

        if (tasks.length === 0) {
            tasksContainer.innerHTML = '<p class="text-center text-gray-500">No tasks yet. Add one!</p>';
            return;
        }

        tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `card-hover bg-white rounded-xl p-4 shadow-sm ${task.completed ? 'opacity-60' : ''}`;
            taskElement.innerHTML = `
                <div class="flex items-start">
                    <button class="w-6 h-6 rounded-full border-2 ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-indigo-500'} flex items-center justify-center mr-3 mt-1 flex-shrink-0" onclick="toggleTask('${task.id}', ${task.completed})">
                        ${task.completed ? '<i class="fas fa-check text-xs"></i>' : ''}
                    </button>
                    <div class="flex-1">
                        <h3 class="font-medium ${task.completed ? 'line-through' : ''}">${task.title}</h3>
                        <p class="text-xs text-gray-500 mt-1">${task.dueDate || ''} • ${task.category || 'General'}</p>
                        <div class="flex items-center mt-2">
                            <span class="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-xs">+${task.points || 1} points</span>
                        </div>
                    </div>
                </div>
            `;
            tasksContainer.appendChild(taskElement);
        });
    }

    window.toggleTask = (taskId, currentState) => {
        if (!currentUser) return;
        db.collection('users').doc(currentUser.uid).collection('tasks').doc(taskId).update({
            completed: !currentState
        });
    }

    function addTask(title) {
        if (!currentUser) return;
        db.collection('users').doc(currentUser.uid).collection('tasks').add({
            title: title,
            completed: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // --- Navigation & UI ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Deactivate all tabs
            document.querySelectorAll('.tab-btn').forEach(tab => {
                tab.classList.remove('tab-active');
                tab.classList.add('text-gray-600');
            });
            
            // Activate clicked tab
            this.classList.add('tab-active');
            this.classList.remove('text-gray-600');
            
            // Hide all main content views
            document.querySelectorAll('#main-content > div[id$="-view"]').forEach(view => {
                view.classList.add('hidden');
            });
            
            // Show the selected view
            const viewId = this.getAttribute('data-view');
            document.getElementById(viewId).classList.remove('hidden');
        });
    });

    document.querySelectorAll('.add-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const currentView = [...document.querySelectorAll('#main-content > div[id$="-view"]')]
                .find(view => !view.classList.contains('hidden'));

            if (!currentView) return;

            if (currentView.id === 'tasks-view') {
                const title = prompt("Enter new task title:");
                if (title) {
                    addTask(title);
                }
            } else {
                alert('Add functionality for other views is coming soon!');
            }
        });
    });
});
