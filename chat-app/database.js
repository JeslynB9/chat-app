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

// Create the `messages` table
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL,
            receiver TEXT NOT NULL,
            message TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating messages table:', err.message);
        } else {
            console.log('Messages table created or already exists.');
        }
    });
});

// Create the `calendar_events` table
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS calendar_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            start TEXT NOT NULL,
            end TEXT NOT NULL,
            created_by TEXT
        )
    `, (err) => {
        if (err) {
            console.error('Error creating calendar_events table:', err.message);
        } else {
            console.log('Calendar events table created or already exists.');
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
            if (!row) return callback(null, null);
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

// Fetch messages between two users
function getMessagesBetweenUsers(sender, receiver, callback) {
    const query = `
        SELECT * FROM messages
        WHERE sender = ? OR receiver = ?
        ORDER BY createdAt ASC
    `;
    db.all(query, [sender, receiver], (err, rows) => {
        if (err) {
            console.error('Error fetching messages from database:', err);
            callback(err);
        } else {
            callback(null, rows);
        }
    });
}

// Save a new message
function saveMessage(sender, receiver, message, callback) {
    const query = `
        INSERT INTO messages (sender, receiver, message, createdAt)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `;
    db.run(query, [sender, receiver, message], function (err) {
        if (err) {
            console.error('Error saving message to database:', err);
            callback(err);
        } else {
            callback(null, { id: this.lastID, sender, receiver, message });
        }
    });
}

// Add a chat for both users
function addChatForBothUsers(sender, receiver, callback) {
    const query = `
        INSERT INTO messages (sender, receiver, message, createdAt)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP), (?, ?, ?, CURRENT_TIMESTAMP)
    `;
    const initialMessage = `Chat started: ${new Date().toLocaleString()}`;
    db.run(query, [sender, receiver, initialMessage, receiver, sender, initialMessage], (err) => {
        if (err) {
            console.error('Error adding chat for both users:', err);
            callback(err);
        } else {
            callback(null);
        }
    });
}

// Fetch the chat list for a specific user
function getUserChats(username, callback) {
    const query = `
        SELECT DISTINCT CASE
            WHEN sender = ? THEN receiver
            WHEN receiver = ? THEN sender
        END AS username
        FROM messages
        WHERE sender = ? OR receiver = ?
    `;
    db.all(query, [username, username, username, username], (err, rows) => {
        if (err) {
            console.error('Error fetching user chats from database:', err);
            callback(err);
        } else {
            callback(null, rows);
        }
    });
}

function getAllCalendarEvents(callback) {
    const query = `SELECT * FROM calendar_events`;
    db.all(query, [], (err, rows) => {
        if (err) {
            callback(err);
        } else {
            callback(null, rows);
        }
    });
}

function addCalendarEvent({ title, start, end, created_by }, callback) {
    const query = `
        INSERT INTO calendar_events (title, start, end, created_by)
        VALUES (?, ?, ?, ?)
    `;
    db.run(query, [title, start, end, created_by], function (err) {
        if (err) {
            callback(err);
        } else {
            callback(null, { id: this.lastID });
        }
    });
}

// Create events table
db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT,
      username TEXT NOT NULL
    )
  `);
  
  // Add an event
  exports.addEvent = (event, callback) => {
      const { title, start, end, username } = event;
      const query = `INSERT INTO events (title, start, end, username) VALUES (?, ?, ?, ?)`;
      db.run(query, [title, start, end, username], function (err) {
          if (err) return callback(err);
          callback(null, { id: this.lastID, ...event });
      });
  };
  
  // Fetch all events for a user
  exports.getEvents = (username, callback) => {
      const query = `SELECT * FROM events WHERE username = ?`;
      db.all(query, [username], callback);
  };

module.exports = {
    registerUser,
    authenticateUser,
    saveUsername,
    getAllUsernames,
    getMessagesBetweenUsers,
    saveMessage,
    addChatForBothUsers,
    getUserChats,
    getAllCalendarEvents,
    addCalendarEvent
};

