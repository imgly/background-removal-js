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
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'Background Removal Test Report',
      outputPath: 'test-report.html'
    }]
  ],
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
