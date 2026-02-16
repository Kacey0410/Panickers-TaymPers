let allTasks = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    loadTasks();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('taskForm').addEventListener('submit', handleAddTask);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('editForm').addEventListener('submit', handleEditTask);
    document.querySelector('.close').addEventListener('click', closeEditModal);

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderTasks();
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('editModal');
        if (e.target === modal) {
            closeEditModal();
        }
    });
}

async function loadUserData() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) throw new Error('Not authenticated');

        const user = await response.json();
        document.getElementById('userGreeting').textContent = `Welcome, ${user.firstName}!`;
    } catch (error) {
        window.location.href = '/login.html';
    }
}

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        if (!response.ok) throw new Error('Failed to load tasks');

        allTasks = await response.json();
        renderTasks();
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

function renderTasks() {
    const tasksList = document.getElementById('tasksList');
    
    let filteredTasks = allTasks;
    if (currentFilter === 'pending') {
        filteredTasks = allTasks.filter(task => !task.completed);
    } else if (currentFilter === 'completed') {
        filteredTasks = allTasks.filter(task => task.completed);
    }

    if (filteredTasks.length === 0) {
        tasksList.innerHTML = '<p class="empty-message">No tasks found.</p>';
        return;
    }

    tasksList.innerHTML = filteredTasks
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .map(task => createTaskElement(task))
        .join('');

    // Add event listeners
    document.querySelectorAll('.btn-complete').forEach(btn => {
        btn.addEventListener('click', () => {
            const taskId = btn.dataset.taskId;
            const task = allTasks.find(t => t.id === parseInt(taskId));
            handleCompleteTask(taskId, !task.completed);
        });
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.taskId));
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteTask(btn.dataset.taskId));
    });
}

function createTaskElement(task) {
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    const isOverdue = dueDate < today && !task.completed;

    return `
        <div class="task-item ${task.completed ? 'completed' : ''} ${task.priority}-priority">
            <div class="task-header">
                <h3 class="task-title">${escapeHtml(task.title)}</h3>
            </div>
            
            <div class="task-badges">
                ${task.subject ? `<span class="badge badge-subject">${escapeHtml(task.subject)}</span>` : ''}
                <span class="badge badge-priority-${task.priority}">${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</span>
                ${isOverdue ? '<span class="badge" style="background-color: #fee2e2; color: #dc2626;">Overdue</span>' : ''}
            </div>

            ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}

            <div class="task-meta">
                📅 Due: ${dueDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                })}
            </div>

            <div class="task-actions">
                <button class="btn-small btn-complete" data-task-id="${task.id}">
                    ${task.completed ? 'Undo' : 'Complete'}
                </button>
                <button class="btn-small btn-edit" data-task-id="${task.id}">Edit</button>
                <button class="btn-small btn-delete" data-task-id="${task.id}">Delete</button>
            </div>
        </div>
    `;
}

async function handleAddTask(e) {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const subject = document.getElementById('subject').value;
    const priority = document.getElementById('priority').value;
    const dueDate = document.getElementById('dueDate').value;

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, subject, priority, dueDate })
        });

        if (response.ok) {
            document.getElementById('taskForm').reset();
            loadTasks();
        } else {
            alert('Failed to create task');
        }
    } catch (error) {
        console.error('Error creating task:', error);
    }
}

async function handleCompleteTask(taskId, completed) {
    const task = allTasks.find(t => t.id === parseInt(taskId));
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...task, completed })
        });

        if (response.ok) {
            loadTasks();
        }
    } catch (error) {
        console.error('Error updating task:', error);
    }
}

async function handleDeleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadTasks();
        }
    } catch (error) {
        console.error('Error deleting task:', error);
    }
}

function openEditModal(taskId) {
    const task = allTasks.find(t => t.id === parseInt(taskId));
    if (!task) return;

    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTitle').value = task.title;
    document.getElementById('editDescription').value = task.description || '';
    document.getElementById('editSubject').value = task.subject || '';
    document.getElementById('editPriority').value = task.priority;
    document.getElementById('editDueDate').value = task.dueDate;

    document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
}

async function handleEditTask(e) {
    e.preventDefault();
    const taskId = document.getElementById('editTaskId').value;
    const title = document.getElementById('editTitle').value;
    const description = document.getElementById('editDescription').value;
    const subject = document.getElementById('editSubject').value;
    const priority = document.getElementById('editPriority').value;
    const dueDate = document.getElementById('editDueDate').value;
    const task = allTasks.find(t => t.id === parseInt(taskId));

    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title, 
                description, 
                subject, 
                priority, 
                dueDate,
                completed: task.completed 
            })
        });

        if (response.ok) {
            closeEditModal();
            loadTasks();
        }
    } catch (error) {
        console.error('Error updating task:', error);
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
