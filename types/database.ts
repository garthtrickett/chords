import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export interface Chord {
  created_at: Generated<string>;
  id: string | null;
  name: string;
  tab: string;
  tuning: Generated<string>;
}

export interface Pattern {
  created_at: Generated<string>;
  id: string | null;
  key_root: Generated<string>;
  key_type: Generated<string>;
  name: string;
  notes: string;
  updated_at: Generated<string>;
}

export interface Tuning {
  created_at: Generated<string>;
  id: string | null;
  name: string;
  notes: string;
}

export interface DB {
  chord: Chord;
  pattern: Pattern;
  tuning: Tuning;
}
