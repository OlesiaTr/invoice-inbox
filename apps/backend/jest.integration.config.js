/** Integration tests: real Postgres + pgmq (docker compose up db). Run serially. */
module.exports = {
  ...require('./jest.config'),
  testRegex: '.*\\.int-spec\\.ts$',
  globalSetup: '<rootDir>/testing/global-setup.ts',
  testTimeout: 30000,
};
