import { defineConfig } from "tsdown"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    testing: "src/testing.ts",
  },
  format: ["esm", "cjs"],
  sourcemap: true,
  dts: true,
  publint: true,
  attw: {
    profile: "strict",
  },
})
