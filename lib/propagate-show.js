/**
 * @module propagateShow
 **/

const jp = require('jsonpath')
const {deepClone} = require('@solidgoldpig/fb-utils-node')
const {getEntryPointKeys} = require('./entry-points')

/**
   * Create conditions object where all passed conditions must be met
   *
   * @param {array} condtions
   *  Array of conditions
   *
   * @return {object}
   *   Condtion object
   **/
const createAllConditions = (...condtions) => {
  const definedConditions = condtions.filter(condition => condition !== undefined)
  if (!definedConditions.length) {
    return
  }
  if (definedConditions.length === 1) {
    return definedConditions[0]
  }

  const allOf = deepClone(definedConditions)
    .map(condition => condition.all ? condition.all : condition)
  const all = [].concat(...allOf)

  // possible optimisation to push additonal conditions on to existing allOf
  // NB. but ensure to clone in this case
  // OTOH, why not do it by reference?
  return {
    _type: 'condition',
    all
    // : definedConditions
  }
}

/**
 * Hoist show information from nested instances to step instance
 *
 * @param {object} instances
 *  Object of service instances keyed by id
 *
 * @return {object}
 *  Cloned object containing instances with propagated show info
 **/
const propagateInstanceConditions = (instances) => {
  instances = deepClone(instances)

  jp.paths(instances, '$..["components","items"]').reverse().forEach(instancePath => {
    const collectionType = instancePath.pop()
    // Not sure why jsonpath puts this value in the path array - but it does
    const collectionInstancePath = jp.stringify(instancePath).replace(/\.value/, '')
    const instance = jp.query(instances, collectionInstancePath)[0]
    const instanceCollection = instance[collectionType]
    const shows = instanceCollection.map(item => item.show).filter(show => show)
    // if all the items have a condition, the collection of items must satisfy at least one of them
    if (shows.length === instanceCollection.length) {
      // no need to match any if there's only one condition
      // Is there really a need for this optimisation though?
      const instanceShow = shows.length === 1 ? deepClone(shows[0]) : {
        _type: 'condition',
        any: deepClone(shows)
      }
      instance.show = createAllConditions(instance.show, instanceShow)
    }
  })
  return instances
}

/**
 * Propagate show information through nested instances
 *
 * @param {object} instances
 *  Object of service instances keyed by id
 *
 * @return {object}
 *  Cloned object containing instances with propagated show info
 **/
const propagate = instances => {
  instances = deepClone(instances)

  const seen = {}

  /**
     * Recursively apply show conditions to steps
     *
     * @param {object} instance
     *  Instance object
     *
     * @return {undefined}
     *   Transforms are applied in place
     **/
  const propagateStepConditions = (instance) => {
    if (seen[instance._id]) {
      return
    }
    seen[instance._id] = true
    if (instance.mountPoint) {
      const mountPointInstance = instances[instance.mountPoint]
      propagateStepConditions(mountPointInstance)
      if (mountPointInstance.show !== undefined) {
        instance.show = createAllConditions(mountPointInstance.show, instance.show)
      }
    }
    if (instance._parent) {
      propagateStepConditions(instances[instance._parent])
    }
    if (instance.steps) {
      const showSteps = createAllConditions(instance.show, instance.showSteps)
      instance.steps.forEach(step => {
        const stepInstance = instances[step]
        if (showSteps) {
          stepInstance.show = createAllConditions(showSteps, stepInstance.show)
        }
        propagateStepConditions(stepInstance)
      })
    }
  }

  instances = propagateInstanceConditions(instances)

  const pageKeys = getEntryPointKeys(instances)
  pageKeys.forEach(key => {
    propagateStepConditions(instances[key])
  })

  return instances
}
module.exports = {
  propagate,
  propagateInstanceConditions
}
