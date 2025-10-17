// src/server.ts
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { nanoid } from "nanoid";
import { Effect, Data } from "effect";
import { db } from "./db/database";
import type { InsertablePattern } from "../types/app";

// --- Custom Error Types ---

class DatabaseError extends Data.TaggedError("DatabaseError")<{
  cause: unknown;
}> {
  get message() {
    return "A database error occurred.";
  }
}

class PatternNotFoundError extends Data.TaggedError(
  "PatternNotFoundError",
)<{}> {
  get message() {
    return "Pattern not found.";
  }
}

class PatternNameConflictError extends Data.TaggedError(
  "PatternNameConflictError",
)<{}> {
  get message() {
    return "A pattern with this name already exists.";
  }
}

// --- Effectful Database Operations ---

/**
 * Checks if a low-level database error is due to a UNIQUE constraint violation.
 */
const isUniqueConstraintError = (e: unknown): boolean =>
  e instanceof Error && e.message.includes("UNIQUE constraint failed");

/**
 * An Effect that inserts a new pattern into the database.
 * Fails with `PatternNameConflictError` on name collision.
 */
const createPattern = (newPattern: InsertablePattern) =>
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

/**
 * An Effect that updates an existing pattern.
 * Fails with `PatternNotFoundError` if the ID doesn't exist.
 * Fails with `PatternNameConflictError` on name collision.
 */
const updatePattern = (id: string, data: { name: string; notes: string }) =>
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

// --- Elysia Server Setup ---

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({ assets: "dist", prefix: "" }))
  .get("/", ({ redirect }) => {
    return redirect("/index.html");
  })
  .group("/patterns", (app) =>
    app
      .get("/", async () => {
        // Simple reads can often remain as-is for simplicity
        return await db
          .selectFrom("pattern")
          .selectAll()
          .where("deleted", "=", 0)
          .orderBy("created_at", "desc")
          .execute();
      })
      .post(
        "/",
        async ({ body, set }) => {
          const newPattern: InsertablePattern = {
            id: nanoid(),
            name: body.name,
            notes: body.notes,
          };

          const program = createPattern(newPattern);

          // Run the effect and handle success/failure declaratively
          return await Effect.runPromise(
            Effect.match(program, {
              onFailure: (error) => {
                set.status =
                  error._tag === "PatternNameConflictError" ? 409 : 500;
                return { error: error.message };
              },
              onSuccess: (result) => {
                set.status = 201;
                return result;
              },
            }),
          );
        },
        {
          body: t.Object({
            name: t.String(),
            notes: t.String(),
          }),
        },
      )
      .put(
        "/:id",
        async ({ params, body, set }) => {
          const program = updatePattern(params.id, body);

          // Run the effect and handle all possible typed errors
          return await Effect.runPromise(
            Effect.match(program, {
              onFailure: (error) => {
                if (error._tag === "PatternNotFoundError") {
                  set.status = 404;
                } else if (error._tag === "PatternNameConflictError") {
                  set.status = 409;
                } else {
                  set.status = 500; // DatabaseError
                }
                return { error: error.message };
              },
              onSuccess: (result) => {
                return result;
              },
            }),
          );
        },
        {
          body: t.Object({
            name: t.String(),
            notes: t.String(),
          }),
          params: t.Object({
            id: t.String(),
          }),
        },
      ),
  )
  .listen(8080);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
