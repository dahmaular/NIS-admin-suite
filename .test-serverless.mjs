/**
 * Simulates the actual Vercel serverless deployment shape without needing
 * `vercel dev` (which requires login): builds api/index.js's handler exactly
 * as Vercel would invoke it, serves it over plain HTTP, and drives requests
 * at it with the same req.url shapes Vercel's rewrites would forward
 * (rewrites preserve the original req.url; only routing changes).
 *
 * Uses an in-memory MongoDB (real driver, real network-free connection) to
 * stand in for MONGODB_URI, and a fresh empty root dir with no data/uploads
 * folders present — the critical regression check is that startup does NOT
 * try to mkdir on a read-only filesystem when VERCEL=1.
 */
import http from "node:http";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const REPO = "/Users/adedamolaagunbiade/Documents/Azure/NIS-admin-suite";

// Fresh root: only copy scripts/ (needed for injector.js/injected-assistant.js),
// deliberately NOT data/ or uploads/ so we can prove no mkdir is attempted.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nis-vercel-sim-"));
fs.cpSync(path.join(REPO, "scripts"), path.join(tmpRoot, "scripts"), { recursive: true });

const mongod = await MongoMemoryServer.create();
process.env.VERCEL = "1";
process.env.MONGODB_URI = mongod.getUri();
process.env.MONGODB_DB = "nis-vercel-sim";
process.env.ADMIN_PASSWORD = "sim-strong-password";
process.env.JWT_SECRET = "sim-long-random-secret";
// Cloudinary: config-only smoke test (no real upload call in this script).
process.env.CLOUDINARY_URL = "cloudinary://fake_key:fake_secret@fake_cloud";

const { createApp } = await import(`${REPO}/app.js`);
const app = await createApp({ root: tmpRoot, serveStatic: false });

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();
const base = `http://localhost:${port}`;

const assert = (cond, msg) => {
  if (!cond) { console.error(`FAIL: ${msg}`); process.exitCode = 1; return; }
  console.log(`ok: ${msg}`);
};

// 1. No local dirs were created on a "read-only" root (VERCEL=1 guard).
assert(!fs.existsSync(path.join(tmpRoot, "data")), "no ./data dir created when VERCEL=1");
assert(!fs.existsSync(path.join(tmpRoot, "uploads")), "no ./uploads dir created when VERCEL=1");

// 2. Static site serving is off (serveStatic: false) — root path 404s via Express (no catch-all).
{
  const res = await fetch(`${base}/`);
  assert(res.status === 404, `root path 404s with serveStatic:false (got ${res.status})`);
}

// 3. injector.js / injected-assistant.js served (what the real site embeds).
{
  const res = await fetch(`${base}/injector.js`);
  const body = await res.text();
  assert(res.status === 200 && body.includes("MutationObserver"), "/injector.js served with expected content");
}
{
  const res = await fetch(`${base}/injected-assistant.js`);
  assert(res.status === 200, "/injected-assistant.js served");
}

// 4. Login rejects wrong password, accepts the real one (no INSECURE_DEFAULTS block since we set real values).
{
  const wrong = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "nope" }) });
  assert(wrong.status === 401, "wrong password rejected");
  const right = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "sim-strong-password" }) });
  assert(right.status === 200, "correct password accepted");
  var { token } = await right.json();
  assert(!!token, "token issued");
}

// 5. Content GET (unauthenticated) + POST (authenticated) round-trip, backed by the in-memory Mongo.
{
  const get1 = await fetch(`${base}/api/content`);
  const c1 = await get1.json();
  assert(get1.status === 200 && typeof c1 === "object", "GET /api/content works with no auth");

  const save = await fetch(`${base}/api/content`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...c1, "hero.heading": "Simulated Vercel deploy" }),
  });
  assert(save.status === 200, "POST /api/content authenticated save succeeds");

  const get2 = await fetch(`${base}/api/content`);
  const c2 = await get2.json();
  assert(c2["hero.heading"] === "Simulated Vercel deploy", "content persisted through MongoDB round-trip");
}

// 6. Auth is actually enforced on write routes.
{
  const noAuth = await fetch(`${base}/api/content`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert(noAuth.status === 401, "POST /api/content without token is rejected");
}

// 7. CORS header present for cross-origin fetch from the real production site.
{
  const res = await fetch(`${base}/api/content`, { headers: { Origin: "https://norwegianinternationalschools.com" } });
  assert(res.headers.get("access-control-allow-origin") === "*", "CORS allows cross-origin GET from the real site");
}

await new Promise((r) => server.close(r));
await mongod.stop();
fs.rmSync(tmpRoot, { recursive: true, force: true });
console.log(process.exitCode ? "\nSOME TESTS FAILED" : "\nAll serverless-shape tests passed.");
