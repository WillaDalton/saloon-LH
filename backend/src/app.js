const express = require('express')
const { rateLimit } = require('express-rate-limit')
const { randomBytes, scrypt: scryptCallback, createHash, timingSafeEqual } = require('node:crypto')
const { promisify } = require('node:util')

const scrypt = promisify(scryptCallback)
const companyTypes = ['ferme', 'herboriste', 'distillerie', 'general-store']
const text = { type: 'text' }
const resources = {
  saloons: { fields: { nom: text, ville: text } },
  utilisateurs: {
    fields: {
      nom: text, prenom: text, login: text, password: { type: 'password' },
      grade: { type: 'enum', values: ['employé', 'contremaitre', 'co-patron', 'patron'] },
      saloon_id: { type: 'id' }, admin: { type: 'boolean' }
    },
    hidden: ['password']
  },
  ingredients: { fields: { nom: text, type: { type: 'enum', values: [...companyTypes, 'cueillette'] } } },
  produits: {
    fields: { nom: text, saloon_id: { type: 'id', nullable: true }, revente: { type: 'boolean' } }
  },
  entreprises: {
    fields: { nom: text, type: { type: 'enum', values: companyTypes }, nom_patron: text, bp_patron: text }
  }
}

function validId(value) {
  return Number.isInteger(value) && value > 0 && value <= 4294967295
}

function validate(body, fields, update) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Corps JSON invalide'
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(fields, key)) return `Champ inconnu : ${key}`
  }
  for (const [key, field] of Object.entries(fields)) {
    const value = body[key]
    if (value === undefined) {
      if (field.nullable || (update && field.type === 'password')) continue
      return `Champ requis : ${key}`
    }
    if (value === null && field.nullable) continue
    if (field.type === 'text' && (typeof value !== 'string' || !value.trim() || value.length > 255)) return `Champ invalide : ${key}`
    if (field.type === 'password' && (typeof value !== 'string' || !value || Buffer.byteLength(value) > 1024)) return `Champ invalide : ${key}`
    if (field.type === 'enum' && !field.values.includes(value)) return `Champ invalide : ${key}`
    if (field.type === 'id' && !validId(value)) return `Champ invalide : ${key}`
    if (field.type === 'boolean' && typeof value !== 'boolean') return `Champ invalide : ${key}`
  }
}

async function valuesFor(body, fields) {
  const values = {}
  for (const [key, field] of Object.entries(fields)) {
    if (body[key] === undefined && field.type === 'password') continue
    if (field.type === 'password') {
      const salt = randomBytes(16).toString('hex')
      const hash = await scrypt(body[key], salt, 64)
      values.password_hash = `scrypt:${salt}:${hash.toString('hex')}`
    } else {
      values[key] = body[key] === undefined ? null : body[key]
    }
  }
  return values
}

function createApp(pool, apiKey) {
  const app = express()
  app.use(express.json({ limit: '16kb' }))

  app.get('/api/health', rateLimit({ windowMs: 60_000, limit: 60 }), async (_req, res) => {
    try {
      await pool.query('SELECT 1')
      res.json({ status: 'ok' })
    } catch {
      res.status(503).json({ status: 'unavailable' })
    }
  })

  const expectedKey = typeof apiKey === 'string' && apiKey.length >= 32
    ? createHash('sha256').update(apiKey).digest() : null
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120 }), (req, res, next) => {
    if (!expectedKey) return res.status(503).json({ error: 'API_KEY non configurée' })
    const match = /^Bearer (.+)$/.exec(req.get('Authorization') || '')
    const suppliedKey = createHash('sha256').update(match ? match[1] : '').digest()
    if (!match || !timingSafeEqual(expectedKey, suppliedKey)) return res.status(401).json({ error: 'Non autorisé' })
    next()
  })

  for (const [name, resource] of Object.entries(resources)) {
    const columns = ['id', ...Object.keys(resource.fields).filter(key => !resource.hidden?.includes(key))]
    const select = `SELECT ${columns.map(column => `\`${column}\``).join(', ')} FROM \`${name}\``
    const normalize = row => {
      for (const [key, field] of Object.entries(resource.fields)) {
        if (field.type === 'boolean') row[key] = Boolean(row[key])
      }
      return row
    }
    const readId = (req, res) => {
      const id = Number(req.params.id)
      if (!/^[1-9]\d*$/.test(req.params.id) || !validId(id)) {
        res.status(400).json({ error: 'Identifiant invalide' })
        return null
      }
      return id
    }
    app.get(`/api/${name}`, async (_req, res) => {
      const rows = await pool.query(`${select} ORDER BY id`)
      res.json(rows.map(normalize))
    })
    app.get(`/api/${name}/:id`, async (req, res) => {
      const id = readId(req, res)
      if (id === null) return
      const rows = await pool.query(`${select} WHERE id = ?`, [id])
      if (!rows.length) return res.status(404).json({ error: 'Ressource introuvable' })
      res.json(normalize(rows[0]))
    })
    app.post(`/api/${name}`, async (req, res) => {
      const error = validate(req.body, resource.fields, false)
      if (error) return res.status(400).json({ error })
      const values = await valuesFor(req.body, resource.fields)
      const keys = Object.keys(values)
      const result = await pool.query(
        `INSERT INTO \`${name}\` (${keys.map(key => `\`${key}\``).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
        Object.values(values)
      )
      const rows = await pool.query(`${select} WHERE id = ?`, [result.insertId])
      res.status(201).location(`/api/${name}/${result.insertId}`).json(normalize(rows[0]))
    })
    app.put(`/api/${name}/:id`, async (req, res) => {
      const id = readId(req, res)
      if (id === null) return
      const error = validate(req.body, resource.fields, true)
      if (error) return res.status(400).json({ error })
      const values = await valuesFor(req.body, resource.fields)
      const keys = Object.keys(values)
      const result = await pool.query(
        `UPDATE \`${name}\` SET ${keys.map(key => `\`${key}\` = ?`).join(', ')} WHERE id = ?`,
        [...Object.values(values), id]
      )
      if (!result.affectedRows) return res.status(404).json({ error: 'Ressource introuvable' })
      const rows = await pool.query(`${select} WHERE id = ?`, [id])
      if (!rows.length) return res.status(404).json({ error: 'Ressource introuvable' })
      res.json(normalize(rows[0]))
    })
    app.delete(`/api/${name}/:id`, async (req, res) => {
      const id = readId(req, res)
      if (id === null) return
      const result = await pool.query(`DELETE FROM \`${name}\` WHERE id = ?`, [id])
      if (!result.affectedRows) return res.status(404).json({ error: 'Ressource introuvable' })
      res.status(204).end()
    })
  }

  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' })
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Corps trop volumineux' })
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Valeur déjà utilisée' })
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Contrainte de référence non respectée' })
    }
    console.error('API error:', error)
    res.status(500).json({ error: 'Erreur interne' })
  })
  return app
}

module.exports = { createApp }
