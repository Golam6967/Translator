import { db } from '../lib/dictionary-db';

const total = db.prepare('SELECT COUNT(*) as total FROM dictionary').get();
console.log('Total rows:', total);

const waterArabic = db
  .prepare(`SELECT * FROM dictionary WHERE sourceWord = 'water' AND targetCode = 'ar' LIMIT 5`)
  .all();
console.log('"water" in Arabic:', waterArabic);

const waterAll = db
  .prepare(`SELECT * FROM dictionary WHERE sourceWord = 'water' LIMIT 20`)
  .all();
console.log('"water" in all 4 languages:', waterAll);

const reverseLookup = db
  .prepare(`SELECT * FROM dictionary WHERE targetWord = 'كتاب' AND targetCode = 'ar' LIMIT 5`)
  .all();
console.log('Reverse lookup for "كتاب" (ar):', reverseLookup);
