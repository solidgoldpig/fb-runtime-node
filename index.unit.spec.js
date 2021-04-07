const test = require('tape')

const methods = require('./index')

test('When the module is loaded', function (t) {
  t.equal(typeof methods.getRuntimeData, 'function', 'it should export the getRuntimeData method')

  t.end()
})
