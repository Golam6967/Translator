import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'dictionary.sqlite');
export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS dictionary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sourceWord TEXT NOT NULL,
    sourceLang TEXT NOT NULL DEFAULT 'en',
    targetWord TEXT NOT NULL,
    targetLang TEXT NOT NULL,
    targetCode TEXT NOT NULL,
    pos TEXT
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_source
  ON dictionary(sourceWord, targetCode);
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_target
  ON dictionary(targetWord, targetCode);
`);

export default db;
