// Import functions from the Firebase v9 SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Firebase Configuration ---
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

// --- App State ---
let appData = {
    tasks: [],
    projects: [],
    transactions: [],
};

// --- Authentication ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        ui.mainContent.classList.remove('hidden');
        ui.bottomNav.classList.remove('hidden');
        ui.loginView.classList.add('hidden');
        ui.userProfileIcon.innerHTML = `<img src="${user.photoURL}" alt="User" class="w-8 h-8 rounded-full cursor-pointer">`;
        initializeAppShell();
    } else {
        currentUser = null;
        ui.mainContent.classList.add('hidden');
        ui.bottomNav.classList.add('hidden');
        ui.loginView.classList.remove('hidden');
        ui.userProfileIcon.innerHTML = `<i class="fas fa-user"></i>`;
    }
});

// --- App Initialization ---
function initializeAppShell() {
    renderAppLayout();
    attachEventListeners();
    setupRealtimeListeners();
}

function renderAppLayout() {
    ui.mainContent.innerHTML = `
        <div id="dashboard-view"></div>
        <div id="tasks-view" class="hidden"></div>
        <div id="projects-view" class="hidden"></div>
        <div id="finances-view" class="hidden"></div>
        <div id="kittens-view" class="hidden"><p class="p-4 text-center text-gray-500">Kittens coming soon!</p></div>
    `;
    ui.bottomNav.innerHTML = `
        <div class="flex justify-around">
            <button data-view="dashboard-view" class="tab-btn p-2 text-center text-indigo-600 tab-active"><i class="fas fa-home block text-xl mb-1"></i><span class="text-xs">Home</span></button>
            <button data-view="tasks-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-tasks block text-xl mb-1"></i><span class="text-xs">Tasks</span></button>
            <button data-view="projects-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-project-diagram block text-xl mb-1"></i><span class="text-xs">Projects</span></button>
            <button data-view="finances-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-wallet block text-xl mb-1"></i><span class="text-xs">Finances</span></button>
            <button data-view="kittens-view" class="tab-btn p-2 text-center text-gray-500"><i class="fas fa-paw block text-xl mb-1"></i><span class="text-xs">Kittens</span></button>
        </div>
    `;
}

function attachEventListeners() {
    ui.loginButton.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
    ui.userProfileIcon.onclick = () => { if (currentUser) signOut(auth); };

    ui.bottomNav.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            const viewId = e.currentTarget.dataset.view;
            ui.bottomNav.querySelector('.tab-active')?.classList.remove('tab-active', 'text-indigo-600');
            e.currentTarget.classList.add('tab-active', 'text-indigo-600');
            ui.mainContent.querySelectorAll('div[id$="-view"]').forEach(v => v.classList.add('hidden'));
            ui.mainContent.querySelector(`#${viewId}`).classList.remove('hidden');
        };
    });
}

function setupRealtimeListeners() {
    if (!currentUser) return;
    const collections = ['tasks', 'projects', 'transactions'];
    collections.forEach(name => {
        const q = query(collection(db, 'users', currentUser.uid, name), orderBy('createdAt', 'desc'));
        onSnapshot(q, (snapshot) => {
            appData[name] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAllViews();
        });
    });
}

// --- Global Render Function ---
function renderAllViews() {
    renderDashboard();
    renderTasks();
    renderProjects();
    renderFinances();
}

// --- Dashboard ---
function renderDashboard() {
    const container = document.getElementById('dashboard-view');
    if (!container) return;

    // Finance Summary
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTransactions = appData.transactions.filter(t => t.createdAt.toDate() >= startOfMonth);
    const income = monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    // Task Summary
    const pendingTasks = appData.tasks.filter(t => !t.completed).length;

    // Project Summary
    const activeProjects = appData.projects.filter(p => calculateProjectProgress(p).progress < 100);
    
    container.innerHTML = `
        <div class="p-4">
            <h2 class="text-xl font-bold mb-4">Dashboard</h2>
            
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-green-100 text-green-800 p-4 rounded-lg shadow">
                    <p class="text-sm">Income</p>
                    <p class="text-2xl font-bold">$${income.toFixed(2)}</p>
                </div>
                <div class="bg-red-100 text-red-800 p-4 rounded-lg shadow">
                    <p class="text-sm">Expenses</p>
                    <p class="text-2xl font-bold">$${expenses.toFixed(2)}</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-6">
                 <div class="bg-blue-100 text-blue-800 p-4 rounded-lg shadow">
                    <p class="text-sm">Pending Tasks</p>
                    <p class="text-2xl font-bold">${pendingTasks}</p>
                </div>
                <div class="bg-purple-100 text-purple-800 p-4 rounded-lg shadow">
                    <p class="text-sm">Active Projects</p>
                    <p class="text-2xl font-bold">${activeProjects.length}</p>
                </div>
            </div>
            
            <div class="bg-white p-4 rounded-lg shadow">
                <h3 class="font-bold mb-2">Recent Activity</h3>
                <div class="space-y-3">
                    ${[...appData.transactions, ...appData.tasks].sort((a,b) => b.createdAt.seconds - a.createdAt.seconds).slice(0, 3).map(item => `
                        <div class="flex items-center text-sm">
                            <i class="fas ${item.amount ? 'fa-exchange-alt' : 'fa-check-circle'} mr-3 text-gray-400"></i>
                            <span class="flex-grow">${item.title}</span>
                            ${item.amount ? `<span class="${item.type === 'income' ? 'text-green-600' : 'text-red-600'} font-medium">${item.type === 'income' ? '+' : '-'}$${item.amount}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// --- Finances ---
function renderFinances() {
    const container = document.getElementById('finances-view');
    if (!container) return;

    // Calculate monthly totals
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTransactions = appData.transactions.filter(t => t.createdAt.toDate() >= startOfMonth);
    const income = monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const savings = income - expenses;

    // Group expenses by category
    const expenseByCategory = monthlyTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
        }, {});
    const maxExpense = Math.max(...Object.values(expenseByCategory), 1);
    
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6 p-4">
            <h2 class="text-lg font-semibold">Your Finances</h2>
            <button id="add-transaction-btn" class="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md"><i class="fas fa-plus"></i></button>
        </div>
        
        <div class="px-4">
            <div class="bg-white rounded-xl shadow-md p-4 mb-6">
                <div class="flex justify-between items-baseline mb-2">
                    <h3 class="font-bold">Monthly Balance</h3>
                    <p class="text-sm text-gray-500">${now.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                </div>
                <div class="grid grid-cols-3 text-center">
                    <div><p class="text-sm text-gray-500">Income</p><p class="font-bold text-green-500 text-lg">$${income.toFixed(2)}</p></div>
                    <div><p class="text-sm text-gray-500">Expenses</p><p class="font-bold text-red-500 text-lg">$${expenses.toFixed(2)}</p></div>
                    <div><p class="text-sm text-gray-500">Savings</p><p class="font-bold text-blue-500 text-lg">$${savings.toFixed(2)}</p></div>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-md p-4 mb-6">
                <h3 class="font-bold mb-4">Expense Categories</h3>
                <div class="flex justify-around items-end h-32">
                    ${Object.entries(expenseByCategory).map(([category, amount]) => `
                        <div class="flex flex-col items-center w-1/4">
                            <div class="w-1/2 bg-indigo-200 rounded-t-lg" style="height: ${(amount / maxExpense) * 100}%"></div>
                            <p class="text-xs mt-1">${category}</p>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div>
                <h3 class="font-bold mb-4">Recent Transactions</h3>
                <div class="space-y-3">
                ${appData.transactions.slice(0, 5).map(t => `
                    <div class="bg-white rounded-xl p-3 shadow-sm flex items-center">
                        <div class="w-10 h-10 rounded-full ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} flex items-center justify-center mr-3"><i class="fas fa-dollar-sign"></i></div>
                        <div class="flex-grow"><p class="font-medium">${t.title}</p><p class="text-xs text-gray-500">${t.category}</p></div>
                        <p class="font-medium ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}">${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)}</p>
                    </div>
                `).join('')}
                </div>
            </div>
        </div>
    `;
     document.getElementById('add-transaction-btn').onclick = openTransactionModal;
}

function openTransactionModal(transaction = {}) {
    // Logic to show a modal for adding/editing a transaction
    const title = prompt("Transaction Title:", transaction.title || "");
    if (!title) return;
    const amount = parseFloat(prompt("Amount:", transaction.amount || ""));
    if (isNaN(amount) || amount <= 0) return alert("Invalid amount");
    const type = prompt("Type (income/expense):", transaction.type || "expense");
    if (type !== 'income' && type !== 'expense') return alert("Invalid type");
    const category = prompt("Category:", transaction.category || "General");

    const data = { title, amount, type, category, updatedAt: serverTimestamp() };
    if (transaction.id) {
        updateDoc(doc(db, 'users', currentUser.uid, 'transactions', transaction.id), data);
    } else {
        data.createdAt = serverTimestamp();
        addDoc(collection(db, 'users', currentUser.uid, 'transactions'), data);
    }
}

// --- Tasks & Projects (Simplified for brevity, assuming they work) ---
function renderTasks() { 
    // Assuming this function exists and works
}
function renderProjects() {
    // Assuming this function exists and works
}
function calculateProjectProgress(project) {
    if (!project.steps || project.steps.length === 0) return { progress: 0 };
    return { progress: (project.steps.filter(s => s.completed).length / project.steps.length) * 100 };
}
