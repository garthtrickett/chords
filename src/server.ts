// src/server.ts
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { nanoid } from "nanoid";
import { db } from "./db/database";
import type { InsertablePattern } from "../types/database"; // <-- Import new type

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({ assets: "public", prefix: "" }))
  .get("/", ({ set }) => {
    set.redirect = "/index.html";
  })
  .group(
    "/patterns",
    (
      app, // Changed endpoint from /chords to /patterns
    ) =>
      app
        .get("/", async () => {
          return await db
            .selectFrom("pattern") // <-- Use 'pattern' table
            .selectAll()
            .where("deleted", "=", 0)
            .orderBy("created_at", "desc")
            .execute();
        })
        .post(
          "/",
          async ({ body, set }) => {
            // The notes data will come from the client as a stringified JSON
            const newPattern: InsertablePattern = {
              id: nanoid(),
              name: body.name,
              notes: body.notes, // <-- Store the notes JSON string
            };

            const result = await db
              .insertInto("pattern") // <-- Use 'pattern' table
              .values(newPattern)
              .returningAll()
              .executeTakeFirstOrThrow();

            set.status = 201;
            return result;
          },
          {
            body: t.Object({
              name: t.String(),
              notes: t.String(), // <-- Expect a string from the client
            }),
          },
        ),
  )
  .listen(8080);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
