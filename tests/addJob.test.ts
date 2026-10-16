import { expect, test } from "vitest"

import { db } from "./setup/db"
import { addJob } from "./setup/workerUtils"

test("addJob", async () => {
  const payload = { foo: 123 }
  const job = await addJob("testTask", payload)

  expect(job.id).toBeTypeOf("string")
  expect(job.payload).toEqual(payload)
  await db.$query<{ id: string }>`SELECT id FROM graphile_worker.jobs WHERE id = ${job.id}`
    .then(({ rows }) => expect(rows).toHaveLength(1))
})

test("addJob treats empty and zero spec values as unset", async () => {
  const job = await addJob("testTask", { foo: 123 }, { queueName: "", jobKey: "", maxAttempts: 0, priority: 0 })

  await db.$query<{ key: string | null, queue_name: string | null, max_attempts: number }>`
    SELECT key, queue_name, max_attempts FROM graphile_worker.jobs WHERE id = ${job.id}
  `.then(({ rows }) => expect(rows).toEqual([{ key: null, queue_name: null, max_attempts: 25 }]))
})

test("addJob in transaction", async () => {
  await db.$transaction(async () => {
    await addJob("testTask", { foo: 123 })
    await db.$query<{ count: number }>`SELECT COUNT(*)::integer AS count FROM graphile_worker.jobs`
      .then(({ rows: [{ count }] }) => expect(count).toBe(1))
    throw new Error("test")
  }).catch(() => {})
  await db.$query<{ count: number }>`SELECT COUNT(*)::integer AS count FROM graphile_worker.jobs`
    .then(({ rows: [{ count }] }) => expect(count).toBe(0))
})
