const { Pool } = require('pg');

// Connection pool tuning per the precaution checklist: bound max
// connections and idle timeout so this never silently exhausts the
// DB's connection limit under concurrent template-cloning or
// billing-batch operations.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // A pooled client emitting an error (e.g. backend restart) must not
  // crash the whole process silently.
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = { pool };
