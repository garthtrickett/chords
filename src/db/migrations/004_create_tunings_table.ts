// src/db/migrations/004_create_tunings_table.ts
import type { Kysely } from "kysely";
import { sql } from "kysely";

const DEFAULT_TUNINGS = [
  { name: "Standard", notes: "E A D G B e" },
  { name: "Drop D", notes: "D A D G B e" },
  { name: "Open G", notes: "D G D G B D" },
  { name: "Open D", notes: "D A D F# A D" },
  { name: "DADGAD", notes: "D A D G A D" },
];

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("tuning")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull().unique())
    .addColumn("notes", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();

  // Seed the table with some default tunings
  for (const tuning of DEFAULT_TUNINGS) {
    await db
      .insertInto("tuning")
      .values({
        ...tuning,
        id: tuning.name.toLowerCase().replace(" ", "-"), // simple id generation
      })
      .execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("tuning").execute();
}
