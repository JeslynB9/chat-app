document.addEventListener('DOMContentLoaded', () => {
    // ==========================
    // 👤 USERNAME SETUP
    // ==========================
    const username = localStorage.getItem('username');

    if (!username) {
        alert('You are not logged in. Redirecting to login page...');
        window.location.href = 'login.html';
        return;
    }

    const sidebarUsername = document.getElementById('sidebar-username');
    if (sidebarUsername) {
        sidebarUsername.textContent = username;
    }

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
    let activeReceiver = null; // Ensure this is properly initialized

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        toggleBtn.textContent = sidebar.classList.contains('collapsed') ? '→' : '←';
    });

    function sendMessage() {
        const messageText = inputField.value.trim();
        if (messageText && activeReceiver) {
            const messageData = {
                message: messageText,
                sender: username,
                receiver: activeReceiver,
                timestamp: Date.now() // Use the current timestamp
            };

            // Emit the message via Socket.IO
            socket.emit('sendMessage', messageData);

            // Save the message to the database
            fetch('http://localhost:3000/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messageData)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log('Message saved:', data);
                        // Add the message to the UI
                        const messageElement = document.createElement('div');
                        messageElement.classList.add('message', 'sent');
                        const messageBubble = document.createElement('div');
                        messageBubble.classList.add('message-bubble');
                        messageBubble.textContent = messageText;
                        messageElement.appendChild(messageBubble);
                        messagesContainer.appendChild(messageElement);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to the bottom

                        // Dynamically update the last message in the sidebar
                        updateLastMessageInSidebar(activeReceiver, messageText, "You", messageData.timestamp);
                    } else {
                        console.error('Error saving message:', data.message);
                    }
                })
                .catch(error => console.error('Error sending message:', error));

            inputField.value = ''; // Clear the input field
        } else if (!activeReceiver) {
            alert('Please select a user to chat with.');
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
        // Ignore messages sent by the sender
        if (data.sender === username) {
            return;
        }

        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'received');
        const usernameElement = document.createElement('div');
        usernameElement.classList.add('username');
        usernameElement.textContent = data.sender;

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');
        messageBubble.textContent = data.message;

        messageElement.appendChild(usernameElement);
        messageElement.appendChild(messageBubble);

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Dynamically update the last message in the sidebar
        updateLastMessageInSidebar(data.sender, data.message, data.sender, data.timestamp);
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

    // ==========================
    // ✉️ COMPOSE MESSAGE MODAL
    // ==========================
    const composeButton = document.getElementById('compose-button');
    const composeModal = document.getElementById('compose-modal');
    const closeComposeButton = composeModal.querySelector('.close-button');
    const searchUserInput = document.getElementById('search-user');
    const userResults = document.getElementById('user-results');
    const startChatButton = document.getElementById('start-chat-button');

    let selectedUser = null;

    composeButton.addEventListener('click', () => {
        // Reset the modal when it is reopened
        searchUserInput.value = '';
        userResults.innerHTML = '';
        selectedUser = null;
        startChatButton.disabled = true;

        composeModal.style.display = 'block';
    });

    closeComposeButton.addEventListener('click', () => {
        composeModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === composeModal) {
            composeModal.style.display = 'none';
        }
    });

    searchUserInput.addEventListener('input', () => {
        const query = searchUserInput.value.trim();
        if (query) {
            fetch(`http://localhost:3000/search-users?query=${encodeURIComponent(query)}`)
                .then(response => response.json())
                .then(data => {
                    userResults.innerHTML = '';
                    data.users.forEach(user => {
                        const userItem = document.createElement('li');
                        userItem.textContent = user.username;
                        userItem.addEventListener('click', () => {
                            selectedUser = user.username;
                            startChatButton.disabled = false;
                            Array.from(userResults.children).forEach(child => child.classList.remove('selected'));
                            userItem.classList.add('selected');
                            console.log(`User selected: ${selectedUser}`);
                        });
                        userResults.appendChild(userItem);
                    });
                })
                .catch(error => console.error('Error fetching users:', error));
        } else {
            userResults.innerHTML = '';
            selectedUser = null;
            startChatButton.disabled = true;
        }
    });

    startChatButton.addEventListener('click', () => {
        if (selectedUser) {
            console.log(`Starting chat with ${selectedUser}`);
            addChatToSidebar(selectedUser); // Add the selected user to the sidebar
            notifyNewChat(username); // Notify the server to add the chat for both users
            activeChat = selectedUser;
            messagesContainer.innerHTML = ''; // Clear messages for the new chat
            composeModal.style.display = 'none';
        } else {
            console.error('No user selected to start a chat.');
        }
    });

    // ==========================
    // 🗨️ CHAT LIST & MESSAGES
    // ==========================
    const chatList = document.getElementById('chat-list');
    let activeChat = null;
    const chatHeaderName = document.querySelector('.main-chat-header div > div:first-child'); // Select the header name element
    const chatHeaderUsername = document.getElementById('chat-header-username'); // Select the username element in the chat header
    const noChatPlaceholder = document.getElementById('no-chat-placeholder');
    const chatScreen = document.getElementById('chat-screen');
    const inputArea = document.getElementById('main-chat-footer'); // Correctly select the footer containing the input area

    function addChatToSidebar(username) {
        // Check if the chat already exists in the sidebar
        if (Array.from(chatList.children).some(chat => chat.querySelector('div > div:first-child').textContent.trim() === username)) {
            console.log(`Chat with ${username} already exists in the sidebar.`);
            return;
        }

        const chatItem = document.createElement('div');
        chatItem.classList.add('chat-list-item');
        chatItem.innerHTML = `
            <img src="default-avatar.jpg" alt="User" width="40" height="40">
            <div>
                <div>${username}</div>
                <div class="last-message">Loading...</div> <!-- Placeholder for the last message -->
            </div>
            <div class="last-message-time">Loading...</div> <!-- Placeholder for the last message time -->
        `;
        chatItem.setAttribute('data-last-timestamp', 0); // Default timestamp for sorting
        chatItem.addEventListener('click', () => {
            highlightSelectedChat(chatItem); // Highlight the selected chat
            activeReceiver = username; // Set the active receiver
            chatHeaderUsername.textContent = username; // Update the chat header with the username
            toggleChatScreen(true); // Show the chat screen
            loadMessages(username); // Fetch and display previous messages
        });
        chatList.appendChild(chatItem);

        // Fetch the last message for this chat
        fetchLastMessage(username, chatItem);
    }

    function fetchLastMessage(username, chatItem) {
        fetch(`http://localhost:3000/messages?sender=${encodeURIComponent(username)}&receiver=${encodeURIComponent(username)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.messages.length > 0) {
                    const lastMessage = data.messages[data.messages.length - 1];
                    const lastMessageElement = chatItem.querySelector('.last-message');
                    const lastMessageTimeElement = chatItem.querySelector('.last-message-time');
                    lastMessageElement.textContent = `${lastMessage.sender === username ? "You" : lastMessage.sender}: ${lastMessage.message}`;
                    lastMessageTimeElement.textContent = formatTimestamp(new Date(lastMessage.createdAt).getTime()); // Ensure consistent formatting
                    chatItem.setAttribute('data-last-timestamp', new Date(lastMessage.createdAt).getTime());
                    reorderChatList(); // Reorder the chat list after updating the timestamp
                } else {
                    chatItem.querySelector('.last-message').textContent = 'No messages yet';
                    chatItem.querySelector('.last-message-time').textContent = '';
                }
            })
            .catch(error => {
                console.error('Error fetching last message:', error);
                chatItem.querySelector('.last-message').textContent = 'Error loading message';
                chatItem.querySelector('.last-message-time').textContent = '';
            });
    }

    function reorderChatList() {
        const chatItems = Array.from(chatList.children);
        chatItems.sort((a, b) => {
            const timestampA = parseInt(a.getAttribute('data-last-timestamp'), 10) || 0;
            const timestampB = parseInt(b.getAttribute('data-last-timestamp'), 10) || 0;
            return timestampB - timestampA; // Sort in descending order (most recent first)
        });

        // Append the sorted items back to the chat list
        chatItems.forEach(chatItem => chatList.appendChild(chatItem));
    }

    function formatTimestamp(timestamp) {
        const date = new Date(timestamp); // Use the timestamp directly
        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12; // Convert to 12-hour format
        return `${formattedHours}:${minutes} ${ampm}`;
    }

    // Fetch and display the chat list for the logged-in user
    function fetchChatList() {
        fetch(`http://localhost:3000/user-chats?username=${encodeURIComponent(username)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    chatList.innerHTML = ''; // Clear existing chat list
                    data.chats.forEach(chat => {
                        addChatToSidebar(chat.username);
                    });
                } else {
                    console.error('Error fetching chat list:', data.message);
                }
            })
            .catch(error => console.error('Error fetching chat list:', error));
    }

    // Call fetchChatList on page load to populate the chat list
    fetchChatList();

    function toggleChatScreen(show) {
        if (show) {
            noChatPlaceholder.style.display = 'none';
            chatScreen.classList.remove('hidden');
            inputArea.style.display = 'flex'; // Ensure the input area is visible
        } else {
            noChatPlaceholder.style.display = 'flex';
            chatScreen.classList.add('hidden');
            inputArea.style.display = 'none'; // Hide the input area when no chat is selected
        }
    }

    // Initially show the placeholder and hide the input area
    toggleChatScreen(false);

    // Function to highlight the selected chat
    function highlightSelectedChat(selectedChat) {
        // Remove the 'selected' class from all chat items
        Array.from(chatList.children).forEach(chat => chat.classList.remove('selected'));
        // Add the 'selected' class to the clicked chat item
        selectedChat.classList.add('selected');
    }

    function loadMessages(username) {
        console.log(`Loading messages for user: ${username}`);
        fetch(`http://localhost:3000/messages?sender=${encodeURIComponent(username)}&receiver=${encodeURIComponent(username)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    messagesContainer.innerHTML = ''; // Clear existing messages
                    data.messages.forEach(message => {
                        const messageElement = document.createElement('div');
                        messageElement.classList.add('message', message.sender === username ? 'received' : 'sent');
                        const messageBubble = document.createElement('div');
                        messageBubble.classList.add('message-bubble');
                        messageBubble.textContent = message.message;
                        messageElement.appendChild(messageBubble);
                        messagesContainer.appendChild(messageElement);
                    });
                    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to the bottom
                } else {
                    console.error('Error fetching messages:', data.message);
                }
            })
            .catch(error => console.error('Error loading messages:', error));
    }

    // Notify the server when a new chat is added
    function notifyNewChat(username) {
        fetch('http://localhost:3000/add-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: username, receiver: selectedUser })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log(`Chat with ${selectedUser} added for both users.`);
                } else {
                    console.error('Error adding chat:', data.message);
                }
            })
            .catch(error => console.error('Error notifying server:', error));
    }

    // Listen for updates to the chat list
    socket.on('updateChatList', ({ sender, receiver }) => {
        if (sender === username || receiver === username) {
            fetchChatList(); // Refresh the chat list for the logged-in user
        }
    });

    function updateLastMessageInSidebar(username, message, sender, timestamp) {
        const chatItem = Array.from(chatList.children).find(chat =>
            chat.querySelector('div > div:first-child').textContent.trim() === username
        );

        if (chatItem) {
            const lastMessageElement = chatItem.querySelector('.last-message');
            const lastMessageTimeElement = chatItem.querySelector('.last-message-time');
            const displaySender = sender === username ? "You" : sender;
            lastMessageElement.textContent = `${displaySender}: ${message}`;
            lastMessageTimeElement.textContent = formatTimestamp(timestamp); // Correctly format timestamp
            chatItem.setAttribute('data-last-timestamp', timestamp); // Update the timestamp attribute
            reorderChatList(); // Reorder the chat list after updating the timestamp
        }
    }
});