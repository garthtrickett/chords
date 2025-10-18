// src/db/migrations/005_add_key_to_patterns.ts
import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("pattern")
    .addColumn("key_root", "text", (col) => col.notNull().defaultTo("C"))
    .execute();

  await db.schema
    .alterTable("pattern")
    .addColumn("key_type", "text", (col) => col.notNull().defaultTo("major"))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // SQLite also requires dropping columns one at a time.
  await db.schema.alterTable("pattern").dropColumn("key_root").execute();
  await db.schema.alterTable("pattern").dropColumn("key_type").execute();
}
