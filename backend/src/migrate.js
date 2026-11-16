require('dotenv').config()

const { readFile } = require('node:fs/promises')
const path = require('node:path')
const { createPool } = require('./db')

async function migrate() {
  const pool = createPool()
  try {
    const sql = await readFile(path.join(__dirname, '../migrations/001_initial.sql'), 'utf8')
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) {
      await pool.query(statement)
    }
    console.log('Database schema initialized')
  } finally {
    await pool.end()
  }
}

migrate().catch(error => {
  console.error('Database migration failed:', error.message)
  process.exitCode = 1
})
