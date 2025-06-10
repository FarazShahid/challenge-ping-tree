const { promisify } = require('util')

module.exports = createTargetStore

function createTargetStore (redis) {
  const getAsync = promisify(redis.get).bind(redis)
  const setAsync = promisify(redis.set).bind(redis)
  const keysAsync = promisify(redis.keys).bind(redis)

  return {
    addTarget,
    getTargetById,
    getAllTargets,
    updateTarget
  }

  function addTarget (target) {
    const id = target.id || Date.now().toString()
    const key = `target:${id}`

    return getAsync(key)
      .then(existingData => {
        if (existingData) {
          return Promise.reject(new Error('Target already exists'))
        }
        const data = JSON.stringify({ ...target, id })
        return setAsync(key, data).then(() => JSON.parse(data))
      })
  }
  function getTargetById (id) {
    const key = `target:${id}`
    return getAsync(key).then(data =>
      data && JSON.parse(data)
    )
  }

  function getAllTargets () {
    return keysAsync('target:*')
      .then(keys => Promise.all(keys.map(key => getAsync(key))))
      .then(targets => targets.filter(Boolean).map(JSON.parse))
  }

  function updateTarget (id, updates) {
    const key = `target:${id}`
    return getAsync(key)
      .then(data => {
        if (!data) return null
        const original = JSON.parse(data)
        const merged = Object.assign({}, original, updates, { id })
        return setAsync(key, JSON.stringify(merged)).then(() => merged)
      })
  }
}
