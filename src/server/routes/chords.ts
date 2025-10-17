// src/server/routes/chords.ts
import { Elysia, t } from "elysia";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import {
  getAllChords,
  createChord,
  updateChord,
  deleteChord,
} from "../services";
import type { InsertableChord } from "../../../types/app";

export const chordRoutes = new Elysia({ prefix: "/chords" })
  .get("/", async ({ set }) => {
    const program = getAllChords();
    return await Effect.runPromise(
      Effect.match(program, {
        onFailure: (error) => {
          set.status = 500;
          return { error: error.message };
        },
        onSuccess: (chords) => chords,
      }),
    );
  })
  .post(
    "/",
    async ({ body, set }) => {
      const newChord: InsertableChord = {
        id: nanoid(),
        name: body.name,
        tab: body.tab,
        tuning: body.tuning,
      };
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
    },
    { body: t.Object({ name: t.String(), tab: t.String(), tuning: t.String() }) },
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const program = updateChord(params.id, body);
      return await Effect.runPromise(
        Effect.match(program, {
          onFailure: (error) => {
            if (error._tag === "ChordNotFoundError") set.status = 404;
            else if (error._tag === "ChordNameConflictError") set.status = 409;
            else set.status = 500;
            return { error: error.message };
          },
          onSuccess: (result) => result,
        }),
      );
    },
    {
      body: t.Object({ name: t.String(), tab: t.String(), tuning: t.String() }),
      params: t.Object({ id: t.String() }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const program = deleteChord(params.id);
      return await Effect.runPromise(
        Effect.match(program, {
          onFailure: (error) => {
            set.status = error._tag === "ChordNotFoundError" ? 404 : 500;
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
