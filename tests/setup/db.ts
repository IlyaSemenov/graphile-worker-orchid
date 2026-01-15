import { orchidORM, testTransaction } from "orchid-orm"
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest"

const maybeDatabaseURL = import.meta.env.VITE_DATABASE_URL as string | undefined
if (!maybeDatabaseURL) {
  throw new Error("VITE_DATABASE_URL is required to run PostgreSQL integration tests.")
}
const databaseURL = maybeDatabaseURL
export { databaseURL }

export const db = orchidORM(
  {
    databaseURL,
    log: !!import.meta.env.VITE_DATABASE_LOG,
  },
  {},
)

beforeAll(() => testTransaction.start(db))
beforeEach(() => testTransaction.start(db))
afterEach(() => testTransaction.rollback(db))
afterAll(() => testTransaction.close(db))
