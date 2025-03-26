document.addEventListener('DOMContentLoaded', () => {
    // ==========================
    // 🔌 SOCKET & MESSAGE HANDLING
    // ==========================
    const socket = io('http://localhost:3000');
    const inputField = document.querySelector('.input-area input');
    const messagesContainer = document.querySelector('.messages');
    const typingStatus = document.querySelector('.typing-status');
    let typingTimeout;
    const toggleBtn = document.getElementById('toggle-sidebar');
    const sidebar = document.querySelector('.sidebar');

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        toggleBtn.textContent = sidebar.classList.contains('collapsed') ? '→' : '←';
    });

    // const username = prompt("Enter your username:");

    fetch('http://localhost:3000/save-username', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
            location.reload();
        } else {
            console.log('Username saved:', data.user);
        }
    })
    .catch(error => {
        console.error('Error saving username:', error);
    });

    function sendMessage() {
        const messageText = inputField.value.trim();
        if (messageText) {
            const messageData = { message: messageText, sender: username };
            socket.emit('sendMessage', messageData);
            inputField.value = '';
        }
    }

    inputField.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    inputField.addEventListener('input', () => {
        socket.emit('typing', username);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('stopTyping', username);
        }, 1000);
    });

    socket.on('receiveMessage', (data) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        if (data.sender === username) {
            messageElement.classList.add('sent');
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
            messageBubble.textContent = data.message;
            messageElement.appendChild(messageBubble);
        } else {
            messageElement.classList.add('received');
            const usernameElement = document.createElement('div');
            usernameElement.classList.add('username');
            usernameElement.textContent = data.sender;

            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
            messageBubble.textContent = data.message;

            messageElement.appendChild(usernameElement);
            messageElement.appendChild(messageBubble);
        }

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    socket.on('typing', (user) => {
        if (user !== username) {
            typingStatus.textContent = 'Typing...';
        }
    });
    
    socket.on('stopTyping', (user) => {
        if (user !== username) {
            typingStatus.textContent = '';
        }
    });

    // ==========================
    // 📸 FOOTER BUTTONS (CAMERA + PLUS)
    // ==========================
    const cameraButton = document.querySelector('.input-area button:nth-child(3)');
    const plusButton = document.querySelector('.input-area button:nth-child(4)');

    cameraButton.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.click();

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                alert(`Selected file: ${file.name}`);
            }
        });
    });

    plusButton.addEventListener('click', () => {
        alert('Plus button clicked! You can implement additional actions here.');
    });

    // ==========================
    // 📌 PINS (HEADER)
    // ==========================
    const pinsContainer = document.querySelector(".pins-container");
    const addPinButton = document.getElementById("add-pin-button");

    addPinButton.addEventListener("click", () => {
        const pinText = prompt("Enter the text for the new pin:");
        if (pinText) {
            const pin = document.createElement("div");
            pin.className = "pin";
            pin.innerHTML = `
                <span class="pin-text">${pinText}</span>
                <button class="remove-pin-button">&times;</button>
            `;
            pinsContainer.insertBefore(pin, addPinButton);
        }
    });

    pinsContainer.addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-pin-button")) {
            event.target.parentElement.remove();
        }
    });

    // ==========================
    // 📌 PINS (SIDEBAR)
    // ==========================
    const sidebarPinsContainer = document.querySelector(".pins-container-sidebar");
    const addSidebarPinButton = document.getElementById("add-pin-button-sidebar");

    addSidebarPinButton.addEventListener("click", () => {
        const pinText = prompt("Enter the text for the new pin:");
        if (pinText) {
            const pin = document.createElement("div");
            pin.className = "pin-sidebar";
            pin.innerHTML = `
                <span class="pin-text-sidebar">${pinText}</span>
                <button class="remove-pin-button-sidebar">&times;</button>
            `;
            sidebarPinsContainer.insertBefore(pin, addSidebarPinButton);
        }
    });

    sidebarPinsContainer.addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-pin-button-sidebar")) {
            event.target.parentElement.remove();
        }
    });

    // ==========================
    // ⚙️ SETTINGS MODAL & THEMES
    // ==========================
    const settingsButton = document.getElementById('settings-button');
    const modal = document.getElementById('settings-modal');
    const closeButton = document.querySelector('.close-button');
    const themeButtons = document.querySelectorAll('.theme-button');

    settingsButton.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    themeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const theme = button.getAttribute('data-theme');
            applyTheme(theme);
            localStorage.setItem('theme', theme);
        });
    });

    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    }

    // ==========================
    // 🔘 Sidebar Button Logic (Optional Future)
    // ==========================
    // Add more button handlers here if needed

    // ==========================
    // 📝 Task Bar Logic
    // ==========================
    const progressCircle = document.querySelector('.progress-circle');
    const progressPercentage = document.querySelector('.progress-percentage');
    const taskList = document.querySelector('.task-list');
    const taskItems = document.getElementById('task-items');
    const addTaskButton = document.getElementById('add-task-button');

    let tasks = [];
    let completedTasks = 0;

    progressCircle.addEventListener('click', () => {
        taskList.classList.toggle('hidden');
    });

    addTaskButton.addEventListener('click', () => {
        const taskId = `task-${tasks.length}`;
        tasks.push({ id: taskId, text: '', completed: false });

        const taskItem = document.createElement('li');
        taskItem.innerHTML = `
            <input type="checkbox" id="${taskId}">
            <span class="task-name" data-task-id="${taskId}">New Task</span>
            <button class="delete-task-button">&times;</button> <!-- Display "X" -->
        `;
        taskItems.appendChild(taskItem);

        const taskName = taskItem.querySelector('.task-name');

        function enableEditing() {
            const taskId = taskName.getAttribute('data-task-id');
            const task = tasks.find(t => t.id === taskId);

            const taskInput = document.createElement('input');
            taskInput.type = 'text';
            taskInput.className = 'task-input';
            taskInput.value = task.text || taskName.textContent;
            taskName.replaceWith(taskInput);
            taskInput.focus();

            taskItem.classList.add('editing'); // Add the editing class

            function finalizeTaskInput(event) {
                if (event.type === 'blur' || (event.type === 'keypress' && event.key === 'Enter')) {
                    const taskText = taskInput.value.trim();
                    if (taskText) {
                        task.text = taskText;
                        taskInput.replaceWith(taskName);
                        taskName.textContent = taskText;
                    } else {
                        // Remove the task if no text is entered
                        tasks = tasks.filter(t => t.id !== taskId);
                        taskItem.remove();
                    }
                    taskItem.classList.remove('editing'); // Remove the editing class
                    updateProgress();
                }
            }

            taskInput.addEventListener('blur', finalizeTaskInput);
            taskInput.addEventListener('keypress', finalizeTaskInput);
        }

        // Immediately enable editing for the new task
        enableEditing();

        // Allow editing on double-click
        taskName.addEventListener('dblclick', enableEditing);

        // Add delete functionality
        const deleteButton = taskItem.querySelector('.delete-task-button');
        deleteButton.addEventListener('click', () => {
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                if (tasks[taskIndex].completed) {
                    completedTasks--; // Deduct completed tasks if the task was marked as completed
                }
                tasks.splice(taskIndex, 1); // Remove the task from the array
            }
            taskItem.remove(); // Remove the task from the DOM
            updateProgress(); // Update the progress percentage
        });
    });

    taskItems.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox') {
            const taskId = event.target.id;
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.completed = event.target.checked;
                completedTasks = tasks.filter(t => t.completed).length;
                updateProgress();
            }
        }
    });

    function updateProgress() {
        const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
        progressPercentage.textContent = `${progress}%`;
        progressCircle.style.background = `conic-gradient(var(--sent-bg) 0% ${progress}%, var(--received-bg) ${progress}% 100%)`;
        progressCircle.style.transition = 'background 0.3s ease-in-out';
    }
});