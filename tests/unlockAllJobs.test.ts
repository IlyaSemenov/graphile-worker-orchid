import { expect, test } from "vitest"

import { db } from "./setup/db"
import { workerUtils } from "./setup/workerUtils"

test("unlockAllJobs is a no-op before graphile_worker schema exists", async () => {
  await db.$query`DROP SCHEMA graphile_worker CASCADE`

  await expect(workerUtils.unlockAllJobs()).resolves.toBeUndefined()
})

test("unlockAllJobs unlocks locked jobs", async () => {
  const job = await workerUtils.addJob("testTask", { foo: 123 })
  const workerId = "test-worker-1"

  await db.$query`
    UPDATE graphile_worker._private_jobs
    SET locked_by = ${workerId}, locked_at = now()
    WHERE id = CAST(${job.id} AS bigint)
  `

  const {
    rows: [lockedJob],
  } = await db.$query<{ locked_by: string | null, locked_at: Date | null }>`
    SELECT locked_by, locked_at
    FROM graphile_worker.jobs
    WHERE id = ${job.id}
  `
  expect(lockedJob.locked_by).toBe(workerId)
  expect(lockedJob.locked_at).toBeTruthy()

  await workerUtils.unlockAllJobs()

  const {
    rows: [unlockedJob],
  } = await db.$query<{ locked_by: string | null, locked_at: Date | null }>`
    SELECT locked_by, locked_at
    FROM graphile_worker.jobs
    WHERE id = ${job.id}
  `
  expect(unlockedJob.locked_by).toBeNull()
  expect(unlockedJob.locked_at).toBeNull()
})
