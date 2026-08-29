import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

// Migration runner: applies *.sql files from ./migrations in lexical order,
// recording each applied file in `schema_migrations` so re-running is safe.
// SQL files must be written idempotently (IF NOT EXISTS / ON DUPLICATE KEY).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'kkufa',
    password: process.env.DB_PASSWORD || 'kkufa',
    multipleStatements: true,
    charset: 'utf8mb4'
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'kkufa_visa'}\` CHARACTER SET utf8mb4`);
  await conn.query(`USE \`${process.env.DB_NAME || 'kkufa_visa'}\``);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [rows] = await conn.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    await conn.query(sql);
    await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    console.log(`[migrate] applied ${file}`);
  }
  console.log('[migrate] done');
  await conn.end();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
