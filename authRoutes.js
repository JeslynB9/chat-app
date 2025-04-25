// authRoutes.js
const express = require('express');
const sqlite3 = require('sqlite3');
const { hashPassword, verifyPassword } = require('./passwordUtils');
const { isPasswordSecure } = require('./passwordValidator');
const { generateToken } = require('./jwtUtils');
const bcrypt = require('bcrypt');

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

// REGISTER endpoint
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const check = isPasswordSecure(password);
    if (!check.secure) {
        return res.status(400).json({ success: false, message: check.message });
    }

    try {
        const hashed = await hashPassword(password);
        userDB.run(
            `INSERT INTO users (username, password) VALUES (?, ?)`,
            [username, hashed],
            function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT') {
                        return res.status(409).json({ success: false, message: 'Username already exists' });
                    }
                    return res.status(500).json({ success: false, message: 'Database error' });
                }

                res.status(201).json({ success: true, message: 'User registered successfully' });
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// LOGIN endpoint
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    userDB.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, row) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (!row) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const match = await verifyPassword(password, row.password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const token = generateToken({ username });
        res.json({ success: true, token, message: 'Login successful' });
    });
});

module.exports = router;