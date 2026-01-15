import { expect, test } from "vitest"

import { db } from "./setup/db"
import { addJob, removeJob } from "./setup/workerUtils"

test("removeJob", async () => {
  const payload = { foo: 1 }

  const job1 = await addJob("testTask", payload, { jobKey: "job1" })
  const job2 = await addJob("testTask", payload, { jobKey: "job2" })
  await db.$query<{ count: number }>`SELECT COUNT(*)::integer AS count FROM graphile_worker.jobs`
    .then(({ rows: [{ count }] }) => expect(count).toBe(2))

  await removeJob("job1").then((removed) => {
    expect(removed?.id).toBe(job1.id)
  })

  await db.$query<{ id: string }>`SELECT id FROM graphile_worker.jobs`
    .then(({ rows }) => {
      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe(job2.id)
    })

  await removeJob("missing-job-key").then((removed) => {
    expect(removed).toBeUndefined()
  })
})
