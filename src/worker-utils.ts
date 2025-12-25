import type { DbJob, TaskSpec } from "graphile-worker"
import type { OrchidORM, TableClasses } from "orchid-orm"

export function makeWorkerUtils<T extends TableClasses>(db: OrchidORM<T>) {
  /**
   * Call graphile_worker.add_job() and return the job data.
   */
  async function addJob<TIdentifier extends keyof GraphileWorker.Tasks>(
    /**
     * The name of the task that will be executed for this job.
     */
    identifier: TIdentifier,
    /**
     * The payload (typically a JSON object) that will be passed to the task executor.
     */
    payload: GraphileWorker.Tasks[TIdentifier],
    /**
     * Additional details about how the job should be handled.
     */
    spec?: TaskSpec,
  ): Promise<DbJob> {
    const { rows: [job] } = await db.$query<DbJob>`
      SELECT * FROM graphile_worker.add_job(
        identifier => ${identifier},
        payload => ${JSON.stringify(payload)},
        queue_name => ${spec?.queueName ?? null},
        run_at => ${spec?.runAt ?? null},
        max_attempts => ${spec?.maxAttempts ?? null},
        job_key => ${spec?.jobKey ?? null},
        priority => ${spec?.priority ?? null},
        flags => ${spec?.flags ?? null},
        job_key_mode => ${spec?.jobKeyMode ?? null}
      )
    `
    return job
  }

  /**
   * Remove pending job by job_key.
   *
   * Return job data if job was removed.
   */
  async function removeJob(jobKey: string): Promise<DbJob | undefined> {
    // remove_job() always returns a single row (having all NULLs if not found).
    const { rows } = await db.$query<DbJob>`
      SELECT * FROM graphile_worker.remove_job(
        job_key => ${jobKey}
      )
      WHERE id IS NOT NULL
    `
    return rows.at(0)
  }

  async function waitJob(jobId: string, opts?: {
    pollInterval: number
  }) {
    const { pollInterval = 1000 } = opts ?? {}
    while (true) {
      const { rows: [job] } = await db.$query<Pick<DbJob, "attempts" | "max_attempts" | "locked_by">>`
          SELECT attempts, max_attempts, locked_by
          FROM graphile_worker.jobs
          WHERE id = ${jobId}
        `
      if (!job) {
        // Job completed.
        return
      }
      if (!job.locked_by && job.attempts >= job.max_attempts) {
        // Job failed.
        throw new Error("Job reached max attempts.")
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  /**
   * Unlock all locked jobs.
   */
  async function unlockAllJobs() {
    await db.$query`
      SELECT graphile_worker.force_unlock_workers(
        COALESCE(ARRAY_AGG(locked_jobs.locked_by), '{}')
      )
      FROM (
        SELECT locked_by
        FROM graphile_worker.jobs 
        WHERE locked_by IS NOT NULL
      ) as locked_jobs
    `
  }

  return {
    addJob,
    removeJob,
    waitJob,
    unlockAllJobs,
  }
}
