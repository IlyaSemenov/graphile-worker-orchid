import { expect, test } from "vitest"

import { db } from "./setup/db"
import { workerUtils } from "./setup/workerUtils"

const schemaExists = () =>
  db.$query<{ exists: boolean }>`SELECT to_regclass('graphile_worker.jobs') IS NOT NULL AS exists`
    .then(({ rows: [{ exists }] }) => exists)

test("runMigrations is idempotent when the schema already exists", async () => {
  // The schema was already installed by the setup's beforeAll, so this is a
  // second run right after the first. It must not fail.
  expect(await schemaExists()).toBe(true)

  await expect(workerUtils.runMigrations()).resolves.toBeUndefined()

  expect(await schemaExists()).toBe(true)
})

test("runMigrations installs the schema from scratch", async () => {
  await db.$query`DROP SCHEMA graphile_worker CASCADE`
  expect(await schemaExists()).toBe(false)

  await workerUtils.runMigrations()

  expect(await schemaExists()).toBe(true)
  // The schema is usable: adding a job works.
  const job = await workerUtils.addJob("testTask", { foo: 123 })
  expect(job.id).toBeTypeOf("string")
})

test("runMigrations participates in the caller's transaction", async () => {
  // Start from a clean slate so the migrations actually run inside the
  // transaction below (rather than being a no-op on an existing schema).
  await db.$query`DROP SCHEMA graphile_worker CASCADE`
  expect(await schemaExists()).toBe(false)

  // Run the migrations inside the caller's own transaction, then make that
  // transaction fail. If runMigrations honors the active transaction, the
  // freshly installed schema must roll back along with it.
  await db.$transaction(async () => {
    await workerUtils.runMigrations()
    expect(await schemaExists()).toBe(true)
    throw new Error("roll back the caller's transaction")
  }).catch(() => {})

  expect(await schemaExists()).toBe(false)
})
