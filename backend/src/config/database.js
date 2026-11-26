import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

pg.types.setTypeParser(1082, value => value);

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10
});

pool.on('error', (error) => {
  console.error('PostgreSQL error:', error.message);
});

export async function query(sql, params, client) {
  const runner = client || pool;
  return runner.query(sql, params || []);
}

export async function getOne(sql, params, client) {
  const result = await query(sql, params, client);
  return result.rows[0] || null;
}

export async function getMany(sql, params, client) {
  const result = await query(sql, params, client);
  return result.rows;
}

export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function checkConnection() {
  const row = await getOne('SELECT current_database() AS name');
  return row.name;
}

export function closePool() {
  return pool.end();
}
