import { runMigrations } from "graphile-worker"
import { orchidORM, testTransaction } from "orchid-orm"
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest"

const databaseURL = import.meta.env.VITE_DATABASE_URL
if (!databaseURL) {
  throw new Error("VITE_DATABASE_URL is required to run PostgreSQL integration tests.")
}

export const db = orchidORM(
  {
    databaseURL,
    log: !!import.meta.env.VITE_DATABASE_LOG,
  },
  {},
)

beforeAll(async () => {
  await runMigrations({ connectionString: databaseURL })
  await testTransaction.start(db)
})
beforeEach(() => testTransaction.start(db))
afterEach(() => testTransaction.rollback(db))
afterAll(() => testTransaction.close(db))
