// src/server/routes/patterns.ts
import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import {
  getAllPatterns,
  createPattern,
  updatePattern,
  deletePattern,
} from "../services";
import type { InsertablePattern } from "../../../types/app";

export const patternRoutes = new Elysia({ prefix: "/patterns" })
  .get("/", async ({ set }) => {
    const program = getAllPatterns();
    return await Effect.runPromise(
      Effect.match(program, {
        onFailure: (error) => {
          set.status = 500;
          return { error: error.message };
        },
        onSuccess: (patterns) => patterns,
      }),
    );
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
    },
    { body: t.Object({ name: t.String(), notes: t.String() }) },
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const program = updatePattern(params.id, body);
      return await Effect.runPromise(
        Effect.match(program, {
          onFailure: (error) => {
            if (error._tag === "PatternNotFoundError") set.status = 404;
            else if (error._tag === "PatternNameConflictError")
              set.status = 409;
            else set.status = 500;
            return { error: error.message };
          },
          onSuccess: (result) => result,
        }),
      );
    },
    {
      body: t.Object({ name: t.String(), notes: t.String() }),
      params: t.Object({ id: t.String() }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const program = deletePattern(params.id);
      return await Effect.runPromise(
        Effect.match(program, {
          onFailure: (error) => {
            set.status = error._tag === "PatternNotFoundError" ? 404 : 500;
            return { error: error.message };
          },
          onSuccess: () => {
            set.status = 204;
            return "";
          },
        }),
      );
    },
    { params: t.Object({ id: t.String() }) },
  );
