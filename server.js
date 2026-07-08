
/**
 * Local dev server for the NIS Admin Suite.
 * - Serves ./site-build so you can test the injector/picker against a local
 *   copy of the site (the real production site lives elsewhere and embeds
 *   /injector.js from wherever this app is deployed — see README).
 * - Runs the Admin dashboard separately via `npm run dev` in ./admin
 *   (proxied to this server's /api) or built+previewed with `npm run build
 *   && npm run preview` in ./admin.
 *
 * Start: npm install && npm start
 * Configure: copy .env.example to .env and fill in the values.
 */
import "dotenv/config";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createApp } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 5175;

const app = await createApp({ root: __dirname, serveStatic: true });

app.listen(PORT, () => {
  console.log(`NIS Admin Suite (local dev) running at http://localhost:${PORT}`);
  console.log(`- Public site (local copy): http://localhost:${PORT}/`);
  console.log(`- API:                      http://localhost:${PORT}/api`);
  console.log(`- Admin dashboard:          run "npm run dev" in ./admin (http://localhost:5176)`);
});
