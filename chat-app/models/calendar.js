const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all events
router.get('/', (req, res) => {
  db.all('SELECT * FROM calendar_events', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add a new event
router.post('/', (req, res) => {
  const { title, start, end, created_by } = req.body;
  const sql = 'INSERT INTO calendar_events (title, start, end, created_by) VALUES (?, ?, ?, ?)';
  db.run(sql, [title, start, end, created_by], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

module.exports = router;