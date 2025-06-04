const http = require('http')
const cuid = require('cuid')
const Corsify = require('corsify')
const sendJson = require('send-data/json')
const ReqLogger = require('req-logger')
const healthPoint = require('healthpoint')
const getBody = require('body/json')

const redis = require('./redis')
const createTargetStore = require('./targets')
const createRouter = require('./route')

const version = require('../package.json').version

const targets = createTargetStore(redis)
const routerLogic = createRouter(redis, targets)
const logger = ReqLogger({ version })
const health = healthPoint({ version }, redis.healthCheck)

const cors = Corsify({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, accept, content-type'
})

module.exports = function server () {
  return http.createServer(cors(handleRequest))
}

// Main request handler
function handleRequest (req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname

  // Health check route
  if (pathname === '/health') {
    return health(req, res)
  }
  req.id = cuid()
  logger(req, res, { requestId: req.id }, function (info) {
    info.authEmail = (req.auth || {}).email
    console.log(info)
  })
  const normalizedPath = normalizePath(pathname)
  if (normalizedPath === '/favicon.ico') {
    return sendNoContent(res)
  }

  if (normalizedPath === '/api/targets') {
    return handleTargets(req, res)
  }

  const targetIdMatch = normalizedPath.match(/^\/api\/target\/([^/]+)$/)
  if (targetIdMatch) {
    return handleTargetById(req, res, targetIdMatch[1])
  }

  res.statusCode = 404
  sendJson(req, res, { error: 'Not Found' })
}

function normalizePath (pathname) {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

function sendNoContent (res) {
  res.statusCode = 204
  res.end()
}

// Handle /api/targets
function handleTargets (req, res) {
  if (req.method === 'POST') {
    return getBody(req, res, (err, body) => handleErrorOrPromise(req, res, err, targets.addTarget(body)))
  }
  if (req.method === 'GET') {
    return targets.getAllTargets()
      .then(result => sendJson(req, res, result))
      .catch(err => handleError(req, res, err))
  }

  // Method not allowed
  res.statusCode = 405
  return sendJson(req, res, { error: 'Method Not Allowed' })
}

// Handle /api/target/:id
function handleTargetById (req, res, id) {
  if (req.method === 'GET') {
    return targets.getTargetById(id)
      .then(result => result ? sendJson(req, res, result) : sendNotFound(req, res))
      .catch(err => handleError(req, res, err))
  }

  if (req.method === 'POST') {
    return getBody(req, res, (err, body) => handleErrorOrPromise(req, res, err, targets.updateTarget(id, body)))
  }

  // Method not allowed
  res.statusCode = 405
  return sendJson(req, res, { error: 'Method Not Allowed' })
}

function handleRoute (req, res) {
  return getBody(req, res, (err, body) => handleErrorOrPromise(req, res, err, routerLogic.routeVisitor(body)))
}

function handleErrorOrPromise (req, res, err, promise) {
  if (err) return handleError(req, res, err)
  promise
    .then(result => sendJson(req, res, result))
    .catch(err => handleError(req, res, err))
}

function handleError (req, res, err) {
  if (!err) return

  res.statusCode = err.statusCode || 500
  logError(req, res, err)

  sendJson(req, res, {
    error: err.message || http.STATUS_CODES[res.statusCode]
  })
}

function logError (req, res, err) {
  if (process.env.NODE_ENV === 'test') return

  const logType = res.statusCode >= 500 ? 'error' : 'warn'

  console[logType]({
    err: err,
    requestId: req.id,
    statusCode: res.statusCode
  }, err.message)
}

function sendNotFound (req, res) {
  res.statusCode = 404
  sendJson(req, res, { error: 'Target not found' })
}
