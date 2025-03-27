const express = require('express');
const router = express.Router();
const db = require('../models/calendar');

// GET events for a user
router.get('/events', (req, res) => {
    const username = req.query.username;
    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required' });
    }

    db.getEvents(username, (err, events) => {
        if (err) {
            console.error('Error fetching events:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, events });
    });
});

// POST new event
router.post('/events', (req, res) => {
    const { title, start, end, username } = req.body;

    if (!title || !start || !username) {
        return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    db.addCalendarEvent({ title, start, end, created_by: username }, (err) => {
        if (err) {
            console.error('Error adding event:', err);
            return res.status(500).json({ success: false, message: 'Insert failed' });
        }
        res.status(201).json({ success: true });
    });
});

module.exports = router;