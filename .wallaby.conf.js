module.exports = () => ({
  files: [
    { pattern: 'index.js', load: false },
    "!index.unit.spec.js",
    { pattern: 'lib/**/*.js', load: false },
    "!lib/**/*.unit.spec.js",
    { pattern: 'data/**/*.json', load: false }
  ],
  tests: [
    'index.unit.spec.js',
    'lib/**/*.unit.spec.js'
  ],
  env: {
    type: 'node'
  },
  testFramework: 'tape',
  workers: {
    restart: true
  }
})
