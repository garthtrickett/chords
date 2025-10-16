// src/db/database.ts
import type { Kysely } from "kysely";
import { DB } from "../../types/database";
import { db as untypedDb } from "./bootstrap";

// This is the fully typed Kysely instance that your application will use.
export const db = untypedDb as Kysely<DB>;
