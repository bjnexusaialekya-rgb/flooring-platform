const { Pool } = require('pg');

// Connection pool tuning per the precaution checklist: bound max
// connections and idle timeout so this never silently exhausts the
// DB's connection limit under concurrent template-cloning or
// billing-batch operations.
// SSL: required in production (RDS enforces this on the default
// parameter group) but off for local Docker Postgres, which has no
// cert. rejectUnauthorized: false because RDS uses Amazon's own CA
// bundle rather than one in the OS trust store by default — this
// still forces an encrypted connection, it just doesn't verify the
// chain. Swap in the RDS CA bundle here later if full verification
// is required.
const useSsl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // A pooled client emitting an error (e.g. backend restart) must not
  // crash the whole process silently.
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = { pool };
