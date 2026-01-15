import { runMigrations } from "graphile-worker"
import { createAdvisoryLock } from "pg-advisory-lock"
import { beforeAll } from "vitest"

import { makeWorkerUtils } from "#lib"

import { databaseURL, db } from "./db"

declare global {
  // eslint-disable-next-line ts/no-namespace
  namespace GraphileWorker {
    interface Tasks {
      testTask: { foo: number }
    }
  }
}

export const { withLock, wrapWithLock } = createAdvisoryLock(databaseURL)

beforeAll(async () => {
  // Use advisory lock to prevent race condition error in CI/CD:
  // duplicate key value violates unique constraint "pg_namespace_nspname_index"
  // TODO: allow migrations to run within the Orchid ORM transaction.
  await withLock("runMigrations", () => runMigrations({ connectionString: databaseURL }))
})

export const { addJob, removeJob } = makeWorkerUtils(db.$queryBuilder)
