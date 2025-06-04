process.env.NODE_ENV = 'test'

const test = require('ava')
const servertest = require('servertest')

const server = require('../lib/server')

test.serial.cb('healthcheck', function (t) {
  const url = '/health'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.end()
  })
})

test.serial.cb('create target', function (t) {
  const url = '/api/targets'
  const target = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: { $in: ['ca', 'ny'] },
      hour: { $in: ['13', '14', '15'] }
    }
  }
  const testServer = servertest(server(), url, {
    method: 'POST',
    encoding: 'json',
    headers: {
      'Content-Type': 'application/json'
    }
  }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'correct statusCode')
    t.truthy(res.body.id, 'target has id') // you can customize this
    t.end()
  })

  testServer.write(JSON.stringify(target))
  testServer.end()
})

test.serial.cb('get all targets', function (t) {
  const url = '/api/targets'
  servertest(server(), url, {
    method: 'GET',
    encoding: 'json'
  }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'correct statusCode')
    t.true(Array.isArray(res.body), 'response is array')
    t.true(res.body.length > 0, 'response has at least one target')
    t.end()
  })
})

test.serial.cb('get target by id', function (t) {
  const url = '/api/target/1'
  servertest(server(), url, {
    method: 'GET',
    encoding: 'json'
  }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.id, '1', 'correct target ID')
    t.end()
  })
})

test.serial.cb('update target by id', function (test) {
  const update = {
    id: '1',
    url: 'http://example.com',
    value: '0.75',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: { $in: ['ca', 'ny'] },
      hour: { $in: ['13', '14', '15'] }
    }
  }
  const url = '/api/target/1'
  const testServer = servertest(server(), url, {
    method: 'POST',
    encoding: 'json'
  }, function (err, res) {
    test.falsy(err, 'no error')
    test.is(res.statusCode, 200, 'correct statusCode')
    test.is(res.body.value, '0.75', 'target value updated')
    test.end()
  })
  testServer.write(JSON.stringify(update))
  testServer.end()
})

test.serial.cb('GET /favicon.ico returns 204', function (test) {
  servertest(server(), '/favicon.ico', { method: 'GET' }, function (err, res) {
    console.log('res', res)
    console.log('err', err)
    test.falsy(err, 'no error')
    test.is(res.statusCode, 204, 'should return 204 No Content')
    test.end()
  })
})

test.serial.cb('PUT /api/targets returns 405', function (test) {
  const url = '/api/targets'
  const testServer = servertest(server(), url, { method: 'PUT', encoding: 'json' }, function (err, res) {
    test.falsy(err, 'no error')
    test.is(res.statusCode, 405, 'should return 405')
    test.is(res.body.error, 'Method Not Allowed', 'should explain method not allowed')
    test.end()
  })
  testServer.end()
})

test.serial.cb('GET /api/target/nonexistent returns 404', function (test) {
  const url = '/api/target/nonexistent-id'
  servertest(server(), url, { method: 'GET', encoding: 'json' }, function (err, res) {
    test.falsy(err, 'no error')
    test.is(res.statusCode, 404, 'should return 404')
    test.is(res.body.error, 'Target not found', 'should explain not found')
    test.end()
  })
})
