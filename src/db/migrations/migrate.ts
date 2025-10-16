// src/db/migrations/migrate.ts
import * as path from "path";
import { promises as fs } from "fs";
// MODIFIED: Import the 'MigrationResult' type
import { Migrator, FileMigrationProvider, type MigrationResult } from "kysely";
import { db } from "../bootstrap";

async function migrateToLatest() {
  console.log("Running database migrations...");

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // The migration folder is relative to the compiled JS file in `dist`,
      // so we need to ensure the path is correct. __dirname works here.
      migrationFolder: path.join(__dirname, "."),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  // MODIFIED: Apply the 'MigrationResult' type to the 'it' parameter
  results?.forEach((it: MigrationResult) => {
    if (it.status === "Success") {
      console.log(
        `✅ Migration "${it.migrationName}" was executed successfully`,
      );
    } else if (it.status === "Error") {
      console.error(`❌ Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("Failed to migrate");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
  console.log("Migrations complete.");
  process.exit(0);
}

migrateToLatest();
