const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./database'); // SQLite DB module
const { getChatDB, addTask } = require('./utils/chatDB');

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

    db.getMessagesBetweenUsers(sender, receiver, (err, messages) => {
        if (err) {
            console.error('Database error fetching messages:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, messages });
    });
});

// ========== Save a New Message ==========
app.post('/messages', (req, res) => {
    const { sender, receiver, message } = req.body;

    if (!sender || !receiver || !message) {
        return res.status(400).json({ success: false, message: 'Sender, receiver, and message are required' });
    }

    db.saveMessage(sender, receiver, message, (err, savedMessage) => {
        if (err) {
            console.error('Database error saving message:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.status(201).json({ success: true, message: 'Message saved', data: savedMessage });
    });
});

// ========== Add a Chat for Both Users ==========
app.post('/add-chat', (req, res) => {
    const { sender, receiver } = req.body;

    if (!sender || !receiver) {
        return res.status(400).json({ success: false, message: 'Sender and receiver are required' });
    }

    db.addChatForBothUsers(sender, receiver, (err) => {
        if (err) {
            console.error('Database error adding chat:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
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
app.put('/chatDB/tasks/:taskId/status', (req, res) => {
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

// ========== Socket.IO ==========
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinChat', ({ userA, userB }) => {
        const room = [userA, userB].sort().join('_');
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`); // Debugging log
    });

    socket.on('sendMessage', (data) => {
        const { message, sender, receiver, timestamp } = data;
      
        // Save to chat-specific DB
        const db = getChatDB(sender, receiver);
        db.run(
          `INSERT INTO messages (sender, message, timestamp) VALUES (?, ?, ?)`,
          [sender, message, timestamp],
          (err) => {
            if (err) {
              console.error('❌ Failed to save message:', err.message);
            } else {
              console.log(`💾 Message saved to chat_${[sender, receiver].sort().join('_')}.db`);
            }
          }
        );
      
        // Broadcast message to all clients
        io.emit('receiveMessage', data);
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
server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});