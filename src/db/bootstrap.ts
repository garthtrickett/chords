// src/db/bootstrap.ts
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Database } from "bun:sqlite";

// This instance is untyped (Kysely<any>) and is used ONLY for running migrations.
// It uses Bun's native SQLite driver.

const dialect = new BunSqliteDialect({
  database: new Database("chords.db"),
});

export const db = new Kysely<any>({
  dialect,
});
