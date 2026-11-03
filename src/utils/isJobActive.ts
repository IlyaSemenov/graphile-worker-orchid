import type { Db } from "orchid-orm"

/**
 * Age of a job lock after which graphile-worker treats the lock as stale and clears it.
 *
 * Mirrors the interval hardcoded in graphile-worker (`resetLockedAt` in dist/sql/resetLockedAt.js of graphile-worker 0.17.x), which has no option to change it.
 */
const staleLockInterval = "4 hours"

/**
 * Check whether the job with the given job_key may still run or be running now.
 *
 * Return true when the job has attempts left or when a worker locked it less than 4 hours ago.
 * Such a lock means that the job is running or that its worker died too recently for graphile-worker to treat the lock as stale.
 * Return false when the job is missing (completed or removed), or when it has no attempts left and is either unlocked or locked longer than 4 hours ago.
 *
 * Read the `graphile_worker.jobs` view rather than the `_private_jobs` table: graphile-worker documents the view as a public API, while its tables are not a public interface and may change in a minor version.
 */
export async function isJobActive(
  db: Db,
  /**
   * The job_key of the job to check.
   */
  jobKey: string,
): Promise<boolean> {
  const { rows: [{ active }] } = await db.query<{ active: boolean }>`
    SELECT EXISTS (
      SELECT FROM graphile_worker.jobs
      WHERE key = ${jobKey}
        AND (attempts < max_attempts OR locked_at > now() - ${staleLockInterval}::interval)
    ) AS active
  `
  return active
}
