
# NIS Admin Suite (Drop-in CMS for an existing React build)

This project manages the content of an **existing, separately-hosted site**
(norwegianinternationalschools.com) via:
- a content **Injector** — a small script embedded in the real site's `<head>` that fetches
  content from this project's API and replaces text/images/links at runtime via CSS selectors
  (with a MutationObserver so SPA re-renders stay updated),
- a fully branded **Admin dashboard** (React + Vite), styled after the NIS identity (indigo
  `#2d338a`, red `#dc2c2c`, Effra), with:
  - **Dashboard** — live stats, quick actions, recent uploads
  - **Content Studio** — grouped inline editors, dirty tracking, one-click publish
  - **Media Library** — drag & drop uploads, preview lightbox, copy URL, delete
  - **Element Mappings** — point-and-click element picker over the live site (via iframe)
  - **Live Preview** — desktop / tablet / mobile device frames
- a lightweight **Express** API (deployed as Vercel serverless functions in production) for
  persistence, uploads and media management, backed by:
  - **MongoDB** for content, selector mappings and the media index (set `MONGODB_URI`)
  - **Cloudinary** for image/media storage (set `CLOUDINARY_URL`)
  - automatic fallback to `./data/*.json` + `./uploads` when neither is configured (local dev
    only — Vercel has no persistent disk, so both are required there),
    with a one-time migration of the JSON files into MongoDB on first connect.

The admin dashboard and the public marketing site are **two separate deployments** — this
repo's `site-build/` folder is a local copy used only to test the injector/picker before wiring
them into the real, live site (see "Embedding the injector on the real site" below).

> 🔐 Default local password: `changeme` — always set `ADMIN_PASSWORD` for anything but local dev.

---

## Quick Start (local dev)

Local dev runs two processes: the API + a local copy of the site (Express, port 5175), and the
admin dashboard (Vite, port 5176, proxied to 5175).

1. **Install** (also builds the admin UI once, for parity with production):
   ```bash
   npm install
   ```

2. **Terminal 1 — API + local site copy:**
   ```bash
   npm start
   ```
   - Local site copy: http://localhost:5175/
   - API: http://localhost:5175/api

3. **Terminal 2 — Admin dashboard:**
   ```bash
   cd admin && npm run dev
   ```
   - Admin: http://localhost:5176/ (password: `changeme`, or your `ADMIN_PASSWORD`)

> To change the password and token secret for local dev:
> ```bash
> ADMIN_PASSWORD="your-strong-password" JWT_SECRET="a-long-random-secret" npm start
> ```

4. **Configure production backends** — copy `.env.example` to `.env` and fill in:
   ```bash
   MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net   # content & mappings
   CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>  # image storage
   ADMIN_PASSWORD=...   JWT_SECRET=...
   ```
   On the first connect, any existing `data/*.json` content is migrated into MongoDB
   automatically. Without these variables the local server logs a warning and uses the local
   JSON files / `uploads/` folder instead (local dev only — not available on Vercel).

---

## Deploying to Vercel

One Vercel project hosts **both** the admin dashboard (static, built by Vite) and the API
(serverless functions under `/api`) — see `vercel.json`. The real public site is **not** part
of this deployment; it keeps living wherever it lives today.

1. **Push this repo to GitHub** (or GitLab/Bitbucket), then in the Vercel dashboard:
   **Add New → Project → Import** this repo. Vercel auto-detects `vercel.json`.

2. **Set Environment Variables** (Project → Settings → Environment Variables) — required,
   there is no local-disk fallback on Vercel:
   | Variable | Value |
   |---|---|
   | `ADMIN_PASSWORD` | a strong password (never leave as `changeme`) |
   | `JWT_SECRET` | a long random string |
   | `MONGODB_URI` | your MongoDB Atlas connection string |
   | `MONGODB_DB` | `nis-admin` (or your choice) |
   | `CLOUDINARY_URL` | `cloudinary://<api_key>:<api_secret>@<cloud_name>` |
   | `CLOUDINARY_FOLDER` | `nis-admin` (or your choice) |
   | `VITE_SITE_ORIGIN` | `https://norwegianinternationalschools.com` (build-time; the admin app needs this to link to/preview/pick elements on the real site) |

   The app refuses to authenticate if `ADMIN_PASSWORD`/`JWT_SECRET` are left at their
   insecure defaults on Vercel (`INSECURE_DEFAULTS` guard in `app.js`) — deploy will succeed,
   but `/api/login` will return a 500 until you set them.

3. **Deploy.** Vercel runs `npm install` (which builds the admin UI via `postinstall`), then
   `npm run build` (rebuilds it explicitly per `vercel.json`), and serves `admin/dist` as static
   output with `/api/*`, `/injector.js` and `/injected-assistant.js` rewritten to the
   `api/index.js` serverless function.

4. **Embed the injector on the real site.** Add this to the `<head>` of
   norwegianinternationalschools.com (wherever it's hosted), replacing the URL with your
   Vercel deployment's domain:
   ```html
   <script>window.__CONTENT_API_BASE__ = 'https://your-admin-project.vercel.app/api';</script>
   <script src="https://your-admin-project.vercel.app/injected-assistant.js"></script>
   <script src="https://your-admin-project.vercel.app/injector.js" defer></script>
   ```
   Once that's live, content saved in the admin dashboard applies to the real site on next
   page load, and the **Element Mappings** / **Live Preview** views (which iframe the real
   site via `VITE_SITE_ORIGIN`) will show the picker highlighting working against it too —
   the real site currently sends no `X-Frame-Options`/CSP `frame-ancestors` header, so it can
   be iframed; if that ever changes, those two views will stop loading and would need the
   iframe origin explicitly allowed.

5. **Local CLI alternative:** `npx vercel` (link the project) then `npx vercel --prod` deploys
   from your machine using the same `vercel.json`; set the env vars with `npx vercel env add`
   or in the dashboard first.

### Known Vercel constraints
- **Upload size:** Vercel serverless functions cap request bodies around 4.5MB; the upload
  route's multer limit is set to 4MB to fail cleanly under that rather than hit a generic
  Vercel 413. Very large photos should be resized before upload.
- **Cold starts:** the first request after idle re-connects to MongoDB (a few hundred ms);
  the connection is cached across warm invocations afterwards (see `storage.js`).

---

## How it works

- In local dev, `server.js` serves a local copy of the site from `./site-build` and injects two
  small scripts into its HTML for testing. In production, the real site (hosted elsewhere) embeds
  the same two scripts directly, served by the Vercel deployment (see "Embedding the injector" above):
  - `/injected-assistant.js` – lets you **pick** elements in the live preview / picker iframe.
  - `/injector.js` – reads `/api/selectors` + `/api/content` and **mutates the DOM** (text, html, image, link, toggle).
- The Admin UI:
  - Create a **mapping**: Key → (Type, CSS Selector) — via the point-and-click picker or manually.
  - Provide a **value** for that key (text/html/url/etc.) in Content Studio.
  - Save. The public page reflects the values on its next load.

---

## Tips

- Use the **Pick** button in Element Mappings to grab precise selectors from the live site.
- For images: set Type=`image` and Value to an uploaded file's URL (use the **Media Library**).
- For links: set Type=`link` and Value=`https://...` – works on `<a>` tags.
- To hide a section: set Type=`toggle` and Value=`false` for the section's container.

---

## Files you may customize

- `data/content.json` – editable **values**, also the seed data migrated into MongoDB on first connect.
- `data/selectors.json` – selector **mappings**, same seeding behavior.
- `uploads/` – local media fallback (only used when `CLOUDINARY_URL` is unset; not available on Vercel).

---

## Notes / Limitations

- This approach edits the **rendered DOM**. It’s robust when selectors are stable.
- If the page structure or class names change in future builds, update selectors in Admin.
- For 100% control and future-proofing, integrating a proper headless CMS into the source code is recommended. This suite is designed to make your current build fully editable **today**.

---

## Project Structure

```
nis-admin-suite/
├─ admin/               # React (Vite) Admin app — its own Vercel-deployable frontend
│  ├─ public/logo.png   # Bundled crest (branding doesn't depend on the live site)
│  └─ ...                (built to ./admin/dist, which Vercel serves as static output)
├─ api/
│  └─ index.js          # Vercel serverless entry — wraps app.js, no static serving
├─ app.js                # Shared Express app factory (routes only, no app.listen)
├─ server.js             # Local dev entry — app.listen() + serves ./site-build for testing
├─ storage.js            # MongoDB/Cloudinary storage layer (with local JSON/disk fallback)
├─ data/
│  ├─ content.json      # Editable content values (seeds MongoDB on first connect)
│  └─ selectors.json    # Key → { type, selector }
├─ scripts/
│  ├─ injector.js       # Applies content into the DOM at runtime (embedded on the real site)
│  └─ injected-assistant.js # Helper to pick elements (embedded on the real site)
├─ site-build/          # Local copy of the site, for testing only — not deployed to Vercel
├─ uploads/             # Local media fallback — not available on Vercel
├─ vercel.json           # Rewrites /api/*, /injector.js, /injected-assistant.js to api/index.js
└─ package.json
```

---

## Security

- Token-based auth using JWT; credentials are never stored server-side.
- Change `ADMIN_PASSWORD` & `JWT_SECRET` in production — set them as Vercel Environment
  Variables, never commit them. `app.js` refuses to issue tokens on Vercel if either is left
  at its insecure default.
- Vercel deployments are served over HTTPS by default.
