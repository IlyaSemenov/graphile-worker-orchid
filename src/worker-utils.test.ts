import { expect, it } from "vitest"

import { makeWorkerUtils } from "./worker-utils"

it("returns correctly shaped object", () => {
  const utils = makeWorkerUtils(0 as any)
  expect(utils.addJob).toBeTypeOf("function")
  expect(utils.removeJob).toBeTypeOf("function")
  expect(utils.waitJob).toBeTypeOf("function")
})
