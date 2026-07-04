require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    console.log('Applying schema.sql ...');
    await client.query(schemaSql);
    console.log('Schema applied successfully.');
  } catch (err) {
    if (err.code === '42P07') {
      // relation already exists — schema.sql has no IF NOT EXISTS on
      // purpose (so a genuine drift is loud), but re-running migrate
      // on an already-migrated DB is a common no-op case.
      console.log('Tables already exist — schema is already applied. No action taken.');
    } else {
      console.error('Migration failed:', err.message);
      process.exitCode = 1;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
