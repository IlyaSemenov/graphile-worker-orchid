import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Some tests drop the shared graphile_worker schema; running files in parallel
    // can deadlock when another file is using the same schema at the same time.
    fileParallelism: false,
  },
})
