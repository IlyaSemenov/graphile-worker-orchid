---
"graphile-worker-orchid": patch
---

Make `addJob` store an omitted payload as an empty object, like `addJob` of graphile-worker, instead of failing with `UNDEFINED_VALUE`.
