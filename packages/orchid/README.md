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

const { addJob, removeJob } = makeWorkerUtils(db)
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
  // The job will only by added when and if the transaction commits.
  await addJob("sendRegistrationEmail", { user })
})
```

### removeJob

Remove job by job key:

```ts
await removeJob("testing")
```
