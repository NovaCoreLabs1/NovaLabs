/** @type {import('@stryker-mutator/api/core').StrykerOptions} */
module.exports = {
  packageManager: 'npm',
  // Lower concurrency to reduce test runner timeouts on CI/dev machines
  concurrency: 2,
  testRunner: 'jest',
  jest: {
    configFile: 'package.json', // reuses the jest block already in package.json
    enableFindRelatedTests: false,
  },
  coverageAnalysis: 'perTest',
  mutate: [
    'src/auth/**/*.ts',
    '!src/auth/**/*.spec.ts',
    '!src/auth/**/*.module.ts',
    '!src/auth/dto/**',
    '!src/auth/entities/**',
    '!src/auth/interface/**',
    '!src/auth/decorators/**',
  ],
  thresholds: { high: 80, low: 60, break: 60 },
  // Ignore static mutants that take disproportionate time and emit JSON report for CI
  ignoreStatic: true,
  reporters: ['html', 'clear-text', 'progress', 'json'],
};
