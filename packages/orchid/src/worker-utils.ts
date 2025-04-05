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
    const { rows: [{ job }] } = await db.$query<{ job: DbJob }>`
      SELECT row_to_json(graphile_worker.add_job(
        identifier => ${identifier},
        payload => ${payload},
        queue_name => ${spec?.queueName},
        run_at => ${spec?.runAt},
        max_attempts => ${spec?.maxAttempts},
        job_key => ${spec?.jobKey},
        priority => ${spec?.priority},
        flags => ${spec?.flags},
        job_key_mode => ${spec?.jobKeyMode}
    )) job`
    return job
  }

  return { addJob }
}
