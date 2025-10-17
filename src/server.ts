// src/server.ts
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { nanoid } from "nanoid";
import { db } from "./db/database";
import type { InsertablePattern } from "../types/app"; // <-- Import new type

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({ assets: "dist", prefix: "" }))
  .get("/", ({ redirect }) => {
    return redirect("/index.html");
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
            const newPattern: InsertablePattern = {
              id: nanoid(),
              name: body.name,
              notes: body.notes,
            };

            try {
              const result = await db
                .insertInto("pattern")
                .values(newPattern)
                .returningAll()
                .executeTakeFirstOrThrow();

              set.status = 201;
              return result;
            } catch (e: any) {
              set.status = 409; // Conflict
              return { error: "A pattern with this name already exists." };
            }
          },
          {
            body: t.Object({
              name: t.String(),
              notes: t.String(),
            }),
          },
        )
        // NEW: Add a PUT route to update an existing pattern
        .put(
          "/:id",
          async ({ params, body, set }) => {
            try {
              const result = await db
                .updateTable("pattern")
                .set({ name: body.name, notes: body.notes })
                .where("id", "=", params.id)
                .returningAll()
                .executeTakeFirst();

              if (!result) {
                set.status = 404;
                return { error: "Pattern not found." };
              }
              return result;
            } catch (e: any) {
              set.status = 409;
              return {
                error: "Another pattern with this name already exists.",
              };
            }
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
