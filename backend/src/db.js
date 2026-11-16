const mariadb = require('mariadb')

function createPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')

  const databaseUrl = new URL(process.env.DATABASE_URL)
  if (!databaseUrl.username && process.env.DB_USER) databaseUrl.username = process.env.DB_USER
  if (!databaseUrl.password && process.env.DB_PASSWORD) databaseUrl.password = process.env.DB_PASSWORD
  if (!databaseUrl.searchParams.has('connectTimeout')) databaseUrl.searchParams.set('connectTimeout', '5000')
  if (!databaseUrl.searchParams.has('acquireTimeout')) databaseUrl.searchParams.set('acquireTimeout', '5000')
  const pool = mariadb.createPool(databaseUrl.toString())
  pool.on('error', () => console.error('Idle database connection failed'))
  return pool
}

module.exports = { createPool }
