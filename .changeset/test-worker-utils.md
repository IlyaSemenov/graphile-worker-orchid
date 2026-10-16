---
"graphile-worker-orchid": minor
---

Add `createTestWorkerUtils` in `graphile-worker-orchid/testing`, a test double of the worker utils that enqueues jobs through the given `addJob` and tracks pending jobs for `removeJob` until `clear()`, and export the `WorkerUtils` type.
