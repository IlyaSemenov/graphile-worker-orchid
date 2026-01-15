import type { DbJob, TaskSpec } from "graphile-worker"
import type { Db } from "orchid-orm"

/**
 * Call graphile_worker.add_job() and return the job data.
 */
export async function addJob<TIdentifier extends keyof GraphileWorker.Tasks>(
  db: Db,
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
  const { rows: [job] } = await db.query<DbJob>`
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
