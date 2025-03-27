const express = require('express');
const router = express.Router();
const db = require('../database');

// Create the calendar_events table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    start TEXT NOT NULL,
    end TEXT,
    created_by TEXT NOT NULL
)
`);

// GET: fetch all events for a specific user
router.get('/', (req, res) => {
  const username = req.query.username;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  db.all(
    'SELECT id, title, start, end FROM calendar_events WHERE created_by = ?',
    [username],
    (err, rows) => {
      if (err) {
        console.error('Failed to fetch calendar events:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      res.json({ success: true, events: rows });
    }
  );
});

// POST: add a new calendar event
router.post('/add', (req, res) => {
  const { title, start, end, username } = req.body;

  if (!title || !start || !username) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  db.run(
    'INSERT INTO calendar_events (title, start, end, created_by) VALUES (?, ?, ?, ?)',
    [title, start, end || null, username],
    function (err) {
      if (err) {
        console.error('Failed to insert event:', err);
        return res.status(500).json({ success: false, message: 'Database insert error' });
      }
      res.status(201).json({ success: true, id: this.lastID });
    }
  );
});

module.exports = router;