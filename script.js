let calendar; // global calendar instance
let calendarInitialized = false;
let activeReceiver = null; // Ensure this is properly initialized

function generateProfilePicture(username) {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');

    // Generate a random background color
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#33FFF5'];
    const backgroundColor = colors[Math.floor(Math.random() * colors.length)];

    // Draw the background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the initial
    ctx.fillStyle = '#FFFFFF'; // White text
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = username.charAt(0).toUpperCase();
    ctx.fillText(initial, canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL(); // Return the image as a data URL
}

function openCalendar() {
    const userA = localStorage.getItem('username'); // Current logged-in user
    const userB = activeReceiver; // The user currently being chatted with

    if (!userA || !userB) {
        console.error('Cannot open calendar. Missing users:', { userA, userB });
        alert('Cannot open calendar. Please ensure both users are selected.');
        return;
    }

    const modal = document.getElementById("calendar-modal");
    modal.style.display = "block";

    const calendarEl = document.getElementById('calendar');
    console.log('Opening calendar for chat between:', userA, userB); // Debugging log

    if (!calendarInitialized) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            height: '100%',
            contentHeight: '100%',
            selectable: true,
            editable: true,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: function(fetchInfo, successCallback, failureCallback) {
                console.log('Fetching events for chat between:', userA, userB); // Debugging log
                fetch(`http://localhost:3000/calendar/events?userA=${encodeURIComponent(userA)}&userB=${encodeURIComponent(userB)}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            successCallback(data.events.map(event => ({
                                id: event.id,
                                title: event.title,
                                start: event.start,
                                end: event.end
                            })));
                        } else {
                            console.error('Error fetching events:', data.message); // Debugging log
                            failureCallback(data.message);
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching events:', error); // Debugging log
                        failureCallback('Failed to fetch events');
                    });
            },
            eventContent: function(arg) {
                // Create a container for the event
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.justifyContent = 'space-between';
                container.style.alignItems = 'center';

                // Add the event title
                const title = document.createElement('span');
                title.textContent = arg.event.title;
                container.appendChild(title);

                // Add the delete button
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'x';
                deleteButton.style.marginLeft = '10px';
                deleteButton.style.background = 'red';
                deleteButton.style.color = 'white';
                deleteButton.style.border = 'none';
                deleteButton.style.borderRadius = '50%';
                deleteButton.style.cursor = 'pointer';
                deleteButton.addEventListener('click', (event) => {
                    event.stopPropagation(); // Prevent triggering the event click
                    const eventId = arg.event.id;
                    if (confirm('Are you sure you want to delete this event?')) {
                        fetch(`http://localhost:3000/calendar/events/${eventId}?userA=${encodeURIComponent(userA)}&userB=${encodeURIComponent(userB)}`, {
                            method: 'DELETE'
                        })
                            .then(res => res.json())
                            .then(data => {
                                console.log('Server response for deleting event:', data); // Debugging log
                                if (data.success) {
                                    calendar.refetchEvents(); // Refresh the calendar
                                    alert('Event deleted successfully.');
                                } else {
                                    alert('Failed to delete event.');
                                }
                            })
                            .catch(error => console.error('Error deleting event:', error));
                    }
                });
                container.appendChild(deleteButton);

                return { domNodes: [container] };
            },
            select: function(info) {
                const title = prompt('Event Title:');
                if (title) {
                    const eventData = { 
                        title, 
                        start: info.startStr, 
                        end: info.endStr || info.startStr, 
                        userA, 
                        userB, 
                        created_by: userA 
                    };
                    console.log('Sending event data to server:', eventData); // Debugging log
                    fetch('http://localhost:3000/calendar/events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(eventData)
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                calendar.refetchEvents();
                            } else {
                                alert('Failed to add event.');
                            }
                        })
                        .catch(error => console.error('Error adding event:', error));
                }
            },
            eventClick: function(info) {
                if (confirm(`Do you want to delete the event "${info.event.title}"?`)) {
                    fetch(`http://localhost:3000/calendar/events/${info.event.id}?userA=${encodeURIComponent(userA)}&userB=${encodeURIComponent(userB)}`, {
                        method: 'DELETE'
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                info.event.remove();
                                alert('Event deleted successfully.');
                            } else {
                                alert('Failed to delete event.');
                            }
                        })
                        .catch(error => console.error('Error deleting event:', error));
                }
            }
        });

        calendar.render();
        calendarInitialized = true;
    } else {
        calendar.refetchEvents();
    }
}

function closeCalendar() {
    document.getElementById("calendar-modal").style.display = "none";
}

function getOrGenerateProfilePicture(username) {
    // Check if a profile picture is already saved in localStorage
    const savedPicture = localStorage.getItem(`profilePicture_${username}`);
    if (savedPicture) {
        return savedPicture; // Return the saved profile picture
    }

    // Generate a new profile picture and save it
    const newPicture = generateProfilePicture(username);
    localStorage.setItem(`profilePicture_${username}`, newPicture);
    return newPicture;
}

function updateInfoPanel(user, file) {
    const infoUser = document.getElementById('info-user');
    const infoFile = document.getElementById('info-file');

    infoUser.textContent = user || 'N/A';
    infoFile.textContent = file || 'N/A';
}

function openInfoPopup(user, file) {
    const popup = document.getElementById('info-popup');
    const popupUser = document.getElementById('popup-info-user');
    const popupFile = document.getElementById('popup-info-file');

    popupUser.textContent = user || 'N/A';
    popupFile.textContent = file || 'N/A';

    popup.style.display = 'block';
}

function closeInfoPopup() {
    const popup = document.getElementById('info-popup');
    popup.style.display = 'none';
}

function openInfoPopup(username, profilePicture, files) {
    const popup = document.getElementById('info-popup');
    const overlay = document.getElementById('popup-overlay');
    const popupUsername = document.getElementById('popup-username');
    const popupProfilePicture = document.getElementById('popup-profile-picture');
    const popupFiles = document.getElementById('popup-files');

    popupUsername.textContent = username || 'N/A';
    popupProfilePicture.src = profilePicture || 'default-avatar.jpg';

    // Clear and populate the files list
    popupFiles.innerHTML = '';
    if (files && files.length > 0) {
        files.forEach(file => {
            const fileItem = document.createElement('li');
            fileItem.textContent = file;
            popupFiles.appendChild(fileItem);
        });
    } else {
        const noFilesItem = document.createElement('li');
        noFilesItem.textContent = 'No files sent.';
        popupFiles.appendChild(noFilesItem);
    }

    popup.style.display = 'block';
    overlay.style.display = 'block'; // Show the overlay
}

function closeInfoPopup() {
    const popup = document.getElementById('info-popup');
    const overlay = document.getElementById('popup-overlay');

    popup.style.display = 'none';
    overlay.style.display = 'none'; // Hide the overlay
}

document.addEventListener('DOMContentLoaded', () => {
    // ==========================
    // 👤 USERNAME SETUP
    // ==========================
    const calendarButton = document.getElementById('calendar-button');
    calendarButton.addEventListener('click', openCalendar);
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

    // Set the profile picture for the logged-in user
    const sidebarFooterImage = document.querySelector('.sidebar-footer img');
    if (sidebarFooterImage) {
        const profilePicture = getOrGenerateProfilePicture(username);
        sidebarFooterImage.src = profilePicture;
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


    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        toggleBtn.querySelector('img').src = isCollapsed ? 'images/arrowright-light.png' : 'images/arrowleft-light.png';
    });

    function sendMessage() {
        const messageText = inputField.value.trim();
        if (messageText && activeReceiver) {
            if (username === activeReceiver) {
                alert("You cannot message yourself.");
                return; // Prevent sending the message
            }

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

    function updateUnreadCount(username, count) {
        const chatItem = Array.from(chatList.children).find(chat =>
            chat.querySelector('div > div:first-child').textContent.trim() === username
        );

        if (chatItem) {
            let unreadBadge = chatItem.querySelector('.unread-count');
            if (!unreadBadge) {
                unreadBadge = document.createElement('div');
                unreadBadge.classList.add('unread-count');
                chatItem.appendChild(unreadBadge);
            }
            unreadBadge.textContent = count > 0 ? count : '';
            unreadBadge.style.display = count > 0 ? 'block' : 'none';
        }
    }

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

        // Increment unread count for the sender
        if (activeReceiver !== data.sender) {
            const unreadCount = parseInt(localStorage.getItem(`unread_${data.sender}`) || '0', 10) + 1;
            localStorage.setItem(`unread_${data.sender}`, unreadCount);
            updateUnreadCount(data.sender, unreadCount);
        }
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
                openInfoPopup(localStorage.getItem('username'), file.name); // Show popup with file info
            }
        });
    });

    plusButton.addEventListener('click', openCalendar);

    

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
        });
    });

    function updateImagesForTheme(theme) {
        const settingsButtonImg = document.getElementById('settings-button').querySelector('img');
        const cameraButtonImg = document.getElementById('camera-button').querySelector('img');
        const calendarButtonImg = document.getElementById('calendar-button').querySelector('img');
        const infoButtonImg = document.getElementById('info-button').querySelector('img');
        const searchButtonImg = document.getElementById('top-search-button').querySelector('img');
    
        if (theme === 'dark') {
            settingsButtonImg.src = 'images/settings-dark.png';
            cameraButtonImg.src = 'images/camera-dark.png';
            calendarButtonImg.src = 'images/plus-dark.png';
            infoButtonImg.src = 'images/info-dark.png';
            searchButtonImg.src = 'images/search-dark.png';
        } else {
            settingsButtonImg.src = 'images/settings-light.png';
            cameraButtonImg.src = 'images/camera-light.png';
            calendarButtonImg.src = 'images/plus-light.png';
            searchButtonImg.src = 'images/search-light.png';
        }
    
        // Log errors if images fail to load
        [settingsButtonImg, cameraButtonImg, calendarButtonImg].forEach(img => {
            img.onerror = () => console.error(`Failed to load image: ${img.src}`);
        });
    }

    // Extend the applyTheme function to update images
    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        updateImagesForTheme(theme);
    }

    // Call updateImagesForTheme when the page loads to set the initial images
    document.addEventListener('DOMContentLoaded', () => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        applyTheme(savedTheme);
    });

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
    const newTaskInput = document.getElementById('new-task-input');

    let tasks = [];
    let completedTasks = 0;

    progressCircle.addEventListener('click', () => {
        taskList.classList.toggle('hidden');
        if (!taskList.classList.contains('hidden')) {
            const userA = localStorage.getItem('username'); // Current logged-in user
            const userB = activeReceiver; // The user currently being chatted with

            if (userA && userB) {
                console.log('Refreshing tasks for:', { userA, userB }); // Debugging log
                fetchTasks(userA, userB); // Refresh tasks from the database
            } else {
                console.error('Cannot refresh tasks. Missing users:', { userA, userB });
            }
        }
    });

    document.getElementById('add-task-button').addEventListener('click', () => {
        const taskInput = document.getElementById('new-task-input');
        const taskText = taskInput.value.trim();
        const userA = localStorage.getItem('username'); // Assuming the task creator is the logged-in user
        const userB = activeReceiver; // Assuming the task is assigned to the active receiver

        if (taskText && userA && userB) {
            const taskData = { task: taskText, userA, userB };
            console.log('Sending task data to server:', taskData); // Debugging log

            fetch(`http://localhost:3000/chatDB/tasks`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-logged-in-user': userA // Send the logged-in user in the headers
                },
                body: JSON.stringify(taskData)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    console.log('Task added successfully:', data); // Debugging log
                    const taskList = document.getElementById('task-items');
                    const taskItem = document.createElement('li');
                    taskItem.classList.add('task-item'); // Add a class for styling
                    taskItem.textContent = taskText;

                    // Add checkbox
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = false;
                    checkbox.style.position = 'absolute';
                    checkbox.style.right = '40px'; // Position the checkbox to the right of the task name
                    checkbox.addEventListener('change', () => {
                        const isCompleted = checkbox.checked;
                        const taskIndex = tasks.findIndex(t => t.id === data.task.id);
                        if (taskIndex !== -1) {
                            tasks[taskIndex].status = isCompleted ? 'completed' : 'not complete';
                        }
                        completedTasks = tasks.filter(t => t.status === 'completed').length;
                        updateProgress();
                    });

                    // Add delete button
                    const deleteButton = document.createElement('button');
                    deleteButton.innerHTML = '&times;'; // "x" symbol
                    deleteButton.classList.add('delete-task-button');
                    deleteButton.style.width = '20px'; // Smaller width
                    deleteButton.style.height = '20px'; // Smaller height
                    deleteButton.style.fontSize = '12px'; // Smaller font size
                    deleteButton.addEventListener('click', () => deleteTask(userA, userB, data.task.id, taskItem));

                    taskItem.appendChild(checkbox);
                    taskItem.appendChild(deleteButton);
                    taskItem.style.position = 'relative'; // Ensure proper positioning
                    taskList.appendChild(taskItem);

                    // Add the new task to the global tasks array
                    tasks.push({ id: data.task.id, task: taskText, status: 'not complete' });

                    // If the checkbox is checked immediately, update the completed tasks count
                    if (checkbox.checked) {
                        completedTasks++;
                    }

                    updateProgress(); // Update progress dynamically
                    taskInput.value = ''; // Clear the input field
                } else {
                    console.error('Failed to add task:', data.message); // Debugging log
                    alert('Failed to add task.');
                }
            })
            .catch(error => console.error('Error adding task:', error));
        } else {
            console.error('Task text, userA, and userB are required:', { taskText, userA, userB }); // Debugging log
            alert('Task text, userA, and userB are required.');
        }
    });

    newTaskInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            addTaskButton.click();
        }
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

    function fetchTasks(userA, userB) {
        fetch(`http://localhost:3000/chatDB/tasks?userA=${encodeURIComponent(userA)}&userB=${encodeURIComponent(userB)}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    console.log('Tasks fetched successfully:', data.tasks); // Debugging log
                    const taskList = document.getElementById('task-items');
                    taskList.innerHTML = ''; // Clear the existing task list
                    tasks = data.tasks; // Update the global tasks array
                    completedTasks = tasks.filter(task => task.status === 'completed').length; // Count completed tasks
                    updateProgress(); // Update the progress percentage

                    data.tasks.forEach(task => {
                        const taskItem = document.createElement('li');
                        taskItem.classList.add('task-item'); // Add a class for styling
                        taskItem.textContent = task.task;

                        // Add checkbox
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.checked = task.status === 'completed';
                        checkbox.style.position = 'absolute';
                        checkbox.style.right = '40px'; // Position the checkbox to the right of the task name
                        checkbox.addEventListener('change', () => {
                            task.status = checkbox.checked ? 'completed' : 'not complete';
                            completedTasks = tasks.filter(t => t.status === 'completed').length;
                            updateProgress();

                            // Update the task status in the database
                            fetch(`http://localhost:3000/chatDB/tasks/${task.id}/status`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: task.status })
                            })
                            .then(res => res.json())
                            .then(data => {
                                if (data.success) {
                                    console.log('Task status updated successfully:', data);
                                } else {
                                    console.error('Failed to update task status:', data.message);
                                }
                            })
                            .catch(error => console.error('Error updating task status:', error));
                        });

                        // Add delete button
                        const deleteButton = document.createElement('button');
                        deleteButton.innerHTML = '&times;'; // "x" symbol
                        deleteButton.classList.add('delete-task-button');
                        deleteButton.style.width = '20px'; // Smaller width
                        deleteButton.style.height = '20px'; // Smaller height
                        deleteButton.style.fontSize = '12px'; // Smaller font size
                        deleteButton.addEventListener('click', () => deleteTask(userA, userB, task.id, taskItem));

                        taskItem.appendChild(checkbox);
                        taskItem.appendChild(deleteButton);
                        taskItem.style.position = 'relative'; // Ensure proper positioning
                        taskList.appendChild(taskItem);
                    });
                } else {
                    console.error('Failed to fetch tasks:', data.message); // Debugging log
                    alert('Failed to fetch tasks.');
                }
            })
            .catch(error => console.error('Error fetching tasks:', error));
    }

    function updateProgress() {
        const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
        progressPercentage.textContent = `${progress}%`;
        progressCircle.style.background = `conic-gradient(var(--sent-bg) 0% ${progress}%, var(--received-bg) ${progress}% 100%)`;
        progressCircle.style.transition = 'background 0.3s ease-in-out';
    }

    function deleteTask(userA, userB, taskId, taskElement) {
        if (confirm('Are you sure you want to delete this task?')) {
            fetch(`http://localhost:3000/chatDB/tasks/${taskId}?userA=${encodeURIComponent(userA)}&userB=${encodeURIComponent(userB)}`, {
                method: 'DELETE'
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        console.log('Task deleted successfully:', data); // Debugging log

                        // Check if the task was completed before deletion
                        const checkbox = taskElement.querySelector('input[type="checkbox"]');
                        if (checkbox && checkbox.checked) {
                            completedTasks--; // Decrement completed tasks
                        }

                        tasks = tasks.filter(task => task.id !== taskId); // Remove the task from the global array
                        updateProgress(); // Update the progress percentage
                        taskElement.remove(); // Remove the task from the UI
                    } else {
                        console.error('Failed to delete task:', data.message); // Debugging log
                        alert('Failed to delete task.');
                    }
                })
                .catch(error => console.error('Error deleting task:', error));
        }
    }

    // Listen for fetchTasks event and refresh the task list
    socket.on('fetchTasks', ({ userA, userB }) => {
        const loggedInUser = localStorage.getItem('username');
        if (loggedInUser === userA || loggedInUser === userB) {
            console.log('fetchTasks event received. Refreshing task list for:', { userA, userB }); // Debugging log
            fetchTasks(userA, userB);
        }
    });

    // Listen for task updates
    socket.on('taskAdded', (task) => {
        console.log('Task added event received:', task); // Debugging log

        const taskList = document.getElementById('task-items');
        const taskItem = document.createElement('li');
        taskItem.textContent = task.task;
        taskList.appendChild(taskItem);
    });

    socket.on('taskDeleted', (taskId) => {
        const taskList = document.getElementById('task-items');
        const taskItems = taskList.getElementsByTagName('li');
        for (let item of taskItems) {
            if (item.querySelector('input').dataset.taskId == taskId) {
                taskList.removeChild(item);
                break;
            }
        }
    });

    socket.on('taskStatusUpdated', (data) => {
        const { taskId, status } = data;
        const taskList = document.getElementById('task-items');
        const taskItems = taskList.getElementsByTagName('li');
        for (let item of taskItems) {
            if (item.querySelector('input').dataset.taskId == taskId) {
                item.querySelector('input').checked = (status === 'completed');
                break;
            }
        }
    });

    socket.on('fetchTasks', ({ userA, userB }) => {
        fetchTasks(userA, userB);
    });

    // Emit joinChat event when a chat is opened
    document.addEventListener('DOMContentLoaded', () => {
        const userA = localStorage.getItem('username');
        const userB = activeReceiver;
        if (userA && userB) {
            console.log(`Joining chat room for users: ${userA}, ${userB}`); // Debugging log
            socket.emit('joinChat', { userA, userB });
            fetchTasks(userA, userB);
        }
    });

    // Call fetchTasks when a chat is opened
    document.addEventListener('DOMContentLoaded', () => {
        const userA = localStorage.getItem('username');
        const userB = activeReceiver;
        if (userA && userB) {
            socket.emit('joinChat', { userA, userB });
            fetchTasks(userA, userB);
        }
    });

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
                        if (user.username === username) return; // Skip adding the current user
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
        const existingChatItem = Array.from(chatList.children).find(chat =>
            chat.querySelector('div > div:first-child').textContent.trim() === username
        );

        if (existingChatItem) {
            // Update the profile picture if the chat already exists
            const profilePicture = getOrGenerateProfilePictureForUser(username);
            const profileImage = existingChatItem.querySelector('img');
            if (profileImage) {
                profileImage.src = profilePicture;
            }
            return;
        }

        const chatItem = document.createElement('div');
        chatItem.classList.add('chat-list-item');
        const profilePicture = getOrGenerateProfilePictureForUser(username); // Get or generate the profile picture
        chatItem.innerHTML = `
            <img src="${profilePicture}" alt="User" width="40" height="40">
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
            const profilePicture = getOrGenerateProfilePictureForUser(username); // Get or generate the profile picture
            chatHeaderProfilePicture.src = profilePicture; // Update the chat header profile picture
            toggleChatScreen(true); // Show the chat screen
            loadMessages(username); // Fetch and display previous messages
            socket.emit('joinChat', { userA: username, userB: username }); // Emit joinChat event
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
                    // Filter out "Chat started" messages
                    const lastMessage = data.messages.reverse().find(message => !message.message.startsWith('Chat started:'));
                    if (lastMessage) {
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
        return fetch(`http://localhost:3000/user-chats?username=${encodeURIComponent(username)}`)
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
    fetchChatList().then(() => {
        initializeUnreadCounts();
    });

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

                    // Use the `createdAt` timestamp of the first message for the chat start time
                    const chatStartedTime = data.messages.length > 0 
                        ? new Date(data.messages[0].createdAt) 
                        : null;

                    // Add "Chat started: date, time" message at the top if a start time exists
                    if (chatStartedTime) {
                        const chatStartedElement = document.createElement('div');
                        chatStartedElement.classList.add('chat-started');
                        chatStartedElement.textContent = `Chat started: ${chatStartedTime.toLocaleString()}`;
                        messagesContainer.appendChild(chatStartedElement);
                    }

                    // Add only actual messages, skipping the initial "Chat started" message
                    data.messages.forEach(message => {
                        if (!message.message.startsWith('Chat started:')) { // Skip initial message
                            const messageElement = document.createElement('div');
                            messageElement.classList.add('message', message.sender === username ? 'received' : 'sent');
                            const messageBubble = document.createElement('div');
                            messageBubble.classList.add('message-bubble');
                            messageBubble.textContent = message.message;
                            messageElement.appendChild(messageBubble);
                            messagesContainer.appendChild(messageElement);
                        }
                    });
                    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to the bottom

                    // Reset unread count for the active chat
                    localStorage.setItem(`unread_${username}`, '0');
                    updateUnreadCount(username, 0);
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

    const uploadProfilePictureInput = document.getElementById('upload-profile-picture');
    const uploadedProfilePicture = document.getElementById('uploaded-profile-picture');
    const chatHeaderProfilePicture = document.getElementById('chat-header-profile-picture');

    // Load the saved profile picture for the logged-in user
    const savedProfilePicture = localStorage.getItem(`profilePicture_${username}`);
    if (savedProfilePicture) {
        uploadedProfilePicture.src = savedProfilePicture;
        sidebarFooterImage.src = savedProfilePicture;
    }

    uploadProfilePictureInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageUrl = e.target.result;

                // Update the profile picture in the settings modal
                uploadedProfilePicture.src = imageUrl;

                // Update the profile picture in the sidebar
                sidebarFooterImage.src = imageUrl;

                // Save the uploaded image URL to localStorage for the logged-in user
                localStorage.setItem(`profilePicture_${username}`, imageUrl);

                // Update the profile picture in the sidebar chat list if the user is present
                updateSidebarProfilePicture(username, imageUrl);
            };
            reader.readAsDataURL(file);
        }
    });

    function updateSidebarProfilePicture(user, imageUrl) {
        // Find the chat item for the user in the sidebar
        const chatItem = Array.from(chatList.children).find(chat =>
            chat.querySelector('div > div:first-child').textContent.trim() === user
        );

        if (chatItem) {
            const profileImage = chatItem.querySelector('img');
            if (profileImage) {
                profileImage.src = imageUrl; // Update the profile picture
            }
        }
    }

    function getOrGenerateProfilePictureForUser(user) {
        // Check if a profile picture is saved for the user
        const savedPicture = localStorage.getItem(`profilePicture_${user}`);
        if (savedPicture) {
            return savedPicture; // Return the saved profile picture
        }

        // Generate a new profile picture and save it
        const newPicture = generateProfilePicture(user);
        localStorage.setItem(`profilePicture_${user}`, newPicture);
        return newPicture;
    }

    function addChatToSidebar(username) {
        // Check if the chat already exists in the sidebar
        const existingChatItem = Array.from(chatList.children).find(chat =>
            chat.querySelector('div > div:first-child').textContent.trim() === username
        );

        if (existingChatItem) {
            // Update the profile picture if the chat already exists
            const profilePicture = getOrGenerateProfilePictureForUser(username);
            const profileImage = existingChatItem.querySelector('img');
            if (profileImage) {
                profileImage.src = profilePicture;
            }
            return;
        }

        const chatItem = document.createElement('div');
        chatItem.classList.add('chat-list-item');
        const profilePicture = getOrGenerateProfilePictureForUser(username); // Get or generate the profile picture
        chatItem.innerHTML = `
            <img src="${profilePicture}" alt="User" width="40" height="40">
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
            const profilePicture = getOrGenerateProfilePictureForUser(username); // Get or generate the profile picture
            chatHeaderProfilePicture.src = profilePicture; // Update the chat header profile picture
            toggleChatScreen(true); // Show the chat screen
            loadMessages(username); // Fetch and display previous messages
        });
        chatList.appendChild(chatItem);

        // Fetch the last message for this chat
        fetchLastMessage(username, chatItem);
    }

    function initializeUnreadCounts() {
        Array.from(chatList.children).forEach(chatItem => {
            const username = chatItem.querySelector('div > div:first-child').textContent.trim();
            const unreadCount = parseInt(localStorage.getItem(`unread_${username}`) || '0', 10);
            updateUnreadCount(username, unreadCount);
        });
    }

    function filterChatsByUnread() {
        Array.from(chatList.children).forEach(chatItem => {
            const username = chatItem.querySelector('div > div:first-child').textContent.trim();
            const unreadCount = parseInt(localStorage.getItem(`unread_${username}`) || '0', 10);
            chatItem.style.display = unreadCount > 0 ? 'flex' : 'none'; // Show only chats with unread messages
        });
    }

    function showAllChats() {
        Array.from(chatList.children).forEach(chatItem => {
            chatItem.style.display = 'flex'; // Show all chats
        });
    }

    const infoButton = document.getElementById('info-button');
    infoButton.addEventListener('click', () => {
        if (activeReceiver) {
            const profilePicture = getOrGenerateProfilePictureForUser(activeReceiver);
            const filesSent = JSON.parse(localStorage.getItem(`files_${activeReceiver}`) || '[]');
            openInfoPopup(activeReceiver, profilePicture, filesSent);
        } else {
            alert('No active chat selected.');
        }
    });

    // Reuse the existing cameraButton variable
        cameraButton.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.click();
    
            fileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    alert(`Selected file: ${file.name}`);
                    const files = JSON.parse(localStorage.getItem(`files_${activeReceiver}`) || '[]');
                    files.push(file.name);
                    localStorage.setItem(`files_${activeReceiver}`, JSON.stringify(files));
                }
            });
        });

    // Update event listeners for the "Unread" and "All" pins
    document.querySelectorAll('.pin-text-sidebar').forEach(pin => {
        pin.addEventListener('click', (event) => {
            if (event.target.textContent === 'Unread') {
                filterChatsByUnread();
            } else if (event.target.textContent === 'All') {
                showAllChats();
            }
        });
    });

    // ==========================
    // 🔍 CHAT SEARCH LOGIC
    // ==========================
    // Ensure these variables are defined and point to the correct elements
    // 🔍 Setup search functionality
    const topSearchButton = document.getElementById('top-search-button');
    const chatSearchModal = document.getElementById('chat-search-modal');
    const chatSearchInput = document.getElementById('chat-search-input');
    const chatSearchResults = document.getElementById('chat-search-results');
    const closeChatSearch = document.getElementById('close-chat-search');

    topSearchButton.addEventListener('click', () => {
        chatSearchModal.classList.remove('hidden');
        chatSearchModal.style.display = 'block';
        chatSearchInput.focus();
    });

    closeChatSearch.addEventListener('click', () => {
        chatSearchModal.classList.add('hidden');
        chatSearchModal.style.display = 'none';
        chatSearchInput.value = '';
        chatSearchResults.innerHTML = '';
    });

    chatSearchInput.addEventListener('input', () => {
        const searchTerm = chatSearchInput.value.toLowerCase();
        chatSearchResults.innerHTML = '';

        if (!searchTerm || !messagesContainer) return;

        const messageBubbles = messagesContainer.querySelectorAll('.message-bubble');

        messageBubbles.forEach((bubble) => {
            if (bubble.textContent.toLowerCase().includes(searchTerm)) {
                const resultItem = document.createElement('li');
                resultItem.textContent = bubble.textContent;

                resultItem.addEventListener('click', () => {
                    bubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    bubble.classList.add('highlight');
                    setTimeout(() => bubble.classList.remove('highlight'), 2000);
                    chatSearchModal.classList.add('hidden');
                    chatSearchModal.style.display = 'none';
                    chatSearchInput.value = '';
                    chatSearchResults.innerHTML = '';
                });

                chatSearchResults.appendChild(resultItem);
            }
        });
    });
    // ========== 🔍 SIDEBAR CHAT LIST SEARCH ==========
    const sidebarSearchInput = document.getElementById('sidebar-search');

    sidebarSearchInput.addEventListener('input', () => {
        const query = sidebarSearchInput.value.toLowerCase();

        Array.from(chatList.children).forEach(chatItem => {
            const username = chatItem.querySelector('div > div:first-child')?.textContent.toLowerCase() || '';
            const lastMessage = chatItem.querySelector('.last-message')?.textContent.toLowerCase() || '';

            const matches = username.includes(query) || lastMessage.includes(query);
            chatItem.style.display = matches ? 'flex' : 'none';
        });
    });
});