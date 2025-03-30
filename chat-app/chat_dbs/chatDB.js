const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Ensure directory exists
const chatDBPath = path.join(__dirname, './'); // Corrected to reference the current directory
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
  });

  return db;
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
  const query = `
    INSERT INTO messages (sender, receiver, message, createdAt)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `;
  db.run(query, [sender, receiver, message], function (err) {
    if (err) {
      console.error('Error saving message to chat-specific database:', err);
      callback(err);
    } else {
      callback(null, { id: this.lastID, sender, receiver, message });
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
      callback(null, rows);
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

module.exports = {
  getChatDB,
  addEvent,
  deleteEvent,
  addTask,
  saveMessage,
  getMessagesBetweenUsers,
  addChatForBothUsers
};