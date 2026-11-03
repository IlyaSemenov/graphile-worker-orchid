import { describe, expect, test } from "vitest"

import { db } from "./setup/db"
import { addJob, isJobActive, removeJob } from "./setup/workerUtils"

/**
 * Lock the job the way a worker does when it starts an attempt, `lockedAgo` before now.
 */
async function lockJob(jobId: string, lockedAgo = "0 seconds") {
  await db.$query`
    UPDATE graphile_worker._private_jobs
    SET attempts = attempts + 1, locked_at = now() - ${lockedAgo}::interval, locked_by = 'worker'
    WHERE id = ${jobId}
  `
}

/**
 * Unlock the job with an error and postpone its retry the way a worker does when an attempt fails or the worker shuts down forcefully.
 */
async function failJob(jobId: string) {
  await db.$query`
    UPDATE graphile_worker._private_jobs
    SET
      last_error = 'error',
      run_at = greatest(now(), run_at) + (exp(least(attempts, 10)) * interval '1 second'),
      locked_at = NULL,
      locked_by = NULL
    WHERE id = ${jobId}
  `
}

describe("isJobActive", () => {
  test("returns true for a job waiting to run", async () => {
    await addJob("testTask", { foo: 1 }, { jobKey: "key1" })

    expect(await isJobActive("key1")).toBe(true)
  })

  test("returns true for a job waiting to be retried", async () => {
    const job = await addJob("testTask", { foo: 1 }, { jobKey: "key1", maxAttempts: 2 })
    await lockJob(job.id)
    await failJob(job.id)

    expect(await isJobActive("key1")).toBe(true)
  })

  test("returns true for a running job on its last attempt", async () => {
    const job = await addJob("testTask", { foo: 1 }, { jobKey: "key1", maxAttempts: 1 })
    await lockJob(job.id)

    expect(await isJobActive("key1")).toBe(true)
  })

  test("returns false for a permanently failed job", async () => {
    const job = await addJob("testTask", { foo: 1 }, { jobKey: "key1", maxAttempts: 1 })
    await lockJob(job.id)
    await failJob(job.id)

    expect(await isJobActive("key1")).toBe(false)
  })

  test("returns true for a job with attempts left locked for more than 4 hours", async () => {
    const job = await addJob("testTask", { foo: 1 }, { jobKey: "key1", maxAttempts: 2 })
    await lockJob(job.id, "4 hours 1 minute")

    expect(await isJobActive("key1")).toBe(true)
  })

  test("returns false for a job on its last attempt locked for more than 4 hours", async () => {
    const job = await addJob("testTask", { foo: 1 }, { jobKey: "key1", maxAttempts: 1 })
    await lockJob(job.id, "4 hours 1 minute")

    expect(await isJobActive("key1")).toBe(false)
  })

  test("returns false for a missing job", async () => {
    expect(await isJobActive("key1")).toBe(false)
  })

  test("returns false for a removed job", async () => {
    await addJob("testTask", { foo: 1 }, { jobKey: "key1" })
    await removeJob("key1")

    expect(await isJobActive("key1")).toBe(false)
  })

  test("returns false for a job with another key", async () => {
    await addJob("testTask", { foo: 1 }, { jobKey: "key1" })

    expect(await isJobActive("key2")).toBe(false)
  })

  test("sees a job added in the current transaction", async () => {
    await expect(db.$transaction(async () => {
      await addJob("testTask", { foo: 1 }, { jobKey: "key1" })
      expect(await isJobActive("key1")).toBe(true)
      throw new Error("rollback")
    })).rejects.toThrow("rollback")

    expect(await isJobActive("key1")).toBe(false)
  })
})
