const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Folder where your .db files are
const dbFolder = '.';

// Check all chat_*.db files
fs.readdirSync(dbFolder)
  .filter(file => file.startsWith('chat_') && file.endsWith('.db'))
  .forEach(file => {
    const dbPath = path.join(dbFolder, file);
    const db = new sqlite3.Database(dbPath);

    console.log(`🔍 Checking uploads table in ${file}...`);

    db.serialize(() => {
      db.all(`PRAGMA table_info(uploads);`, (err, columns) => {
        if (err) {
          console.error(`❌ Error checking uploads table in ${file}:`, err.message);
        } else if (columns.length === 0) {
          console.warn(`⚠️ No uploads table found in ${file}`);
        } else {
          const columnNames = columns.map(c => c.name);
          const expected = ['id', 'filename', 'filepath', 'filetype', 'uploader', 'timestamp'];
          const missing = expected.filter(c => !columnNames.includes(c));
          
          if (missing.length === 0) {
            console.log(`✅ uploads table is correct in ${file}`);
          } else {
            console.warn(`⚠️ uploads table missing columns [${missing.join(', ')}] in ${file}`);
          }
        }
      });
    });

    db.close();
  });