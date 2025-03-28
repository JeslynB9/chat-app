const express = require('express');
const router = express.Router();
const db = require('../database'); // Correctly import the database module

// GET events for a user
router.get('/events', (req, res) => {
    const { username } = req.query;
    console.log('Fetching events for username:', username); // Debugging log
    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required' });
    }

    db.getEvents(username, (err, events) => {
        if (err) {
            console.error('Error fetching events:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        console.log('Fetched events from database for username:', username, events); // Debugging log
        res.json({ success: true, events });
    });
});

// POST new event for a user
router.post('/events', (req, res) => {
    const { title, start, end, username } = req.body;
    console.log('Adding event for username:', username, { title, start, end }); // Debugging log

    if (!title || !start || !username) {
        console.error('Missing required fields:', { title, start, username });
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    db.addEvent({ title, start, end, username }, (err, savedEvent) => {
        if (err) {
            console.error('Failed to save event to database:', err);
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }
        console.log('Event successfully saved to database:', savedEvent); // Debugging log
        res.status(201).json({ success: true, event: savedEvent });
    });
});

module.exports = router;