// src/server/errors.ts
import { Data } from "effect";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  cause: unknown;
}> {
  get message() {
    return "A database error occurred.";
  }
}

export class PatternNotFoundError extends Data.TaggedError("PatternNotFoundError")<{}> {
  get message() {
    return "Pattern not found.";
  }
}

export class PatternNameConflictError extends Data.TaggedError(
  "PatternNameConflictError",
)<{}> {
  get message() {
    return "A pattern with this name already exists.";
  }
}

export class ChordNameConflictError extends Data.TaggedError(
  "ChordNameConflictError",
)<{}> {
  get message() {
    return "A chord with this name already exists.";
  }
}

export class ChordNotFoundError extends Data.TaggedError("ChordNotFoundError")<{}> {
  get message() {
    return "Chord not found.";
  }
}

export class TuningNameConflictError extends Data.TaggedError(
  "TuningNameConflictError",
)<{}> {
  get message() {
    return "A tuning with this name already exists.";
  }
}

export class TuningNotFoundError extends Data.TaggedError("TuningNotFoundError")<{}> {
  get message() {
    return "Tuning not found.";
  }
}
