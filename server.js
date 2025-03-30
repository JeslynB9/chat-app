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
    fs.mkdirSync(uploadsDir, { recursive: true });
}

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
        socket.broadcast.emit('userJoined', username);
        io.emit('updateUserList', Array.from(new Set([...connectedUsers, username])));
        connectedUsers.add(username);
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
        const room = [userA, userB].sort().join('_');
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            connectedUsers.delete(socket.username);
            io.emit('userLeft', socket.username);
            io.emit('updateUserList', Array.from(connectedUsers));
        }
        console.log('A user disconnected');
    });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        console.log('Saving file to:', uploadDir);
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Apply CORS middleware
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    console.log('File upload request received');
    
    if (!req.file) {
        console.error('No file received');
        return res.status(400).json({
            success: false,
            error: 'No file received'
        });
    }

    try {
        console.log('File saved:', req.file);
        
        // Return the file URL and details
        res.json({
            success: true,
            url: `/uploads/${req.file.filename}`,
            name: req.file.originalname,
            type: req.file.mimetype,
            size: req.file.size
        });
    } catch (error) {
        console.error('Error handling file upload:', error);
        res.status(500).json({
            success: false,
            error: 'Error saving file'
        });
    }
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

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 