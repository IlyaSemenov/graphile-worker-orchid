---
"graphile-worker-orchid": minor
---

Add `isJobActive`, which checks through the orchid-orm connection (honoring the active transaction) whether the job with the given job key may still run or be running now, and support it in `createTestWorkerUtils`.
