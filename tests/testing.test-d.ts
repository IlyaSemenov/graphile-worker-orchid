import type { AddJobFunction, DbJob } from "graphile-worker"
import { expectTypeOf, test } from "vitest"

import type { makeWorkerUtils, WorkerUtils } from "#lib"
import type { TestWorkerUtils, TestWorkerUtilsOptions } from "#lib/testing"
import { createTestWorkerUtils } from "#lib/testing"

declare const addJob: AddJobFunction

test("WorkerUtils is the return type of makeWorkerUtils", () => {
  expectTypeOf<WorkerUtils>().toEqualTypeOf<ReturnType<typeof makeWorkerUtils>>()
})

test("createTestWorkerUtils returns TestWorkerUtils", () => {
  const workerUtils = createTestWorkerUtils({ addJob })

  expectTypeOf(workerUtils).toEqualTypeOf<TestWorkerUtils>()
  expectTypeOf(workerUtils).toExtend<WorkerUtils>()
  expectTypeOf(workerUtils.clear).toEqualTypeOf<() => void>()
  expectTypeOf(workerUtils.addJob).toEqualTypeOf<AddJobFunction>()
  expectTypeOf(workerUtils.removeJob).returns.toEqualTypeOf<Promise<DbJob | undefined>>()
})

test("createTestWorkerUtils options", () => {
  expectTypeOf<TestWorkerUtilsOptions["waitJob"]>().toEqualTypeOf<WorkerUtils["waitJob"] | undefined>()

  createTestWorkerUtils({
    addJob,
    waitJob: async (jobId, opts) => {
      expectTypeOf(jobId).toEqualTypeOf<string>()
      expectTypeOf(opts).toEqualTypeOf<{ pollInterval: number } | undefined>()
    },
    unlockAllJobs: async () => {},
    runMigrations: async () => {},
  })

  // @ts-expect-error addJob is required
  createTestWorkerUtils({})
  // @ts-expect-error overrides must match the worker utils
  createTestWorkerUtils({ addJob, waitJob: async (_jobId: number) => {} })
})
