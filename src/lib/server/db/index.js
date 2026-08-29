import mysql from 'mysql2/promise';

// Single shared pool. Every write that must be atomic runs through
// withTransaction() so business rules (e.g. "one pending application per
// applicant") are enforced inside a real DB transaction, not by a check-then-
// insert race.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'kkufa',
  password: process.env.DB_PASSWORD || 'kkufa',
  database: process.env.DB_NAME || 'kkufa_visa',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  charset: 'utf8mb4',
  timezone: 'Z'
});

export default pool;

/** Run `fn(connection)` inside a transaction; commit on success, rollback on
 * error, and always release the connection back to the pool. */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
