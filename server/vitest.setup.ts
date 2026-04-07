/**
 * Vitest global setup — runs before any test file is imported.
 *
 * Sets mock environment variables so modules that check for DATABASE_URL,
 * JWT_SECRET, etc. at import time don't crash in CI where these aren't set.
 * The actual database connection will fail, but that's fine because tests
 * that need a real DB are already designed to handle connection errors.
 */

// Only set if not already present (don't override real values in dev)
const defaults: Record<string, string> = {
  DATABASE_URL: "mysql://test:test@localhost:3306/test",
  JWT_SECRET: "test-jwt-secret-for-ci",
  BETTER_AUTH_URL: "http://localhost:3000",
  OWNER_OPEN_ID: "test-owner-id",
  OWNER_NAME: "Test Owner",
  BUILT_IN_FORGE_API_URL: "http://localhost:9999",
  BUILT_IN_FORGE_API_KEY: "test-forge-key",
  VITE_APP_ID: "test-app-id",
  OAUTH_SERVER_URL: "http://localhost:9999",
  VITE_OAUTH_PORTAL_URL: "http://localhost:9999",
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
