import type { AddJobFunction, Job, TaskSpec } from "graphile-worker"

import type { WorkerUtils } from "./workerUtils"

/**
 * Options of {@link createTestWorkerUtils}.
 */
export type TestWorkerUtilsOptions = {
  /**
   * `addJob` that the test worker utils enqueue jobs through, such as a recorder of enqueued jobs.
   */
  addJob: AddJobFunction
  /**
   * `waitJob` implementation. When not given, `waitJob` throws.
   */
  waitJob?: WorkerUtils["waitJob"]
  /**
   * `unlockAllJobs` implementation. When not given, `unlockAllJobs` throws.
   */
  unlockAllJobs?: WorkerUtils["unlockAllJobs"]
  /**
   * `runMigrations` implementation. When not given, `runMigrations` throws.
   */
  runMigrations?: WorkerUtils["runMigrations"]
}

/**
 * Test double of the worker utils returned by {@link createTestWorkerUtils}.
 */
export type TestWorkerUtils = WorkerUtils & {
  /**
   * Forget all pending jobs, for example between tests.
   */
  clear(): void
}

/**
 * Create a test double of the worker utils that enqueues jobs through `options.addJob`.
 *
 * The returned `addJob` tracks pending jobs by job key the way graphile_worker.add_job() does, so `removeJob` returns the job it removes, as the worker utils of `makeWorkerUtils` do.
 */
export function createTestWorkerUtils(options: TestWorkerUtilsOptions): TestWorkerUtils {
  const pendingJobs = new Map<string, Job>()

  const addJob: AddJobFunction = async (identifier, payload, spec) => {
    const job = createJob(await options.addJob(identifier, payload, spec), identifier, payload, spec)
    const jobKey = job.key
    if (!jobKey) {
      return job
    }
    const pendingJob = pendingJobs.get(jobKey)
    if (!pendingJob) {
      pendingJobs.set(jobKey, job)
      return { ...job }
    }
    // Like graphile_worker.add_job(), update the pending job instead of adding another one.
    const updatedJob: Job = spec?.jobKeyMode === "unsafe_dedupe"
      ? { ...pendingJob, revision: pendingJob.revision + 1, updated_at: job.updated_at }
      : {
          ...job,
          id: pendingJob.id,
          created_at: pendingJob.created_at,
          revision: pendingJob.revision + 1,
          payload: Array.isArray(pendingJob.payload) && Array.isArray(job.payload) ? [...pendingJob.payload, ...job.payload] : job.payload,
          run_at: spec?.jobKeyMode === "preserve_run_at" ? pendingJob.run_at : job.run_at,
        }
    pendingJobs.set(jobKey, updatedJob)
    // Like makeWorkerUtils, return the identifier of the call even for a deduplicated job.
    return { ...updatedJob, task_identifier: identifier }
  }

  return {
    addJob,
    async removeJob(jobKey) {
      const job = pendingJobs.get(jobKey)
      if (!job) {
        return undefined
      }
      pendingJobs.delete(jobKey)
      const { task_identifier: _, ...dbJob } = job
      return dbJob
    },
    waitJob: options.waitJob ?? createNotImplemented("waitJob"),
    unlockAllJobs: options.unlockAllJobs ?? createNotImplemented("unlockAllJobs"),
    runMigrations: options.runMigrations ?? createNotImplemented("runMigrations"),
    clear() {
      pendingJobs.clear()
    },
  }
}

/**
 * Build the job that graphile_worker.add_job() would add for the call.
 *
 * Fields assigned by the database keep the values of the job returned by `options.addJob`.
 */
function createJob(job: Job, identifier: string, payload: unknown, spec: TaskSpec | undefined): Job {
  // Like makeWorkerUtils, treat empty and zero spec values as unset, so that the database defaults apply.
  return {
    ...job,
    task_identifier: identifier,
    payload: payload ?? {},
    key: spec?.jobKey || null,
    run_at: spec?.runAt || job.run_at,
    priority: spec?.priority || 0,
    max_attempts: spec?.maxAttempts || 25,
    flags: spec?.flags?.length ? Object.fromEntries(spec.flags.map(flag => [flag, true] as const)) : null,
    attempts: 0,
    last_error: null,
    locked_at: null,
    locked_by: null,
  }
}

/**
 * Create a worker utils method that rejects as not implemented in the test double.
 */
function createNotImplemented(name: keyof WorkerUtils) {
  return async (): Promise<never> => {
    throw new Error(`${name} is not implemented in the test worker utils.`)
  }
}
