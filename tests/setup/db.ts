import { testTransaction } from "orchid-orm"
import { orchidORM } from "orchid-orm/postgres-js"
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest"

import { makeWorkerUtils } from "#lib"

// Notices emitted by routine test setup/teardown DDL.
const skippedNoticeCodes = new Set([
  "00000", // "drop cascades to ..." from DROP SCHEMA ... CASCADE
  "42P06", // schema "graphile_worker" already exists, skipping
  "42P07", // relation "migrations" already exists, skipping
  "42701", // column "breaking" of relation "migrations" already exists, skipping
])

export const db = orchidORM(
  {
    databaseURL: import.meta.env.VITE_DATABASE_URL,
    log: !!import.meta.env.VITE_DATABASE_LOG,
    onnotice(notice) {
      if (!(notice.code && skippedNoticeCodes.has(notice.code))) {
        console.warn(`[${notice.code}] ${notice.message}`)
      }
    },
  },
  {},
)

const { runMigrations } = makeWorkerUtils(db.$qb)

beforeAll(async () => {
  await testTransaction.start(db)
  await runMigrations()
})
beforeEach(() => testTransaction.start(db))
afterEach(() => testTransaction.rollback(db))
afterAll(() => testTransaction.close(db))
