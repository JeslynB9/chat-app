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
        message_id INTEGER NOT NULL, -- Ensure message_id is an integer
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

// Create a new pin for a message
function createPin(userA, userB, messageId, callback) {
  const db = getChatDB(userA, userB);
  const pinId = `${userA}_${userB}_${messageId}`; // Unique pin ID

  const query = `
    INSERT INTO pins (id, message_id)
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
function removePin(userA, userB, messageId, callback) {
  const db = getChatDB(userA, userB);
  const pinId = `${userA}_${userB}_${messageId}`; // Unique pin ID

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

// Fetch all pinned messages for a chat
function getPinnedMessages(userA, userB, callback) {
  const db = getChatDB(userA, userB);

  const query = `
    SELECT DISTINCT pins.id, pins.name
    FROM pins
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching pinned messages:', err);
      return callback(err);
    }
    callback(null, rows);
  });
}

// Check if a message is pinned
function isMessagePinned(userA, userB, messageId, callback) {
  const db = getChatDB(userA, userB);
  const pinId = `${userA}_${userB}_${messageId}`; // Unique pin ID

  const query = `
    SELECT COUNT(*) AS count
    FROM pins
    WHERE id = ? AND message_id = ?
  `;
  db.get(query, [pinId, messageId], (err, row) => {
    if (err) {
      console.error('Error checking if message is pinned:', err);
      return callback(err);
    }
    callback(null, row.count > 0);
  });
}

/**
 * Create a new category for a user.
 * @param {string} userId - The ID of the user.
 * @param {string} categoryName - The name of the category.
 * @param {function} callback - Callback function.
 */
function createCategory(userId, categoryName, callback) {
  const db = new sqlite3.Database(path.join(chatDBPath, 'categories.db'));

  const query = `
    INSERT INTO categories (user_id, name)
    VALUES (?, ?)
  `;
  db.run(query, [userId, categoryName], function (err) {
    if (err) {
      console.error('Error creating category:', err);
      return callback(err);
    }
    console.log('Category created with ID:', this.lastID);
    callback(null, { id: this.lastID, name: categoryName });
  });
}

/**
 * Assign a chat to a category.
 * @param {string} userA - The first user in the chat.
 * @param {string} userB - The second user in the chat.
 * @param {number} categoryId - The ID of the category.
 * @param {function} callback - Callback function.
 */
function assignChatToCategory(userA, userB, categoryId, callback) {
  const db = getChatDB(userA, userB);
  const chatId = getChatDBName(userA, userB);

  const query = `
    INSERT INTO chat_categories (chat_id, category_id)
    VALUES (?, ?)
  `;
  db.run(query, [chatId, categoryId], function (err) {
    if (err) {
      console.error('Error assigning chat to category:', err);
      return callback(err);
    }
    console.log('Chat assigned to category with ID:', categoryId);
    callback(null, { chatId, categoryId });
  });
}

/**
 * Get all categories for a user.
 * @param {string} userId - The ID of the user.
 * @param {function} callback - Callback function.
 */
function getCategories(userId, callback) {
  const db = new sqlite3.Database(path.join(chatDBPath, 'categories.db'));

  const query = `
    SELECT * FROM categories
    WHERE user_id = ?
  `;
  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error('Error fetching categories:', err);
      return callback(err);
    }
    callback(null, rows);
  });
}

/**
 * Get all chats in a category.
 * @param {number} categoryId - The ID of the category.
 * @param {function} callback - Callback function.
 */
function getChatsInCategory(categoryId, callback) {
  const db = new sqlite3.Database(path.join(chatDBPath, 'categories.db'));

  const query = `
    SELECT chat_id FROM chat_categories
    WHERE category_id = ?
  `;
  db.all(query, [categoryId], (err, rows) => {
    if (err) {
      console.error('Error fetching chats in category:', err);
      return callback(err);
    }
    callback(null, rows.map(row => row.chat_id));
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
  getPinnedMessages,
  isMessagePinned,
  createCategory,
  assignChatToCategory,
  getCategories,
  getChatsInCategory,
  updateTaskStatus,
  deleteTask,
};