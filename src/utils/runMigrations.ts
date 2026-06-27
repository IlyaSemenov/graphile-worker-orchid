// graphile-worker doesn't expose a public way to run migrations against an
// existing connection, so we reach into its internals. These are stable across
// the supported version range (see the `graphile-worker` peer dependency), but
// the deep imports are the reason that range is pinned.
import { processSharedOptions } from "graphile-worker/dist/lib.js"
import { migrate } from "graphile-worker/dist/migrate.js"
import type { Db } from "orchid-orm"

/** The database adapter orchid-orm exposes via `db.$getAdapter()`. */
type Adapter = ReturnType<Db["$getAdapter"]>

/** The `pg.PoolClient`-like client graphile-worker's `migrate` expects. */
type MigrationClient = Parameters<typeof migrate>[1]

/**
 * Run graphile-worker migrations through the orchid-orm connection.
 *
 * Unlike graphile-worker's own `runMigrations`, this uses the database
 * connection managed by orchid-orm (honoring the active transaction), so the
 * migrations participate in the surrounding orchid-orm transaction instead of
 * opening a separate connection.
 */
export async function runMigrations(db: Db) {
  const compiledSharedOptions = processSharedOptions({})

  // graphile-worker bootstraps the schema by probing for the `migrations` table
  // and catching the resulting "relation does not exist" (42P01) error. It does
  // that on a bare connection, where a failed statement is harmless; but here
  // `migrate` runs inside `db.transaction()` below, where that error would abort
  // the whole transaction (and some drivers, e.g. postgres-js, rethrow it on
  // commit even after a savepoint rollback). So we pre-create the schema with
  // the same idempotent `if not exists` DDL graphile-worker would run, which
  // never errors, so `migrate`'s probe finds the table and never raises 42P01.
  //
  // This runs before the `db.transaction()` wrapper, but it is not "outside a
  // transaction": when the caller is already in one, `$getAdapter()` returns
  // that transaction's adapter and the DDL participates in it. That's fine —
  // being idempotent, it never produces the error the wrapper must avoid.
  await ensureSchema(db.$getAdapter(), compiledSharedOptions.escapedWorkerSchema)

  // Now that the schema exists, `migrate` won't trigger any errors, so it can
  // run inside the (possibly already open) orchid-orm transaction.
  await db.transaction(async () => {
    await migrate(compiledSharedOptions, makeMigrationClient(db.$getAdapter()))
  })
}

/**
 * Create the graphile-worker bootstrap schema idempotently.
 *
 * This mirrors graphile-worker's own `installSchema` bootstrap DDL. All
 * statements use `if not exists`, so it is a no-op when the schema is already
 * present and never raises the error that `migrate` would otherwise provoke.
 */
async function ensureSchema(adapter: Adapter, escapedWorkerSchema: string) {
  await adapter.query(`create schema if not exists ${escapedWorkerSchema}`)
  await adapter.query(
    `create table if not exists ${escapedWorkerSchema}.migrations (
      id int primary key,
      ts timestamptz default now() not null
    )`,
  )
  await adapter.query(
    `alter table ${escapedWorkerSchema}.migrations add column if not exists breaking boolean not null default false`,
  )
}

/**
 * Adapt the orchid-orm {@link Adapter} to the `PoolClient`-like interface that
 * graphile-worker's `migrate` expects.
 *
 * `migrate` wraps each migration in `begin`/`commit`/`rollback`; we make those
 * no-ops because the whole run is already wrapped in a single orchid-orm
 * transaction, which provides atomicity: any error thrown by `migrate` (e.g. a
 * genuinely failing migration) rolls the entire run back.
 *
 * graphile-worker also has a concurrent-migration path: on a unique-violation
 * "clash" it issues `rollback` and silently continues, expecting the partial
 * migration to be undone. Our no-op `rollback` would NOT undo it, leaving the
 * transaction aborted. That path is unreachable here: running every migration
 * in one transaction means there is no second connection to race against, so a
 * clash can't occur in normal use.
 */
function makeMigrationClient(adapter: Adapter): MigrationClient {
  // graphile-worker's `migrate` only ever calls `client.query`, so we provide
  // just that and cast to the full `PoolClient` shape it expects.
  return {
    async query(textOrConfig: string | { text: string, values?: unknown[] }, values?: unknown[]) {
      const text = typeof textOrConfig === "string" ? textOrConfig : textOrConfig.text
      const queryValues = typeof textOrConfig === "string" ? values : textOrConfig.values

      const command = text.trim().toLowerCase()
      if (command === "begin" || command === "commit" || command === "rollback") {
        return { rows: [], rowCount: 0 }
      }

      return adapter.query(text, queryValues)
    },
  } as unknown as MigrationClient
}
