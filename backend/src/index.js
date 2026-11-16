require('dotenv').config()

const express = require('express')
const { rateLimit } = require('express-rate-limit')
const mariadb = require('mariadb')

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

const databaseUrl = new URL(process.env.DATABASE_URL)
if (!databaseUrl.username && process.env.DB_USER) databaseUrl.username = process.env.DB_USER
if (!databaseUrl.password && process.env.DB_PASSWORD) databaseUrl.password = process.env.DB_PASSWORD
if (!databaseUrl.searchParams.has('connectTimeout')) databaseUrl.searchParams.set('connectTimeout', '5000')
if (!databaseUrl.searchParams.has('acquireTimeout')) databaseUrl.searchParams.set('acquireTimeout', '5000')
const pool = mariadb.createPool(databaseUrl.toString())
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
