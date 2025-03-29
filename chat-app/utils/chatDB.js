const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

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
        sender TEXT,
        message TEXT,
        timestamp INTEGER
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

module.exports = {
  getChatDB,
  addEvent,
  deleteEvent,
  addTask
};