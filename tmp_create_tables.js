const { Pool } = require('/home/runner/workspace/lib/db/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const tables = [
  `CREATE TABLE IF NOT EXISTS site_updates (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'update',
    pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    update_id INTEGER NOT NULL REFERENCES site_updates(id) ON DELETE CASCADE,
    read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS user_checkins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    stars_earned INTEGER NOT NULL DEFAULT 1,
    streak_day INTEGER NOT NULL DEFAULT 1,
    multiplier REAL NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS user_star_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,
];

async function run() {
  for (const sql of tables) {
    try {
      await pool.query(sql);
      console.log("OK:", sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1]);
    } catch (e) {
      console.log("ERROR:", sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1], e.message);
    }
  }
  await pool.end();
  console.log("Done!");
}
run();
