import type { AddJobFunction } from "graphile-worker"
import { expect, expectTypeOf, test } from "vitest"

import { db } from "./setup/db"
import { workerUtils } from "./setup/workerUtils"

test("makeWorkerUtils exposes upstream addJob signature", () => {
  expectTypeOf(workerUtils.addJob).toEqualTypeOf<AddJobFunction>()

  expect(typeof workerUtils.addJob).toBe("function")
  expect(typeof workerUtils.removeJob).toBe("function")
  expect(typeof workerUtils.waitJob).toBe("function")
  expect(typeof workerUtils.unlockAllJobs).toBe("function")
})

test("makeWorkerUtils addJob returns task_identifier", async () => {
  const payload = { foo: 123 }
  const job = await workerUtils.addJob("testTask", payload)

  expect(job.task_identifier).toBe("testTask")
  expect(job.payload).toEqual(payload)

  await db.$query<{ task_identifier: string }>`
    SELECT task_identifier FROM graphile_worker.jobs WHERE id = ${job.id}
  `.then(({ rows }) => {
        expect(rows).toHaveLength(1)
        expect(rows[0].task_identifier).toBe("testTask")
      })
})
