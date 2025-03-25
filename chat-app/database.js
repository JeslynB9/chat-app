const sqlite3 = require('sqlite3').verbose();

// Create or open the database file
const db = new sqlite3.Database('./chat-app.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Create the `users` table if it doesn't exist
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL
        )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Users table created or already exists.');
        }
    });
});

// Function to save a username
function saveUsername(username, callback) {
    const query = `INSERT INTO users (username) VALUES (?)`;
    db.run(query, [username], function (err) {
        if (err) {
            callback(err);
        } else {
            callback(null, { id: this.lastID, username });
        }
    });
}

// Function to retrieve all usernames
function getAllUsernames(callback) {
    const query = `SELECT * FROM users`;
    db.all(query, [], (err, rows) => {
        if (err) {
            callback(err);
        } else {
            callback(null, rows);
        }
    });
}

module.exports = {
    saveUsername,
    getAllUsernames
};