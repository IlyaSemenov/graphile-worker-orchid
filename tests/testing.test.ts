import type { AddJobFunction, Job } from "graphile-worker"
import { describe, expect, test, vi } from "vitest"

import { createTestWorkerUtils } from "#lib/testing"

/**
 * Create an `addJob` that returns jobs with sequential ids and records its calls.
 */
function createAddJob() {
  let lastJobId = 0
  return vi.fn<AddJobFunction>(async (identifier, payload, spec) => {
    const now = new Date()
    const job: Job = {
      id: String(++lastJobId),
      job_queue_id: null,
      task_id: 0,
      task_identifier: identifier,
      payload,
      // Keep zero spec values, so that the tests check that the test worker utils apply the database defaults.
      priority: spec?.priority ?? 0,
      run_at: now,
      attempts: 0,
      max_attempts: spec?.maxAttempts ?? 25,
      last_error: null,
      created_at: now,
      updated_at: now,
      key: spec?.jobKey || null,
      revision: 0,
      locked_at: null,
      locked_by: null,
      flags: null,
      is_available: true,
    }
    return job
  })
}

describe("addJob", () => {
  test("delegates to options.addJob", async () => {
    const addJob = createAddJob()
    const workerUtils = createTestWorkerUtils({ addJob })
    const spec = { jobKey: "key1" }

    const job = await workerUtils.addJob("task1", { foo: 1 }, spec)

    expect(addJob).toHaveBeenCalledExactlyOnceWith("task1", { foo: 1 }, spec)
    expect(job).toEqual(await addJob.mock.results[0].value)
  })

  test("treats zero spec values as unset", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })

    const job = await workerUtils.addJob("task1", { foo: 1 }, { jobKey: "key1", priority: 0, maxAttempts: 0 })

    expect(job).toMatchObject({ priority: 0, max_attempts: 25 })
    expect(await workerUtils.removeJob("key1")).toMatchObject({ priority: 0, max_attempts: 25 })
  })

  test("updates the pending job by default", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })

    const job1 = await workerUtils.addJob("task1", { foo: 1 }, { jobKey: "key1" })
    const job2 = await workerUtils.addJob("task2", { foo: 2 }, { jobKey: "key1", priority: 1 })

    expect(job2).toMatchObject({ id: job1.id, task_identifier: "task2", payload: { foo: 2 }, priority: 1, revision: 1 })
    expect(await workerUtils.removeJob("key1")).toMatchObject({ id: job1.id, payload: { foo: 2 }, priority: 1, revision: 1 })
  })

  test("updates the pending job in replace mode", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })
    const runAt1 = new Date("2026-01-01T00:00:00.000Z")
    const runAt2 = new Date("2026-01-02T00:00:00.000Z")

    const job1 = await workerUtils.addJob("task1", { foo: 1 }, { jobKey: "key1", runAt: runAt1 })
    const job2 = await workerUtils.addJob("task1", { foo: 2 }, { jobKey: "key1", runAt: runAt2, jobKeyMode: "replace" })

    expect(job2).toMatchObject({ id: job1.id, payload: { foo: 2 }, run_at: runAt2 })
    expect(await workerUtils.removeJob("key1")).toMatchObject({ id: job1.id, payload: { foo: 2 }, run_at: runAt2 })
  })

  test("updates the pending job and keeps its run_at in preserve_run_at mode", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })
    const runAt1 = new Date("2026-01-01T00:00:00.000Z")
    const runAt2 = new Date("2026-01-02T00:00:00.000Z")

    const job1 = await workerUtils.addJob("task1", { foo: 1 }, { jobKey: "key1", runAt: runAt1 })
    const job2 = await workerUtils.addJob("task1", { foo: 2 }, { jobKey: "key1", runAt: runAt2, jobKeyMode: "preserve_run_at" })

    expect(job2).toMatchObject({ id: job1.id, payload: { foo: 2 }, run_at: runAt1 })
    expect(await workerUtils.removeJob("key1")).toMatchObject({ id: job1.id, payload: { foo: 2 }, run_at: runAt1 })
  })

  test("appends array payloads of the pending job", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })

    await workerUtils.addJob("task1", [1], { jobKey: "key1" })
    const job = await workerUtils.addJob("task1", [2, 3], { jobKey: "key1" })

    expect(job.payload).toEqual([1, 2, 3])
    expect(await workerUtils.removeJob("key1")).toMatchObject({ payload: [1, 2, 3] })
  })

  test("keeps the pending job in unsafe_dedupe mode", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })

    const job1 = await workerUtils.addJob("task1", { foo: 1 }, { jobKey: "key1" })
    const job2 = await workerUtils.addJob("task2", { foo: 2 }, { jobKey: "key1", jobKeyMode: "unsafe_dedupe" })

    expect(job2).toMatchObject({ id: job1.id, task_identifier: "task2", payload: { foo: 1 }, revision: 1 })
    expect(await workerUtils.removeJob("key1")).toMatchObject({ id: job1.id, payload: { foo: 1 }, revision: 1 })
  })

  test("defaults a null payload to an empty object", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })

    const job = await workerUtils.addJob("task1", null, { jobKey: "key1" })

    expect(job.payload).toEqual({})
    expect(await workerUtils.removeJob("key1")).toMatchObject({ payload: {} })
  })

  test("returns jobs detached from the pending job", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })

    const job = await workerUtils.addJob("task1", { foo: 1 }, { jobKey: "key1" })
    job.priority = 1

    expect(await workerUtils.removeJob("key1")).toMatchObject({ priority: 0 })
  })

  test("tracks jobs with different keys separately", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })

    const job1 = await workerUtils.addJob("task1", { foo: 1 }, { jobKey: "key1" })
    const job2 = await workerUtils.addJob("task1", { foo: 2 }, { jobKey: "key2" })

    expect(await workerUtils.removeJob("key1")).toMatchObject({ id: job1.id })
    expect(await workerUtils.removeJob("key2")).toMatchObject({ id: job2.id })
  })

  test("does not track jobs with an empty key", async () => {
    const addJob = createAddJob()
    const workerUtils = createTestWorkerUtils({ addJob })

    const job1 = await workerUtils.addJob("task1", { foo: 1 }, { jobKey: "" })
    const job2 = await workerUtils.addJob("task1", { foo: 2 }, { jobKey: "" })

    expect(job2.id).not.toBe(job1.id)
    expect(job2.key).toBeNull()
    expect(await workerUtils.removeJob("")).toBeUndefined()
  })
})

describe("removeJob", () => {
  test("returns the pending job once and then undefined", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })
    const runAt = new Date("2026-01-01T00:00:00.000Z")

    const job = await workerUtils.addJob("task1", { foo: 1 }, {
      jobKey: "key1",
      runAt,
      priority: 1,
      maxAttempts: 5,
      flags: ["flag1"],
    })

    const { task_identifier: _, ...dbJob } = job
    expect(await workerUtils.removeJob("key1")).toEqual({
      ...dbJob,
      key: "key1",
      run_at: runAt,
      priority: 1,
      max_attempts: 5,
      flags: { flag1: true },
    })
    expect(await workerUtils.removeJob("key1")).toBeUndefined()
  })

  test("returns undefined for an unknown key", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })

    expect(await workerUtils.removeJob("key1")).toBeUndefined()
  })
})

describe("clear", () => {
  test("forgets pending jobs", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })

    const job1 = await workerUtils.addJob("task1", { foo: 1 }, { jobKey: "key1" })
    await workerUtils.addJob("task1", { foo: 2 }, { jobKey: "key2" })
    workerUtils.clear()

    expect(await workerUtils.removeJob("key2")).toBeUndefined()
    const job2 = await workerUtils.addJob("task1", { foo: 3 }, { jobKey: "key1" })
    expect(job2).toMatchObject({ payload: { foo: 3 }, revision: 0 })
    expect(job2.id).not.toBe(job1.id)
    expect(await workerUtils.removeJob("key1")).toMatchObject({ id: job2.id, payload: { foo: 3 }, revision: 0 })
  })
})

describe("other methods", () => {
  test("throw when not implemented", async () => {
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob() })

    await expect(workerUtils.waitJob("1")).rejects.toThrow("waitJob is not implemented")
    await expect(workerUtils.unlockAllJobs()).rejects.toThrow("unlockAllJobs is not implemented")
    await expect(workerUtils.runMigrations()).rejects.toThrow("runMigrations is not implemented")
  })

  test("use the overrides", async () => {
    const waitJob = vi.fn(async () => {})
    const unlockAllJobs = vi.fn(async () => {})
    const runMigrations = vi.fn(async () => {})
    const workerUtils = createTestWorkerUtils({ addJob: createAddJob(), waitJob, unlockAllJobs, runMigrations })

    await workerUtils.waitJob("1", { pollInterval: 10 })
    await workerUtils.unlockAllJobs()
    await workerUtils.runMigrations()

    expect(waitJob).toHaveBeenCalledExactlyOnceWith("1", { pollInterval: 10 })
    expect(unlockAllJobs).toHaveBeenCalledOnce()
    expect(runMigrations).toHaveBeenCalledOnce()
  })
})
