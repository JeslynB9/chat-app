const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') }); // Corrected .env path
const sqlite3 = require('sqlite3').verbose(); // Corrected syntax
const fs = require('fs');
const CryptoJS = require('crypto-js'); // Import CryptoJS for encryption and decryption

// Ensure directory exists
const chatDBPath = path.join(__dirname, '../chat_dbs');
if (!fs.existsSync(chatDBPath)) {
  fs.mkdirSync(chatDBPath);
}

// Get sorted DB filename
function getChatDBName(userA, userB) {
  const sorted = [userA, userB].sort();
  return `chat_${sorted[0]}_${sorted[1]}.db`;
}

// Get or create DB
function getChatDB(userA, userB) {
  const dbName = getChatDBName(userA, userB);
  const dbPath = path.join(chatDBPath, dbName);
  const db = new sqlite3.Database(dbPath);
  // Create tables if not exist
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        message TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        start TEXT,
        end TEXT,
        created_by TEXT
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        filepath TEXT,
        uploader TEXT,
        timestamp INTEGER
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT,
        status TEXT DEFAULT 'not complete'
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS pins (
        id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        PRIMARY KEY (id, message_id)
      )
    `);
    // Add default pins if not already present
    const defaultPins = [
      { id: 'Urgent', message_id: 'Urgent' }, // Retain original casing
      { id: 'General', message_id: 'General' } // Retain original casing
    ];
    defaultPins.forEach(pin => {
      db.run(
        `INSERT OR IGNORE INTO pins (id, message_id) VALUES (?, ?)`,
        [pin.id, pin.message_id],
        (err) => {
          if (err) {
            console.error('Error adding default pin:', err);
          }
        }
      );
    });
  });
  return db;
}

const secretKey = process.env.SECRET_KEY || 'hardcoded-secret-key'; // Fallback for testing
console.log('Loaded SECRET_KEY:', secretKey); // Debugging log
if (!secretKey) {
  console.error('SECRET_KEY is not defined.');
  throw new Error('SECRET_KEY is not defined.');
}

function encryptMessage(message) {
  return CryptoJS.AES.encrypt(message, secretKey).toString();
}

function decryptMessage(encryptedMessage) {
  try {
    // Check if the input is a valid encrypted string
    if (!encryptedMessage || !encryptedMessage.includes('U2FsdGVkX1')) {
      console.warn('Skipping decryption for non-encrypted data:', encryptedMessage);
      return encryptedMessage; // Return the plain text as is
    }

    const bytes = CryptoJS.AES.decrypt(encryptedMessage, secretKey);
    const decryptedMessage = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedMessage) {
      throw new Error('Decryption resulted in an empty string');
    }
    return decryptedMessage;
  } catch (error) {
    console.error('Error decrypting message:', error.message, 'Encrypted data:', encryptedMessage);
    return '[Decryption Error]'; // Return a placeholder message
  }
}

// Add an event to the chat-specific database
function addEvent(userA, userB, event, callback) {
  const db = getChatDB(userA, userB);
  const { title, start, end, created_by } = event;
  const query = `
    INSERT INTO events (title, start, end, created_by)
    VALUES (?, ?, ?, ?)
  `;
  db.run(query, [title, start, end, created_by], function (err) {
    if (err) {
      console.error('Error adding event to chat-specific database:', err);
      return callback(err);
    }
    console.log('Event added to chat-specific database with ID:', this.lastID);
    callback(null, { id: this.lastID, ...event });
  });
}

// Delete an event from the chat-specific database
function deleteEvent(userA, userB, eventId, callback) {
  const db = getChatDB(userA, userB);
  const query = `DELETE FROM events WHERE id = ?`;
  db.run(query, [eventId], function (err) {
    if (err) {
      console.error('Error deleting event from chat-specific database:', err);
      return callback(err);
    }
    console.log('Event deleted from chat-specific database with ID:', eventId);
    callback(null, { id: eventId });
  });
}

// Add a task to the chat-specific database
function addTask(userA, userB, task, callback) {
  const db = getChatDB(userA, userB); // Ensure the correct database is used
  const { task: taskText, status } = task;
  const query = `
    INSERT INTO tasks (task, status)
    VALUES (?, ?)
  `;
  console.log(`Adding task to chat_${[userA, userB].sort().join('_')}.db`); // Debugging log
  db.run(query, [taskText, status], function (err) {
    if (err) {
      console.error(`Error adding task to chat_${[userA, userB].sort().join('_')}.db:`, err);
      return callback(err);
    }
    console.log(`Task added to chat_${[userA, userB].sort().join('_')}.db with ID:`, this.lastID); // Debugging log
    callback(null, { id: this.lastID, task: taskText, status });
  });
}

// Save a new message to the chat-specific database
function saveMessage(userA, userB, sender, receiver, message, callback) {
  const db = getChatDB(userA, userB); // Get the chat-specific database

  if (!message || message.trim() === '') {
    console.error('Error: Message is empty or null. Cannot save to database.');
    return callback(new Error('Message cannot be empty.'));
  }

  const encryptedMessage = encryptMessage(message); // Encrypt the message
  const query = `
    INSERT INTO messages (sender, receiver, message, createdAt)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `;
  db.run(query, [sender, receiver, encryptedMessage], function (err) {
    if (err) {
      console.error('Error saving message to chat-specific database:', err);
      callback(err);
    } else {
      callback(null, { id: this.lastID, sender, receiver, message: encryptedMessage });
    }
  });
}

// Fetch messages between two users from the chat-specific database
function getMessagesBetweenUsers(userA, userB, callback) {
  const db = getChatDB(userA, userB); // Get the chat-specific database
  const query = `
    SELECT * FROM messages
    WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
    ORDER BY createdAt ASC
  `;
  db.all(query, [userA, userB, userB, userA], (err, rows) => {
    if (err) {
      console.error('Error fetching messages from chat-specific database:', err);
      callback(err);
    } else {
      // Decrypt messages before returning
      const decryptedRows = rows.map(row => ({
        ...row,
        message: decryptMessage(row.message)
      }));
      callback(null, decryptedRows);
    }
  });
}

// Add a chat for both users in the chat-specific database
function addChatForBothUsers(userA, userB, callback) {
  const db = getChatDB(userA, userB); // Get the chat-specific database
  const query = `
    INSERT INTO messages (sender, receiver, message, createdAt)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP), (?, ?, ?, CURRENT_TIMESTAMP)
  `;
  const initialMessage = `Chat started: ${new Date().toLocaleString()}`;
  db.run(query, [userA, userB, initialMessage, userB, userA, initialMessage], (err) => {
    if (err) {
      console.error('Error adding chat for both users:', err);
      callback(err);
    } else {
      callback(null);
    }
  });
}

// Create a new pin for a message
function createPin(userA, userB, pinId, messageId, callback) {
  const db = getChatDB(userA, userB);
  const query = `
    INSERT OR IGNORE INTO pins (id, message_id)
    VALUES (?, ?)
  `;
  db.run(query, [pinId, messageId], function (err) {
    if (err) {
      console.error('Error creating pin:', err);
      return callback(err);
    }
    console.log('Pin created with ID:', pinId);
    callback(null, { id: pinId, message_id: messageId });
  });
}

// Assign a message to a pin
function assignMessageToPin(userA, userB, pinId, messageId, callback) {
  const db = getChatDB(userA, userB);
  const query = `
    INSERT OR IGNORE INTO pins (id, message_id)
    VALUES (?, ?)
  `;
  db.run(query, [pinId, messageId], function (err) {
    if (err) {
      console.error('Error assigning message to pin:', err);
      return callback(err);
    }
    console.log('Message assigned to pin with ID:', pinId);
    callback(null, { id: pinId, message_id: messageId });
  });
}

// Remove a pin for a message
function removePin(userA, userB, pinId, messageId, callback) {
  const db = getChatDB(userA, userB);
  const query = `
    DELETE FROM pins
    WHERE id = ? AND message_id = ?
  `;
  db.run(query, [pinId, messageId], function (err) {
    if (err) {
      console.error('Error removing pin:', err);
      return callback(err);
    }
    console.log('Pin removed with ID:', pinId);
    callback(null, { id: pinId });
  });
}

// Fetch all pins for a chat
function getPins(userA, userB, callback) {
  const db = getChatDB(userA, userB);
  const query = `
    SELECT DISTINCT id
    FROM pins
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching pins:', err);
      return callback(err);
    }
    callback(null, rows.map(row => row.id)); // Return only the pin IDs
  });
}

// Fetch messages for a specific pin
function getMessagesForPin(userA, userB, pinId, callback) {
  const db = getChatDB(userA, userB);
  const query = `
    SELECT messages.*
    FROM pins
    JOIN messages ON pins.message_id = messages.id
    WHERE pins.id = ?
  `;
  db.all(query, [pinId], (err, rows) => {
    if (err) {
      console.error('Error fetching messages for pin:', err);
      return callback(err);
    }
    callback(null, rows);
  });
}

function updateTaskStatus(userA, userB, taskId, status, callback) {
  console.log('Updating task status in database:', { userA, userB, taskId, status }); // Debugging log
  if (!userA || !userB || !taskId || !status) {
    console.error('Missing required parameters:', { userA, userB, taskId, status });
    return callback(new Error('userA, userB, taskId, and status are required'));
  }
  const db = getChatDB(userA, userB);
  const query = `
    UPDATE tasks
    SET status = ?
    WHERE id = ?
  `;
  db.run(query, [status, taskId], function (err) {
    if (err) {
      console.error('Error updating task status:', err);
      return callback(err);
    }
    console.log('Task status updated successfully:', { taskId, status });
    callback(null, { id: taskId, status });
  });
}

function deleteTask(userA, userB, taskId, callback) {
  const db = getChatDB(userA, userB);
  const query = `
    DELETE FROM tasks
    WHERE id = ?
  `;
  db.run(query, [taskId], function (err) {
    if (err) {
      console.error('Error deleting task:', err);
      return callback(err);
    }
    console.log('Task deleted successfully:', { taskId });
    callback(null, { id: taskId });
  });
}

module.exports = {
  getChatDB,
  addEvent,
  deleteEvent,
  addTask,
  saveMessage,
  getMessagesBetweenUsers,
  addChatForBothUsers,
  createPin,
  assignMessageToPin,
  removePin,
  getPins,
  getMessagesForPin,
  updateTaskStatus,
  deleteTask,
};