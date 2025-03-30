const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
    console.log('A user connected');

    socket.on('setUsername', (username) => {
        socket.username = username;
        socket.broadcast.emit('userJoined', username);
        io.emit('updateUserList', Array.from(new Set([...connectedUsers, username])));
        connectedUsers.add(username);
    });

    socket.on('sendMessage', (data) => {
        console.log('Received message:', {
            type: data.type,
            sender: data.sender,
            receiver: data.receiver,
            fileData: data.fileData ? {
                name: data.fileData.name,
                type: data.fileData.type,
                size: data.fileData.size
            } : undefined
        });

        const { sender, receiver, timestamp } = data;
        const room = [sender, receiver].sort().join('-');

        try {
            // Format the message content based on type
            let messageContent;
            let messageToSend;

            if (data.type === 'file') {
                // Save the file and get its URL
                const fileUrl = saveFile(data.fileData.data, data.fileData.type);
                
                // Create the message content for database
                const fileData = {
                    name: data.fileData.name,
                    type: data.fileData.type,
                    size: data.fileData.size,
                    url: fileUrl
                };

                messageContent = JSON.stringify({
                    type: 'file',
                    fileData: fileData
                });

                // Create message to send to clients (without base64 data)
                messageToSend = {
                    type: 'file',
                    sender: data.sender,
                    receiver: data.receiver,
                    timestamp: data.timestamp,
                    fileData: fileData
                };
            } else {
                messageContent = data.message;
                messageToSend = data;
            }

            // Get the chat-specific database
            const db = getChatDB(sender, receiver);

            // Save the message to the database
            db.run(
                'INSERT INTO messages (sender, receiver, message, timestamp) VALUES (?, ?, ?, ?)',
                [sender, receiver, messageContent, timestamp],
                (err) => {
                    if (err) {
                        console.error('Error saving message:', err);
                        return;
                    }

                    // Broadcast the message without base64 data
                    io.to(room).emit('receiveMessage', messageToSend);
                    io.to(sender).emit('receiveMessage', messageToSend);
                    io.to(receiver).emit('receiveMessage', messageToSend);
                }
            );
        } catch (error) {
            console.error('Error processing message:', error);
        }
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
        console.log('Multer destination called:', { file: file.originalname });
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        console.log('Multer filename called:', { file: file.originalname });
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Apply CORS middleware with proper configuration
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// File upload endpoint
app.post('/upload', (req, res) => {
    console.log('Upload endpoint hit');
    console.log('Request headers:', req.headers);
    
    upload.single('file')(req, res, function(err) {
        console.log('Multer upload callback:', { 
            error: err, 
            file: req.file,
            body: req.body 
        });

        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            return res.status(400).json({
                success: false,
                error: `Upload error: ${err.message}`
            });
        } else if (err) {
            console.error('Unknown upload error:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload file'
            });
        }

        if (!req.file) {
            console.error('No file uploaded');
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        try {
            const fileUrl = `/uploads/${req.file.filename}`;
            console.log('File uploaded successfully:', {
                filename: req.file.filename,
                originalname: req.file.originalname,
                size: req.file.size,
                url: fileUrl
            });

            res.json({
                success: true,
                url: fileUrl,
                filename: req.file.originalname,
                size: req.file.size
            });
        } catch (error) {
            console.error('Error processing uploaded file:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process uploaded file'
            });
        }
    });
}); 