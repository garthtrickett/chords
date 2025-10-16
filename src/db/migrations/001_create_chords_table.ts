import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('chord')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('e_string_high', 'integer', (col) => col.notNull()) // Fret number (-1 for muted)
    .addColumn('b_string', 'integer', (col) => col.notNull())
    .addColumn('g_string', 'integer', (col) => col.notNull())
    .addColumn('d_string', 'integer', (col) => col.notNull())
    .addColumn('a_string', 'integer', (col) => col.notNull())
    .addColumn('e_string_low', 'integer', (col) => col.notNull())
    .addColumn('deleted', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'text', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updated_at', 'text', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('chord').execute();
}
