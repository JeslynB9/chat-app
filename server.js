const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

function saveFile(base64Data, fileType) {
    // Extract the actual base64 data (remove data:image/png;base64, etc.)
    const base64Content = base64Data.split(';base64,').pop();
    
    // Generate a unique filename
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const extension = fileType.split('/')[1] || 'bin'; // Default to bin if no extension
    const filename = `${uniqueId}.${extension}`;
    
    // Save the file to disk
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, base64Content, { encoding: 'base64' });
    
    return `/uploads/${filename}`;
}

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('setUsername', (username) => {
        socket.username = username;
        socket.broadcast.emit('userJoined', username);
        io.emit('updateUserList', Array.from(new Set([...connectedUsers, username])));
        connectedUsers.add(username);
    });

    socket.on('sendMessage', (data) => {
        console.log('Received message:', {
            type: data.type,
            sender: data.sender,
            receiver: data.receiver,
            fileData: data.fileData ? {
                name: data.fileData.name,
                type: data.fileData.type,
                size: data.fileData.size
            } : undefined
        });

        const { sender, receiver, timestamp } = data;
        const room = [sender, receiver].sort().join('-');

        // Format the message content based on type
        let messageContent;
        let messageToSend = { ...data };

        if (data.type === 'file') {
            try {
                // Save the file and get its URL
                const fileUrl = saveFile(data.fileData.data, data.fileData.type);
                
                // Create the message content for database
                messageContent = JSON.stringify({
                    type: 'file',
                    fileData: {
                        name: data.fileData.name,
                        type: data.fileData.type,
                        size: data.fileData.size,
                        url: fileUrl
                    }
                });

                // Update the message to send with the URL instead of base64
                messageToSend.fileData = {
                    name: data.fileData.name,
                    type: data.fileData.type,
                    size: data.fileData.size,
                    url: fileUrl
                };
            } catch (error) {
                console.error('Error saving file:', error);
                return;
            }
        } else {
            messageContent = data.message;
        }

        // Get the chat-specific database
        const db = getChatDB(sender, receiver);

        // Save the message to the database
        db.run(
            'INSERT INTO messages (sender, receiver, message, timestamp) VALUES (?, ?, ?, ?)',
            [sender, receiver, messageContent, timestamp],
            (err) => {
                if (err) {
                    console.error('Error saving message:', err);
                    return;
                }

                // Broadcast the message with URL instead of base64
                io.to(room).emit('receiveMessage', messageToSend);
                io.to(sender).emit('receiveMessage', messageToSend);
                io.to(receiver).emit('receiveMessage', messageToSend);
            }
        );
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            connectedUsers.delete(socket.username);
            io.emit('userLeft', socket.username);
            io.emit('updateUserList', Array.from(connectedUsers));
        }
        console.log('A user disconnected');
    });
});

// Add a route to serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 