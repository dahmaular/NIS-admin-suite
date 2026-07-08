/**
 * Storage layer for the NIS Admin Suite.
 *
 * Documents (content, selectors, media index):
 *   - MongoDB when MONGODB_URI is set (collection "settings", one doc per kind,
 *     seeded from ./data/*.json on first run so existing content migrates over)
 *   - JSON files in ./data otherwise
 *
 * Media blobs:
 *   - Cloudinary when CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) is set
 *   - Local ./uploads directory otherwise
 */
import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import { v2 as cloudinary } from "cloudinary";

// Minimal safe defaults — the full editable set ships in ./data/*.json and is
// used to seed MongoDB; these only apply when those files are missing too.
const CONTENT_DEFAULTS = {
  "site.title": "Norwegian International School",
  "hero.heading": "Welcome to Norwegian International School, Port Harcourt",
  "footer.phone": "(+234) 7081888098",
  "footer.emailAdmin": "schooladmin@norwegianinternationalschools.com",
  "footer.address": "11 Rotimi Amaechi Drive GRA Phase 3,<br>Rivers State, Nigeria",
};
const SELECTOR_DEFAULTS = {
  "site.title": { type: "text", selector: "title" },
  "hero.heading": { type: "text", selector: "h1[class*='heroTitle']" },
  "footer.phone": { type: "text", selector: "div[class*='phoneText']" },
  "footer.emailAdmin": { type: "text", selector: "div[class*='footerEmails'] p:nth-of-type(1)" },
  "footer.address": { type: "html", selector: "div[class*='addressText']" },
};

/* ---------------- document stores ---------------- */

function jsonDocsStore(dataDir) {
  const fileFor = (kind) => path.join(dataDir, `${kind}.json`);

  function readJson(kind, fallback) {
    const file = fileFor(kind);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf8");
      return fallback;
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  return {
    backend: "json files (./data)",
    async get(kind, fallback) { return readJson(kind, fallback); },
    async set(kind, data) {
      fs.writeFileSync(fileFor(kind), JSON.stringify(data, null, 2), "utf8");
    },
    async close() {},
  };
}

// On Vercel a "cold start" creates a fresh module scope, but warm invocations
// reuse the same process — caching the client on `global` (which survives
// warm reuse, unlike a plain module-level variable re-evaluated per bundle)
// avoids opening a new MongoDB connection on every request.
const g = globalThis;

async function mongoDocsStore(uri, dbName, dataDir) {
  if (!g.__nisMongoClientPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    g.__nisMongoClientPromise = client.connect();
  }
  const client = await g.__nisMongoClientPromise;
  const settings = client.db(dbName).collection("settings");

  // One-time migration: seed each kind from ./data/*.json if the doc is absent.
  async function seedIfMissing(kind, fallback) {
    const existing = await settings.findOne({ _id: kind });
    if (existing) return;
    let data = fallback;
    const file = path.join(dataDir, `${kind}.json`);
    if (fs.existsSync(file)) {
      try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
    }
    await settings.updateOne({ _id: kind }, { $setOnInsert: { data } }, { upsert: true });
    console.log(`[storage] seeded "${kind}" into MongoDB`);
  }
  await seedIfMissing("content", CONTENT_DEFAULTS);
  await seedIfMissing("selectors", SELECTOR_DEFAULTS);

  return {
    backend: `MongoDB (${dbName})`,
    async get(kind, fallback) {
      const doc = await settings.findOne({ _id: kind });
      return doc ? doc.data : fallback;
    },
    async set(kind, data) {
      await settings.updateOne({ _id: kind }, { $set: { data } }, { upsert: true });
    },
    async close() { await client.close(); g.__nisMongoClientPromise = null; },
  };
}

/* ---------------- media stores ---------------- */

function localMediaStore(uploadsDir) {
  return {
    backend: "local disk (./uploads)",
    async list() {
      return fs.readdirSync(uploadsDir)
        .filter((f) => !f.startsWith("."))
        .map((name) => {
          const stat = fs.statSync(path.join(uploadsDir, name));
          return { name, url: `/uploads/${name}`, size: stat.size, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
    },
    async save(file) {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const name = `${Date.now()}_${safe}`;
      fs.writeFileSync(path.join(uploadsDir, name), file.buffer);
      return { url: `/uploads/${name}`, name };
    },
    async remove(name) {
      const target = path.join(uploadsDir, path.basename(name));
      if (!fs.existsSync(target)) return false;
      fs.unlinkSync(target);
      return true;
    },
  };
}

function cloudinaryMediaStore(docs, folder) {
  // The media index (public_id → url/size/date) lives in the docs store so
  // listing never depends on Cloudinary Admin API quotas.
  async function getIndex() { return docs.get("media", []); }
  async function setIndex(items) { await docs.set("media", items); }

  return {
    backend: `Cloudinary (folder "${folder}")`,
    async list() {
      const items = await getIndex();
      return [...items].sort((a, b) => b.mtime - a.mtime);
    },
    async save(file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "auto", use_filename: true, unique_filename: true },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(file.buffer);
      });
      const entry = {
        name: result.public_id,
        url: result.secure_url,
        size: result.bytes,
        mtime: Date.now(),
        resourceType: result.resource_type,
      };
      const items = await getIndex();
      await setIndex([entry, ...items.filter((i) => i.name !== entry.name)]);
      return { url: entry.url, name: entry.name };
    },
    async remove(name) {
      const items = await getIndex();
      const entry = items.find((i) => i.name === name);
      if (!entry) return false;
      await cloudinary.uploader.destroy(name, { resource_type: entry.resourceType || "image" });
      await setIndex(items.filter((i) => i.name !== name));
      return true;
    },
  };
}

/* ---------------- init ---------------- */

export async function initStorage({ dataDir, uploadsDir }) {
  let docs;
  if (process.env.MONGODB_URI) {
    const dbName = process.env.MONGODB_DB || "nis-admin";
    docs = await mongoDocsStore(process.env.MONGODB_URI, dbName, dataDir);
  } else {
    docs = jsonDocsStore(dataDir);
    // make sure defaults exist on first run
    await docs.get("content", CONTENT_DEFAULTS);
    await docs.get("selectors", SELECTOR_DEFAULTS);
  }

  const hasCloudinary = !!(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
  let media;
  if (hasCloudinary) {
    if (!process.env.CLOUDINARY_URL) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
    cloudinary.config({ secure: true });
    media = cloudinaryMediaStore(docs, process.env.CLOUDINARY_FOLDER || "nis-admin");
  } else {
    media = localMediaStore(uploadsDir);
  }

  console.log(`[storage] documents: ${docs.backend}`);
  console.log(`[storage] media:     ${media.backend}`);
  if (!process.env.MONGODB_URI || !hasCloudinary) {
    console.warn("[storage] running with local fallback(s) — set MONGODB_URI and CLOUDINARY_URL in .env for production");
  }

  return {
    docs,
    media,
    contentDefaults: CONTENT_DEFAULTS,
    selectorDefaults: SELECTOR_DEFAULTS,
  };
}
