import { db } from '../lib/dictionary-db';

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'AcculatorDictImporter/1.0 (offline Islamic translation dictionary; local use)';

const LANG_CODES = ['en', 'ar', 'fa', 'ur', 'tr'] as const;
const LANG_NAMES: Record<(typeof LANG_CODES)[number], string> = {
  en: 'English',
  ar: 'Arabic',
  fa: 'Persian',
  ur: 'Urdu',
  tr: 'Turkish',
};

// Wikidata classes to pull named entities from. Adding a new class later is
// just adding one entry here — no other code needs to change.
const ENTITY_CLASSES: { name: string; qid: string; pos: string }[] = [
  { name: 'Companion of the Prophet (Sahabi)', qid: 'Q188711', pos: 'proper noun' },
  { name: 'Prophet of Islam', qid: 'Q168827', pos: 'proper noun' },
];

// Not every relevant entity is tagged with the classes above in Wikidata's
// structured data (e.g. Musab ibn Umair only has occupation "preacher", not
// "Sahabi") — this list plugs specific known gaps. Add a QID here to fix a
// missing word without waiting on Wikidata's own classification to improve.
const EXPLICIT_ITEMS: { name: string; qid: string; pos: string }[] = [
  { name: "Mus'ab ibn Umair", qid: 'Q1110691', pos: 'proper noun' },
];

interface DictionaryRow {
  sourceWord: string;
  sourceLang: string;
  targetWord: string;
  targetLang: string;
  targetCode: string;
  pos: string | null;
}

// Matches the unique index created by importDictionary.ts; created here too
// so this script also works standalone. Does not touch dictionary-db.ts.
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

interface SparqlBinding {
  item: { value: string };
  lang: { value: string };
  label: { value: string };
}

async function fetchLabelsForClass(qid: string): Promise<Map<string, Record<string, string>>> {
  const langFilter = LANG_CODES.map((c) => `'${c}'`).join(', ');
  const query = `
    SELECT ?item ?lang ?label WHERE {
      { ?item wdt:P31 wd:${qid} . } UNION { ?item wdt:P106 wd:${qid} . }
      ?item rdfs:label ?label .
      BIND(LANG(?label) AS ?lang)
      FILTER(?lang IN (${langFilter}))
    }
  `;

  const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata query failed for ${qid}: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { results: { bindings: SparqlBinding[] } };

  const labelsByItem = new Map<string, Record<string, string>>();
  for (const binding of data.results.bindings) {
    const item = binding.item.value;
    const lang = binding.lang.value;
    const label = binding.label.value.trim();
    if (!label) continue;

    if (!labelsByItem.has(item)) labelsByItem.set(item, {});
    labelsByItem.get(item)![lang] = label;
  }

  return labelsByItem;
}

async function fetchLabelsForItems(qids: string[]): Promise<Map<string, Record<string, string>>> {
  const langFilter = LANG_CODES.map((c) => `'${c}'`).join(', ');
  const values = qids.map((qid) => `wd:${qid}`).join(' ');
  const query = `
    SELECT ?item ?lang ?label WHERE {
      VALUES ?item { ${values} }
      ?item rdfs:label ?label .
      BIND(LANG(?label) AS ?lang)
      FILTER(?lang IN (${langFilter}))
    }
  `;

  const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata query failed for explicit items: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { results: { bindings: SparqlBinding[] } };

  const labelsByItem = new Map<string, Record<string, string>>();
  for (const binding of data.results.bindings) {
    const item = binding.item.value;
    const lang = binding.lang.value;
    const label = binding.label.value.trim();
    if (!label) continue;

    if (!labelsByItem.has(item)) labelsByItem.set(item, {});
    labelsByItem.get(item)![lang] = label;
  }

  return labelsByItem;
}

// The frontend's word input rejects anything containing whitespace, so a
// multi-word label like "Mus`ab ibn `Umair" can never actually be typed in.
// This derives a single-token alias (the first name) so simple lookups work.
function firstNameAlias(label: string): string | null {
  const firstToken = label.split(/\s+/)[0];
  const cleaned = firstToken.replace(/[`ʿʾ'".,()]/g, '').toLowerCase();
  return cleaned.length >= 3 ? cleaned : null;
}

function buildRows(
  labelsByItem: Map<string, Record<string, string>>,
  pos: string,
): DictionaryRow[] {
  const rows: DictionaryRow[] = [];

  for (const labels of labelsByItem.values()) {
    const presentLangs = LANG_CODES.filter((code) => labels[code]);

    for (const sourceLang of presentLangs) {
      for (const targetLang of presentLangs) {
        if (sourceLang === targetLang) continue;

        const rawSourceWord = labels[sourceLang];
        const sourceWord = sourceLang === 'en' ? rawSourceWord.toLowerCase() : rawSourceWord;

        rows.push({
          sourceWord,
          sourceLang,
          targetWord: labels[targetLang],
          targetLang: LANG_NAMES[targetLang],
          targetCode: targetLang,
          pos,
        });

        if (sourceLang === 'en') {
          const alias = firstNameAlias(rawSourceWord);
          if (alias && alias !== sourceWord) {
            rows.push({
              sourceWord: alias,
              sourceLang,
              targetWord: labels[targetLang],
              targetLang: LANG_NAMES[targetLang],
              targetCode: targetLang,
              pos,
            });
          }
        }
      }
    }
  }

  return rows;
}

async function importEntityClass(cfg: { name: string; qid: string; pos: string }): Promise<void> {
  console.log(`Fetching "${cfg.name}" (${cfg.qid}) from Wikidata...`);

  const labelsByItem = await fetchLabelsForClass(cfg.qid);
  const rows = buildRows(labelsByItem, cfg.pos);

  const inserted = insertBatch(rows);

  console.log(
    `Import complete (${cfg.name}). Entities found: ${labelsByItem.size}, Total rows inserted: ${inserted}`,
  );
}

async function importExplicitItems(items: { name: string; qid: string; pos: string }[]): Promise<void> {
  if (items.length === 0) return;

  console.log(`Fetching ${items.length} explicit item(s) from Wikidata...`);

  const labelsByItem = await fetchLabelsForItems(items.map((i) => i.qid));
  const posByQid = new Map(items.map((i) => [i.qid, i.pos]));

  let inserted = 0;
  for (const [itemUri, labels] of labelsByItem.entries()) {
    const qid = itemUri.split('/').pop() ?? '';
    const pos = posByQid.get(qid) ?? 'proper noun';
    inserted += insertBatch(buildRows(new Map([[itemUri, labels]]), pos));
  }

  console.log(
    `Import complete (explicit items). Entities found: ${labelsByItem.size}, Total rows inserted: ${inserted}`,
  );
}

async function main() {
  for (const cfg of ENTITY_CLASSES) {
    await importEntityClass(cfg);
  }
  await importExplicitItems(EXPLICIT_ITEMS);
}

main().catch((err) => {
  console.error('Wikidata import failed:', err);
  process.exit(1);
});
