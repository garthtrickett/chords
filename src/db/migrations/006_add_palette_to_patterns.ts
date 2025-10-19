// src/db/migrations/006_add_palette_to_patterns.ts
import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("pattern")
    .addColumn("chord_palette", "text", (col) => col.notNull().defaultTo("[]"))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("pattern").dropColumn("chord_palette").execute();
}
