import type { Db } from "orchid-orm"

/**
 * Unlock all locked jobs.
 */
export async function unlockAllJobs(db: Db) {
  await db.query`
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
