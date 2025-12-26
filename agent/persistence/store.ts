import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "follow_me_gpt.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS macros (
  name TEXT PRIMARY KEY,
  steps TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tags (
  file TEXT NOT NULL,
  tag TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (file, tag)
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  prompt TEXT,
  plan TEXT,
  result TEXT,
  created_at INTEGER NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS fts_docs USING fts5(path, content);
`);

export async function saveMacro(name: string, steps: any[]) {
  db.prepare(
    `INSERT INTO macros (name, steps, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET steps=excluded.steps, updated_at=excluded.updated_at`
  ).run(name, JSON.stringify(steps), Date.now());
}

export async function loadMacros() {
  return db
    .prepare(`SELECT name, steps, updated_at FROM macros`)
    .all()
    .map((r: any) => ({ name: r.name, steps: JSON.parse(r.steps), updated_at: r.updated_at }));
}

export async function logRun(id: string, prompt: string, plan: any, result: any) {
  db.prepare(`INSERT INTO runs (id, prompt, plan, result, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, prompt, JSON.stringify(plan), JSON.stringify(result), Date.now());
}

export async function indexDocument(docPath: string, content: string) {
  db.prepare(`INSERT INTO fts_docs (path, content) VALUES (?, ?)`).run(docPath, content);
}

export async function searchDocuments(query: string, limit = 50) {
  return db
    .prepare(
      `SELECT path, snippet(fts_docs, 1, '[', ']', '...', 10) AS snippet
       FROM fts_docs WHERE fts_docs MATCH ? LIMIT ?`
    )
    .all(query, limit);
}
