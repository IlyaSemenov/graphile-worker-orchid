import type { DbJob } from "graphile-worker"
import type { Db } from "orchid-orm"

/**
 * Wait for a job to complete by its job ID.
 *
 * Throws if the job reaches max attempts.
 */
export async function waitJob(
  db: Db,
  /**
   * The ID of the job to wait for.
   */
  jobId: string,
  /**
   * Optional polling configuration.
   */
  opts?: {
    /**
     * Poll interval in milliseconds.
     */
    pollInterval: number
  },
) {
  const { pollInterval = 1000 } = opts ?? {}
  while (true) {
    const { rows: [job] } = await db.query<Pick<DbJob, "attempts" | "max_attempts" | "locked_by">>`
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
