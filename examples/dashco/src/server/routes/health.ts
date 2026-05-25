import { Hono } from "hono";

export function healthRoute() {
  const r = new Hono();
  r.get("/", (c) =>
    c.json({ status: "ok", timestamp: new Date().toISOString() }),
  );
  return r;
}
