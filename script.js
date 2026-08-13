const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const todoCount = document.getElementById('todo-count');
const clearBtn = document.getElementById('clear-completed');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('searchTodo');

let todos = JSON.parse(localStorage.getItem('todos')) || [];
let currentFilter = 'all';

// Initialize App
window.onload = () => {
    renderTodos();
};

// 1. Add Todo
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

// 2. Render ToDos based on Filter and Search
function renderTodos() {
    let filteredTodos = todos.filter(todo => {
        const matchesFilter = 
            currentFilter === 'all' ? true : 
            currentFilter === 'completed' ? todo.completed : !todo.completed;
        
        const matchesSearch = todo.text.toLowerCase().includes(searchInput.value.toLowerCase());
        
        return matchesFilter && matchesSearch;
    });

    todoList.innerHTML = '';

    filteredTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;

        li.innerHTML = `
            <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleComplete(${todo.id})">
            <span class="todo-text">${todo.text}</span>
            <div class="btn-group">
                <button class="edit-btn" onclick="editTodo(${todo.id})">Edit</button>
                <button class="delete-btn" onclick="deleteTodo(${todo.id})">Delete</button>
            </div>
        `;
        todoList.appendChild(li);
    });

    updateCounter();
}

// 3. Toggle Complete
function toggleComplete(id) {
    todos = todos.map(todo => todo.id === id ? { ...todo, completed: !todo.completed } : todo);
    saveAndRender();
}

// 4. Delete Todo
function deleteTodo(id) {
    todos = todos.filter(todo => todo.id !== id);
    saveAndRender();
}

// 5. Edit Todo
function editTodo(id) {
    const item = todos.find(todo => todo.id === id);
    const li = document.querySelector(`[data-id="${id}"]`);
    const textSpan = li.querySelector('.todo-text');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = item.text;

    input.onblur = () => {
        item.text = input.value.trim() || item.text;
        saveAndRender();
    };

    input.onkeydown = (e) => {
        if (e.key === 'Enter') input.blur();
    };

    textSpan.replaceWith(input);
    input.focus();
}

// 6. Filter Functionality
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderTodos();
    });
});

// 7. Search Functionality
function filterTasks() {
    renderTodos();
}

// 8. Clear Completed
clearBtn.addEventListener('click', () => {
    todos = todos.filter(todo => !todo.completed);
    saveAndRender();
});

// Utility: Update Counter
function updateCounter() {
    const activeTasks = todos.filter(t => !t.completed).length;
    todoCount.innerText = `You have ${activeTasks} task${activeTasks !== 1 ? 's' : ''} left`;
}

// Utility: LocalStorage & Render
function saveAndRender() {
    localStorage.setItem('todos', JSON.stringify(todos));
    renderTodos();
}