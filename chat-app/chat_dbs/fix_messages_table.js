const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const chatDbFolder = __dirname;

// Get all .db files
const dbFiles = fs.readdirSync(chatDbFolder).filter(file => file.endsWith('.db'));

dbFiles.forEach(dbFile => {
    const dbPath = path.join(chatDbFolder, dbFile);
    const db = new sqlite3.Database(dbPath);

    console.log(`🛠️ Updating messages table in ${dbFile}...`);

    db.serialize(() => {
        db.run(`ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'text'`, [], (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error(`❌ Failed to add type column in ${dbFile}: ${err.message}`);
            } else {
                console.log(`✅ Type column added (or already exists) in ${dbFile}`);
            }
        });

        db.run(`ALTER TABLE messages ADD COLUMN fileData TEXT`, [], (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error(`❌ Failed to add fileData column in ${dbFile}: ${err.message}`);
            } else {
                console.log(`✅ fileData column added (or already exists) in ${dbFile}`);
            }
        });
    });

    db.close();
});