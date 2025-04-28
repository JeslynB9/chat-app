const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Find all chat_*.db files
const dbFiles = fs.readdirSync('.').filter(file => file.startsWith('chat_') && file.endsWith('.db'));

dbFiles.forEach(file => {
    console.log(`🛠️ Fixing uploads table in ${file}...`);
    const db = new sqlite3.Database(file);

    db.serialize(() => {
        db.run(`DROP TABLE IF EXISTS uploads;`, (dropErr) => {
            if (dropErr) {
                console.error(`❌ Failed to drop uploads table in ${file}: ${dropErr.message}`);
                db.close();
                return;
            }
            console.log(`✅ Dropped old uploads table in ${file}`);

            db.run(`CREATE TABLE IF NOT EXISTS uploads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                filepath TEXT,
                filetype TEXT,
                uploader TEXT,
                timestamp INTEGER
            );`, (createErr) => {
                if (createErr) {
                    console.error(`❌ Failed to create uploads table in ${file}: ${createErr.message}`);
                } else {
                    console.log(`✅ Created correct uploads table in ${file}`);
                }
                db.close();
            });
        });
    });
});