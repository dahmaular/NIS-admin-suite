/**
 * Vercel serverless entry point.
 * Wraps the same Express app used locally (see ../app.js), without the
 * static site/admin serving — Vercel's CDN serves the built admin app, and
 * vercel.json rewrites /api/*, /injector.js and /injected-assistant.js here.
 *
 * The app (and its MongoDB connection) is built once per cold start and
 * reused across warm invocations via the cached promise below.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

let appPromise;
function getApp() {
  if (!appPromise) {
    appPromise = createApp({ root: ROOT, serveStatic: false });
  }
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  app(req, res);
}
