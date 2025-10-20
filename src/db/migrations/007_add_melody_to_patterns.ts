// src/db/migrations/007_add_melody_to_patterns.ts
import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("pattern")
    .addColumn("melody", "text", (col) => col.notNull().defaultTo("[]"))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("pattern").dropColumn("melody").execute();
}
