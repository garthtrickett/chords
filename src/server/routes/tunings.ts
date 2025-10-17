// src/server/routes/tunings.ts
import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import {
  getAllTunings,
  createTuning,
  updateTuning,
  deleteTuning,
} from "../services";
import type { InsertableTuning } from "../../../types/app";

export const tuningRoutes = new Elysia({ prefix: "/tunings" })
  .get("/", async ({ set }) => {
    const program = getAllTunings();
    return await Effect.runPromise(
      Effect.match(program, {
        onFailure: (error) => {
          set.status = 500;
          return { error: error.message };
        },
        onSuccess: (tunings) => tunings,
      }),
    );
  })
  .post(
    "/",
    async ({ body, set }) => {
      const newTuning: InsertableTuning = { id: nanoid(), ...body };
      const program = createTuning(newTuning);
      return await Effect.runPromise(
        Effect.match(program, {
          onFailure: (error) => {
            set.status = error._tag === "TuningNameConflictError" ? 409 : 500;
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
      const program = updateTuning(params.id, body);
      return await Effect.runPromise(
        Effect.match(program, {
          onFailure: (error) => {
            if (error._tag === "TuningNotFoundError") set.status = 404;
            else if (error._tag === "TuningNameConflictError") set.status = 409;
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
      const program = deleteTuning(params.id);
      return await Effect.runPromise(
        Effect.match(program, {
          onFailure: (error) => {
            set.status = error._tag === "TuningNotFoundError" ? 404 : 500;
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
