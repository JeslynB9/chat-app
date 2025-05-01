const express = require('express');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const authRoutes = require('./authRoutes');
const authenticate = require('./authMiddleware');

const socket = io('http://localhost:3000'); // never omit the http!
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Corrected .env path

const secretKey = process.env.SECRET_KEY; // Load SECRET_KEY
console.log('Loaded SECRET_KEY:', secretKey); // Debugging log
if (!secretKey) {
    console.error('SECRET_KEY is not defined in the environment variables.');
    throw new Error('SECRET_KEY is required but not defined.');
}

console.log('SECRET_KEY loaded successfully.'); // Debugging log

app.get('/profile', authenticate, (req, res) => {
    res.json({ success: true, user: req.user });
});
const bcrypt = require('bcrypt'); // Reverting to bcrypt

// Load server key and certificate
const options = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
};

const app = express();

// Create HTTPS server
const server = https.createServer(options, app);

// Attach socket.io to HTTPS server
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get('/profile', authenticate, (req, res) => {
    res.json({ success: true, user: req.user });
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o777 });
        console.log('Created uploads directory:', uploadsDir);
    } catch (error) {
        console.error('Error creating uploads directory:', error);
    }
}

const connectedUsers = new Set();

function saveFile(base64Data, fileType) {
    try {
        // Extract the actual base64 data (remove data:image/png;base64, etc.)
        const base64Content = base64Data.split(';base64,').pop();
        
        // Generate a unique filename
        const uniqueId = crypto.randomBytes(16).toString('hex');
        const extension = fileType.split('/')[1] || 'bin'; // Default to bin if no extension
        const filename = `${uniqueId}.${extension}`;
        
        // Save the file to disk
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, base64Content, { encoding: 'base64' });
        
        return `/uploads/${filename}`;
    } catch (error) {
        console.error('Error saving file:', error);
        throw error;
    }
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join chat room
    socket.on('joinChat', ({ userA, userB }) => {
        const room = [userA, userB].sort().join('_');
        socket.join(room);
        console.log(`User joined room: ${room}`);
    });

    // Handle sending messages
    socket.on('sendMessage', (messageData) => {
        console.log('Message received:', messageData);

        // Broadcast the message to the receiver's room
        const room = [messageData.sender, messageData.receiver].sort().join('_');
        io.to(room).emit('receiveMessage', messageData);

        // Save the message to the database
        const db = getChatDB(messageData.sender, messageData.receiver);
        const query = `
            INSERT INTO messages (sender, receiver, message, createdAt)
            VALUES (?, ?, ?, ?)
        `;
        db.run(query, [messageData.sender, messageData.receiver, messageData.message, messageData.timestamp], (err) => {
            if (err) {
                console.error('Error saving message to database:', err);
            } else {
                console.log('Message saved to database.');
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('setUsername', (username) => {
        socket.username = username;
        connectedUsers.add(username);
        socket.broadcast.emit('userJoined', username);
        io.emit('updateUserList', Array.from(connectedUsers));
        console.log('User set username:', username);
        console.log('Connected users:', Array.from(connectedUsers));
    });

    socket.on('sendMessage', (message) => {
        console.log('Received message:', message);
        
        const messageToSend = {
            ...message,
            timestamp: Date.now()
        };

        // If it's a file message, ensure we're only sending the necessary data
        if (message.type === 'file' && message.fileData) {
            messageToSend.fileData = {
                name: message.fileData.name,
                type: message.fileData.type,
                size: message.fileData.size,
                url: message.fileData.url
            };
        }

        // Save message to database
        const dbName = `chat_${message.sender}_${message.receiver}.db`;
        const db = new sqlite3.Database(dbName);
        
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT,
                content TEXT,
                sender TEXT,
                receiver TEXT,
                timestamp INTEGER,
                fileData TEXT,
                isPinned INTEGER DEFAULT 0
            )`);

            const stmt = db.prepare(`INSERT INTO messages (type, content, sender, receiver, timestamp, fileData)
                VALUES (?, ?, ?, ?, ?, ?)`);
                
            stmt.run(
                message.type,
                message.content || null,
                message.sender,
                message.receiver,
                messageToSend.timestamp,
                message.fileData ? JSON.stringify(message.fileData) : null
            );
            
            stmt.finalize();
        });

        db.close();

        // Broadcast the message
        io.emit('receiveMessage', messageToSend);
    });

    socket.on('joinChat', ({ userA, userB }) => {
        const chatRoom = [userA, userB].sort().join('-');
        socket.join(chatRoom);
        console.log(`User joined chat room: ${chatRoom}`);
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            connectedUsers.delete(socket.username);
            io.emit('userLeft', socket.username);
            io.emit('updateUserList', Array.from(connectedUsers));
        }
        console.log('A user disconnected');
    });

    // Add task update event handler
    socket.on('taskStatusUpdate', ({ userA, userB, taskId, status }) => {
        console.log('Task status update received:', { userA, userB, taskId, status });
        
        // Broadcast the update to all connected clients immediately
        io.emit('taskStatusChanged', { 
            userA, 
            userB, 
            taskId, 
            status,
            timestamp: Date.now()
        });
    });

    socket.on('taskAdded', ({ userA, userB, task }) => {
        console.log('New task added:', { userA, userB, task });
        io.emit('taskUpdated', { userA, userB, task });
    });

    socket.on('taskDeleted', ({ userA, userB, taskId }) => {
        console.log('Task deleted:', { userA, userB, taskId });
        io.emit('taskDeleted', { userA, userB, taskId });
    });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        // Ensure the uploads directory exists before saving
        if (!fs.existsSync(uploadsDir)) {
            try {
                fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o777 });
                console.log('Created uploads directory:', uploadsDir);
            } catch (error) {
                console.error('Error creating uploads directory:', error);
                return cb(error);
            }
        }
        console.log('Saving file to:', uploadsDir);
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        // Generate a unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `${uniqueSuffix}${ext}`;
        console.log('Generated filename:', filename);
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('file');

// Apply CORS middleware
app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload endpoint with better error handling
app.post('/upload', (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            return res.status(400).json({ success: false, message: err.message });
        } else if (err) {
            console.error('Unknown upload error:', err);
            return res.status(500).json({ success: false, message: 'Unknown error' });
        }

        const file = req.files?.file?.[0];
        const uploader = req.body?.uploader;
        const receiver = req.body?.receiver;

        console.log('📤 File upload request received:', req.body);

        if (!file || !uploader || !receiver) {
            console.error('❌ Missing file, uploader, or receiver:', { file, uploader, receiver });
            return res.status(400).json({
                success: false,
                message: 'Missing file, uploader, or receiver'
            });
        }

        // Create message record in DB
        const fileData = {
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
            url: `/uploads/${file.filename}`
        };

        const dbName = `chat_${uploader}_${receiver}.db`;
        const db = new sqlite3.Database(dbName);
        const timestamp = Date.now();

        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT,
                content TEXT,
                sender TEXT,
                receiver TEXT,
                timestamp INTEGER,
                fileData TEXT,
                isPinned INTEGER DEFAULT 0
            )`);

            const stmt = db.prepare(`INSERT INTO messages (type, content, sender, receiver, timestamp, fileData)
                VALUES (?, ?, ?, ?, ?, ?)`);
            stmt.run(
                'file',
                null,
                uploader,
                receiver,
                timestamp,
                JSON.stringify(fileData)
            );
            stmt.finalize();
        });

        db.close();

        // Respond with file URL
        res.status(200).json({
            success: true,
            message: 'File uploaded and saved',
            url: fileData.url,
            file: fileData
        });
    });
});

// Add endpoint to toggle message pin status
app.post('/api/messages/:messageId/pin', (req, res) => {
    const messageId = req.params.messageId;
    const { isPinned, sender, receiver } = req.body;

    console.log('Pin request received:', { messageId, isPinned, sender, receiver });

    if (!sender || !receiver) {
        return res.status(400).json({ success: false, message: 'Sender and receiver are required' });
    }

    const dbName = `chat_${sender}_${receiver}.db`;
    const db = new sqlite3.Database(dbName);

    db.run('UPDATE messages SET isPinned = ? WHERE id = ?', [isPinned ? 1 : 0, messageId], function(err) {
        if (err) {
            console.error('Error updating message pin status:', err);
            return res.status(500).json({ success: false, message: 'Error updating pin status' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        res.json({ success: true });
    });

    db.close();
});

// Update the message fetching to include pin status
app.get('/messages', (req, res) => {
    const { sender, receiver } = req.query;
    
    if (!sender || !receiver) {
        return res.status(400).json({ success: false, message: 'Sender and receiver are required' });
    }
    
    const dbName = `chat_${sender}_${receiver}.db`;
    const db = new sqlite3.Database(dbName);
    
    db.all(
        `SELECT * FROM messages 
         WHERE (sender = ? AND receiver = ?) 
         OR (sender = ? AND receiver = ?)
         ORDER BY isPinned DESC, timestamp ASC`,
        [sender, receiver, receiver, sender],
        (err, rows) => {
            if (err) {
                console.error('Error fetching messages:', err);
                res.status(500).json({ success: false, message: 'Error fetching messages' });
                return;
            }
            
            // Convert isPinned from integer to boolean
            const messages = rows.map(row => ({
                ...row,
                isPinned: Boolean(row.isPinned)
            }));
            
            res.json({ success: true, messages });
        }
    );
    
    db.close();
});

app.post('/messages', (req, res) => {
    const { sender, receiver, message } = req.body;

    if (!sender || !receiver || !message) {
        return res.status(400).json({ success: false, message: 'Sender, receiver, and message are required' });
    }

    const dbName = `chat_${sender}_${receiver}.db`;
    const db = new sqlite3.Database(dbName);

    // Check for duplicates before inserting
    db.get(`SELECT id FROM messages WHERE sender = ? AND receiver = ? AND message = ? ORDER BY timestamp DESC LIMIT 1`,
        [sender, receiver, message],
        (err, row) => {
            if (err) {
                console.error('Error checking for duplicates:', err);
                return res.status(500).json({ success: false, message: 'Error checking for duplicates' });
            }

            if (row) {
                return res.status(409).json({ success: false, message: 'Duplicate message detected.' });
            }

            db.run(`INSERT INTO messages (sender, receiver, message, timestamp) VALUES (?, ?, ?, datetime('now'))`,
                [sender, receiver, message],
                function(err) {
                    if (err) {
                        console.error('Error inserting message:', err);
                        return res.status(500).json({ success: false, message: 'Failed to save message' });
                    }
                    res.json({ success: true, id: this.lastID });
                });
        });

    db.close();
});


// Add endpoint to delete a message
app.delete('/messages/:messageId', (req, res) => {
    const messageId = req.params.messageId;
    const { sender, receiver } = req.query;
    
    console.log('Delete request received:', { messageId, sender, receiver }); // Debug log
    
    if (!sender || !receiver) {
        console.error('Missing sender or receiver:', { sender, receiver });
        return res.status(400).json({ success: false, message: 'Sender and receiver are required' });
    }
    
    const dbName = `chat_${sender}_${receiver}.db`;
    console.log('Using database:', dbName); // Debug log
    
    const db = new sqlite3.Database(dbName);
    
    db.run('DELETE FROM messages WHERE id = ?', [messageId], function(err) {
        if (err) {
            console.error('Error deleting message:', err);
            res.status(500).json({ success: false, message: 'Error deleting message' });
            return;
        }
        
        if (this.changes === 0) {
            console.error('Message not found:', messageId);
            res.status(404).json({ success: false, message: 'Message not found' });
            return;
        }
        
        console.log('Message deleted successfully:', messageId); // Debug log
        
        // Emit socket event to notify clients about the deleted message
        io.emit('messageDeleted', { messageId });
        
        res.json({ success: true });
    });
    
    db.close();
});

// Add endpoint to handle new chat creation
app.post('/add-chat', (req, res) => {
    const { sender, receiver } = req.body;
    
    if (!sender || !receiver) {
        return res.status(400).json({
            success: false,
            message: 'Sender and receiver are required'
        });
    }

    try {
        // Create chat database for both users
        const dbName1 = `chat_${sender}_${receiver}.db`;
        const dbName2 = `chat_${receiver}_${sender}.db`;
        
        // Create databases if they don't exist
        const db1 = new sqlite3.Database(dbName1);
        const db2 = new sqlite3.Database(dbName2);

        // Create messages table in both databases
        const createTable = `CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            content TEXT,
            sender TEXT,
            receiver TEXT,
            timestamp INTEGER,
            fileData TEXT,
            isPinned INTEGER DEFAULT 0
        )`;

        db1.serialize(() => {
            db1.run(createTable);
        });

        db2.serialize(() => {
            db2.run(createTable);
        });

        db1.close();
        db2.close();

        // Emit event to notify both users about the new chat
        io.emit('updateChatList', { sender, receiver });

        console.log(`Chat created between ${sender} and ${receiver}`);

        res.json({
            success: true,
            message: 'Chat created successfully'
        });
    } catch (error) {
        console.error('Error creating chat:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating chat'
        });
    }
});

// Add endpoint to get user's chat list
app.get('/user-chats', (req, res) => {
    const { username } = req.query;
    
    if (!username) {
        return res.status(400).json({
            success: false,
            message: 'Username is required'
        });
    }

    try {
        // Get all database files that start with chat_username or where username is the receiver
        const files = fs.readdirSync(__dirname).filter(file => 
            file.startsWith('chat_') && 
            file.endsWith('.db') && 
            (file.includes(`_${username}_`) || file.includes(`_${username}.db`))
        );

        // Extract unique usernames from the database files
        const chats = files.map(file => {
            const parts = file.replace('chat_', '').replace('.db', '').split('_');
            return parts[0] === username ? parts[1] : parts[0];
        });

        // Remove duplicates
        const uniqueChats = [...new Set(chats)];

        res.json({
            success: true,
            chats: uniqueChats.map(username => ({ username }))
        });
    } catch (error) {
        console.error('Error getting chat list:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting chat list'
        });
    }
});

// Add task database initialization
function initializeTaskDatabase(userA, userB) {
    const dbName = `chat_${userA}_${userB}.db`;
    const db = new sqlite3.Database(dbName);
    
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task TEXT NOT NULL,
            status TEXT DEFAULT 'not complete',
            created_by TEXT,
            created_at INTEGER
        )`);
    });
    
    db.close();
}

// Add task endpoint
app.post('/chatDB/tasks', (req, res) => {
    const { task, userA, userB } = req.body;
    const loggedInUser = req.headers['x-logged-in-user'];

    console.log('Received task creation request:', { task, userA, userB, loggedInUser });

    if (!task || !userA || !userB) {
        const missingFields = [];
        if (!task) missingFields.push('task');
        if (!userA) missingFields.push('userA');
        if (!userB) missingFields.push('userB');
        
        return res.status(400).json({
            success: false,
            message: `Missing required fields: ${missingFields.join(', ')}`
        });
    }

    try {
        // Create database names for both users
        const dbNameA = `chat_${userA}_${userB}.db`;
        const dbNameB = `chat_${userB}_${userA}.db`;
        
        console.log('Creating task in databases:', { dbNameA, dbNameB });

        // Helper function to run database operations
        const addTaskToDb = (dbName) => {
            return new Promise((resolve, reject) => {
                const db = new sqlite3.Database(dbName);
                
                db.serialize(() => {
                    // Create table if it doesn't exist
                    db.run(`CREATE TABLE IF NOT EXISTS tasks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        task TEXT NOT NULL,
                        status TEXT DEFAULT 'not complete',
                        created_by TEXT,
                        created_at INTEGER
                    )`);

                    // Insert the task
                    const timestamp = Date.now();
                    db.run(
                        'INSERT INTO tasks (task, status, created_by, created_at) VALUES (?, ?, ?, ?)',
                        [task, 'not complete', loggedInUser, timestamp],
                        function(err) {
                            if (err) {
                                console.error('Error inserting task:', err);
                                db.close();
                                reject(err);
                                return;
                            }

                            // Get the inserted task
                            db.get('SELECT * FROM tasks WHERE id = ?', [this.lastID], (err, taskData) => {
                                db.close();
                                if (err) reject(err);
                                else resolve({ id: this.lastID, taskData });
                            });
                        }
                    );
                });
            });
        };

        // Add task to both databases
        Promise.all([
            addTaskToDb(dbNameA),
            addTaskToDb(dbNameB)
        ]).then(([resultA]) => {
            const newTask = {
                id: resultA.id,
                task: task,
                status: 'not complete',
                created_by: loggedInUser,
                created_at: Date.now()
            };

            // Emit socket event to notify clients
            io.emit('taskAdded', {
                userA,
                userB,
                task: newTask
            });

            console.log('Task created successfully:', newTask);

            res.json({
                success: true,
                task: newTask
            });
        }).catch(error => {
            console.error('Error adding task:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding task: ' + error.message
            });
        });

    } catch (error) {
        console.error('Error in task creation:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating task'
        });
    }
});

// Get tasks endpoint
app.get('/chatDB/tasks', (req, res) => {
    const { userA, userB } = req.query;

    if (!userA || !userB) {
        return res.status(400).json({
            success: false,
            message: 'Missing userA or userB'
        });
    }

    const dbName = `chat_${userA}_${userB}.db`;
    const db = new sqlite3.Database(dbName);

    db.all('SELECT * FROM tasks ORDER BY created_at DESC', [], (err, tasks) => {
        db.close();
        
        if (err) {
            console.error('Error fetching tasks:', err);
            return res.status(500).json({
                success: false,
                message: 'Error fetching tasks'
            });
        }

        res.json({
            success: true,
            tasks: tasks || []
        });
    });
});

// Update task status endpoint
app.put('/chatDB/tasks/:taskId/status', async (req, res) => {
    const taskId = req.params.taskId;
    const { status, userA, userB } = req.body;
    
    console.log('Received task status update:', { taskId, status, userA, userB });

    // Validate all required parameters
    if (!taskId || !status || !userA || !userB) {
        const missingParams = [];
        if (!taskId) missingParams.push('taskId');
        if (!status) missingParams.push('status');
        if (!userA) missingParams.push('userA');
        if (!userB) missingParams.push('userB');
        
        console.error('Missing required parameters:', missingParams);
        return res.status(400).json({ 
            success: false, 
            message: `Missing required parameters: ${missingParams.join(', ')}` 
        });
    }

    // Validate status value
    if (status !== 'complete' && status !== 'not complete') {
        return res.status(400).json({
            success: false,
            message: 'Invalid status value. Must be either "complete" or "not complete"'
        });
    }

    try {
        // Create database names for both users
        const dbNameA = `chat_${userA}_${userB}.db`;
        const dbNameB = `chat_${userB}_${userA}.db`;
        
        console.log('Updating task in databases:', { dbNameA, dbNameB });

        // Helper function to run database operations
        const updateTaskInDb = async (dbName) => {
            return new Promise((resolve, reject) => {
                const db = new sqlite3.Database(dbName);
                
                db.serialize(() => {
                    // Create table if it doesn't exist
                    db.run(`CREATE TABLE IF NOT EXISTS tasks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        task TEXT NOT NULL,
                        status TEXT DEFAULT 'not complete',
                        created_by TEXT,
                        created_at INTEGER
                    )`);

                    // Update task status
                    db.run('UPDATE tasks SET status = ? WHERE id = ?', [status, taskId], function(err) {
                        if (err) {
                            console.error('Database error:', err);
                            db.close();
                            reject(err);
                            return;
                        }

                        // Get updated task data
                        db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
                            db.close();
                            if (err) {
                                console.error('Error fetching updated task:', err);
                                reject(err);
                            } else {
                                resolve({ changes: this.changes, task });
                            }
                        });
                    });
                });
            });
        };

        // Update both databases concurrently
        const [resultA, resultB] = await Promise.all([
            updateTaskInDb(dbNameA),
            updateTaskInDb(dbNameB)
        ]);

        // Check if the task was found and updated
        if (resultA.changes === 0 && resultB.changes === 0) {
            console.error('Task not found:', taskId);
            return res.status(404).json({ 
                success: false, 
                message: 'Task not found' 
            });
        }

        // Get the task data from either result
        const task = resultA.task || resultB.task;

        // Broadcast the update to all connected clients
        io.emit('taskStatusChanged', {
            taskId: parseInt(taskId),
            status,
            userA,
            userB,
            task
        });

        console.log('Task status updated successfully:', { taskId, status });
        res.json({ 
            success: true, 
            message: 'Task status updated successfully',
            task 
        });

    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ 
            success: false, 
            message: `Error updating task status: ${error.message}` 
        });
    }
});

// Delete task endpoint
app.delete('/chatDB/tasks/:taskId', (req, res) => {
    const { taskId } = req.params;
    const { userA, userB } = req.query;

    if (!userA || !userB) {
        return res.status(400).json({
            success: false,
            message: 'Missing userA or userB'
        });
    }

    const dbNameA = `chat_${userA}_${userB}.db`;
    const dbNameB = `chat_${userB}_${userA}.db`;

    const deleteFromDb = (dbName) => {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbName);
            db.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
                db.close();
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    };

    Promise.all([deleteFromDb(dbNameA), deleteFromDb(dbNameB)])
        .then(([changesA, changesB]) => {
            if (changesA > 0 || changesB > 0) {
                // Broadcast the deletion to all connected clients
                io.emit('taskDeleted', { userA, userB, taskId });

                res.json({
                    success: true,
                    message: 'Task deleted successfully'
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Task not found'
                });
            }
        })
        .catch(err => {
            console.error('Error deleting task:', err);
            res.status(500).json({
                success: false,
                message: 'Error deleting task'
            });
        });
});

// Endpoint to securely serve the SECRET_KEY
app.get('/get-secret-key', (req, res) => {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) {
        console.error('SECRET_KEY is not defined in the environment variables.');
        return res.status(500).json({ success: false, message: 'SECRET_KEY is not defined.' });
    }
    res.json({ success: true, secretKey });
});

const bcrypt = require('bcrypt'); 
const sqlite3 = require('sqlite3');

app.post('/register', async (req, res) => {
    console.log('⚡ Register API called with body:', req.body);

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Missing username or password' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const db = new sqlite3.Database('users.db', (err) => {
            if (err) {
                console.error('Error connecting to users.db:', err);
            }
        });

        db.run('CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)', (err) => {
            if (err) {
                console.error('Error creating users table:', err);
                return res.status(500).json({ success: false, message: 'Database error (table)' });
            }
        });

        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
            db.close();
            if (err) {
                console.error('Error inserting user:', err);
                return res.status(500).json({ success: false, message: 'Database error (insert)' });
            }
            console.log('✅ Successfully registered user:', username);
            return res.status(201).json({ success: true, message: 'Registration successful' });
        });
    } catch (error) {
        console.error('Error during registration:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/get-upload', (req, res) => {
    console.log('💡 /get-upload handler triggered');

    const { id, userA, userB } = req.query;

    // Validate query params
    if (!id || !userA || !userB) {
        console.warn('⚠️ Missing parameters:', { id, userA, userB });
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    let db;
    try {
        db = getChatDB(userA, userB);
        console.log(`📂 Using DB: chat_${userA}_${userB}.db`);
    } catch (e) {
        console.error('❌ Failed to get DB:', e.message);
        return res.status(500).json({ success: false, message: 'DB error' });
    }

    // Now actually run the query
    db.get('SELECT * FROM uploads WHERE id = ?', [id], (err, row) => {
        console.log('🔍 db.get callback triggered');
        if (err) {
            console.error('❌ Upload fetch error:', err.message);
            return res.status(500).json({ success: false, message: 'DB query failed' });
        }

        if (!row) {
            console.warn(`⚠️ No upload found for ID ${id}`);
            return res.status(404).json({ success: false, message: 'Upload not found' });
        }

        console.log('✅ Upload row:', row);

        // Ensure all expected fields exist
        res.json({
            success: true,
            file: {
                name: row.filename,
                type: row.filetype,
                size: row.size || 0,
                url: row.filepath  // ✅ Change this from `filepath:` to `url:`
            }
        });
    });

    // Failsafe response if something hangs
    setTimeout(() => {
        if (!res.headersSent) {
            console.error('⏱ Timeout: /get-upload failed to send');
            res.status(500).json({ success: false, message: 'Timeout — no response sent' });
        }
    }, 5000);
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`HTTPS Server running at https://localhost:${PORT}`);
});