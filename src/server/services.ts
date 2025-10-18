// src/server/services.ts
import { Effect } from "effect";
import { db } from "../db/database";
import type {
  InsertablePattern,
  InsertableChord,
  InsertableTuning,
} from "../../types/app";
import {
  DatabaseError,
  PatternNameConflictError,
  PatternNotFoundError,
  ChordNameConflictError,
  ChordNotFoundError,
  TuningNameConflictError,
  TuningNotFoundError,
} from "./errors";

const isUniqueConstraintError = (e: unknown): boolean =>
  e instanceof Error && e.message.includes("UNIQUE constraint failed");

export const getAllPatterns = () =>
  Effect.tryPromise({
    try: () =>
      db
        .selectFrom("pattern")
        .selectAll()
        .orderBy("created_at", "desc")
        .execute(),
    catch: (cause) => new DatabaseError({ cause }),
  });

export const createPattern = (newPattern: InsertablePattern) =>
  Effect.tryPromise({
    try: () =>
      db
        .insertInto("pattern")
        .values(newPattern)
        .returningAll()
        .executeTakeFirstOrThrow(),
    catch: (e) =>
      isUniqueConstraintError(e)
        ? new PatternNameConflictError()
        : new DatabaseError({ cause: e }),
  });

export const updatePattern = (
  id: string,
  data: {
    name: string;
    notes: string;
    key_root: string;
    key_type: string;
  },
) =>
  Effect.tryPromise({
    try: () =>
      db
        .updateTable("pattern")
        .set(data)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst(),
    catch: (e) =>
      isUniqueConstraintError(e)
        ? new PatternNameConflictError()
        : new DatabaseError({ cause: e }),
  }).pipe(
    Effect.flatMap((result) =>
      result ? Effect.succeed(result) : Effect.fail(new PatternNotFoundError()),
    ),
  );

export const deletePattern = (id: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .deleteFrom("pattern")
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst(),
    catch: (cause) => new DatabaseError({ cause }),
  }).pipe(
    Effect.flatMap((result) =>
      result ? Effect.succeed(result) : Effect.fail(new PatternNotFoundError()),
    ),
  );

export const getAllChords = () =>
  Effect.tryPromise({
    try: () =>
      db.selectFrom("chord").selectAll().orderBy("created_at", "desc").execute(),
    catch: (cause) => new DatabaseError({ cause }),
  });

export const createChord = (newChord: InsertableChord) =>
  Effect.tryPromise({
    try: () =>
      db
        .insertInto("chord")
        .values(newChord)
        .returningAll()
        .executeTakeFirstOrThrow(),
    catch: (e) =>
      isUniqueConstraintError(e)
        ? new ChordNameConflictError()
        : new DatabaseError({ cause: e }),
  });

export const updateChord = (
  id: string,
  data: { name: string; tab: string; tuning: string },
) =>
  Effect.tryPromise({
    try: () =>
      db
        .updateTable("chord")
        .set(data)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst(),
    catch: (e) =>
      isUniqueConstraintError(e)
        ? new ChordNameConflictError()
        : new DatabaseError({ cause: e }),
  }).pipe(
    Effect.flatMap((result) =>
      result ? Effect.succeed(result) : Effect.fail(new ChordNotFoundError()),
    ),
  );

export const deleteChord = (id: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .deleteFrom("chord")
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst(),
    catch: (cause) => new DatabaseError({ cause }),
  }).pipe(
    Effect.flatMap((result) =>
      result ? Effect.succeed(result) : Effect.fail(new ChordNotFoundError()),
    ),
  );

export const getAllTunings = () =>
  Effect.tryPromise({
    try: () =>
      db.selectFrom("tuning").selectAll().orderBy("created_at", "asc").execute(),
    catch: (cause) => new DatabaseError({ cause }),
  });

export const createTuning = (newTuning: InsertableTuning) =>
  Effect.tryPromise({
    try: () =>
      db
        .insertInto("tuning")
        .values(newTuning)
        .returningAll()
        .executeTakeFirstOrThrow(),
    catch: (e) =>
      isUniqueConstraintError(e)
        ? new TuningNameConflictError()
        : new DatabaseError({ cause: e }),
  });

export const updateTuning = (id: string, data: { name: string; notes: string }) =>
  Effect.tryPromise({
    try: () =>
      db
        .updateTable("tuning")
        .set(data)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst(),
    catch: (e) =>
      isUniqueConstraintError(e)
        ? new TuningNameConflictError()
        : new DatabaseError({ cause: e }),
  }).pipe(
    Effect.flatMap((result) =>
      result ? Effect.succeed(result) : Effect.fail(new TuningNotFoundError()),
    ),
  );

export const deleteTuning = (id: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .deleteFrom("tuning")
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst(),
    catch: (cause) => new DatabaseError({ cause }),
  }).pipe(
    Effect.flatMap((result) =>
      result ? Effect.succeed(result) : Effect.fail(new TuningNotFoundError()),
    ),
  );
