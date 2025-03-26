const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./database'); // SQLite DB module

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// File uploads
const upload = multer({ dest: 'uploads/' });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
                console.error('Registration DB Error:', err);  // <-- Add this line
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
    if (!req.file) return res.status(400).send('No file uploaded.');
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
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

// ========== Socket.IO ==========
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('sendMessage', (data) => {
        console.log('Message received:', data);
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

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});