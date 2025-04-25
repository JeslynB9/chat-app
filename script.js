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

function openInfoPopup(username, profilePicture, files) {
    // Remove any existing popups first
    const existingPopup = document.querySelector('.info-popup');
    const existingOverlay = document.querySelector('.popup-overlay');
    if (existingPopup) existingPopup.remove();
    if (existingOverlay) existingOverlay.remove();

    // Create new overlay
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    document.body.appendChild(overlay);

    // Create new popup
    const popup = document.createElement('div');
    popup.className = 'info-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <button class="close-button">&times;</button>
            <div class="user-info">
                <img id="popup-profile-picture" src="${profilePicture || 'default-avatar.jpg'}" alt="Profile Picture">
                <h3 id="popup-username">${username || 'N/A'}</h3>
            </div>
            <div class="files-section">
                <h4>Files Sent</h4>
                <ul id="popup-files">
                    ${files && files.length > 0 
                        ? files.map(file => `<li>${file}</li>`).join('') 
                        : '<li>No files sent.</li>'}
                </ul>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    // Add event listeners
    const closeButton = popup.querySelector('.close-button');
    closeButton.addEventListener('click', () => {
        popup.remove();
        overlay.remove();
    });

    overlay.addEventListener('click', () => {
        popup.remove();
        overlay.remove();
    });
}

function closeInfoPopup() {
    const popup = document.getElementById('info-popup');
    popup.style.display = 'none';
}

function displayPinMessagesPopup(pinId, messages) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    popup.className = 'pin-messages-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <button class="close-button">&times;</button>
            <h3>Messages for Pin: ${pinId}</h3>
            <ul class="messages-list">
                ${messages.map(msg => `
                    <li>
                        <strong>${msg.sender}:</strong> ${msg.message}
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
    document.body.appendChild(popup);

    // Add event listener to close the popup
    popup.querySelector('.close-button').addEventListener('click', () => {
        popup.remove();
        overlay.remove();
    });

    // Close the popup when clicking on the overlay
    overlay.addEventListener('click', () => {
        popup.remove();
        overlay.remove();
    });
}

// Add CSS for the popup
const pinMessagesPopupStyle = document.createElement('style');
pinMessagesPopupStyle.textContent = `
    .pin-messages-popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: var(--bg-color);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1001;
        padding: 20px;
        width: 400px;
        max-height: 80%;
        overflow-y: auto;
    }

    .pin-messages-popup .popup-content {
        position: relative;
    }

    .pin-messages-popup .close-button {
        position: absolute;
        top: -100px; /* Position at the top */
        right: 10px; /* Position at the right */
        background: none;
        border: none;
        font-size: 1.2rem;
        cursor: pointer;
        color: var(--text-color);
    }

    .pin-messages-popup .messages-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .pin-messages-popup .messages-list li {
        margin-bottom: 10px;
        padding: 5px;
        border-bottom: 1px solid var(--border-color);
    }

    .popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 1000;
    }
`;
document.head.appendChild(pinMessagesPopupStyle);

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

                        // Append the sent message to the UI immediately
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
            console.warn('activeReceiver missing during message send/receive.');
            return;
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
        if (data.sender === username || data.receiver === username) {
            // Update the last message in the sidebar
            const displayText = data.type === 'file' ? `[${data.fileData.name}]` : data.message;
            const displaySender = data.sender === username ? "You" : data.sender;
            updateLastMessageInSidebar(data.sender === username ? data.receiver : data.sender, displayText, displaySender, data.timestamp);

            // Only display the message if it's in the current chat
            if ((data.sender === activeReceiver || data.receiver === activeReceiver) && data.sender !== username) {
                try {
                    const messageElement = document.createElement('div');
                    messageElement.className = `message received`;

                    if (data.type === 'file') {
                        let fileData = data.fileData;
                        // Try to parse the message if it's a string
                        if (typeof data.message === 'string' && data.message.startsWith('{')) {
                            try {
                                const parsedMessage = JSON.parse(data.message);
                                if (parsedMessage.type === 'file') {
                                    fileData = parsedMessage.fileData;
                                }
                            } catch (e) {
                                console.error('Error parsing file message:', e);
                            }
                        }

                        const fileContainer = document.createElement('div');
                        fileContainer.className = 'file-container';

                        // Add file icon
                        const icon = document.createElement('div');
                        icon.className = 'file-icon';
                        icon.textContent = getFileIcon(fileData.type);
                        fileContainer.appendChild(icon);

                        // Add file info
                        const info = document.createElement('div');
                        info.className = 'file-info';

                        const name = document.createElement('div');
                        name.className = 'file-name';
                        name.textContent = fileData.name;
                        info.appendChild(name);

                        const size = document.createElement('div');
                        size.className = 'file-size';
                        size.textContent = formatFileSize(fileData.size);
                        info.appendChild(size);

                        fileContainer.appendChild(info);

                        // Add download link if URL is available
                        if (fileData.url) {
                            const downloadLink = document.createElement('a');
                            downloadLink.href = fileData.url;
                            downloadLink.download = fileData.name;
                            downloadLink.className = 'download-button';
                            downloadLink.textContent = '⬇️';
                            fileContainer.appendChild(downloadLink);
                        }

                        messageElement.appendChild(fileContainer);
                    } else {
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
                        messageBubble.textContent = data.message || '';
            messageElement.appendChild(messageBubble);
        }

                    // Add timestamp
                    const timestamp = document.createElement('span');
                    timestamp.className = 'timestamp';
                    timestamp.textContent = new Date(data.timestamp).toLocaleTimeString();
                    messageElement.appendChild(timestamp);

                    // Add to messages container
                    const messagesContainer = document.querySelector('.messages');
                    if (messagesContainer) {
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                } catch (error) {
                    console.error('Error displaying message:', error);
                }
            }
        }

        // Handle unread messages
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

    socket.on('messageSaved', ({ sender, receiver }) => {
        const username = localStorage.getItem('username');
        if (username === sender || username === receiver) {
            if (activeReceiver === sender || activeReceiver === receiver) {
                // Refetch messages for the active chat
                loadMessages(activeReceiver);
            }
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
        fileInput.accept = '*/*';
        fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        };
    });

    function getFileIcon(fileType) {
        if (fileType.startsWith('image/')) return '🖼️';
        if (fileType.startsWith('video/')) return '🎥';
        if (fileType.startsWith('audio/')) return '🎵';
        if (fileType === 'application/pdf') return '📄';
        if (fileType.includes('document') || fileType.includes('msword')) return '📝';
        if (fileType.includes('spreadsheet') || fileType.includes('excel')) return '📊';
        if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📊';
        if (fileType.includes('zip') || fileType.includes('compressed')) return '🗜️';
        return '📎';
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function handleFileUpload(file) {
            if (!activeReceiver) {
            alert('Please select a chat before uploading a file.');
                return;
            }
    
            const formData = new FormData();
            formData.append('uploader', username);
            formData.append('receiver', activeReceiver);
            formData.append('file', file); // ← move this last
    
        fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const fileData = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    url: data.url  // Use the URL from the response
                };
    
                const messageData = {
                    type: 'file',
                    fileData: fileData,
                    sender: username,
                    receiver: activeReceiver,
                    timestamp: Date.now()
                };
    
                // Emit the message via Socket.IO
                // socket.emit('sendMessage', messageData);
    
                // Display the message in UI
                const messageElement = document.createElement('div');
                messageElement.className = 'message sent';
    
                const fileContainer = document.createElement('div');
                fileContainer.className = 'file-container';
    
                const icon = document.createElement('div');
                icon.className = 'file-icon';
                icon.textContent = getFileIcon(fileData.type);
                fileContainer.appendChild(icon);
    
                const info = document.createElement('div');
                info.className = 'file-info';
    
                const name = document.createElement('div');
                name.className = 'file-name';
                name.textContent = fileData.name;
                info.appendChild(name);
    
                const size = document.createElement('div');
                size.className = 'file-size';
                size.textContent = formatFileSize(fileData.size);
                info.appendChild(size);
    
                fileContainer.appendChild(info);
    
                // Add download link
                const downloadLink = document.createElement('a');
                downloadLink.href = fileData.url;
                downloadLink.download = fileData.name;
                downloadLink.className = 'download-button';
                downloadLink.textContent = '⬇️';
                fileContainer.appendChild(downloadLink);
    
                messageElement.appendChild(fileContainer);
    
                const timestamp = document.createElement('span');
                timestamp.className = 'timestamp';
                timestamp.textContent = new Date(messageData.timestamp).toLocaleTimeString();
                messageElement.appendChild(timestamp);
    
                const messagesContainer = document.querySelector('.messages');
                messagesContainer.appendChild(messageElement);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                updateLastMessageInSidebar(activeReceiver, `[${file.name}]`, "You", messageData.timestamp);
            } else {
                console.error('Upload failed:', data.error);
                alert('Failed to upload file: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Upload error:', error);
            alert('Upload failed. Please try again.');
        });
    }

    function displayMessage(message, isSent = false) {
        const messageContainer = document.createElement('div');
        messageContainer.className = `message ${isSent ? 'sent' : 'received'}`;
        messageContainer.dataset.messageId = message.id;

        try {
            if (message.type === 'file') {
                const fileData = message.fileData;
                
                if (fileData.type.startsWith('image/')) {
                    // Handle image files
                    const img = document.createElement('img');
                    img.src = fileData.data;
                    img.alt = fileData.name;
                    img.style.maxWidth = '200px';
                    img.style.borderRadius = '8px';
                    img.style.cursor = 'pointer';
                    img.onclick = () => window.open(fileData.data, '_blank');
                    messageContainer.appendChild(img);
                } else {
                    // Handle other file types
                    const fileContainer = document.createElement('div');
                    fileContainer.className = 'file-container';

                    const icon = document.createElement('div');
                    icon.className = 'file-icon';
                    icon.textContent = getFileIcon(fileData.type);
                    fileContainer.appendChild(icon);

                    const info = document.createElement('div');
                    info.className = 'file-info';

                    const name = document.createElement('div');
                    name.className = 'file-name';
                    name.textContent = fileData.name;
                    info.appendChild(name);

                    const size = document.createElement('div');
                    size.className = 'file-size';
                    size.textContent = formatFileSize(fileData.size);
                    info.appendChild(size);

                    fileContainer.appendChild(info);

                    const downloadLink = document.createElement('a');
                    downloadLink.href = fileData.data;
                    downloadLink.download = fileData.name;
                    downloadLink.className = 'download-button';
                    downloadLink.textContent = '⬇️';
                    fileContainer.appendChild(downloadLink);

                    messageContainer.appendChild(fileContainer);
                }
            } else {
                // Handle text messages
                const messageBubble = document.createElement('div');
                messageBubble.classList.add('message-bubble');
                messageBubble.textContent = message.message || '';
                messageContainer.appendChild(messageBubble);
            }

            // Add timestamp
            const timestamp = document.createElement('span');
            timestamp.className = 'timestamp';
            timestamp.textContent = new Date(message.timestamp).toLocaleTimeString();
            messageContainer.appendChild(timestamp);

            // Add context menu event listener
            messageContainer.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showMessageContextMenu(e, messageContainer, message);
            });

            // Add to messages container
            const messagesContainer = document.querySelector('.messages');
            if (messagesContainer) {
                messagesContainer.appendChild(messageContainer);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        } catch (error) {
            console.error('Error displaying message:', error);
        }
    }

    // Function to show message context menu
    function showMessageContextMenu(event, messageContainer, message) {
        // Remove any existing context menu
        const existingMenu = document.querySelector('.message-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'message-context-menu';
        contextMenu.innerHTML = `
            <div class="context-menu-option" data-action="pin">📌 Pin Message</div>
            <div class="context-menu-option" data-action="copy">📋 Copy Message</div>
            <div class="context-menu-option" data-action="delete">🗑️ Delete Message</div>
        `;

        // Position the menu at the cursor position
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;
        contextMenu.style.zIndex = '1000';
        document.body.appendChild(contextMenu);

        // Add event listeners for menu options
        contextMenu.querySelectorAll('.context-menu-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = e.target.dataset.action;
                handleMessageAction(action, message, messageContainer);
                contextMenu.remove();
            });
        });

        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target) && e.target !== messageContainer) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }

    // Function to handle message actions
    function handleMessageAction(action, message, messageContainer) {
        switch (action) {
            case 'pin':
                pinMessage(message);
                break;
            case 'copy':
                copyMessage(message.message);
                break;
            case 'delete':
                deleteMessage(message, messageContainer);
                break;
        }
    }

    // Function to pin a message
    function pinMessage(message) {
        const userA = localStorage.getItem('username');
        const userB = activeReceiver;
        const pinId = prompt('Enter a name for this pin:');
        
        if (pinId) {
            fetch('http://localhost:3000/chatDB/pins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pinId,
                    messageId: message.id,
                    userA,
                    userB
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert('Message pinned successfully!');
                } else {
                    alert('Failed to pin message: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error pinning message:', error);
                alert('Failed to pin message');
            });
        }
    }

    // Function to copy message text
    function copyMessage(text) {
        navigator.clipboard.writeText(text)
            .then(() => {
                alert('Message copied to clipboard!');
            })
            .catch(error => {
                console.error('Error copying message:', error);
                alert('Failed to copy message');
            });
    }

    // Function to delete a message
    function deleteMessage(message, messageContainer) {
        if (confirm('Are you sure you want to delete this message?')) {
            fetch(`http://localhost:3000/messages/${message.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    messageContainer.remove();
                    // Emit socket event to notify other users
                    socket.emit('messageDeleted', {
                        messageId: message.id,
                        userA: localStorage.getItem('username'),
                        userB: activeReceiver
                    });
                } else {
                    alert('Failed to delete message: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error deleting message:', error);
                alert('Failed to delete message');
            });
        }
    }

    // Add CSS for the message context menu
    const messageContextMenuStyle = document.createElement('style');
    messageContextMenuStyle.textContent = `
        .message-context-menu {
            position: fixed;
            background-color: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 1000;
            min-width: 150px;
            padding: 4px 0;
        }

        .message-context-menu .context-menu-option {
            padding: 8px 12px;
            cursor: pointer;
            transition: background-color 0.2s;
            color: var(--text-color);
        }

        .message-context-menu .context-menu-option:hover {
            background-color: var(--hover-color);
        }

        .message {
            cursor: context-menu;
            user-select: none;
        }
    `;
    document.head.appendChild(messageContextMenuStyle);

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

    // Add event listener for pin clicks
    document.querySelector('.pins-container').addEventListener('click', (event) => {
        const pinElement = event.target.closest('.pin');
        if (!pinElement) return;

        const pinId = pinElement.querySelector('.pin-text').textContent.trim();
        const userA = localStorage.getItem('username'); // Current logged-in user
        const userB = activeReceiver; // The user currently being chatted with

        if (!userA || !userB || !pinId) {
            console.error('Missing userA, userB, or pinId:', { userA, userB, pinId });
            return;
        }

        // Fetch messages attached to the pin
        fetch(`http://localhost:3000/chatDB/pins/messages?userA=${encodeURIComponent(userA)}&userB=${encodeURIComponent(userB)}&pinId=${encodeURIComponent(pinId)}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    displayPinMessagesPopup(pinId, data.messages);
                } else {
                    console.error('Failed to fetch messages for pin:', data.message);
                    alert('Failed to fetch messages for this pin.');
                }
            })
            .catch(error => console.error('Error fetching messages for pin:', error));
    });

    // Function to display the popup with messages
    function displayPinMessagesPopup(pinId, messages) {
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        document.body.appendChild(overlay);

        const popup = document.createElement('div');
        popup.className = 'pin-messages-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <button class="close-button">&times;</button>
                <h3>Messages for Pin: ${pinId}</h3>
                <ul class="messages-list">
                    ${messages.map(msg => `
                        <li>
                            <strong>${msg.sender}:</strong> ${msg.message}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
        document.body.appendChild(popup);

        // Add event listener to close the popup
        popup.querySelector('.close-button').addEventListener('click', () => {
            popup.remove();
            overlay.remove();
        });

        // Close the popup when clicking on the overlay
        overlay.addEventListener('click', () => {
            popup.remove();
            overlay.remove();
        });
    }

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
            const pinElement = event.target.parentElement;
            const pinText = pinElement.querySelector('.pin-text-sidebar').textContent;

            // Prevent deletion of "All" and "Unread" pins
            if (pinText === "All" || pinText === "Unread") {
                alert("This pin cannot be deleted.");
                return;
            }

            pinElement.remove();
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

                            // Update the task status in the database and notify other users
                            updateTaskStatus(task.id, task.status, userA, userB);
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
                        socket.emit('taskDeleted', { taskId, userA, userB }); // Notify other users
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
    // Removed duplicate declaration of chatList
    let activeChat = null;
    const chatHeaderName = document.querySelector('.main-chat-header div > div:first-child'); // Select the header name element
    const chatHeaderUsername = document.getElementById('chat-header-username'); // Select the username element in the chat header
    const noChatPlaceholder = document.getElementById('no-chat-placeholder');
    const chatScreen = document.getElementById('chat-screen');
    const inputArea = document.getElementById('main-chat-footer'); // Correctly select the footer containing the input area

    function updateLastMessageInSidebar(username, message, sender, timestamp) {
        const chatItem = Array.from(chatList.children).find(chat =>
            chat.querySelector('div > div:first-child').textContent.trim() === username
        );

        if (chatItem) {
            const lastMessageElement = chatItem.querySelector('.last-message');
            const lastMessageTimeElement = chatItem.querySelector('.last-message-time');
            const displaySender = sender === localStorage.getItem('username') ? "You" : sender;

            // Update the last message and timestamp
            lastMessageElement.textContent = `${displaySender}: ${message}`;
            lastMessageTimeElement.textContent = formatTimestamp(timestamp);
            chatItem.setAttribute('data-last-timestamp', timestamp);

            reorderChatList(); // Reorder the chat list after updating the timestamp
        }
    }

    function fetchLastMessage(username, chatItem) {
        const sender = localStorage.getItem('username'); // Current logged-in user
        const receiver = username;

        fetch(`http://localhost:3000/messages?sender=${encodeURIComponent(sender)}&receiver=${encodeURIComponent(receiver)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.messages.length > 0) {
                    // Get the most recent message
                    const lastMessage = data.messages[data.messages.length - 1];
                    const lastMessageElement = chatItem.querySelector('.last-message');
                    const lastMessageTimeElement = chatItem.querySelector('.last-message-time');
                    const displaySender = lastMessage.sender === sender ? "You" : lastMessage.sender;

                    // Update the last message and timestamp
                    lastMessageElement.textContent = `${displaySender}: ${lastMessage.message}`;
                    lastMessageTimeElement.textContent = formatTimestamp(new Date(lastMessage.createdAt).getTime());
                    chatItem.setAttribute('data-last-timestamp', new Date(lastMessage.createdAt).getTime());

                    reorderChatList(); // Reorder the chat list after updating the timestamp
                } else {
                    // Handle case where no messages exist
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
        const profilePicture = getOrGenerateProfilePictureForUser(username);
        chatItem.innerHTML = `
            <img src="${profilePicture}" alt="User" width="40" height="40">
            <div>
                <div>${username}</div>
                <div class="last-message">Loading...</div>
            </div>
            <div class="last-message-time">Loading...</div>
        `;
        chatItem.setAttribute('data-last-timestamp', 0);
        
        // Add click event for selecting chat
        chatItem.addEventListener('click', () => {
            highlightSelectedChat(chatItem);
            activeReceiver = username;
            chatHeaderUsername.textContent = username;
            const profilePicture = getOrGenerateProfilePictureForUser(username);
            chatHeaderProfilePicture.src = profilePicture;
            toggleChatScreen(true);
            loadMessages(username);
        });

        // Add context menu event
        chatItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const contextMenu = document.getElementById('chat-context-menu');
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.pageX}px`;
            contextMenu.style.top = `${e.pageY}px`;
            contextMenu.dataset.username = username;
            
            // Update pin option text based on current state
            const pinOption = contextMenu.querySelector('[data-action="pin"]');
            if (chatItem.classList.contains('pinned')) {
                pinOption.innerHTML = '📌 Unpin Chat';
            } else {
                pinOption.innerHTML = '📌 Pin Chat';
            }
            
            contextMenu.classList.remove('hidden');
        });

        chatList.appendChild(chatItem);
        fetchLastMessage(username, chatItem);
    }

    // Context menu event listeners
    const contextMenu = document.getElementById('chat-context-menu');
    
    // Handle context menu options
    document.querySelectorAll('.context-menu-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            const action = e.target.dataset.action;
            const username = contextMenu.dataset.username;
            const chatItem = Array.from(chatList.children).find(chat => 
                chat.querySelector('div > div:first-child').textContent.trim() === username
            );

            if (!chatItem) return;

            if (action === 'pin') {
                if (chatItem.classList.contains('pinned')) {
                    // If already pinned, unpin it
                    chatItem.classList.remove('pinned');
                    // Move to original position (after pinned chats)
                    const lastPinnedChat = Array.from(chatList.children)
                        .filter(chat => chat.classList.contains('pinned'))
                        .pop();
                    if (lastPinnedChat) {
                        lastPinnedChat.after(chatItem);
                    } else {
                        chatList.prepend(chatItem);
                    }
                    // Update the pin option text
                    e.target.innerHTML = '📌 Pin Chat';
                } else {
                    // If not pinned, pin it
                    chatItem.classList.add('pinned');
                    chatItem.classList.remove('archived');
                    chatList.prepend(chatItem);
                    // Update the pin option text
                    e.target.innerHTML = '📌 Unpin Chat';
                }
            } 
            else if (action === 'archive') {
                chatList.appendChild(chatItem);
                chatItem.classList.add('archived');
                chatItem.classList.remove('pinned');
            } 
            else if (action === 'delete') {
                const confirmDelete = confirm(`Are you sure you want to delete the chat with ${username}?`);
                if (confirmDelete) {
                    // Request server to delete the database
                    fetch(`http://localhost:3000/delete-chat-database`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userA: localStorage.getItem('username'), userB: username })
                    })
            .then(response => response.json())
            .then(data => {
                        if (data.success) {
                            console.log(`Database for chat with ${username} deleted successfully.`);
                            localStorage.setItem(`deleted_chat_${username}`, true); // Mark chat as deleted
                            chatItem.remove();
                            if (activeReceiver === username) {
                                activeReceiver = null;
                                chatHeaderUsername.textContent = '';
                                chatHeaderProfilePicture.src = '';
                                toggleChatScreen(false);
                    }
                } else {
                            console.error(`Failed to delete database for chat with ${username}:`, data.message);
                            alert('Failed to delete chat.');
                        }
                    })
                    .catch(error => console.error('Error deleting chat database:', error));
                }
            }

            // Hide context menu after action
            contextMenu.style.display = 'none';
            contextMenu.classList.add('hidden');
        });
    });

    // Hide context menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#chat-context-menu')) {
            contextMenu.style.display = 'none';
            contextMenu.classList.add('hidden');
        }
    });

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
                        if (!localStorage.getItem(`deleted_chat_${chat.username}`)) {
                            addChatToSidebar(chat.username); // Only add chats that haven't been deleted
                        }
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
            if (chatScreen.classList.contains('hidden')) {
                noChatPlaceholder.style.display = 'none';
                chatScreen.classList.remove('hidden');
                inputArea.style.display = 'flex'; // Ensure the input area is visible
            }
        } else {
            if (!chatScreen.classList.contains('hidden')) {
                noChatPlaceholder.style.display = 'flex';
                chatScreen.classList.add('hidden');
                inputArea.style.display = 'none'; // Hide the input area when no chat is selected
            }
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

    function loadMessages(receiver) {
        const sender = localStorage.getItem('username'); // Current logged-in user
        if (!sender || !receiver) {
            console.error('Cannot load messages. Missing sender or receiver:', { sender, receiver });
            return;
        }

        fetch(`http://localhost:3000/messages?sender=${encodeURIComponent(sender)}&receiver=${encodeURIComponent(receiver)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const messagesContainer = document.getElementById('messages-container');
                const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop === messagesContainer.clientHeight;

                if (messagesContainer.children.length === data.messages.length) {
                    return; // Skip rendering if nothing changed
                }

                messagesContainer.innerHTML = ''; // Clear only if changed

                data.messages.forEach(message => {
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('message', message.sender === sender ? 'sent' : 'received');

                    const messageBubble = document.createElement('div');
                    messageBubble.classList.add('message-bubble');
                    messageBubble.textContent = message.message;

                    messageElement.appendChild(messageBubble);
                    messagesContainer.appendChild(messageElement);
                });

                    // Only scroll to the bottom if the user is already at the bottom
                    if (isAtBottom) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                } else {
                    console.error('Failed to load messages:', data.message);
                }
            })
            .catch(error => console.error('Error loading messages:', error));
    }

    // Call `loadMessages` when a chat is selected
    const chatList = document.getElementById('chat-list');
    chatList.addEventListener('click', (event) => {
        const chatItem = event.target.closest('.chat-list-item');
        if (chatItem) {
            const receiver = chatItem.querySelector('div > div:first-child').textContent.trim();
            activeReceiver = receiver; // Set the active receiver
            loadMessages(receiver); // Load messages for the selected chat
        }
    });

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
    const sidebarSearchInput = document.querySelector('.search-bar');

    sidebarSearchInput.addEventListener('input', () => {
        const query = sidebarSearchInput.value.toLowerCase();

        Array.from(chatList.children).forEach(chatItem => {
            const username = chatItem.querySelector('div > div:first-child')?.textContent.toLowerCase() || '';
            const lastMessage = chatItem.querySelector('.last-message')?.textContent.toLowerCase() || '';

            const matches = username.includes(query) || lastMessage.includes(query);
            chatItem.style.display = matches ? 'flex' : 'none';
        });
    });

    document.querySelectorAll('.context-menu-option').forEach(option => {
        option.removeEventListener('click', () => {});
    });

    document.addEventListener('click', () => {
        document.getElementById('chat-context-menu')?.classList.add('hidden');
    });

    // Function to update task status
    async function updateTaskStatus(taskId, newStatus, userA, userB) {
        console.log('Updating task status:', { taskId, newStatus, userA, userB });
        
        if (!taskId || !userA || !userB) {
            console.error('Missing required parameters:', { taskId, userA, userB });
            throw new Error('Missing required parameters');
        }

        try {
            const response = await fetch(`http://localhost:3000/chatDB/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: newStatus,
                    userA,
                    userB
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update task status');
            }

            console.log('Task status updated successfully:', data);
            socket.emit('taskStatusUpdated', { taskId, status: newStatus, userA, userB });
            return data;
        } catch (error) {
            console.error('Error updating task status:', error);
            throw error;
        }
    }

    // Function to create task element
    function createTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.className = 'task';
        taskElement.dataset.taskId = task.id;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.status === 'complete';
        checkbox.addEventListener('change', async (event) => {
            const taskId = task.id;
            const newStatus = event.target.checked ? 'complete' : 'not complete';
            
            try {
                await updateTaskStatus(taskId, newStatus, userA, userB);
                // Update the task text style
                const taskText = taskElement.querySelector('span');
                if (taskText) {
                    taskText.style.textDecoration = newStatus === 'complete' ? 'line-through' : 'none';
                }
            } catch (error) {
                // Revert checkbox state if update fails
                event.target.checked = !event.target.checked;
                alert('Failed to update task status: ' + error.message);
            }
        });

        const taskText = document.createElement('span');
        taskText.textContent = task.task;
        if (task.status === 'complete') {
            taskText.style.textDecoration = 'line-through';
        }

        taskElement.appendChild(checkbox);
        taskElement.appendChild(taskText);
        return taskElement;
    }
});