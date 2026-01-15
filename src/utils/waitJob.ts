import type { DbJob } from "graphile-worker"
import type { OrchidORM, TableClasses } from "orchid-orm"

export async function waitJob<T extends TableClasses>(
  db: OrchidORM<T>,
  jobId: string,
  opts?: {
    pollInterval: number
  },
) {
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
