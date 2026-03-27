import type { Db } from "orchid-orm"

/**
 * Unlock all locked jobs.
 */
export async function unlockAllJobs(db: Db) {
  await db.query`
    DO $$
    DECLARE
      worker_ids text[];
    BEGIN
      IF to_regclass('graphile_worker.jobs') IS NULL THEN
        RETURN;
      END IF;

      EXECUTE $sql$
        SELECT COALESCE(array_agg(locked_by), '{}'::text[])
        FROM graphile_worker.jobs
        WHERE locked_by IS NOT NULL
      $sql$
      INTO worker_ids;

      PERFORM graphile_worker.force_unlock_workers(worker_ids);
    END
    $$;
  `
}
