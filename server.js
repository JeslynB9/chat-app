const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
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
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
}).single('file'); // Configure multer to expect a single file with field name 'file'

// Apply CORS middleware
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload endpoint with better error handling
app.post('/upload', (req, res) => {
    // Set response headers
    res.setHeader('Content-Type', 'application/json');

    upload(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            return res.status(400).json({
                success: false,
                message: `Upload error: ${err.message}`
            });
        } else if (err) {
            console.error('Unknown upload error:', err);
            return res.status(500).json({
                success: false,
                message: 'Error uploading file'
            });
        }

        if (!req.file) {
            console.error('No file received');
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        try {
            // Log successful upload
            console.log('File uploaded successfully:', req.file);

            // Return success response with file details
            res.status(200).json({
                success: true,
                message: 'File uploaded successfully',
                url: `/uploads/${req.file.filename}`,
                file: {
                    filename: req.file.filename,
                    originalname: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size
                }
            });
        } catch (error) {
            console.error('Error processing upload:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing upload'
            });
        }
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

    if (!task || !userA || !userB) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields'
        });
    }

    try {
        // Initialize databases if they don't exist
        initializeTaskDatabase(userA, userB);
        initializeTaskDatabase(userB, userA);

        // Add task to both users' databases
        const dbNameA = `chat_${userA}_${userB}.db`;
        const dbNameB = `chat_${userB}_${userA}.db`;
        const timestamp = Date.now();

        const addTaskToDb = (dbName) => {
            return new Promise((resolve, reject) => {
                const db = new sqlite3.Database(dbName);
                db.run(
                    'INSERT INTO tasks (task, created_by, created_at) VALUES (?, ?, ?)',
                    [task, loggedInUser, timestamp],
                    function(err) {
                        db.close();
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });
        };

        Promise.all([
            addTaskToDb(dbNameA),
            addTaskToDb(dbNameB)
        ]).then(([taskIdA]) => {
            // Emit socket event to notify clients
            io.emit('taskAdded', {
                userA,
                userB,
                task: {
                    id: taskIdA,
                    task,
                    status: 'not complete',
                    created_by: loggedInUser,
                    created_at: timestamp
                }
            });

            res.json({
                success: true,
                task: {
                    id: taskIdA,
                    task,
                    status: 'not complete'
                }
            });
        }).catch(error => {
            console.error('Error adding task:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding task'
            });
        });
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding task'
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

    if (!userA || !userB || !status) {
        console.error('Missing required parameters:', { userA, userB, status });
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required parameters: userA, userB, or status' 
        });
    }

    try {
        const dbNameA = `chat_${userA}_${userB}.db`;
        const dbNameB = `chat_${userB}_${userA}.db`;
        
        // Create tasks table if it doesn't exist in both databases
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task TEXT NOT NULL,
                status TEXT DEFAULT 'not complete',
                created_by TEXT,
                created_at INTEGER
            )
        `;

        const dbA = new sqlite3.Database(dbNameA);
        const dbB = new sqlite3.Database(dbNameB);

        await Promise.all([
            dbA.run(createTableQuery),
            dbB.run(createTableQuery)
        ]);

        // Update task status in both databases
        const updateQuery = `
            UPDATE tasks 
            SET status = ? 
            WHERE id = ?
        `;

        const [resultA, resultB] = await Promise.all([
            dbA.run(updateQuery, [status, taskId]),
            dbB.run(updateQuery, [status, taskId])
        ]);

        if (resultA.changes === 0 && resultB.changes === 0) {
            console.error('Task not found:', taskId);
            return res.status(404).json({ 
                success: false, 
                message: 'Task not found' 
            });
        }

        // Fetch updated task to verify the change
        const getTaskQuery = `SELECT * FROM tasks WHERE id = ?`;
        const taskA = await dbA.get(getTaskQuery, [taskId]);
        const taskB = await dbB.get(getTaskQuery, [taskId]);
        
        if (!taskA || !taskB) {
            console.error('Failed to fetch updated task:', taskId);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to verify task update' 
            });
        }

        // Broadcast the update to all connected clients
        io.emit('taskStatusChanged', {
            taskId,
            status,
            userA,
            userB
        });

        console.log('Task status updated successfully:', { taskId, status });
        res.json({ 
            success: true, 
            message: 'Task status updated successfully',
            task: taskA || taskB 
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

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 