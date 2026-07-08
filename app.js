
/**
 * NIS Admin Suite - Express app factory
 *
 * Builds the app's routes (auth, content, selectors, media, injector scripts)
 * without binding a port, so the same code runs two ways:
 *   - server.js   -> local dev, app.listen(), optionally also serves
 *                    ./site-build and injects the content scripts (handy for
 *                    testing the picker/injector against a local copy of the
 *                    site before wiring it into the real one).
 *   - api/index.js -> Vercel serverless function. No static site/admin
 *                     serving here — Vercel's CDN serves admin/dist directly,
 *                     and the real production site lives on its own host and
 *                     embeds /injector.js + /injected-assistant.js from here.
 */
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";
import jwt from "jsonwebtoken";
import { initStorage } from "./storage.js";

const JWT_SECRET = process.env.JWT_SECRET || "nis_admin_secret_replace_me";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";
const IS_VERCEL = !!process.env.VERCEL;
const INSECURE_DEFAULTS = IS_VERCEL && (JWT_SECRET === "nis_admin_secret_replace_me" || ADMIN_PASSWORD === "changeme");
if (INSECURE_DEFAULTS) {
  console.error(
    "[app] Refusing insecure defaults on Vercel: set ADMIN_PASSWORD and JWT_SECRET " +
    "as project environment variables (Settings -> Environment Variables) and redeploy."
  );
}

export async function createApp({ root, serveStatic = false } = {}) {
  const app = express();

  const SITE_BUILD = path.join(root, "site-build");
  const DATA_DIR = path.join(root, "data");
  const UPLOADS_DIR = path.join(root, "uploads");

  // Local JSON/disk fallback needs writable directories; Vercel's filesystem
  // is read-only outside /tmp, and this deployment target always configures
  // MongoDB + Cloudinary, so skip creating them there entirely.
  if (!IS_VERCEL) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
  }

  const storage = await initStorage({ dataDir: DATA_DIR, uploadsDir: UPLOADS_DIR });

  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(bodyParser.urlencoded({ extended: true }));
  if (!IS_VERCEL) app.use("/uploads", express.static(UPLOADS_DIR));

  // Open CORS: /api/content and /api/selectors are meant to be fetched
  // cross-origin by injector.js running on the real production site.
  // Write routes still require the JWT bearer token regardless of origin.
  app.use(cors());

  // Wrap async handlers so rejections become clean 500s instead of hangs
  const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
    console.error(`[api] ${req.method} ${req.path}:`, e.message);
    res.status(500).json({ error: e.message || "Server error" });
  });

  function signToken() {
    return jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "7d" });
  }
  function authMiddleware(req, res, next) {
    const auth = req.headers.authorization || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Missing token" });
    try {
      jwt.verify(token, JWT_SECRET);
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }
  }

  app.post("/api/login", (req, res) => {
    if (INSECURE_DEFAULTS) {
      return res.status(500).json({ error: "Server misconfigured: ADMIN_PASSWORD/JWT_SECRET not set" });
    }
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: "Password required" });
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong password" });
    return res.json({ token: signToken() });
  });

  // Token validation (used by the Admin UI to restore sessions)
  app.get("/api/verify", authMiddleware, (req, res) => {
    res.json({ ok: true });
  });

  // Content APIs
  app.get("/api/content", wrap(async (req, res) => {
    res.json(await storage.docs.get("content", storage.contentDefaults));
  }));
  app.post("/api/content", authMiddleware, wrap(async (req, res) => {
    await storage.docs.set("content", req.body || {});
    res.json({ ok: true });
  }));

  // Selector APIs
  app.get("/api/selectors", wrap(async (req, res) => {
    res.json(await storage.docs.get("selectors", storage.selectorDefaults));
  }));
  app.post("/api/selectors", authMiddleware, wrap(async (req, res) => {
    await storage.docs.set("selectors", req.body || {});
    res.json({ ok: true });
  }));

  // Uploads (buffered in memory, then handed to the media store).
  // Kept under Vercel's ~4.5MB serverless request body limit.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 },
  });
  app.post("/api/upload", authMiddleware, upload.single("file"), wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const { url, name } = await storage.media.save(req.file);
    res.json({ url, name });
  }));

  // Media library: list uploaded files
  app.get("/api/uploads", authMiddleware, wrap(async (req, res) => {
    res.json(await storage.media.list());
  }));

  // Media library: delete an uploaded file
  // (name may contain slashes for Cloudinary public_ids, e.g. nis-admin/xyz)
  app.delete(/^\/api\/uploads\/(.+)$/, authMiddleware, wrap(async (req, res) => {
    const name = req.params[0]; // Express has already percent-decoded the capture
    const removed = await storage.media.remove(name);
    if (!removed) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  }));

  // --- Injector JS --- //
  // Served here (not as static files) so the real production site can embed
  // them from this API's origin: <script src="https://<this-app>/injector.js">
  app.get("/injector.js", (req, res) => {
    const injectorPath = path.join(root, "scripts", "injector.js");
    res.type("application/javascript").send(fs.readFileSync(injectorPath, "utf8"));
  });
  app.get("/injected-assistant.js", (req, res) => {
    const helperPath = path.join(root, "scripts", "injected-assistant.js");
    res.type("application/javascript").send(fs.readFileSync(helperPath, "utf8"));
  });

  if (serveStatic) {
    // Serve the compiled site's assets, but never its raw index.html —
    // the "*" fallback below injects our scripts into every HTML response.
    // (Local-dev convenience only, for testing against a local site copy —
    // the Vercel deployment doesn't serve the public site at all.)
    app.use(express.static(SITE_BUILD, { index: false }));

    app.get("*", (req, res) => {
      const indexPath = path.join(SITE_BUILD, "index.html");
      let html = fs.readFileSync(indexPath, "utf8");
      const injectTag = `
    <script>window.__CONTENT_API_BASE__ = '/api';</script>
    <script src="/injected-assistant.js"></script>
    <script src="/injector.js" defer></script>
  `;
      html = html.replace("</head>", `${injectTag}\n</head>`);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    });
  }

  return app;
}
