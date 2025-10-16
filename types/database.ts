// types/database.ts
import type {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from "kysely";

export interface Chord {
  id: string | null;
  name: string;
  e_string_high: number;
  b_string: number;
  g_string: number;
  d_string: number;
  a_string: number;
  e_string_low: number;
  deleted: Generated<number>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface DB {
  chord: Chord;
}

// --- NEW ADDITIONS START ---

// Use Kysely's 'Selectable' utility to create a plain object type
// suitable for sending to the client. This strips out all the complex
// ColumnType and Generated wrappers.
export type SerializableChord = Selectable<Chord>;

// Use Kysely's 'Insertable' utility to create a type for new records
// that are being inserted into the database.
export type InsertableChord = Insertable<Chord>;

// --- NEW ADDITIONS END ---
