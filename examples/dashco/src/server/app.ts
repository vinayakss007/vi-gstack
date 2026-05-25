/**
 * Hono app factory. Takes a DB handle so tests can pass an isolated PGLite
 * instance. The same factory backs `bin/server.ts` and the integration
 * tests — no production/test split.
 */

import { Hono } from "hono";
import type { Db } from "../db/client.js";
import { healthRoute } from "./routes/health.js";
import { intakeRoute } from "./routes/intake.js";
import { digestRoute } from "./routes/digest.js";
import { recommendRoute } from "./routes/recommend.js";
import { fieldsRoute } from "./routes/fields.js";
import { insightsRoute } from "./routes/insights.js";

export interface AppDeps {
  db: Db;
  /** Override for tests. Defaults to () => new Date(). */
  now?: () => Date;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.route("/health", healthRoute());
  app.route("/api/intake", intakeRoute(deps));
  app.route("/api/digest", digestRoute(deps));
  app.route("/api/charts/recommend", recommendRoute());
  app.route("/api/fields", fieldsRoute());
  app.route("/api/insights", insightsRoute());
  return app;
}

export type App = ReturnType<typeof createApp>;
