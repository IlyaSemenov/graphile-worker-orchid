# graphile-worker-orchid

Use [graphile-worker](https://worker.graphile.org/) with [orchid-orm](https://orchid-orm.netlify.app/), including support for transactions.

## Install

```sh
pnpm add graphile-worker-orchid
```

## Use

Create worker utils:

```ts
import { makeWorkerUtils } from "graphile-worker-orchid"
import { orchidORM } from "orchid-orm"

const db = orchidORM({ databaseURL: "..." }, {
  // table definitions
})

const {
  addJob,
  removeJob,
  waitJob,
  unlockAllJobs,
} = makeWorkerUtils(db)
```

### addJob

Add job with job name, params, and possibly options:

```ts
await addJob("test", { foo: 123 }, {
  jobKey: "testing",
})
```

This also works in transaction:

```ts
await db.$transaction(async () => {
  const user = await db.user.select("id", "name", "email").create(userInput)
  // The job will only be added when and if the transaction commits.
  await addJob("sendRegistrationEmail", { user })
})
```

### removeJob

Remove job by job key:

```ts
await removeJob("testing")
```

### waitJob

Wait for a job to complete by its job ID:

```ts
const job = await addJob("test", { foo: 123 })

// Will throw if the job fails (reaches max retry attempts).
await waitJob(job.id)
```

The function waits by simple polling. You can override the polling interval with:

```ts
await waitJob(job.id, {
  pollInterval: 200, // Default is 1000 ms
})
```

### unlockAllJobs

Unlock all locked jobs:

```ts
await unlockAllJobs()
```

This is useful for recovering from situations where jobs remain locked (for example, after a worker crash).

This should only be used when you can guarantee that all workers are stopped.

> [!TIP]
> The recommended approach is to wrap `unlockAllJobs` + `runWorker` in a critical section to ensure only one process runs the worker.
> You can use [pg-advisory-lock](https://github.com/IlyaSemenov/pg-advisory-lock) for this purpose.

<details>
<summary>Example code with <b>pg-advisory-lock</b></summary>

```ts
import { run } from "graphile-worker"
import { orchidORM } from "orchid-orm"
import { createAdvisoryLock } from "pg-advisory-lock"

const databaseUrl = "postgresql://user:pass@localhost/db"
const db = orchidORM({ databaseURL: databaseUrl }, {})

const { unlockAllJobs } = makeWorkerUtils(db)

const { withLock } = createAdvisoryLock(databaseUrl)

// Ensure only one process runs the worker at a time.
await withLock("graphile-worker", async () => {
  // If the previous worker crashed, jobs would remain locked for up to 4 hours.
  // Unlock them immediately to allow processing to resume.
  await unlockAllJobs()
  await run({
    connectionString: databaseUrl,
  })
})
```

</details>
