const { promisify } = require('util')

module.exports = createRouter

// Functions
function createRouter (redis, targetStore) {
  // Promisify Redis methods
  const incrAsync = promisify(redis.incr).bind(redis)
  const getAsync = promisify(redis.get).bind(redis)
  const expireAsync = promisify(redis.expire).bind(redis)

  // Expose the routeVisitor function
  return { routeVisitor }

  // Main function for handling visitor routing
  async function routeVisitor (visitor) {
    const targets = await targetStore.getAllTargets()
    const eligibleTargets = getEligibleTargets(targets, visitor)

    if (eligibleTargets.length === 0) {
      return { decision: 'reject' }
    }

    const sortedTargets = sortTargetsByValue(eligibleTargets)
    for (const target of sortedTargets) {
      const key = getDailyKey(target.id)
      const currentCount = await getCurrentCount(key)
      if (currentCount < parseInt(target.maxAcceptsPerDay, 10)) {
        await incrementCount(key)
        await setExpiration(key)
        return { decision: 'accept', url: target.url }
      }
    }
    return { decision: 'reject' }
  }

  // Check if the target is eligible for the visitor
  function getEligibleTargets (targets, visitor) {
    return targets.filter(target => isTargetEligible(target, visitor))
  }

  // Sort targets by value (highest to lowest)
  function sortTargetsByValue (targets) {
    return targets.sort((a, b) => parseFloat(b.value) - parseFloat(a.value))
  }

  // Check if the target is eligible for the visitor based on geoState and hour
  function isTargetEligible (target, visitor) {
    const acceptedStates = target.accept.geoState.$in
    const acceptedHours = target.accept.hour.$in
    const visitHour = new Date(visitor.timestamp).getUTCHours().toString()

    return acceptedStates.includes(visitor.geoState) && acceptedHours.includes(visitHour)
  }

  // Generate the daily key for Redis storage
  function getDailyKey (id) {
    const date = new Date().toISOString().slice(0, 10) // Get current date (YYYY-MM-DD)
    return `accepts:${id}:${date}`
  }

  // Get the current count for a specific key
  async function getCurrentCount (key) {
    return parseInt(await getAsync(key) || '0', 10)
  }

  // Increment the count for the daily key
  async function incrementCount (key) {
    await incrAsync(key)
  }

  // Set expiration for the daily key (until midnight)
  async function setExpiration (key) {
    await expireAsync(key, secondsUntilMidnight())
  }

  // Calculate the number of seconds remaining until midnight (UTC)
  function secondsUntilMidnight () {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setUTCHours(24, 0, 0, 0)
    return Math.floor((midnight - now) / 1000)
  }
}
