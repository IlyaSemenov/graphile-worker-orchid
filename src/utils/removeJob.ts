import type { DbJob } from "graphile-worker"
import type { OrchidORM, TableClasses } from "orchid-orm"

/**
 * Remove pending job by job_key.
 *
 * Return job data if job was removed.
 */
export async function removeJob<T extends TableClasses>(
  db: OrchidORM<T>,
  jobKey: string,
): Promise<DbJob | undefined> {
  // remove_job() always returns a single row (having all NULLs if not found).
  const { rows } = await db.$query<DbJob>`
    SELECT * FROM graphile_worker.remove_job(
      job_key => ${jobKey}
    )
    WHERE id IS NOT NULL
  `
  return rows.at(0)
}
