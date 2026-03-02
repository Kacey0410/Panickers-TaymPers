let allTasks = [];
let currentFilter = 'all';
let calendarCurrentDate = new Date();
let selectedDate = new Date();
let notificationIntervalId = null;
const notifiedTaskIds = new Set();

document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    loadTasks();
    setupEventListeners();
    initCalendar();
    initTheme();
});

function setupEventListeners() {
    document.getElementById('taskForm').addEventListener('submit', handleAddTask);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('editForm').addEventListener('submit', handleEditTask);
    document.querySelector('.close').addEventListener('click', closeEditModal);

    // Welcome cards (layout tiles)
    document.querySelectorAll('.welcome-card').forEach(card => {
        card.addEventListener('click', () => {
            const targetId = card.dataset.targetTab;
            if (!targetId) return;
            activateTab(targetId);
            const grid = document.querySelector('.dashboard-grid');
            if (grid) {
                grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            setTheme(next);
        });
    }

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
        const greetingEl = document.getElementById('userGreeting');
        if (greetingEl) {
            greetingEl.textContent = `Welcome, ${user.firstName}!`;
        }

        const welcomeTitle = document.getElementById('welcomeTitle');
        if (welcomeTitle && user.firstName) {
            welcomeTitle.textContent = `Welcome back, ${user.firstName}!`;
        }
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
        renderCalendar();
        ensureDeadlineNotificationsWatcher();
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

function formatDateKey(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTasksForDate(date) {
    const key = formatDateKey(date);
    return allTasks.filter(task => task.dueDate && task.dueDate.startsWith(key));
}

function initCalendar() {
    const daysContainer = document.getElementById('calendarDays');
    if (!daysContainer) return;

    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');

    prevBtn.addEventListener('click', () => {
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
        renderCalendar();
    });

    nextBtn.addEventListener('click', () => {
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
        renderCalendar();
    });

    renderCalendar();
}

function renderCalendar() {
    const daysContainer = document.getElementById('calendarDays');
    const monthLabel = document.getElementById('calendarMonthLabel');
    const selectedDateLabel = document.getElementById('selectedDateLabel');
    const tasksListEl = document.getElementById('calendarTasksList');

    if (!daysContainer || !monthLabel || !selectedDateLabel || !tasksListEl) return;

    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    // Month label
    monthLabel.textContent = firstDayOfMonth.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
    });

    // Build calendar cells
    const cells = [];

    // Days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        cells.push({
            day,
            date: new Date(year, month - 1, day),
            outside: true
        });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({
            day: d,
            date: new Date(year, month, d),
            outside: false
        });
    }

    // Fill remainder of grid with next month days to complete weeks
    while (cells.length % 7 !== 0) {
        const nextDay = cells.length - (startDay + daysInMonth) + 1;
        cells.push({
            day: nextDay,
            date: new Date(year, month + 1, nextDay),
            outside: true
        });
    }

    const today = new Date();
    const todayKey = formatDateKey(today);
    const selectedKey = formatDateKey(selectedDate);

    daysContainer.innerHTML = cells.map(cell => {
        const cellKey = formatDateKey(cell.date);
        const hasTasks = getTasksForDate(cell.date).length > 0;
        const isToday = cellKey === todayKey;
        const isSelected = cellKey === selectedKey;

        const classes = ['calendar-day'];
        if (cell.outside) classes.push('calendar-day--outside');
        if (hasTasks) classes.push('calendar-day--has-tasks');
        if (isToday) classes.push('calendar-day--today');
        if (isSelected) classes.push('calendar-day--selected');

        return `
            <button
                type="button"
                class="${classes.join(' ')}"
                data-date="${cellKey}"
            >
                ${cell.day}
            </button>
        `;
    }).join('');

    // Attach click handlers
    document.querySelectorAll('.calendar-day').forEach(btn => {
        if (btn.classList.contains('calendar-day--outside')) {
            // Still allow selecting outside days so user can navigate by clicking
        }
        btn.addEventListener('click', () => {
            const dateStr = btn.dataset.date;
            const [y, m, d] = dateStr.split('-').map(Number);
            selectedDate = new Date(y, m - 1, d);
            calendarCurrentDate = new Date(y, m - 1, 1);
            renderCalendar();
        });
    });

    // Render tasks for selected date
    selectedDateLabel.textContent = `Tasks on ${selectedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    })}`;

    const tasksForDay = getTasksForDate(selectedDate);

    if (tasksForDay.length === 0) {
        tasksListEl.innerHTML = '<p class="empty-message small">No tasks on this date.</p>';
    } else {
        tasksListEl.innerHTML = tasksForDay
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .map(task => `
                <div class="calendar-task-chip">
                    <div>
                        <div class="calendar-task-chip-title">${escapeHtml(task.title)}</div>
                        ${task.subject ? `<div class="calendar-task-chip-meta">${escapeHtml(task.subject)}</div>` : ''}
                    </div>
                    <div class="calendar-task-chip-meta">
                        ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        ${task.completed ? ' • Completed' : ''}
                    </div>
                </div>
            `)
            .join('');
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
                ${!isNaN(dueDate.getTime()) ? ' • ' + dueDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
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
    const dueTime = document.getElementById('dueTime').value;

    const combinedDueDate = combineDateAndTime(dueDate, dueTime);

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, subject, priority, dueDate: combinedDueDate })
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

    const taskDue = new Date(task.dueDate);
    if (!isNaN(taskDue.getTime())) {
        document.getElementById('editDueDate').value = formatDateForInput(taskDue);
        document.getElementById('editDueTime').value = formatTimeForInput(taskDue);
    } else {
        document.getElementById('editDueDate').value = task.dueDate || '';
        document.getElementById('editDueTime').value = '';
    }

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
    const dueTime = document.getElementById('editDueTime').value;
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
                dueDate: combineDateAndTime(dueDate, dueTime),
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

function activateTab(targetId) {
    const tabButtons = document.querySelectorAll('.dashboard-tab');
    const panels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
        const isTarget = btn.dataset.tabTarget === targetId;
        btn.classList.toggle('active', isTarget);
        btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    panels.forEach(panel => {
        const isTarget = panel.id === targetId;
        panel.classList.toggle('tab-panel-active', isTarget);
        panel.hidden = !isTarget;
    });
}

function combineDateAndTime(dateStr, timeStr) {
    if (!dateStr) return '';
    if (!timeStr) return `${dateStr}T23:59`;
    return `${dateStr}T${timeStr}`;
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeForInput(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function ensureDeadlineNotificationsWatcher() {
    if (notificationIntervalId !== null) return;
    if (typeof window === 'undefined') return;

    if (!('Notification' in window)) {
        return;
    }

    if (Notification.permission === 'granted') {
        startDeadlineInterval();
    } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                startDeadlineInterval();
            }
        });
    }
}

function startDeadlineInterval() {
    if (notificationIntervalId !== null) return;
    checkUpcomingDeadlines();
    notificationIntervalId = setInterval(checkUpcomingDeadlines, 60 * 1000);
}

function checkUpcomingDeadlines() {
    const now = new Date();
    const nowMs = now.getTime();
    const oneHourMs = 60 * 60 * 1000;

    allTasks.forEach(task => {
        if (task.completed || !task.dueDate) return;

        const due = new Date(task.dueDate);
        if (isNaN(due.getTime())) return;

        const diff = due.getTime() - nowMs;

        if (diff <= oneHourMs && diff > 0 && !notifiedTaskIds.has(task.id)) {
            notifiedTaskIds.add(task.id);

            const message = `“${task.title}” is due at ${due.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.`;

            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Deadline in 1 hour', {
                    body: message,
                    tag: `task-${task.id}`
                });
            } else {
                alert(`Deadline in 1 hour: ${message}`);
            }
        }
    });
}

function initTheme() {
    let stored = 'light';
    try {
        stored = localStorage.getItem('theme') || 'light';
    } catch {
        stored = 'light';
    }
    setTheme(stored);
}

function setTheme(theme) {
    const normalized = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', normalized);
    try {
        localStorage.setItem('theme', normalized);
    } catch {
        // ignore storage errors
    }

    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        toggle.textContent = normalized === 'dark' ? '☀️' : '🌙';
        toggle.setAttribute('aria-label', normalized === 'dark' ? 'Switch to day mode' : 'Switch to night mode');
    }
}
