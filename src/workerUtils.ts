import type { OrchidORM, TableClasses } from "orchid-orm"

import { addJob, removeJob, unlockAllJobs, waitJob } from "./utils"

export function makeWorkerUtils<T extends TableClasses>(db: OrchidORM<T>) {
  return {
    addJob: addJob.bind(null, db),
    removeJob: removeJob.bind(null, db),
    waitJob: waitJob.bind(null, db),
    unlockAllJobs: unlockAllJobs.bind(null, db),
  }
}
