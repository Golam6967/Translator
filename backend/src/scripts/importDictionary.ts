import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { db } from '../lib/dictionary-db';

const ALLOWED_CODES = new Set(['en', 'ar', 'ur', 'fa', 'tr']);
const ENGLISH_ALLOWED_CODES = new Set(['ar', 'ur', 'fa', 'tr']);

interface DictionaryRow {
  sourceWord: string;
  sourceLang: string;
  targetWord: string;
  targetLang: string;
  targetCode: string;
  pos: string | null;
}

interface ForeignLangConfig {
  file: string;
  code: string;
  name: string;
}

const FOREIGN_LANG_CONFIG: Record<string, ForeignLangConfig> = {
  arabic: { file: 'Arabic.jsonl', code: 'ar', name: 'Arabic' },
  persian: { file: 'Persian.jsonl', code: 'fa', name: 'Persian' },
  urdu: { file: 'Urdu.jsonl', code: 'ur', name: 'Urdu' },
  turkish: { file: 'Turkish.jsonl', code: 'tr', name: 'Turkish' },
};

// Ensures INSERT OR IGNORE actually dedupes across repeated/overlapping import runs.
// This only adds an index via SQL from this script; it does not modify dictionary-db.ts.
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_translation
  ON dictionary(sourceWord, sourceLang, targetWord, targetLang, targetCode)
`);

const insertRow = db.prepare(`
  INSERT OR IGNORE INTO dictionary
  (sourceWord, sourceLang, targetWord, targetLang, targetCode, pos)
  VALUES (@sourceWord, @sourceLang, @targetWord, @targetLang, @targetCode, @pos)
`);

const insertBatch = db.transaction((rows: DictionaryRow[]) => {
  let changes = 0;
  for (const row of rows) {
    changes += insertRow.run(row).changes;
  }
  return changes;
});

function cleanGloss(raw: string): string {
  const withoutParens = raw.replace(/\([^)]*\)/g, '').trim();
  const beforeComma = withoutParens.split(',')[0].trim();
  return beforeComma;
}

async function importEnglish(): Promise<void> {
  const filePath = path.join(__dirname, 'data/Dictionary.jsonl');

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let processed = 0;
  let inserted = 0;
  let batch: DictionaryRow[] = [];
  const BATCH_SIZE = 500;

  for await (const line of rl) {
    if (!line.trim()) continue;

    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    processed++;

    const sourceWord = entry.word;
    if (!sourceWord || typeof sourceWord !== 'string' || !sourceWord.trim()) {
      continue;
    }

    const pos = entry.pos || null;
    const translations = Array.isArray(entry.translations) ? entry.translations : [];
    const matching = translations.filter((t: any) => t && ENGLISH_ALLOWED_CODES.has(t.code));

    if (matching.length === 0) {
      continue;
    }

    for (const translation of matching) {
      batch.push({
        sourceWord: sourceWord.toLowerCase().trim(),
        sourceLang: 'en',
        targetWord: translation.word,
        targetLang: translation.lang,
        targetCode: translation.code,
        pos,
      });
    }

    if (batch.length >= BATCH_SIZE) {
      inserted += insertBatch(batch);
      batch = [];
    }

    if (processed % 5000 === 0) {
      console.log(`Processed ${processed} entries, inserted ${inserted} rows...`);
    }
  }

  if (batch.length > 0) {
    inserted += insertBatch(batch);
  }

  console.log(
    `Import complete (English). Total entries processed: ${processed}, Total rows inserted: ${inserted}`,
  );
}

async function importForeignLanguage(key: keyof typeof FOREIGN_LANG_CONFIG): Promise<void> {
  const cfg = FOREIGN_LANG_CONFIG[key];
  const filePath = path.join(__dirname, 'data', cfg.file);

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let processed = 0;
  let inserted = 0;
  let batch: DictionaryRow[] = [];
  const BATCH_SIZE = 500;

  for await (const line of rl) {
    if (!line.trim()) continue;

    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    processed++;

    const sourceWord = typeof entry.word === 'string' ? entry.word.trim() : '';
    if (!sourceWord) {
      if (processed % 5000 === 0) {
        console.log(`Processed ${processed} entries, inserted ${inserted} rows...`);
      }
      continue;
    }

    const entryLangCode: string = entry.lang_code || cfg.code;
    const entryLangName: string = entry.lang || cfg.name;
    const pos: string | null = entry.pos || null;

    let hasEnglishTranslation = false;

    // Step A — the word's own translations array (rare/absent in kaikki dumps, but handled)
    if (Array.isArray(entry.translations)) {
      const matching = entry.translations.filter(
        (t: any) =>
          t &&
          typeof t.word === 'string' &&
          t.word.trim() &&
          ALLOWED_CODES.has(t.code) &&
          t.code !== entryLangCode,
      );

      for (const translation of matching) {
        if (translation.code === 'en') hasEnglishTranslation = true;
        batch.push({
          sourceWord,
          sourceLang: entryLangCode,
          targetWord: translation.word.trim(),
          targetLang: translation.lang || translation.code,
          targetCode: translation.code,
          pos,
        });
      }
    }

    // Step B + C — derive an English gloss and insert it both ways
    const gloss = entry.senses?.[0]?.glosses?.[0];
    if (!hasEnglishTranslation && typeof gloss === 'string') {
      const cleanedGloss = cleanGloss(gloss);
      if (cleanedGloss) {
        batch.push({
          sourceWord,
          sourceLang: entryLangCode,
          targetWord: cleanedGloss,
          targetLang: 'English',
          targetCode: 'en',
          pos,
        });
        batch.push({
          sourceWord: cleanedGloss.toLowerCase().trim(),
          sourceLang: 'en',
          targetWord: sourceWord,
          targetLang: entryLangName,
          targetCode: entryLangCode,
          pos,
        });
      }
    }

    if (batch.length >= BATCH_SIZE) {
      inserted += insertBatch(batch);
      batch = [];
    }

    if (processed % 5000 === 0) {
      console.log(`Processed ${processed} entries, inserted ${inserted} rows...`);
    }
  }

  if (batch.length > 0) {
    inserted += insertBatch(batch);
  }

  console.log(
    `Import complete (${cfg.name}). Total entries processed: ${processed}, Total rows inserted: ${inserted}`,
  );
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    await importEnglish();
    return;
  }

  if (arg === 'all') {
    for (const key of Object.keys(FOREIGN_LANG_CONFIG)) {
      await importForeignLanguage(key);
    }
    return;
  }

  if (arg in FOREIGN_LANG_CONFIG) {
    await importForeignLanguage(arg as keyof typeof FOREIGN_LANG_CONFIG);
    return;
  }

  console.error(
    `Unknown argument "${arg}". Expected one of: arabic, persian, urdu, turkish, all (or no argument for English).`,
  );
  process.exit(1);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
