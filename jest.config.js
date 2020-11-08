
export default {
  testEnvironment: 'node',
  setupFiles: [],
  moduleFileExtensions: ['js', 'fnk'],
  transform: {
    '^.+\\.fnk$': ['@fink/jest/transform.js'],
    '^.+\\.js$': [
      'babel-jest',
      {presets: [['@babel/preset-env', {targets: {node: 'current'}}]]}
    ],
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/build/'],

  resolver: '@fink/jest/cjs/module-resolver.js',
  snapshotResolver: '@fink/jest/snapshot-resolver.js',

  modulePathIgnorePatterns: ['<rootDir>/build/'],

  testMatch: [
    '<rootDir>/**/*.test.fnk'
  ],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/build/'],
  watchPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/build/'],

  timers: 'modern',

  clearMocks: true,
  resetMocks: false,

  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.js'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/testing/'
  ],
  coverageDirectory: './build/cov',
  coverageReporters: ['lcov'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  }
};
