require('dotenv').config()

const express = require('express')
const { rateLimit } = require('express-rate-limit')
const { Pool } = require('pg')

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
})
pool.on('error', () => {
  console.error('Idle database connection failed')
})
const app = express()

app.use(express.json())

app.get('/api/health', rateLimit({ windowMs: 60_000, limit: 60 }), async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok' })
  } catch {
    res.status(503).json({ status: 'unavailable' })
  }
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`API listening on port ${port}`)
})
