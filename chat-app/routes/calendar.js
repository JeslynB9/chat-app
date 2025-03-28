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

// DELETE an event by ID
router.delete('/events/:id', (req, res) => {
    const { id } = req.params;
    console.log('Deleting event with ID:', id); // Debugging log

    db.deleteEvent(id, (err) => {
        if (err) {
            console.error('Error deleting event:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        console.log('Event deleted successfully with ID:', id); // Debugging log
        res.json({ success: true });
    });
});

module.exports = router;