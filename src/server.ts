// src/server.ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { patternRoutes } from "./server/routes/patterns";
import { chordRoutes } from "./server/routes/chords";
import { tuningRoutes } from "./server/routes/tunings";

const app = new Elysia()
  .use(cors())
  .use(staticPlugin({ assets: "dist", prefix: "" }))
  .get("/", ({ redirect }) => redirect("/index.html"))
  .use(patternRoutes)
  .use(chordRoutes)
  .use(tuningRoutes)
  .listen(8080);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
