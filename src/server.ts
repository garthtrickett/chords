// src/server.ts
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { nanoid } from "nanoid";
import { Effect, Data } from "effect";
import { db } from "./db/database";
import type { InsertablePattern, InsertableChord, InsertableTuning } from "../types/app";

// --- Custom Error Types ---

class DatabaseError extends Data.TaggedError("DatabaseError")<{ cause: unknown }> {
  get message() { return "A database error occurred."; }
}

class PatternNotFoundError extends Data.TaggedError("PatternNotFoundError")<{}> {
  get message() { return "Pattern not found."; }
}

class PatternNameConflictError extends Data.TaggedError("PatternNameConflictError")<{}> {
  get message() { return "A pattern with this name already exists."; }
}

class ChordNameConflictError extends Data.TaggedError("ChordNameConflictError")<{}> {
  get message() { return "A chord with this name already exists."; }
}

// NEW: Add error types for tunings
class TuningNameConflictError extends Data.TaggedError("TuningNameConflictError")<{}> {
  get message() { return "A tuning with this name already exists."; }
}

class TuningNotFoundError extends Data.TaggedError("TuningNotFoundError")<{}> {
  get message() { return "Tuning not found."; }
}


// --- Effectful Database Operations ---

const isUniqueConstraintError = (e: unknown): boolean =>
  e instanceof Error && e.message.includes("UNIQUE constraint failed");

const createPattern = (newPattern: InsertablePattern) =>
  Effect.tryPromise({
    try: () => db.insertInto("pattern").values(newPattern).returningAll().executeTakeFirstOrThrow(),
    catch: (e) => isUniqueConstraintError(e) ? new PatternNameConflictError() : new DatabaseError({ cause: e }),
  });

const updatePattern = (id: string, data: { name: string; notes: string }) =>
  Effect.tryPromise({
    try: () => db.updateTable("pattern").set(data).where("id", "=", id).returningAll().executeTakeFirst(),
    catch: (e) => isUniqueConstraintError(e) ? new PatternNameConflictError() : new DatabaseError({ cause: e }),
  }).pipe(
    Effect.flatMap((result) => result ? Effect.succeed(result) : Effect.fail(new PatternNotFoundError())),
  );

const createChord = (newChord: InsertableChord) =>
  Effect.tryPromise({
    try: () => db.insertInto("chord").values(newChord).returningAll().executeTakeFirstOrThrow(),
    catch: (e) => isUniqueConstraintError(e) ? new ChordNameConflictError() : new DatabaseError({ cause: e }),
  });

// NEW: Add database effects for tunings
const createTuning = (newTuning: InsertableTuning) =>
  Effect.tryPromise({
    try: () => db.insertInto("tuning").values(newTuning).returningAll().executeTakeFirstOrThrow(),
    catch: (e) => isUniqueConstraintError(e) ? new TuningNameConflictError() : new DatabaseError({ cause: e }),
  });

const updateTuning = (id: string, data: { name: string; notes: string }) =>
  Effect.tryPromise({
    try: () => db.updateTable("tuning").set(data).where("id", "=", id).returningAll().executeTakeFirst(),
    catch: (e) => isUniqueConstraintError(e) ? new TuningNameConflictError() : new DatabaseError({ cause: e }),
  }).pipe(
    Effect.flatMap((result) => result ? Effect.succeed(result) : Effect.fail(new TuningNotFoundError())),
  );

const deleteTuning = (id: string) =>
  Effect.tryPromise({
    try: () => db.deleteFrom("tuning").where("id", "=", id).returningAll().executeTakeFirst(),
    catch: (cause) => new DatabaseError({ cause }),
  }).pipe(
    Effect.flatMap((result) => result ? Effect.succeed(result) : Effect.fail(new TuningNotFoundError())),
  );


// --- Elysia Server Setup ---

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({ assets: "dist", prefix: "" }))
  .get("/", ({ redirect }) => redirect("/index.html"))
  .group("/patterns", (app) =>
    app
      .get("/", async () => {
        return await db.selectFrom("pattern").selectAll().where("deleted", "=", 0).orderBy("created_at", "desc").execute();
      })
      .post("/", async ({ body, set }) => {
        const newPattern: InsertablePattern = { id: nanoid(), name: body.name, notes: body.notes };
        const program = createPattern(newPattern);
        return await Effect.runPromise(
          Effect.match(program, {
            onFailure: (error) => {
              set.status = error._tag === "PatternNameConflictError" ? 409 : 500;
              return { error: error.message };
            },
            onSuccess: (result) => {
              set.status = 201;
              return result;
            },
          }),
        );
      }, { body: t.Object({ name: t.String(), notes: t.String() }) }
      )
      .put("/:id", async ({ params, body, set }) => {
        const program = updatePattern(params.id, body);
        return await Effect.runPromise(
          Effect.match(program, {
            onFailure: (error) => {
              if (error._tag === "PatternNotFoundError") set.status = 404;
              else if (error._tag === "PatternNameConflictError") set.status = 409;
              else set.status = 500;
              return { error: error.message };
            },
            onSuccess: (result) => result,
          }),
        );
      }, { body: t.Object({ name: t.String(), notes: t.String() }), params: t.Object({ id: t.String() }) }
      )
  )
  .group("/chords", (app) =>
    app
      .get("/", async () => {
        return await db.selectFrom("chord").selectAll().orderBy("created_at", "desc").execute();
      })
      .post("/", async ({ body, set }) => {
        const newChord: InsertableChord = { id: nanoid(), name: body.name, tab: body.tab, tuning: body.tuning };
        const program = createChord(newChord);
        return await Effect.runPromise(
          Effect.match(program, {
            onFailure: (error) => {
              set.status = error._tag === "ChordNameConflictError" ? 409 : 500;
              return { error: error.message };
            },
            onSuccess: (result) => {
              set.status = 201;
              return result;
            },
          }),
        );
      }, { body: t.Object({ name: t.String(), tab: t.String(), tuning: t.String() }) }
      )
  )
  .group("/tunings", (app) => // NEW: Tuning endpoints
    app
      .get("/", async () => {
        return await db.selectFrom("tuning").selectAll().orderBy("created_at", "asc").execute();
      })
      .post("/", async ({ body, set }) => {
        const newTuning: InsertableTuning = { id: nanoid(), ...body };
        const program = createTuning(newTuning);
        return await Effect.runPromise(Effect.match(program, {
          onFailure: (error) => {
            set.status = error._tag === "TuningNameConflictError" ? 409 : 500;
            return { error: error.message };
          },
          onSuccess: (result) => {
            set.status = 201;
            return result;
          },
        }));
      }, { body: t.Object({ name: t.String(), notes: t.String() }) }
      )
      .put("/:id", async ({ params, body, set }) => {
        const program = updateTuning(params.id, body);
        return await Effect.runPromise(Effect.match(program, {
          onFailure: (error) => {
            if (error._tag === "TuningNotFoundError") set.status = 404;
            else if (error._tag === "TuningNameConflictError") set.status = 409;
            else set.status = 500;
            return { error: error.message };
          },
          onSuccess: (result) => result,
        }));
      }, { body: t.Object({ name: t.String(), notes: t.String() }), params: t.Object({ id: t.String() }) }
      )
      .delete("/:id", async ({ params, set }) => {
        const program = deleteTuning(params.id);
        return await Effect.runPromise(Effect.match(program, {
          onFailure: (error) => {
            set.status = error._tag === "TuningNotFoundError" ? 404 : 500;
            return { error: error.message };
          },
          onSuccess: () => {
            set.status = 204;
            return "";
          },
        }));
      }, { params: t.Object({ id: t.String() }) }
      )
  )
  .listen(8080);

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
