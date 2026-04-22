module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/src/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/browser/'
  ],
  verbose: true,
  testTimeout: 300000,
  maxWorkers: 1,
  setupFilesAfterEnv: [],
  reporters: ['default'],
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
