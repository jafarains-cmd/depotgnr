// Setup test env: pakai DB SQLite in-memory atau file terpisah supaya
// tidak campur dengan dev DB.
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "./data/test.db";
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET ?? "test-secret-32-chars-minimum-pls";
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
