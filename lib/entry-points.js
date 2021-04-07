/**
 * @module entryPoints
 **/

const entryPoints = {}

entryPoints.getEntryPointKeys = (instances) => {
  const instanceKeys = Object.keys(instances)
  const pageKeys = instanceKeys.filter(key => instances[key]._type.startsWith('page.'))
  return pageKeys.filter(pageKey => {
    return instanceKeys.filter(key => {
      return instances[key].steps && instances[key].steps.includes(pageKey)
    }).length === 0
  })
}

entryPoints.getEntryPointInstances = (instances) => {
  const keys = entryPoints.getEntryPointKeys(instances)

  const entryPointInstances = {}
  keys.forEach(key => {
    entryPointInstances[key] = instances[key]
  })

  return entryPointInstances
}

module.exports = entryPoints
