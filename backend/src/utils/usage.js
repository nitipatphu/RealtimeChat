import { query, getOne, getMany } from '../config/database.js';

const TODAY_SQL = "(now() AT TIME ZONE 'Asia/Bangkok')::date";

export async function createUsageTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS daily_active_users (
      day      DATE NOT NULL,
      user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (day, user_id)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS daily_peak_online (
      day      DATE PRIMARY KEY,
      peak     INTEGER NOT NULL DEFAULT 0,
      peak_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function recordUsage(userId, onlineCount) {
  await query(
    'INSERT INTO daily_active_users (day, user_id) VALUES (' + TODAY_SQL + ', $1) ON CONFLICT DO NOTHING',
    [userId]
  );
  await query(
    `INSERT INTO daily_peak_online (day, peak, peak_at) VALUES (` + TODAY_SQL + `, $1, now())
     ON CONFLICT (day) DO UPDATE SET peak = $1, peak_at = now()
     WHERE daily_peak_online.peak < $1`,
    [onlineCount]
  );
}

export async function getUsageDays(dayCount) {
  const rows = await getMany(
    `WITH days AS (
       SELECT generate_series(` + TODAY_SQL + ` - ($1::int - 1), ` + TODAY_SQL + `, interval '1 day')::date AS day
     ),
     activity AS (
       SELECT day, user_id FROM daily_active_users
       WHERE day >= ` + TODAY_SQL + ` - ($1::int - 1)
       UNION
       SELECT (created_at AT TIME ZONE 'Asia/Bangkok')::date AS day, author_id AS user_id FROM messages
       WHERE author_id IS NOT NULL AND (created_at AT TIME ZONE 'Asia/Bangkok')::date >= ` + TODAY_SQL + ` - ($1::int - 1)
       UNION
       SELECT (last_login_at AT TIME ZONE 'Asia/Bangkok')::date AS day, id AS user_id FROM users
       WHERE last_login_at IS NOT NULL AND (last_login_at AT TIME ZONE 'Asia/Bangkok')::date >= ` + TODAY_SQL + ` - ($1::int - 1)
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
            count(a.user_id) AS active,
            COALESCE(p.peak, 0) AS peak,
            p.peak_at
     FROM days d
     LEFT JOIN activity a ON a.day = d.day
     LEFT JOIN daily_peak_online p ON p.day = d.day
     GROUP BY d.day, p.peak, p.peak_at
     ORDER BY d.day`,
    [dayCount]
  );

  return rows.map(row => ({
    date: row.date,
    active: Number(row.active),
    peak: Number(row.peak),
    peakAt: row.peak_at ? new Date(row.peak_at).toISOString() : null
  }));
}

export async function getUsageRecord() {
  const row = await getOne('SELECT to_char(day, \'YYYY-MM-DD\') AS date, peak, peak_at FROM daily_peak_online ORDER BY peak DESC, day DESC LIMIT 1');
  if (!row) return null;
  return { date: row.date, peak: Number(row.peak), peakAt: new Date(row.peak_at).toISOString() };
}

export async function getTrackingStart() {
  const row = await getOne("SELECT to_char(min(day), 'YYYY-MM-DD') AS date FROM daily_peak_online");
  if (!row) return null;
  return row.date;
}
