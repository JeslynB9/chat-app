const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./chat-app.db', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

module.exports = db;


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

// Create the `pins` table
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS pins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT NOT NULL,
            category TEXT NOT NULL,
            UNIQUE(user, category)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating pins table:', err.message);
        } else {
            console.log('Pins table created or already exists.');
        }
    });
});

// Create the `pinned_chats` table
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS pinned_chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pin_id INTEGER NOT NULL,
            chat_username TEXT NOT NULL,
            FOREIGN KEY(pin_id) REFERENCES pins(id),
            UNIQUE(pin_id, chat_username)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating pinned_chats table:', err.message);
        } else {
            console.log('Pinned chats table created or already exists.');
        }
    });
});

// Create the `uploads` table
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            filepath TEXT,
            filetype TEXT,
            uploader TEXT,
            timestamp INTEGER
        )
    `, (err) => {
        if (err) {
            console.error('Error creating uploads table:', err.message);
        } else {
            console.log('Uploads table created or already exists.');
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

// Add a calendar event for a chat
function addCalendarEvent({ title, start, end, chat_id }, callback) {
    console.log('Attempting to add event to database:', { title, start, end, chat_id }); // Log the event details

    const query = `
        INSERT INTO calendar_events (title, start, end, chat_id)
        VALUES (?, ?, ?, ?)
    `;
    db.run(query, [title, start, end, chat_id], function (err) {
        if (err) {
            console.error('Error adding event to database:', err); // Log the detailed error
            callback(err);
        } else {
            console.log('Event added to database with ID:', this.lastID); // Log the inserted event ID
            callback(null, { id: this.lastID, title, start, end, chat_id });
        }
    });
}

// Fetch all events for a chat
function getEvents(chat_id, callback) {
    const query = `SELECT * FROM calendar_events WHERE chat_id = ?`;
    db.all(query, [chat_id], (err, rows) => {
        if (err) {
            console.error('Error fetching calendar events:', err);
            callback(err);
        } else {
            callback(null, rows);
        }
    });
}

// Create events table
db.run(`
    CREATE TABLE IF NOT EXISTS events (
    INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT,
      username TEXT NOT NULL
    )
`);

// Add an event
function addEvent(event, callback) {
    const { title, start, end, username } = event;
    const query = `INSERT INTO events (title, start, end, username) VALUES (?, ?, ?, ?)`;
    db.run(query, [title, start, end, username], function (err) {
        if (err) {
            console.error('Error adding event to database:', err); // Debugging log
            return callback(err);
        }
        console.log('Event added to database with ID:', this.lastID); // Debugging log
        callback(null, { id: this.lastID, ...event });
    });
}

exports.addEvent = (event, callback) => {
    const { title, start, end, username } = event;
    const query = `INSERT INTO events (title, start, end, username) VALUES (?, ?, ?, ?)`;
    db.run(query, [title, start, end, username], function (err) {
        if (err) return callback(err);
        callback(null, { id: this.lastID, ...event });
    });
};

// Fetch all events for a user
function getEvents(username, callback) {
    console.log('Fetching events for username from database:', username); // Debugging log
    const query = `SELECT * FROM events WHERE username = ?`;
    db.all(query, [username], (err, rows) => {
        if (err) {
            console.error('Error fetching events from database:', err); // Debugging log
            return callback(err);
        }
        console.log('Fetched events from database for username:', username, rows); // Debugging log
        callback(null, rows);
    });
}

function addCalendarEventForUsers({ title, start, end, usernames }, callback) {
    console.log('Adding event for users:', { title, start, end, usernames }); // Debugging log

    const query = `
        INSERT INTO calendar_events (title, start, end, username)
        VALUES ${usernames.map(() => '(?, ?, ?, ?)').join(', ')}
    `;
    const params = usernames.flatMap(username => [title, start, end, username]);

    db.run(query, params, function (err) {
        if (err) {
            console.error('Error adding event to database:', err); // Debugging log
            callback(err);
        } else {
            console.log('Event added to database with ID:', this.lastID); // Debugging log
            callback(null, { id: this.lastID, title, start, end, usernames });
        }
    });
}

function getEventsForUsers(usernames, callback) {
    const query = `
        SELECT * FROM calendar_events
        WHERE username IN (${usernames.map(() => '?').join(', ')})
    `;
    db.all(query, usernames, (err, rows) => {
        if (err) {
            console.error('Error fetching events from database:', err); // Debugging log
            callback(err);
        } else {
            callback(null, rows);
        }
    });
}

// Delete an event by ID
function deleteEvent(eventId, callback) {
    const query = `DELETE FROM events WHERE id = ?`;
    db.run(query, [eventId], function (err) {
        if (err) {
            console.error('Error deleting event from database:', err); // Debugging log
            callback(err);
        } else {
            console.log('Event deleted from database with ID:', eventId); // Debugging log
            callback(null, { id: eventId });
        }
    });
}

// Add a new pin for a user
function addPin(user, category, callback) {
    const query = `INSERT INTO pins (user, category) VALUES (?, ?)`;
    db.run(query, [user, category], function (err) {
        if (err) {
            console.error('Error adding pin:', err.message);
            callback(err);
        } else {
            callback(null, { id: this.lastID, user, category });
        }
    });
}

// Get all pins for a user
function getPins(user, callback) {
    const query = `SELECT * FROM pins WHERE user = ?`;
    db.all(query, [user], (err, rows) => {
        if (err) {
            console.error('Error fetching pins:', err.message);
            callback(err);
        } else {
            callback(null, rows);
        }
    });
}

// Add a chat to a pin
function addChatToPin(pinId, chatUsername, callback) {
    const query = `INSERT INTO pinned_chats (pin_id, chat_username) VALUES (?, ?)`;
    db.run(query, [pinId, chatUsername], function (err) {
        if (err) {
            console.error('Error adding chat to pin:', err.message);
            callback(err);
        } else {
            callback(null, { id: this.lastID, pinId, chatUsername });
        }
    });
}

// Get all chats for a specific pin
function getChatsForPin(pinId, callback) {
    const query = `SELECT chat_username FROM pinned_chats WHERE pin_id = ?`;
    db.all(query, [pinId], (err, rows) => {
        if (err) {
            console.error('Error fetching chats for pin:', err.message);
            callback(err);
        } else {
            callback(null, rows.map(row => row.chat_username));
        }
    });
}

// Remove a chat from a pin
function removeChatFromPin(pinId, chatUsername, callback) {
    const query = `DELETE FROM pinned_chats WHERE pin_id = ? AND chat_username = ?`;
    db.run(query, [pinId, chatUsername], function (err) {
        if (err) {
            console.error('Error removing chat from pin:', err.message);
            callback(err);
        } else {
            callback(null, { pinId, chatUsername });
        }
    });
}

// Remove a pin and all associated chats
function removePin(pinId, callback) {
    const deleteChatsQuery = `DELETE FROM pinned_chats WHERE pin_id = ?`;
    const deletePinQuery = `DELETE FROM pins WHERE id = ?`;

    db.run(deleteChatsQuery, [pinId], (err) => {
        if (err) {
            console.error('Error removing chats for pin:', err.message);
            callback(err);
        } else {
            db.run(deletePinQuery, [pinId], (err) => {
                if (err) {
                    console.error('Error removing pin:', err.message);
                    callback(err);
                } else {
                    callback(null, { pinId });
                }
            });
        }
    });
}

module.exports = {
    db,
    registerUser,
    authenticateUser,
    saveUsername,
    getAllUsernames,
    getMessagesBetweenUsers,
    saveMessage,
    addChatForBothUsers,
    getUserChats,
    getAllCalendarEvents,
    addCalendarEvent,
    getEvents,
    addCalendarEventForUsers,
    getEventsForUsers,
    addEvent,
    deleteEvent,
    addPin,
    getPins,
    addChatToPin,
    getChatsForPin,
    removeChatFromPin,
    removePin
};

