const sqlite3 = require('sqlite3').verbose();

// Create or open the database
const db = new sqlite3.Database('./chat-app.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Create the `users` table with password field
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            console.log('Users table created or already exists.');
        }
    });
});

// Register new user
function registerUser(username, hashedPassword, callback) {
    const query = `INSERT INTO users (username, password) VALUES (?, ?)`;
    db.run(query, [username, hashedPassword], function (err) {
        if (err) {
            callback(err);
        } else {
            callback(null, this.lastID);
        }
    });
}

// Authenticate user by username
function authenticateUser(username, callback) {
    const query = `SELECT * FROM users WHERE username = ?`;
    db.get(query, [username], (err, row) => {
        if (err) {
            callback(err);
        } else {
            callback(null, row);
        }
    });
}

// Optional: Still support saveUsername (if used elsewhere)
function saveUsername(username, callback) {
    const query = `INSERT INTO users (username, password) VALUES (?, ?)`;
    const dummyPassword = 'default'; // Not recommended for real use
    db.run(query, [username, dummyPassword], function (err) {
        if (err) {
            callback(err);
        } else {
            callback(null, { id: this.lastID, username });
        }
    });
}

// Optional: Get all users
function getAllUsernames(callback) {
    const query = `SELECT id, username FROM users`;
    db.all(query, [], (err, rows) => {
        if (err) {
            callback(err);
        } else {
            callback(null, rows);
        }
    });
}

module.exports = {
    registerUser,
    authenticateUser,
    saveUsername,
    getAllUsernames
};