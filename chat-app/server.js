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

const calendarRoutes = require('./routes/calendar');
app.use('/api/calendar', calendarRoutes);

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

    // Handle profile picture updates
    socket.on('updateProfilePicture', ({ username, imageUrl }) => {
    });
});

// Start the server
// === CALENDAR: Add new event ===
app.post('/calendar/events', (req, res) => {
    const event = req.body;

    if (!event.title || !event.start || !event.username) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    db.addEvent(event, (err, savedEvent) => {
        if (err) {
            console.error('Failed to save event:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.status(201).json({ success: true, event: savedEvent });
    });
});

// === CALENDAR: Fetch all events for user ===
app.get('/calendar/events', (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ success: false, message: 'Username required' });

    db.getEvents(username, (err, events) => {
        if (err) {
            console.error('Failed to fetch events:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, events });
    });
});
server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});