import type { OrchidORM, TableClasses } from "orchid-orm"

import { addJob, removeJob, unlockAllJobs, waitJob } from "./utils"

export function makeWorkerUtils<T extends TableClasses>(db: OrchidORM<T>) {
  return {
    /**
     * Call graphile_worker.add_job() and return the job data.
     *
     * @param identifier - The name of the task that will be executed for this job.
     * @param payload - The payload (typically a JSON object) that will be passed to the task executor.
     * @param spec - Additional details about how the job should be handled.
     */
    addJob: addJob.bind(null, db),
    /**
     * Remove pending job by job_key.
     *
     * Return job data if job was removed.
     *
     * @param jobKey - The job_key of the job to remove.
     */
    removeJob: removeJob.bind(null, db),
    /**
     * Wait for a job to complete by its job ID.
     *
     * Throws if the job reaches max attempts.
     *
     * @param jobId - The ID of the job to wait for.
     * @param opts - Optional polling configuration.
     */
    waitJob: waitJob.bind(null, db),
    /**
     * Unlock all locked jobs.
     */
    unlockAllJobs: unlockAllJobs.bind(null, db),
  }
}
