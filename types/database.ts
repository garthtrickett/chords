import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export interface Chord {
  created_at: Generated<string>;
  id: string | null;
  name: string;
  tab: string;
}

export interface Pattern {
  created_at: Generated<string>;
  deleted: Generated<number>;
  id: string | null;
  name: string;
  notes: string;
  updated_at: Generated<string>;
}

export interface DB {
  chord: Chord;
  pattern: Pattern;
}
