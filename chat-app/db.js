const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/chat-app');
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;

app.put('/chatDB/tasks/:taskId/status', (req, res) => {
    const { taskId } = req.params;
    const { status, userA, userB } = req.body;

    console.log('Received request to update task status:', { taskId, status, userA, userB }); // Debugging log

    if (!taskId || !status || !userA || !userB) {
        console.error('Invalid request parameters:', { taskId, status, userA, userB });
        return res.status(400).json({ success: false, message: 'userA, userB, taskId, and status are required' });
    }

    updateTaskStatus(userA, userB, taskId, status, (err, result) => {
        if (err) {
            console.error('Error updating task status:', err);
            return res.status(500).json({ success: false, message: 'Failed to update task status' });
        }
        res.json({ success: true, task: result });
    });
});