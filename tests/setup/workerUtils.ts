import { makeWorkerUtils } from "#lib"

import { db } from "./db"

declare global {
  // eslint-disable-next-line ts/no-namespace
  namespace GraphileWorker {
    interface Tasks {
      testTask: { foo: number }
    }
  }
}

export const workerUtils = makeWorkerUtils(db.$queryBuilder)
export const { addJob, removeJob } = workerUtils
