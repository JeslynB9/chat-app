const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const CryptoJS = require('crypto-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // adjust if needed

const secretKey = process.env.SECRET_KEY;
if (!secretKey) {
    console.error('❌ SECRET_KEY not found.');
    process.exit(1);
}

// Helper function to encrypt message
function encrypt(text) {
    return CryptoJS.AES.encrypt(text, secretKey).toString();
}

// Helper function to check if a message is already encrypted
function isEncrypted(message) {
    return typeof message === 'string' && message.startsWith('U2FsdGVkX1');
}

const dbFolder = path.join(__dirname, 'chat_dbs');

fs.readdir(dbFolder, (err, files) => {
    if (err) {
        console.error('❌ Failed to read chat_dbs folder:', err.message);
        return;
    }

    files.filter(file => file.endsWith('.db')).forEach(file => {
        const dbPath = path.join(dbFolder, file);
        const db = new sqlite3.Database(dbPath);

        console.log(`🔍 Scanning database: ${file}`);

        db.serialize(() => {
            db.all(`SELECT id, message FROM messages`, (err, rows) => {
                if (err) {
                    console.error(`❌ Error reading messages from ${file}:`, err.message);
                    return;
                }

                rows.forEach(row => {
                    if (!row.message) return; // skip empty messages

                    if (!isEncrypted(row.message)) {
                        const encrypted = encrypt(row.message);
                        db.run(`UPDATE messages SET message = ? WHERE id = ?`, [encrypted, row.id], (err) => {
                            if (err) {
                                console.error(`❌ Failed to update message ID ${row.id} in ${file}:`, err.message);
                            } else {
                                console.log(`✅ Encrypted message ID ${row.id} in ${file}`);
                            }
                        });
                    } else {
                        console.log(`⏩ Message ID ${row.id} in ${file} already encrypted, skipping.`);
                    }
                });
            });
        });

        db.close();
    });
});