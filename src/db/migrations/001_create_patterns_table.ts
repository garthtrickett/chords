// src/db/migrations/001_create_patterns_table.ts
import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("pattern")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull().unique())
    .addColumn("notes", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("updated_at", "text", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();

  await sql`
    CREATE TRIGGER update_pattern_updated_at
    AFTER UPDATE ON pattern
    FOR EACH ROW
    BEGIN
        UPDATE pattern SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS update_pattern_updated_at`.execute(db);
  await db.schema.dropTable("pattern").execute();
}
