---
"graphile-worker-orchid": patch
---

Make `addJob` treat an empty job key or queue name and a zero priority or max attempts as unset, like `addJob` of graphile-worker.
