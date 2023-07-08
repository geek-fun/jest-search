/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 10 * 60 * 1000,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
