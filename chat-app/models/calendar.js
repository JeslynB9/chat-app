const { db } = require('../database'); // ✅ Destructure the real sqlite3 instance

// ✅ Run this ONCE when the module is loaded to ensure table exists
db.run(`
  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    title TEXT NOT NULL,
    start TEXT NOT NULL,
    end TEXT
  )
`);

module.exports = {
  getEvents: (username, callback) => {
    db.all(
      `SELECT * FROM calendar_events WHERE username = ?`,
      [username],
      (err, rows) => {
        if (err) return callback(err);
        callback(null, rows);
      }
    );
  },

  addEvent: (username, title, start, end, callback) => {
    db.run(
      `INSERT INTO calendar_events (username, title, start, end) VALUES (?, ?, ?, ?)`,
      [username, title, start, end],
      function (err) {
        if (err) return callback(err);
        callback(null, { id: this.lastID });
      }
    );
  }
};