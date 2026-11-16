const test = require('node:test')
const assert = require('node:assert/strict')
const { promisify } = require('node:util')
const { scrypt } = require('node:crypto')
const { execFile } = require('node:child_process')
const mariadb = require('mariadb')
const { createApp } = require('../src/app')

const key = 'test-key-with-at-least-32-characters'

async function serve(app) {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  return {
    server,
    async request(path, { method = 'GET', body, token = key } = {}) {
      const response = await fetch(url + path, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body)
      })
      const data = response.status === 204 ? null : await response.json()
      return { status: response.status, data }
    }
  }
}

test('CRUD routes require a configured API key', async t => {
  const pool = { query: async () => { throw new Error('unexpected database query') } }
  const disabled = await serve(createApp(pool))
  t.after(() => disabled.server.close())
  assert.equal((await disabled.request('/api/saloons')).status, 503)
  const enabled = await serve(createApp(pool, key))
  t.after(() => enabled.server.close())
  assert.equal((await enabled.request('/api/saloons', { token: 'wrong' })).status, 401)
  assert.equal((await enabled.request('/api/saloons', { method: 'POST', body: { nom: '' } })).status, 400)
  assert.equal((await enabled.request('/api/saloons/0')).status, 400)
})

test('MariaDB CRUD, foreign keys, validation and password hashing', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }
  await promisify(execFile)(process.execPath, ['src/migrate.js'], { cwd: require('node:path').join(__dirname, '..'), env })
  await promisify(execFile)(process.execPath, ['src/migrate.js'], { cwd: require('node:path').join(__dirname, '..'), env })
  const pool = mariadb.createPool(process.env.TEST_DATABASE_URL)
  const { server, request } = await serve(createApp(pool, key))
  const created = []
  t.after(async () => {
    try {
      for (const [resource, id] of created.reverse()) {
        await request(`/api/${resource}/${id}`, { method: 'DELETE' })
      }
    } finally {
      server.close()
      await pool.end()
    }
  })
  async function create(resource, body) {
    const result = await request(`/api/${resource}`, { method: 'POST', body })
    assert.equal(result.status, 201, JSON.stringify(result.data))
    created.push([resource, result.data.id])
    return result.data
  }
  const saloon = await create('saloons', { nom: 'Test saloon', ville: 'Test ville' })
  const userBody = {
    nom: 'Nom', prenom: 'Prénom', login: `test-${Date.now()}-${Math.random()}`,
    password: 'mot de passe', grade: 'employé', saloon_id: saloon.id, admin: false
  }
  const user = await create('utilisateurs', userBody)
  assert.equal(user.admin, false)
  assert.equal(Object.hasOwn(user, 'password'), false)
  assert.equal(Object.hasOwn(user, 'password_hash'), false)
  const rows = await pool.query('SELECT password_hash FROM utilisateurs WHERE id = ?', [user.id])
  const [algorithm, salt, hash] = rows[0].password_hash.split(':')
  assert.equal(algorithm, 'scrypt')
  assert.equal((await promisify(scrypt)(userBody.password, salt, 64)).toString('hex'), hash)
  assert.equal((await request('/api/utilisateurs', { method: 'POST', body: userBody })).status, 409)
  const { password, ...userUpdate } = userBody
  assert.equal((await request(`/api/utilisateurs/${user.id}`, { method: 'PUT', body: { ...userUpdate, admin: true } })).data.admin, true)
  assert.equal((await pool.query('SELECT password_hash FROM utilisateurs WHERE id = ?', [user.id]))[0].password_hash, rows[0].password_hash)
  assert.equal((await request(`/api/utilisateurs/${user.id}`, { method: 'PUT', body: { ...userUpdate, admin: true } })).status, 200)
  const changed = await request(`/api/utilisateurs/${user.id}`, { method: 'PUT', body: { ...userUpdate, password: 'nouveau mot de passe' } })
  assert.equal(changed.status, 200)
  assert.equal(Object.hasOwn(changed.data, 'password_hash'), false)
  const updatedHash = (await pool.query('SELECT password_hash FROM utilisateurs WHERE id = ?', [user.id]))[0].password_hash
  const [, newSalt, newHash] = updatedHash.split(':')
  assert.notEqual(updatedHash, rows[0].password_hash)
  assert.equal((await promisify(scrypt)('nouveau mot de passe', newSalt, 64)).toString('hex'), newHash)
  assert.equal((await request(`/api/saloons/${saloon.id}`, { method: 'DELETE' })).status, 409)
  assert.equal((await request('/api/produits', { method: 'POST', body: { nom: 'X', saloon_id: 4294967295, revente: true } })).status, 409)
  assert.equal((await request('/api/ingredients', { method: 'POST', body: { nom: 'X', type: 'incorrect' } })).status, 400)
  const ingredient = await create('ingredients', { nom: 'Menthe', type: 'cueillette' })
  const produit = await create('produits', { nom: 'Boisson', revente: true })
  assert.equal(produit.saloon_id, null)
  const entreprise = await create('entreprises', { nom: 'Ferme', type: 'ferme', nom_patron: 'Patron', bp_patron: '123' })
  for (const [resource, item] of [['saloons', saloon], ['utilisateurs', user], ['ingredients', ingredient], ['produits', produit], ['entreprises', entreprise]]) {
    assert.equal((await request(`/api/${resource}/${item.id}`)).status, 200)
    assert.ok((await request(`/api/${resource}`)).data.some(row => row.id === item.id))
    assert.equal((await request(`/api/${resource}/4294967295`)).status, 404)
  }
  const updated = await request(`/api/produits/${produit.id}`, { method: 'PUT', body: { nom: 'Autre', saloon_id: saloon.id, revente: false } })
  assert.equal(updated.status, 200)
  assert.equal(updated.data.saloon_id, saloon.id)
  assert.equal((await request(`/api/ingredients/${ingredient.id}`, { method: 'DELETE' })).status, 204)
  assert.equal((await request(`/api/ingredients/${ingredient.id}`, { method: 'DELETE' })).status, 404)
})
