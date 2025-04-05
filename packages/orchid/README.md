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

const { addJob } = makeWorkerUtils(db)
```

Then call it with job name, params (and possibly options):

```ts
await addJob("test", { foo: 123 }, {
  jobKey: "testing",
})
```

This also works in transaction:

```ts
await db.$transaction(async () => {
  const user = await db.user.select("id", "name", "email").create(userInput)
  // The job will only run when and if the transaction commits.
  await addJob("sendRegistrationEmail", { user })
})
```
