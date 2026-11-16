require('dotenv').config()

const { createPool } = require('./db')
const { createApp } = require('./app')

const pool = createPool()
const app = createApp(pool, process.env.API_KEY)

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`API listening on port ${port}`)
})
