// authRoutes.js
const express = require('express');
const sqlite3 = require('sqlite3');
const { hashPassword, verifyPassword } = require('./passwordUtils');
const { isPasswordSecure } = require('./passwordValidator');
const { generateToken } = require('./jwtUtils');
const bcrypt = require('bcryptjs'); // Replace bcrypt with bcryptjs

const router = express.Router();
const userDB = new sqlite3.Database('users.db');

// Ensure users table exists
userDB.serialize(() => {
    userDB.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )
    `);
});

router.post('/register', async (req, res) => {
    console.log('⚡ Register API called with body:', req.body);  // ADD THIS LINE!
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Missing username or password' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const db = new sqlite3.Database('users.db');

        db.run('CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)', (err) => {
            if (err) {
                console.error('Error creating users table:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }
        });

        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
            db.close();
            if (err) {
                console.error('Error inserting user:', err);
                return res.status(500).json({ success: false, message: 'Registration failed (maybe username already exists)' });
            }

            return res.status(201).json({ success: true, message: 'Registration successful' });
        });
    } catch (error) {
        console.error('Error during registration:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// LOGIN endpoint
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Missing username or password' });
    }

    try {
        const db = new sqlite3.Database('users.db');

        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            db.close();

            if (err) {
                console.error('Database error during login:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }

            if (!user) {
                // No such username found
                return res.status(401).json({ success: false, message: 'Invalid username or password' });
            }

            // Now check password with bcrypt
            const isPasswordCorrect = await bcrypt.compare(password, user.password);

            if (!isPasswordCorrect) {
                return res.status(401).json({ success: false, message: 'Invalid username or password' });
            }

            // If correct
            return res.json({ success: true, message: 'Login successful' });
        });

    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});



module.exports = router;