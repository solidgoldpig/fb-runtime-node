/**
 * @module mergeInstances
 **/

const jp = require('jsonpath')

const {FBLogger, FBError, clone, deepClone} = require('@solidgoldpig/fb-utils-node')

class FBMergeError extends FBError {}

/**
 * Add a $source property to instances indicating their source
 *
 * @param {{source: string, instances: array}} sourceObj
 * Object detailed below
 *
 * @param {string} sourceObj.source
 * Name of data source
 *
 * @param {array<instances>} sourceObj.instances
 * Instances to annotate
 *
 * @return {Promise.<{source: string, instances: array}>}
 * Promised object containing annotated instances
 **/
const annotateInstances = (sourceObj) => {
  const annotateSourceObj = clone(sourceObj)
  const source = annotateSourceObj.source
  annotateSourceObj.instances = annotateSourceObj.instances.map(instance => {
    return Object.assign({$source: source}, instance)
  })
  return annotateSourceObj
}

/**
 * Merge data from multiple sources
 *
 * @param {array.<{source: string, instances: array}>} sourceObjs
 *  Array of objects specifying
 *  - name of source instance loaded from
 *  - loaded instances
 *
 * @return {object}
 * Merged instances
 **/
const flattenSources = (sourceObjs) => {
  const instances = {}
  const processed = {}

  const instancesBySource = {}
  sourceObjs.forEach(sourceObj => {
    const sourceName = sourceObj.source
    instancesBySource[sourceName] = {}
    sourceObj.instances.forEach(instance => {
      instancesBySource[sourceName][instance._id] = clone(instance)
    })
  })
  const sources = sourceObjs.map(sourceObj => sourceObj.source).reverse()

  // TODO: make this a pure function rather than rely on the closure
  const expandIsa = (instance) => {
    const throwFlattenError = (message, code) => {
      throw new FBMergeError(message, {
        error: {
          code
        },
        data: {
          instance,
          instances
        }
      })
    }

    let isaSource
    const isaId = instance._isa.replace(/(.*)=>(.*)/, (m, m1, m2) => {
      isaSource = m1
      return m2
    })
    if (!isaSource) {
      for (let i = 0; i < sources.length; i++) {
        if (instancesBySource[sources[i]][isaId]) {
          isaSource = sources[i]
          break
        }
      }
    }

    if (!isaSource) {
      throwFlattenError(`No instance "${isaId}" found, referenced by "${instance._id}"`, 'ENOISA')
    } else if (!instancesBySource[isaSource]) {
      throwFlattenError(`No source "${isaSource}" for instance "${isaId}", referenced by "${instance._id}"`, 'ENOISASOURCE')
    } else if (!instancesBySource[isaSource][isaId]) {
      throwFlattenError(`No instance "${isaId}" found in source "${isaSource}", referenced by "${instance._id}"`, 'ENOISAINSOURCE')
    }
    // const originalInstance = deepClone(instance)
    const isaInstance = expandInstanceRef(instancesBySource[isaSource][isaId])
    instance = Object.assign({}, isaInstance, instance)

    // instance.$original = originalInstance
    return instance
  }

  // TODO: make this a pure function rather than rely on the closure
  const expandInstanceRef = (instance) => {
    const processedKey = `${instance.$source}=>${instance._id}`
    if (processed[processedKey]) {
      return instance
    }

    // jsonpath can't set a value on the object itself
    const instanceWrapper = {
      instance
    }

    // TODO: use '$..[*][?(@._isa)]' instead?
    const isaPaths = jp.paths(instanceWrapper, '$.._isa')
    isaPaths.forEach(isaPath => {
      isaPath.pop()
      const propertyPath = jp.stringify(isaPath)
      // if (propertyPath === '$') {
      //   return
      // }
      const isaRefPropertyInstance = expandIsa(jp.query(instanceWrapper, propertyPath)[0])
      if (propertyPath !== '$.instance') {
        jp.value(instanceWrapper, propertyPath, isaRefPropertyInstance)
      } else {
        Object.assign(instance, isaRefPropertyInstance)
      }
    })

    processed[processedKey] = true
    return instance
  }

  sources.forEach(sourceName => {
    Object.keys(instancesBySource[sourceName]).forEach(instanceId => {
      const instance = instancesBySource[sourceName][instanceId]
      if (!instances[instance._id]) {
        instances[instance._id] = expandInstanceRef(instance)
      } else {
        FBLogger(`already got ${instance._id}`)
      }
    })
  })
  return instances
}

/**
 * Merge and annotate data from multiple sources
 *
 * @param {array.<{source: string, instances: array}>} sourceObjs
 *  Array of objects specifying
 *  - name of source instance loaded from
 *  - loaded instances
 *
 * @return {object}
 * Merged instances
 **/
const merge = sourceObjs => {
  sourceObjs = deepClone(sourceObjs)
  const annotatedSources = sourceObjs.map(sourceObj => annotateInstances(sourceObj))
  const flattenedSources = flattenSources(annotatedSources)
  return flattenedSources
}
module.exports = {
  merge
}
