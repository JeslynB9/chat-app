const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');
const db = require('./database'); // SQLite DB module
const { getChatDB, addTask, saveMessage, getMessagesBetweenUsers, addChatForBothUsers } = require('./utils/chatDB');

const app = express();
app.use(express.json());
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const calendarRoutes = require('./routes/calendar');
app.use('/calendar', calendarRoutes);


// Setup storage
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + ext;
    cb(null, name);
  }
});

const upload = multer({ storage });

app.post('/upload', upload.single('image'), (req, res) => {
  const imageUrl = `http://localhost:3000/uploads/${req.file.filename}`;
  res.json({ success: true, imageUrl });
});

app.use('/uploads', express.static('uploads'));

// Properly configure and apply CORS middleware
app.use((req, res, next) => {
    console.log('CORS middleware applied'); // Debugging log
    res.header('Access-Control-Allow-Origin', '*'); // Allow all origins
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // Allow specific HTTP methods
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Allow specific headers
    if (req.method === 'OPTIONS') {
        console.log('Handling preflight request'); // Debugging log
        return res.sendStatus(200); // Handle preflight requests
    }
    next();
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '../')));

// Serve the login page for the root URL
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Alternatively, serve a static HTML file (if you have one)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('/', (req, res) => {
        res.sendFile(path.join(publicDir, 'index.html'));
    });
}

// ========== Auth: Register ==========
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.registerUser(username, hashedPassword, (err, userId) => {
            if (err) {
                console.error('Registration DB Error:', err);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ success: false, message: 'Username already exists' });
                }
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            return res.status(201).json({ success: true, message: 'User registered successfully' });
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== Auth: Login ==========
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    db.authenticateUser(username, async (err, user) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        if (!user || !user.password) return res.status(401).json({ success: false, message: 'User not found or invalid password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect password' });

        res.status(200).json({ success: true, message: 'Login successful', user: { id: user.id, username: user.username } });
    });
});

// ========== Image Upload ==========
app.post('/upload', upload.single('image'), (req, res) => {
    const uploader = req.body.username;
    const receiver = req.body.receiver;
    const timestamp = Date.now();
    const filepath = `/uploads/${req.file.filename}`;
  
    if (!uploader || !receiver || !req.file) {
      return res.status(400).json({ error: 'Missing file or user info' });
    }
  
    // Save to chat-specific DB
    const db = getChatDB(uploader, receiver);
    db.run(
      `INSERT INTO uploads (filename, filepath, uploader, timestamp) VALUES (?, ?, ?, ?)`,
      [req.file.originalname, filepath, uploader, timestamp],
      (err) => {
        if (err) {
          console.error('❌ Upload save error:', err.message);
          return res.status(500).json({ error: 'Failed to save upload' });
        }
        console.log(`📎 Upload saved to chat DB: ${filepath}`);
        res.json({ imageUrl: filepath });
      }
    );
  });

app.get('/chat/history', (req, res) => {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) {
      return res.status(400).json({ error: 'Missing users' });
    }
  
    const db = getChatDB(user1, user2);
    db.all(`SELECT * FROM messages ORDER BY timestamp ASC`, [], (err, rows) => {
      if (err) {
        console.error('❌ Failed to fetch messages:', err.message);
        return res.status(500).json({ error: 'Failed to load messages' });
      }
      res.json({ messages: rows });
    });
  });

// ========== Username (if still needed) ==========
app.post('/save-username', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    db.saveUsername(username, (err, result) => {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Username already exists' });
            }
            return res.status(500).json({ error: 'Failed to save username' });
        }
        res.status(201).json({ message: 'Username saved successfully', user: result });
    });
});

// ========== Search Users ==========
app.get('/search-users', (req, res) => {
    const query = req.query.query;
    if (!query) {
        return res.status(400).json({ success: false, message: 'Query parameter is required' });
    }

    db.getAllUsernames((err, users) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        const filteredUsers = users.filter(user => user.username.toLowerCase().includes(query.toLowerCase()));
        res.json({ success: true, users: filteredUsers });
    });
});

// ========== Fetch Messages ==========
app.get('/messages', (req, res) => {
    const { sender, receiver } = req.query;

    if (!sender || !receiver) {
        return res.status(400).json({ success: false, message: 'Sender and receiver are required' });
    }

    getMessagesBetweenUsers(sender, receiver, (err, messages) => {
        if (err) {
            console.error('Error fetching messages:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
        }

        // Ensure the response includes the message ID
        res.json({ success: true, messages });
    });
});

// ========== Save a New Message ==========
app.post('/messages', (req, res) => {
    const { sender, receiver, message } = req.body;

    if (!sender || !receiver || !message) {
        return res.status(400).json({ success: false, message: 'Sender, receiver, and message are required' });
    }

    saveMessage(sender, receiver, sender, receiver, message, (err, savedMessage) => {
        if (err) {
            console.error('Error saving message:', err);
            return res.status(500).json({ success: false, message: 'Failed to save message' });
        }

        // Emit a Socket.IO event to notify clients
        const room = [sender, receiver].sort().join('_');
        io.to(room).emit('messageSaved', { sender, receiver });

        res.status(201).json({ success: true, message: 'Message saved', data: savedMessage });
    });
});

// ========== Add a Chat for Both Users ==========
app.post('/add-chat', (req, res) => {
    const { sender, receiver } = req.body;

    if (!sender || !receiver) {
        return res.status(400).json({ success: false, message: 'Sender and receiver are required' });
    }

    const chatDB = getChatDB(sender, receiver); // Use chat-specific database
    chatDB.addChatForBothUsers(sender, receiver, (err) => {
        if (err) {
            console.error('Error adding chat:', err);
            return res.status(500).json({ success: false, message: 'Failed to add chat' });
        }

        // Notify both users via Socket.IO
        io.emit('updateChatList', { sender, receiver });

        res.status(201).json({ success: true, message: 'Chat added for both users' });
    });
});

// ========== Fetch the Chat List for a Specific User ==========
app.get('/user-chats', (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required' });
    }

    db.getUserChats(username, (err, chats) => {
        if (err) {
            console.error('Database error fetching user chats:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, chats });
    });
});

// ========== Add Task ==========
app.post('/chatDB/tasks', (req, res) => {
    console.log('Incoming request body:', req.body); // Debugging log

    const { task, userA, userB } = req.body;
    let { status } = req.body;

    // Validate that userA is the one setting up the task
    const loggedInUser = req.headers['x-logged-in-user']; // Assuming the logged-in user is sent in the headers
    if (!loggedInUser || loggedInUser !== userA) {
        console.error('Unauthorized task creation attempt:', { loggedInUser, userA }); // Debugging log
        return res.status(403).json({ success: false, message: 'You are not authorized to create this task' });
    }

    if (!task || !userA || !userB) {
        console.error('Missing required fields:', { task, userA, userB }); // Debugging log
        return res.status(400).json({ success: false, message: 'Task, userA, and userB are required' });
    }

    // Default status to "not complete" if not provided
    status = status || 'not complete';

    // Add the task to the chat-specific database
    addTask(userA, userB, { task, status }, (err, taskData) => {
        if (err) {
            console.error(`❌ Failed to add task to chat_${[userA, userB].sort().join('_')}.db:`, err.message); // Debugging log
            return res.status(500).json({ success: false, message: 'Failed to add task' });
        }

        console.log(`Task added successfully to chat_${[userA, userB].sort().join('_')}.db with ID:`, taskData.id); // Debugging log

        // Emit taskAdded event to the specific chat room
        const room = [userA, userB].sort().join('_');
        console.log(`Emitting taskAdded to room: ${room}`); // Debugging log
        io.to(room).emit('taskAdded', taskData);

        // Emit fetchTasks event to refresh the task list for both users
        io.to(room).emit('fetchTasks', { userA, userB });

        res.status(201).json({ success: true, message: 'Task added successfully', task: taskData });
    });
});

// ========== Fetch Tasks ==========
app.get('/chatDB/tasks', (req, res) => {
    const { userA, userB } = req.query;

    if (!userA || !userB) {
        return res.status(400).json({ success: false, message: 'userA and userB are required' });
    }

    const db = getChatDB(userA, userB); // Use chat-specific database
    const query = `SELECT * FROM tasks`;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Failed to fetch tasks:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to load tasks' });
        }
        res.json({ success: true, tasks: rows });
    });
});

// ========== Delete Task ==========
app.delete('/chatDB/tasks/:taskId', (req, res) => {
    const { userA, userB } = req.query;
    const { taskId } = req.params;

    if (!userA || !userB || !taskId) {
        return res.status(400).json({ success: false, message: 'userA, userB, and taskId are required' });
    }

    const db = getChatDB(userA, userB); // Use chat-specific database
    const query = `DELETE FROM tasks WHERE id = ?`;

    db.run(query, [taskId], function (err) {
        if (err) {
            console.error('❌ Failed to delete task:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to delete task' });
        }

        console.log(`Task with ID ${taskId} deleted successfully from chat_${[userA, userB].sort().join('_')}.db`);
        res.json({ success: true, message: 'Task deleted successfully' });
    });
});

// ========== Update Task Status ==========
app.put('/chat-app/utils/chatDB/tasks/:taskId/status', (req, res) => {
    const { userA, userB } = req.query;
    const { taskId } = req.params;
    const { status } = req.body;

    if (!userA || !userB || !taskId || !status) {
        return res.status(400).json({ success: false, message: 'userA, userB, taskId, and status are required' });
    }

    const db = getChatDB(userA, userB); // Use chat-specific database
    const query = `UPDATE tasks SET status = ? WHERE id = ?`;

    db.run(query, [status, taskId], function (err) {
        if (err) {
            console.error('❌ Failed to update task status:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to update task status' });
        }

        console.log(`Task with ID ${taskId} updated successfully to status: ${status}`);
        res.json({ success: true, message: 'Task status updated successfully' });
    });
});

// Endpoint to delete a chat database
app.post('/delete-chat-database', (req, res) => {
    const { userA, userB } = req.body;

    if (!userA || !userB) {
        return res.status(400).json({ success: false, message: 'Both userA and userB are required.' });
    }

    const dbName = `chat_${[userA, userB].sort().join('_')}.db`;
    const dbPath = path.join(__dirname, 'chat_dbs', dbName); // Corrected directory path

    fs.unlink(dbPath, (err) => {
        if (err) {
            console.error(`Failed to delete database file ${dbName}:`, err.message);
            return res.status(500).json({ success: false, message: 'Failed to delete chat database.' });
        }
        console.log(`Database file ${dbName} deleted successfully.`);
        res.json({ success: true, message: 'Chat database deleted successfully.' });
    });
});

// Add a new pin
app.post('/chatDB/pins', (req, res) => {
    const { userA, userB, pinName } = req.body;

    if (!userA || !userB || !pinName) {
        return res.status(400).json({ success: false, message: 'userA, userB, and pinName are required' });
    }

    const db = getChatDB(userA, userB); // Use chat-specific database
    const pinId = pinName; // Use the entered pin name as the ID

    const query = `
        INSERT INTO pins (id, message_id)
        VALUES (?, ?)
    `;
    db.run(query, [pinId, pinName], function (err) {
        if (err) {
            console.error('❌ Failed to add pin:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to add pin' });
        }
        console.log(`Pin with ID ${pinId} added successfully to chat_${[userA, userB].sort().join('_')}.db`);
        res.status(201).json({ success: true, message: 'Pin added successfully', pin: { id: pinId, name: pinName } });
    });
});

// Fetch available pins for a chat
app.get('/chatDB/pins', (req, res) => {
    const { userA, userB } = req.query;

    if (!userA || !userB) {
        return res.status(400).json({ success: false, message: 'userA and userB are required' });
    }

    const db = getChatDB(userA, userB);
    const query = `SELECT * FROM pins`;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ Failed to fetch pins:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to fetch pins' });
        }

        res.json({ success: true, pins: rows });
    });
});

// Assign a message to a pin
app.post('/chatDB/pins/assign', (req, res) => {
    const { userA, userB, messageId, pinId } = req.body;

    if (!userA || !userB || !messageId || !pinId) {
        return res.status(400).json({ success: false, message: 'userA, userB, messageId, and pinId are required' });
    }

    const db = getChatDB(userA, userB);
    const query = `
        INSERT OR IGNORE INTO pins (id, message_id)
        VALUES (?, ?)
    `;

    db.run(query, [pinId, parseInt(messageId, 10)], function (err) {
        if (err) {
            console.error('❌ Failed to assign message to pin:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to assign message to pin' });
        }
        if (this.changes === 0) {
            return res.status(200).json({ success: false, message: 'Message is already assigned to this pin' });
        }
        res.json({ success: true, message: 'Message assigned to pin successfully' });
    });
});

// Delete a pin
app.delete('/chatDB/pins/:pinId', (req, res) => {
    const { userA, userB } = req.query;
    const { pinId } = req.params;

    if (!userA || !userB || !pinId) {
        return res.status(400).json({ success: false, message: 'userA, userB, and pinId are required' });
    }

    const db = getChatDB(userA, userB);
    const query = `DELETE FROM pins WHERE id = ?`;

    db.run(query, [pinId], function (err) {
        if (err) {
            console.error('❌ Failed to delete pin:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to delete pin' });
        }

        console.log(`Pin with ID ${pinId} deleted successfully from chat_${[userA, userB].sort().join('_')}.db`);
        res.json({ success: true, message: 'Pin deleted successfully' });
    });
});

// Fetch messages for a specific pin
app.get('/chatDB/pins/messages', (req, res) => {
    const { userA, userB, pinId } = req.query;

    if (!userA || !userB || !pinId) {
        return res.status(400).json({ success: false, message: 'userA, userB, and pinId are required' });
    }

    const db = getChatDB(userA, userB);
    const query = `
        SELECT messages.sender, messages.message
        FROM pins
        JOIN messages ON pins.message_id = messages.id
        WHERE pins.id = ?
    `;

    db.all(query, [pinId], (err, rows) => {
        if (err) {
            console.error('Error fetching messages for pin:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch messages for pin' });
        }
        res.json({ success: true, messages: rows });
    });
});

app.get('/get-pins', (req, res) => {
    const { user } = req.query;
    if (!user) {
        return res.status(400).json({ success: false, message: 'User is required.' });
    }

    const query = `SELECT id, category FROM pins WHERE user = ?`;
    db.all(query, [user], (err, rows) => {
        if (err) {
            console.error('Error fetching pins:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to fetch pins.' });
        }
        res.json({ success: true, pins: rows });
    });
});

app.post('/add-chat-to-pin', (req, res) => {
    const { pinId, chatUsername } = req.body;
    if (!pinId || !chatUsername) {
        return res.status(400).json({ success: false, message: 'Pin ID and chat username are required.' });
    }

    db.addChatToPin(pinId, chatUsername, (err, result) => {
        if (err) {
            console.error('Error adding chat to pin:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to add chat to pin.' });
        }
        res.json({ success: true, result });
    });
});

app.get('/get-messages-for-pin', (req, res) => {
    const { pinId } = req.query;
    if (!pinId) {
        return res.status(400).json({ success: false, message: 'Pin ID is required.' });
    }

    db.getChatsForPin(pinId, (err, chats) => {
        if (err) {
            console.error('Error fetching chats for pin:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to fetch chats for pin.' });
        }

        const messagesPromises = chats.map(chatUsername => {
            return new Promise((resolve, reject) => {
                db.getMessagesBetweenUsers(req.user, chatUsername, (err, messages) => {
                    if (err) reject(err);
                    else resolve(messages);
                });
            });
        });

        Promise.all(messagesPromises)
            .then(results => {
                const allMessages = results.flat();
                res.json({ success: true, messages: allMessages });
            })
            .catch(error => {
                console.error('Error fetching messages for pin:', error.message);
                res.status(500).json({ success: false, message: 'Failed to fetch messages for pin.' });
            });
    });
});

app.get('/get-chats-for-category', (req, res) => {
    const { user, category } = req.query;
    if (!user || !category) {
        return res.status(400).json({ success: false, message: 'User and category are required.' });
    }

    const query = `
        SELECT chat_username FROM pinned_chats
        INNER JOIN pins ON pinned_chats.pin_id = pins.id
        WHERE pins.user = ? AND pins.category = ?
    `;
    db.all(query, [user, category], (err, rows) => {
        if (err) {
            console.error('Error fetching chats for category:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to fetch chats for category.' });
        }
        const chats = rows.map(row => row.chat_username);
        res.json({ success: true, chats });
    });
});

// ========== Socket.IO ==========
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinChat', ({ userA, userB }) => {
        const room = [userA, userB].sort().join('_');
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`); // Debugging log
    });

    socket.on('sendMessage', (data) => {
        console.log('Received message:', data); // Debug log

        const { message, sender, receiver, timestamp, type, fileData } = data;
        const room = [sender, receiver].sort().join('_');
        
        // Save to chat-specific DB
        const db = getChatDB(sender, receiver);
        const messageContent = type === 'file' ? JSON.stringify(fileData) : message;
        
        db.run(
            `INSERT INTO messages (sender, receiver, message, createdAt) VALUES (?, ?, ?, ?)`,
            [sender, receiver, messageContent, timestamp],
            (err) => {
                if (err) {
                    console.error('❌ Failed to save message:', err.message);
                } else {
                    console.log(`💾 Message saved to chat_${room}.db`);
                    
                    // Broadcast to the specific chat room
                    io.to(room).emit('receiveMessage', {
                        ...data,
                        timestamp: timestamp || Date.now()
                    });
                }
            }
        );
    });

    socket.on('sendImage', (data) => {
        console.log('Image received:', data);
        io.emit('receiveMessage', data);
    });

    socket.on('typing', (username) => {
        socket.broadcast.emit('typing', username);
    });

    socket.on('stopTyping', (username) => {
        socket.broadcast.emit('stopTyping', username);
    });

    // Handle profile picture updates
    socket.on('updateProfilePicture', ({ username, imageUrl }) => {
    });

    socket.on('addTask', (data) => {
        const { userA, userB, task } = data;
        const room = [userA, userB].sort().join('_');
        addTask(userA, userB, task, (err, result) => {
            if (!err) {
                io.to(room).emit('taskAdded', result);
                io.to(room).emit('fetchTasks', { userA, userB });
            }
        });
    });

    socket.on('editTask', (data) => {
        const { userA, userB, taskId, newTask } = data;
        const room = [userA, userB].sort().join('_');
        const db = getChatDB(userA, userB);
        const query = `UPDATE tasks SET task = ? WHERE id = ?`;
        db.run(query, [newTask, taskId], function (err) {
            if (!err) {
                io.to(room).emit('taskEdited', { taskId, newTask });
            }
        });
    });

    socket.on('deleteTask', (data) => {
        const { userA, userB, taskId } = data;
        const room = [userA, userB].sort().join('_');
        const db = getChatDB(userA, userB);
        const query = `DELETE FROM tasks WHERE id = ?`;
        db.run(query, [taskId], function (err) {
            if (!err) {
                io.to(room).emit('taskDeleted', taskId);
            }
        });
    });
});

// Start the server
// === CALENDAR: Add new event ===
app.post('/calendar/events', (req, res) => {
    const { title, start, end, username } = req.body;

    console.log('Received request to add event:', req.body); // Log the incoming request body

    if (!title || !start || !username) {
        console.error('Missing required fields:', { title, start, username });
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    db.addCalendarEvent({ title, start, end, username }, (err, savedEvent) => {
        if (err) {
            console.error('Failed to save event to database:', err); // Log the detailed error
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }
        console.log('Event successfully saved to database:', savedEvent); // Log the saved event
        res.status(201).json({ success: true, event: savedEvent });
    });
});

// === CALENDAR: Fetch all events for user ===
app.get('/calendar/events', (req, res) => {
    const { username } = req.query;
    console.log('Fetching events for user:', username); // Log the username for which events are being fetched

    if (!username) {
        console.error('Username is required to fetch events');
        return res.status(400).json({ success: false, message: 'Username required' });
    }

    db.getEvents(username, (err, events) => {
        if (err) {
            console.error('Failed to fetch events from database:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        console.log('Fetched events for user:', username, events); // Log the fetched events
        res.json({ success: true, events });
    });
});

app.post('/add-pin', (req, res) => {
    const { user, category } = req.body;
    if (!user || !category) {
        return res.status(400).json({ success: false, message: 'User and category are required.' });
    }

    db.addPin(user, category, (err, result) => {
        if (err) {
            console.error('Error adding pin:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to add pin.' });
        }
        res.json({ success: true, pin: result });
    });
});

app.delete('/remove-pin/:pinId', (req, res) => {
    const { pinId } = req.params;

    const deleteChatsQuery = `DELETE FROM pinned_chats WHERE pin_id = ?`;
    const deletePinQuery = `DELETE FROM pins WHERE id = ?`;

    db.run(deleteChatsQuery, [pinId], (err) => {
        if (err) {
            console.error('Error removing chats for pin:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to remove chats for pin.' });
        }

        db.run(deletePinQuery, [pinId], (err) => {
            if (err) {
                console.error('Error removing pin:', err.message);
                return res.status(500).json({ success: false, message: 'Failed to remove pin.' });
            }

            res.json({ success: true, message: 'Pin removed successfully.' });
        });
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});