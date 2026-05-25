/**
 * `bun run server` — boots the HTTP server on PORT (default 3000).
 *
 * Uses an in-memory PGLite if DATA_DIR is unset. Set DATA_DIR=./data to
 * persist between runs. Set DATABASE_URL in a real production deploy and
 * swap the client (see src/db/client.ts).
 */

import { env } from "../src/env.js";
import { createDb } from "../src/db/client.js";
import { createApp } from "../src/server/app.js";

async function main() {
  const handle = await createDb({ dataDir: env.DATA_DIR });
  const app = createApp({ db: handle.db });

  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  });

  console.log(
    `[dashco] listening on http://localhost:${server.port}  (AI_ENABLED=${env.AI_ENABLED})`,
  );

  const shutdown = async () => {
    console.log("[dashco] shutting down...");
    server.stop();
    await handle.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
