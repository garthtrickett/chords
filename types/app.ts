// types/app.ts
import type { Insertable, Selectable } from "kysely";

// Import the raw, generated database types.
// We use 'Pattern as BasePattern' to avoid naming conflicts if needed,
// though it's not strictly necessary here. It's good practice.
import type { Pattern as BasePattern, Chord as BaseChord } from "./database";

// 1. Define the core, custom type for our application's logic.
// This will never be generated and is safe here.
export interface NoteEvent {
  time: string;
  note: string;
  duration: string;
}

// 2. Re-export the base generated types for convenience.
export type Pattern = BasePattern;
export type Chord = BaseChord;

// 3. Create and export the derived utility types that our app uses.
// These are safe here because they build on the imported generated types.

// A pattern object that is safe to send to the client.
export type SerializablePattern = Selectable<Pattern>;
// A pattern object suitable for inserting into the database.
export type InsertablePattern = Insertable<Pattern>;

// NEW: Add utility types for Chords
export type SerializableChord = Selectable<Chord>;
export type InsertableChord = Insertable<Chord>;
