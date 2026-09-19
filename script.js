// ProTask: script.js

const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const priorityInput = document.getElementById('priority-input');
const dueInput = document.getElementById('due-input');
const todoList = document.getElementById('todo-list');
const todoCount = document.getElementById('todo-count');
const clearBtn = document.getElementById('clear-completed');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('searchTodo');
const sortSelect = document.getElementById('sort-select');
const themeToggle = document.getElementById('theme-toggle');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toast-msg');
const toastUndo = document.getElementById('toast-undo');
const progressFill = document.getElementById('progress-fill');
const progressBar = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');
const progressPct = document.getElementById('progress-pct');

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
const UNDO_MS = 6000;

let todos = loadTodos();
let currentFilter = 'all'; // 'all' | 'active' | 'completed'
let currentSort = 'added'; // 'added' | 'priority' | 'due'
let justAddedId = null;    // so only the newly added task animates
let pendingUndo = null;    // { items: [{ todo, index }] }
let toastTimer = null;

/* ---------- 1. Storage ---------- */

function loadTodos() {
    try {
        const saved = JSON.parse(localStorage.getItem('todos'));
        if (!Array.isArray(saved)) return [];

        // Also upgrades tasks saved by the older version (no priority / due date)
        return saved
            .filter((t) => t && typeof t.text === 'string' && t.text.trim())
            .map((t, i) => ({
                id: Number.isFinite(Number(t.id)) ? Number(t.id) : Date.now() + i,
                text: t.text.trim(),
                completed: Boolean(t.completed),
                priority: PRIORITY_ORDER[t.priority] !== undefined ? t.priority : 'medium',
                due: /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : ''
            }));
    } catch (err) {
        return [];
    }
}

function saveAndRender() {
    try {
        localStorage.setItem('todos', JSON.stringify(todos));
    } catch (err) {
        // Storage blocked or full: the app keeps working in memory for this session
    }
    render();
}

/* ---------- 2. Dates ---------- */

function toISODate(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
}

function parseISODate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d); // local date, avoids the UTC off-by-one bug
}

function describeDue(todo) {
    const now = new Date();
    const todayISO = toISODate(now);
    const tomorrowISO = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

    const date = parseISODate(todo.due);
    const options = { day: 'numeric', month: 'short' };
    if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
    const nice = date.toLocaleDateString(undefined, options);

    if (todo.completed) return { text: `Due ${nice}`, cls: '' };
    if (todo.due < todayISO) return { text: `Overdue: ${nice}`, cls: 'overdue' };
    if (todo.due === todayISO) return { text: 'Due today', cls: 'today' };
    if (todo.due === tomorrowISO) return { text: 'Due tomorrow', cls: '' };
    return { text: `Due ${nice}`, cls: '' };
}

/* ---------- 3. Rendering (XSS safe: textContent only) ---------- */

function compareTodos(a, b) {
    if (a.completed !== b.completed) return a.completed ? 1 : -1; // finished tasks sink
    if (currentSort === 'priority') {
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    // due date: earliest first, tasks without a date last
    if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
}

function getVisibleTodos() {
    const query = searchInput.value.toLowerCase().trim();

    const visible = todos.filter((todo) => {
        const matchesFilter =
            currentFilter === 'all' ? true :
            currentFilter === 'completed' ? todo.completed : !todo.completed;
        return matchesFilter && todo.text.toLowerCase().includes(query);
    });

    // filter() returned a new array, so sorting it does not reorder `todos`
    return currentSort === 'added' ? visible : visible.sort(compareTodos);
}

function createTodoElement(todo) {
    const li = document.createElement('li');
    li.className = 'todo-item' +
        (todo.completed ? ' completed' : '') +
        (todo.id === justAddedId ? ' is-new' : '');
    li.dataset.id = todo.id;
    li.dataset.priority = todo.priority;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'toggle-btn';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', `Mark "${todo.text}" as ${todo.completed ? 'not done' : 'done'}`);

    const body = document.createElement('div');
    body.className = 'todo-body';

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;

    const meta = document.createElement('div');
    meta.className = 'todo-meta';

    const badge = document.createElement('span');
    badge.className = `badge badge-${todo.priority}`;
    badge.textContent = `${PRIORITY_LABEL[todo.priority]} priority`;
    meta.appendChild(badge);

    if (todo.due) {
        const info = describeDue(todo);
        const due = document.createElement('span');
        due.className = 'due' + (info.cls ? ` ${info.cls}` : '');
        due.textContent = info.text;
        meta.appendChild(due);
    }

    body.append(text, meta);

    const group = document.createElement('div');
    group.className = 'btn-group';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'edit-btn';
    edit.textContent = 'Edit';
    edit.setAttribute('aria-label', `Edit task: ${todo.text}`);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete-btn';
    del.textContent = 'Delete';
    del.setAttribute('aria-label', `Delete task: ${todo.text}`);

    group.append(edit, del);
    li.append(checkbox, body, group);
    return li;
}

function render() {
    const visible = getVisibleTodos();
    todoList.replaceChildren();

    if (visible.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'empty-state';
        empty.textContent = todos.length === 0
            ? 'No tasks yet. Add your first task above.'
            : 'No matching tasks.';
        todoList.appendChild(empty);
    } else {
        visible.forEach((todo) => todoList.appendChild(createTodoElement(todo)));
    }

    justAddedId = null;
    updateCounts();
}

function updateCounts() {
    const activeCount = todos.filter((t) => !t.completed).length;
    const counts = {
        all: todos.length,
        active: activeCount,
        completed: todos.length - activeCount
    };

    filterBtns.forEach((btn) => {
        btn.querySelector('.filter-count').textContent = counts[btn.dataset.filter];
    });

    todoCount.textContent = `You have ${activeCount} task${activeCount !== 1 ? 's' : ''} left`;
    clearBtn.disabled = counts.completed === 0;

    const total = todos.length;
    const done = counts.completed;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    progressFill.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', String(pct));
    progressPct.textContent = `${pct}%`;
    progressLabel.textContent =
        total === 0 ? 'No tasks yet' :
        done === total ? `All ${total} task${total !== 1 ? 's' : ''} done` :
        `${done} of ${total} done`;
}

/* ---------- 4. Add ---------- */

todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = todoInput.value.trim();
    if (!text) {
        todoInput.focus();
        return;
    }

    const todo = {
        id: Date.now(),
        text,
        completed: false,
        priority: priorityInput.value,
        due: dueInput.value
    };
    todos.push(todo);
    justAddedId = todo.id;

    todoInput.value = '';
    dueInput.value = '';
    saveAndRender();
    todoInput.focus();
});

/* ---------- 5. Delete with undo ---------- */

function removeTodos(ids, message) {
    const items = [];
    todos.forEach((todo, index) => {
        if (ids.includes(todo.id)) items.push({ todo, index });
    });
    if (items.length === 0) return;

    todos = todos.filter((t) => !ids.includes(t.id));
    saveAndRender();
    showUndo(message, items);
}

function showUndo(message, items) {
    pendingUndo = { items };
    toastMsg.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, UNDO_MS);
}

function hideToast() {
    clearTimeout(toastTimer);
    toast.hidden = true;
    pendingUndo = null;
}

toastUndo.addEventListener('click', () => {
    if (!pendingUndo) return;
    // Items are in original order, so re-inserting at their old index rebuilds the list
    pendingUndo.items.forEach(({ todo, index }) => {
        todos.splice(Math.min(index, todos.length), 0, todo);
    });
    hideToast();
    saveAndRender();
});

clearBtn.addEventListener('click', () => {
    const ids = todos.filter((t) => t.completed).map((t) => t.id);
    const n = ids.length;
    removeTodos(ids, `${n} completed task${n !== 1 ? 's' : ''} cleared`);
});

/* ---------- 6. Click and change handlers (event delegation) ---------- */

todoList.addEventListener('click', (e) => {
    const li = e.target.closest('.todo-item');
    if (!li) return;

    const id = Number(li.dataset.id);

    if (e.target.classList.contains('delete-btn')) {
        removeTodos([id], 'Task deleted');
    } else if (e.target.classList.contains('edit-btn')) {
        handleEdit(li, id);
    }
});

todoList.addEventListener('change', (e) => {
    if (!e.target.classList.contains('toggle-btn')) return;

    const id = Number(e.target.closest('.todo-item').dataset.id);
    todos = todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    saveAndRender();

    // The list was rebuilt, so give focus back to the same checkbox (keyboard users)
    const box = todoList.querySelector(`.todo-item[data-id="${id}"] .toggle-btn`);
    if (box) box.focus();
});

/* ---------- 7. Edit (Enter saves, Escape cancels, blur saves) ---------- */

function handleEdit(li, id) {
    const item = todos.find((t) => t.id === id);
    const textSpan = li.querySelector('.todo-text');
    if (!item || !textSpan) return; // already editing

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = item.text;
    input.setAttribute('aria-label', 'Edit task text');

    let finished = false;
    const finish = (save) => {
        if (finished) return; // Enter/Escape and the blur that follows must not run twice
        finished = true;
        const updated = input.value.trim();
        if (save && updated) item.text = updated;
        saveAndRender();
    };

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
    });

    textSpan.replaceWith(input);
    input.focus();
    input.select();
}

/* ---------- 8. Search, filter, sort ---------- */

searchInput.addEventListener('input', render);

filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        filterBtns.forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        currentFilter = btn.dataset.filter;
        render();
    });
});

sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    render();
});

/* ---------- 9. Theme ---------- */

function getTheme() {
    return document.documentElement.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

themeToggle.addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
        localStorage.setItem('theme', next);
    } catch (err) { /* ignore */ }
});

/* ---------- 10. Start ---------- */

applyTheme(getTheme());
render();