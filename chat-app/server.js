const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for testing; restrict in production
        methods: ["GET", "POST"]
    }
});

app.use(cors());

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' }); // Images will be saved in the 'uploads' folder

const connectDB = require('./db');

// Connect to MongoDB
connectDB();

const userRoutes = require('./routes/user_routes');

app.use(express.json()); // Middleware to parse JSON
app.use('/api/users', userRoutes);

// Serve static files (e.g., uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Handle image uploads
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
});

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Listen for text messages
    socket.on('sendMessage', (data) => {
        console.log('Message received:', data);
        
        // Broadcast message to all clients
        io.emit('receiveMessage', data);
    });

    // Listen for image messages
    socket.on('sendImage', (data) => {
        console.log('Image received:', data);
        
        // Broadcast image to all clients
        io.emit('receiveMessage', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

app.post('/save-username', express.json(), (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

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
app.post('/save-username', express.json(), (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

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