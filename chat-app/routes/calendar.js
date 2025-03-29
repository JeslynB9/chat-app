const express = require('express');
const router = express.Router();
const { addEvent, deleteEvent, getChatDB } = require('../utils/chatDB'); // Import chat-specific functions

// GET events for a chat
router.get('/events', (req, res) => {
    const { userA, userB } = req.query;
    console.log('Fetching events for chat between:', userA, userB); // Debugging log

    if (!userA || !userB) {
        return res.status(400).json({ success: false, message: 'Both userA and userB are required' });
    }

    const db = getChatDB(userA, userB);
    const query = `SELECT * FROM events`;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching events from chat-specific database:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        console.log('Fetched events from chat-specific database:', rows); // Debugging log
        res.json({ success: true, events: rows });
    });
});

// POST new event for a chat
router.post('/events', (req, res) => {
    const { userA, userB, title, start, end, created_by } = req.body;
    console.log('Adding event for chat between:', userA, userB, { title, start, end, created_by }); // Debugging log

    if (!userA || !userB || !title || !start || !created_by) {
        console.error('Missing required fields:', { userA, userB, title, start, created_by });
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    addEvent(userA, userB, { title, start, end, created_by }, (err, savedEvent) => {
        if (err) {
            console.error('Failed to save event to chat-specific database:', err);
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }
        console.log('Event successfully saved to chat-specific database:', savedEvent); // Debugging log
        res.status(201).json({ success: true, event: savedEvent });
    });
});

// DELETE an event by ID for a chat
router.delete('/events/:id', (req, res) => {
    const { userA, userB } = req.query;
    const { id } = req.params;
    console.log('Deleting event with ID:', id, 'for chat between:', userA, userB); // Debugging log

    if (!userA || !userB || !id) {
        console.error('Missing required fields:', { userA, userB, id });
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    deleteEvent(userA, userB, id, (err) => {
        if (err) {
            console.error('Error deleting event from chat-specific database:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        console.log('Event deleted successfully from chat-specific database with ID:', id); // Debugging log
        res.json({ success: true });
    });
});

module.exports = router;