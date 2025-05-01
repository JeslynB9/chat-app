const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const chatDbFolder = path.join(__dirname, 'chat_dbs');
const dbFiles = fs.readdirSync(chatDbFolder).filter(file => file.endsWith('.db'));

dbFiles.forEach(dbFile => {
    const dbPath = path.join(chatDbFolder, dbFile);
    const db = new sqlite3.Database(dbPath);

    console.log(`🛠️ Updating messages table in ${dbFile}...`);

    db.serialize(() => {
        db.run(`ALTER TABLE messages ADD COLUMN upload_id INTEGER`, [], (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error(`❌ Failed to add upload_id column in ${dbFile}: ${err.message}`);
            } else {
                console.log(`✅ upload_id column added (or already exists) in ${dbFile}`);
            }
        });
    });

    db.close();
});