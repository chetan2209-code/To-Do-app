const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const todoCount = document.getElementById('todo-count');
const clearBtn = document.getElementById('clear-completed');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('searchTodo');

let todos = JSON.parse(localStorage.getItem('todos')) || [];
let currentFilter = 'all';

// 1. Initial Load
window.addEventListener('DOMContentLoaded', renderTodos);

// 2. Add Task
todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = todoInput.value.trim();
    if (text) {
        todos.push({
            id: Date.now(),
            text: text,
            completed: false
        });
        todoInput.value = '';
        saveAndRender();
    }
});

// 3. Render Engine (XSS Safe & Event Delegated)
function renderTodos() {
    const query = searchInput.value.toLowerCase().trim();
    
    const filteredTodos = todos.filter(todo => {
        const matchesFilter = 
            currentFilter === 'all' ? true : 
            currentFilter === 'completed' ? todo.completed : !todo.completed;
        
        const matchesSearch = todo.text.toLowerCase().includes(query);
        return matchesFilter && matchesSearch;
    });

    todoList.innerHTML = '';

    if (filteredTodos.length === 0) {
        todoList.innerHTML = `<li style="text-align:center; padding: 1rem; color: var(--text-muted);">No tasks found</li>`;
        updateCounter();
        return;
    }

    filteredTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = todo.completed;
        checkbox.className = 'toggle-btn';

        // Task Text (Prevents XSS Injection)
        const span = document.createElement('span');
        span.className = 'todo-text';
        span.textContent = todo.text;

        // Action Buttons Container
        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group';
        btnGroup.innerHTML = `
            <button class="edit-btn">Edit</button>
            <button class="delete-btn">Delete</button>
        `;

        li.append(checkbox, span, btnGroup);
        todoList.appendChild(li);
    });

    updateCounter();
}

// 4. Centralized Event Delegation (Click Handlers)
todoList.addEventListener('click', (e) => {
    const li = e.target.closest('.todo-item');
    if (!li) return;
    
    const id = Number(li.dataset.id);

    if (e.target.classList.contains('delete-btn')) {
        todos = todos.filter(t => t.id !== id);
        saveAndRender();
    } 
    else if (e.target.classList.contains('edit-btn')) {
        handleEdit(li, id);
    }
});

todoList.addEventListener('change', (e) => {
    if (e.target.classList.contains('toggle-btn')) {
        const id = Number(e.target.closest('.todo-item').dataset.id);
        todos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveAndRender();
    }
});

// 5. Safe Edit Handler
function handleEdit(li, id) {
    const item = todos.find(t => t.id === id);
    const textSpan = li.querySelector('.todo-text');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = item.text;

    const saveChanges = () => {
        const updatedText = input.value.trim();
        if (updatedText) {
            item.text = updatedText;
        }
        saveAndRender();
    };

    input.addEventListener('blur', saveChanges);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
    });

    textSpan.replaceWith(input);
    input.focus();
}

// 6. Search & Filter Handlers
searchInput.addEventListener('input', renderTodos);

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderTodos();
    });
});

clearBtn.addEventListener('click', () => {
    todos = todos.filter(todo => !todo.completed);
    saveAndRender();
});

function updateCounter() {
    const activeCount = todos.filter(t => !t.completed).length;
    todoCount.textContent = `You have ${activeCount} task${activeCount !== 1 ? 's' : ''} left`;
}

function saveAndRender() {
    localStorage.setItem('todos', JSON.stringify(todos));
    renderTodos();
}