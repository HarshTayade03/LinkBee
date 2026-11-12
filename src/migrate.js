const fs = require('fs');
const path = require('path');
const { pool } = require('./config/db');

async function runMigration() {
  try {
    const schemaPath = path.join(__dirname, 'models', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Running database schema migration...');
    await pool.query(sql);
    console.log('Schema migration applied successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();

