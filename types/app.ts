// types/app.ts
import type { Insertable, Selectable } from "kysely";
import type {
  Pattern as BasePattern,
  Chord as BaseChord,
  Tuning as BaseTuning,
} from "./database";

export interface NoteEvent {
  time: string;
  note: string;
  duration: string;
}

export interface Measure {
  id: string;
  slots: (string | null)[]; // Array of chord IDs or null for empty slots
}

export interface PatternSection {
  id: string;
  timeSignature: string;
  measures: Measure[];
}

export type Pattern = BasePattern;
export type Chord = BaseChord;
export type Tuning = BaseTuning;

export type SerializablePattern = Selectable<Pattern>;
export type InsertablePattern = Insertable<Pattern>;
export type SerializableChord = Selectable<Chord>;
export type InsertableChord = Insertable<Chord>;
// NEW: Add utility types for Tunings
export type SerializableTuning = Selectable<Tuning>;
export type InsertableTuning = Insertable<Tuning>;
