// src/db/migrations/003_add_tuning_to_chords.ts
import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("chord")
    .addColumn("tuning", "text", (col) =>
      col.notNull().defaultTo("E A D G B e"),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("chord").dropColumn("tuning").execute();
}
