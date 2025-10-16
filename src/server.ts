// src/server.ts
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { nanoid } from "nanoid";
import { db } from "./db/database";
import type { InsertableChord } from "../types/database"; // <-- MODIFIED: Import InsertableChord

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({ assets: "public", prefix: "" }))

  .get("/", ({ set }) => {
    set.redirect = "/index.html";
  })

  .group("/chords", (app) =>
    app
      .get("/", async () => {
        return await db
          .selectFrom("chord")
          .selectAll()
          .where("deleted", "=", 0)
          .orderBy("created_at", "desc")
          .execute();
      })
      .post(
        "/",
        async ({ body, set }) => {
          // <-- MODIFIED: Use the InsertableChord type -->
          const newChordPattern: InsertableChord = {
            id: nanoid(),
            name: body.name,
            e_string_high: 0,
            b_string: 0,
            g_string: 0,
            d_string: 0,
            a_string: 0,
            e_string_low: 0,
            // 'deleted', 'created_at', 'updated_at' are omitted,
            // as they have default values in the database schema.
            // Kysely's Insertable type handles this for us.
          };

          const result = await db
            .insertInto("chord")
            .values(newChordPattern)
            .returningAll()
            .executeTakeFirstOrThrow();

          set.status = 201;
          return result;
        },
        {
          body: t.Object({
            name: t.String(),
          }),
        },
      ),
  )
  .listen(8080);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
