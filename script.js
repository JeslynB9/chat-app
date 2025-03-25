document.addEventListener('DOMContentLoaded', () => {
    const socket = io('http://localhost:3000'); // Connect to the backend server
    const inputField = document.querySelector('.input-area input');
    const messagesContainer = document.querySelector('.messages');

    // Set a username (this can be dynamic, based on login)
    const username = prompt("Enter your username:");

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
            location.reload(); // Reload the page to prompt for a new username
        } else {
            console.log('Username saved:', data.user);
        }
    })
    .catch(error => {
        console.error('Error saving username:', error);
    });

    const cameraButton = document.querySelector('.input-area button:nth-child(2)');
    const plusButton = document.querySelector('.input-area button:nth-child(3)');

    // Sidebar Buttons
    const allButton = document.getElementById('all-button');
    const unreadButton = document.getElementById('unread-button');
    const addChatButton = document.getElementById('add-chat-button');

    // Header Buttons
    const urgentButton = document.getElementById('urgent-button');
    const generalButton = document.getElementById('general-button');
    const addCategoryButton = document.getElementById('add-category-button');

    // Function to send a message
    function sendMessage() {
        const messageText = inputField.value.trim();
        if (messageText) {
            const messageData = { message: messageText, sender: username };
            socket.emit('sendMessage', messageData);
            inputField.value = '';
        }
    }

    // Add event listener for pressing Enter in the input field
    inputField.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // Listen for incoming messages
    socket.on('receiveMessage', (data) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        // If the message is from the current user, show the message without the username
        if (data.sender === username) {
            messageElement.classList.add('sent');
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
            messageBubble.textContent = data.message;
            messageElement.appendChild(messageBubble);
        } else {
            messageElement.classList.add('received');

            // Create and append the username above the message bubble
            const usernameElement = document.createElement('div');
            usernameElement.classList.add('username');
            usernameElement.textContent = data.sender; // Display the sender's name above the message bubble

            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
            messageBubble.textContent = data.message;

            // Append the username first, then the message bubble
            messageElement.appendChild(usernameElement); 
            messageElement.appendChild(messageBubble);
        }

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    // Camera button functionality
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

    // Plus button functionality
    plusButton.addEventListener('click', () => {
        alert('Plus button clicked! You can implement additional actions here.');
    });

    // Sidebar button functionality
    allButton.addEventListener('click', () => {
        alert('All chats displayed!');
    });

    unreadButton.addEventListener('click', () => {
        alert('Unread chats displayed!');
    });

    addChatButton.addEventListener('click', () => {
        alert('Add new chat!');
    });

    // Header button functionality
    urgentButton.addEventListener('click', () => {
        alert('Urgent chats displayed!');
    });

    generalButton.addEventListener('click', () => {
        alert('General chats displayed!');
    });

    addCategoryButton.addEventListener('click', () => {
        alert('Add new category!');
    });

    document.getElementById('theme-button').addEventListener('click', () => {
        document.getElementById('theme-options').classList.toggle('show');
    });

    document.querySelectorAll('.theme-option').forEach(button => {
        button.addEventListener('click', () => {
            const theme = button.getAttribute('data-theme');
            document.body.setAttribute('data-theme', theme);
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const settingsButton = document.getElementById('settings-button');
    const modal = document.getElementById('settings-modal');
    const closeButton = document.querySelector('.close-button');
    const themeButtons = document.querySelectorAll('.theme-button');

    // Open modal when settings button is clicked
    settingsButton.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    // Close modal when "X" button is clicked
    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Theme Change Functionality
    themeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const theme = button.getAttribute('data-theme');
            applyTheme(theme);
            localStorage.setItem('theme', theme); // Save selection
        });
    });

    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const pinsContainer = document.querySelector(".pins-container");
    const addPinButton = document.getElementById("add-pin-button");

    // Add a new pin
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

            // Add event listener to remove the pin
            pin.querySelector(".remove-pin-button").addEventListener("click", () => {
                pin.remove();
            });
        }
    });

    // Remove existing pins
    pinsContainer.addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-pin-button")) {
            event.target.parentElement.remove();
        }
    });
});
