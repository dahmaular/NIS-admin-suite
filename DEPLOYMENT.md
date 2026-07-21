# Deployment guide — API on Vercel, Admin on cPanel

This project deploys as **two independent pieces on two different hosts**, plus the
existing public site which stays wherever it already lives:

| Piece | What it is | Where it goes | Origin (example) |
|---|---|---|---|
| **API** | Express app (`app.js`) wrapped as a serverless function (`api/index.js`) | Vercel | `https://nis-admin-suite.vercel.app` |
| **Admin** | React/Vite dashboard (`admin/`), a folder of static files | cPanel | `https://admin.norwegianinternationalschools.com` |
| **Public site** | The real school website (not in this repo) | unchanged | `https://norwegianinternationalschools.com` |

The API also serves `/injector.js` and `/injected-assistant.js`, which the public
site embeds so edits made in the admin show up on the live site.

> **The single most important consequence of this split:** the admin and the API are
> now on **different origins**. The admin no longer reaches the API at a relative
> `/api` path — it must be told the API's absolute URL **at build time**, and the
> API must allow the admin's origin through CORS. Both are handled below.

---

## 0. Changes already made for this split

These are committed in the repo; you don't need to make them, but you should know
they exist because they change how you build and deploy.

| File | Change | Why |
|---|---|---|
| `admin/src/lib/api.js` | `const API = "/api"` → built from `VITE_API_BASE` | The admin must call the API cross-origin |
| `vercel.json` | Dropped `buildCommand`, `outputDirectory` now `public/` | Vercel deploys the API only; it no longer builds or hosts the admin |
| `package.json` | Removed the `postinstall` admin build | Stops Vercel building a frontend it no longer serves |
| `public/index.html` | New placeholder page | Gives Vercel a safe static root — **without it Vercel would serve the repo root, exposing `app.js`, `data/*.json` and `storage.js`** |
| `admin/public/.htaccess` | New Apache config | HTTPS redirect, SPA fallback, cache headers for cPanel. Vite copies it into `admin/dist/` on every build |
| `admin/.env.production.example` | New template | Documents the two build-time variables |

Auth is a **JWT bearer token in `localStorage`**, not a cookie. That is what makes
this cross-origin split straightforward — there are no `SameSite`, third-party
cookie, or `credentials: include` problems to solve.

---

## Part A — Deploy the API to Vercel

### A1. Provision the two external services first

Vercel has **no persistent disk**. The local JSON-file and `uploads/` fallbacks in
`storage.js` do not work there, so both of these are **required**, not optional.

**MongoDB Atlas** (content, selectors, media index)

1. Create a free M0 cluster at <https://cloud.mongodb.com>.
2. **Database Access** → add a user with *Read and write to any database*.
3. **Network Access** → **Add IP Address** → **Allow access from anywhere**
   (`0.0.0.0/0`).
   ⚠️ This is not optional laziness: Vercel functions run from rotating IPs with no
   stable egress range on Hobby/Pro, so an IP allowlist will fail intermittently in
   a way that looks like a random database outage. Keep the DB user password strong
   — that is your actual access control.
4. **Connect** → **Drivers** → copy the `mongodb+srv://…` URI and substitute the
   real password.

**Cloudinary** (image and media storage)

1. Sign up at <https://cloudinary.com>.
2. Dashboard → copy the **API Environment variable**, which looks like
   `cloudinary://<api_key>:<api_secret>@<cloud_name>`.

### A2. Set the environment variables

Six variables. Set every one for **Production**, **Preview** and **Development**.

| Variable | Value | Notes |
|---|---|---|
| `ADMIN_PASSWORD` | a strong password | This is the *only* login credential for the dashboard |
| `JWT_SECRET` | 32+ random bytes | `openssl rand -base64 32` |
| `MONGODB_URI` | `mongodb+srv://…` | From A1 |
| `MONGODB_DB` | `nis-admin` | |
| `CLOUDINARY_URL` | `cloudinary://…` | From A1 |
| `CLOUDINARY_FOLDER` | `nis-admin` | |

`VITE_SITE_ORIGIN` is **no longer needed on Vercel** — it was a build-time variable
for the admin, which Vercel no longer builds. It moves to the cPanel build in Part B.

`app.js` has an `INSECURE_DEFAULTS` guard: if `ADMIN_PASSWORD` or `JWT_SECRET` is
left at its default while `VERCEL` is set, the deploy still succeeds but `/api/login`
returns `500 Server misconfigured`. So a failing login right after first deploy
almost always means one of these two is missing.

**Via the dashboard:** Project → Settings → Environment Variables.

**Via the CLI:**

```bash
npm i -g vercel
vercel login
vercel link            # this repo is already linked to project "nis-admin-suite"

for v in ADMIN_PASSWORD JWT_SECRET MONGODB_URI MONGODB_DB CLOUDINARY_URL CLOUDINARY_FOLDER; do
  vercel env add "$v" production
done
```

### A3. Deploy

```bash
vercel --prod
```

Or push to your default branch if the project is connected to Git. Either way the
build is now trivial — `npm install` at the root, no frontend build — so it should
finish in well under a minute.

Note your production URL, e.g. `https://nis-admin-suite.vercel.app`. **Part B needs it.**

### A4. Verify before touching cPanel

Do not move on until all four of these pass. Replace `$API` with your URL.

```bash
API=https://nis-admin-suite.vercel.app

# 1. Public read — should return JSON content, not an error
curl -s $API/api/content | head -c 300

# 2. Login — should return {"token":"eyJ..."}
curl -s -X POST $API/api/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"YOUR_ADMIN_PASSWORD"}'

# 3. Authenticated route — should return {"ok":true}
TOKEN=$(curl -s -X POST $API/api/login -H 'Content-Type: application/json' \
  -d '{"password":"YOUR_ADMIN_PASSWORD"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
curl -s $API/api/verify -H "Authorization: Bearer $TOKEN"

# 4. Injector script — should return JavaScript, not HTML or 404
curl -s -I $API/injector.js | grep -i content-type

# 5. Source files must NOT be reachable — both should 404
curl -s -o /dev/null -w '%{http_code}\n' $API/app.js
curl -s -o /dev/null -w '%{http_code}\n' $API/data/content.json
```

If #5 returns `200` for either, stop — `outputDirectory` is not set to `public` and
your server source is public. Fix `vercel.json` and redeploy.

---

## Part B — Deploy the Admin to cPanel

The admin is **static files only**. cPanel's "Setup Node.js App" is *not* involved —
you are uploading a folder of HTML/JS/CSS to a document root.

### B1. Create a subdomain in cPanel

cPanel → **Domains** → **Create A New Domain**:

- **Domain:** `admin.norwegianinternationalschools.com`
- **Document Root:** `/home/<cpanel-user>/admin.norwegianinternationalschools.com`
  (uncheck "Share document root" — it needs its own directory)

Then cPanel → **SSL/TLS Status** → select the new subdomain → **Run AutoSSL**. Wait
for the certificate to issue before continuing; the `.htaccess` forces HTTPS and the
admin will be unreachable over HTTP.

A subdomain is the right shape here. A subfolder like `example.com/admin` would also
require setting Vite's `base` to `/admin/`, and `admin/vite.config.js` is
deliberately `base: '/'`.

### B2. Build with the production values

```bash
cd admin
cp .env.production.example .env.production
```

Edit `admin/.env.production`:

```bash
VITE_API_BASE=https://nis-admin-suite.vercel.app
VITE_SITE_ORIGIN=https://norwegianinternationalschools.com
```

Both are **no trailing slash**, and `VITE_API_BASE` is the **origin only** — the code
appends `/api` itself. `https://…vercel.app/api` here produces requests to
`/api/api/content` and every call 404s.

Then build **from the repo root**:

```bash
cd ..
npm run build
```

Verify the API URL actually got baked in — Vite inlines env vars at build time, so a
missing `.env.production` fails silently and produces a bundle that calls its own
origin:

```bash
grep -o "https://nis-admin-suite.vercel.app" admin/dist/assets/*.js | head -1
```

No output means the build did not pick up `.env.production`. Fix it and rebuild;
do not upload that bundle.

Confirm `.htaccess` made it into the output (it is a dotfile, so `ls -a`):

```bash
ls -a admin/dist
# .  ..  .htaccess  assets  index.html  logo.png
```

### B3. Upload

**Option 1 — File Manager (simplest).** Zip the *contents* of `dist`, not the folder:

```bash
cd admin/dist && zip -r ../admin-dist.zip . && cd ../..
```

Then cPanel → **File Manager** → navigate into the subdomain's document root →
**Upload** `admin-dist.zip` → right-click → **Extract** → delete the zip.

⚠️ cPanel's File Manager hides dotfiles by default. After extracting, enable
**Settings → Show Hidden Files** and confirm `.htaccess` is present. If it is
missing, create it manually with the contents of `admin/public/.htaccess`.

**Option 2 — FTP/SFTP, repeatable.** Note the trailing slash on the source:

```bash
# SFTP, if your host allows SSH
rsync -avz --delete admin/dist/ \
  <cpanel-user>@<server>:/home/<cpanel-user>/admin.norwegianinternationalschools.com/

# Plain FTP
lftp -u <cpanel-user> <server> -e \
  "mirror -R --delete admin/dist /admin.norwegianinternationalschools.com; bye"
```

`--delete` matters — Vite fingerprints filenames, so without it every deploy leaves
the previous build's `assets/` behind and the directory grows without bound.

The final layout in the document root:

```
index.html
.htaccess
logo.png
assets/
  index-<hash>.js
  index-<hash>.css
```

### B4. Verify

1. Open `https://admin.norwegianinternationalschools.com` — the login screen renders.
2. Open DevTools → **Network**, then log in. The request must go to
   `https://nis-admin-suite.vercel.app/api/login` — **not** to the cPanel domain. If
   it targets the cPanel domain, `VITE_API_BASE` did not make it into the build (B2).
3. After login, check the **Console** for CORS errors (see Troubleshooting).
4. Load the Media Library and upload a small image — this exercises Cloudinary end
   to end.
5. Edit a piece of content, save, then reload — this exercises MongoDB writes.
6. Open the Preview tab — the iframe should load the real public site
   (`VITE_SITE_ORIGIN`).

---

## Part C — Point the public site at the API

On the real school website, add these to `<head>` (this is the same wiring as before
the split, just confirming the API origin is the Vercel one):

```html
<script>window.__CONTENT_API_BASE__ = 'https://nis-admin-suite.vercel.app/api';</script>
<script src="https://nis-admin-suite.vercel.app/injected-assistant.js"></script>
<script src="https://nis-admin-suite.vercel.app/injector.js" defer></script>
```

`injector.js` reads `window.__CONTENT_API_BASE__` and falls back to a same-origin
`/api` — which on the public site's own host does not exist. So if content edits
never appear on the live site, this variable is the first thing to check.

---

## CORS

`app.js` uses `app.use(cors())` — fully open. That is deliberate and still correct:
`/api/content` and `/api/selectors` are fetched cross-origin by `injector.js` running
on the public site, so those reads must be open to any origin. Write routes are
protected by the JWT bearer check regardless of origin, and there are no cookies to
be abused by a cross-site request.

If you later want to tighten it, restrict the *authenticated* routes only, and keep
the public GETs open:

```js
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN; // https://admin.norwegianinternationalschools.com
app.use(cors());                                // public reads + injector
app.use("/api/login", cors({ origin: ADMIN_ORIGIN }));
```

Do not blanket-restrict `cors()` to the admin origin — it will silently break the
injector on the live site.

---

## Troubleshooting

**Login returns `500 Server misconfigured`**
`ADMIN_PASSWORD` or `JWT_SECRET` is unset on Vercel. Set both, then **redeploy** —
environment variable changes do not apply to existing deployments.

**Console: `blocked by CORS policy`**
Check the failing request's actual URL first. Almost always the admin is calling
itself (`VITE_API_BASE` missing from the build) rather than a genuine CORS
misconfiguration — the API sends `Access-Control-Allow-Origin: *`.

**Login works but every subsequent call 401s**
The token is in `localStorage`, which is origin-scoped. If you tested on
`http://` and are now on `https://`, or moved between `admin.example.com` and
`example.com/admin`, the stored token is on the other origin. Clear site data and
log in again.

**Uploads fail with 413**
Vercel caps serverless request bodies at ~4.5MB and `app.js` sets multer to 4MB.
Resize the image before uploading. This is a platform limit, not a bug.

**Everything 404s except the homepage**
`.htaccess` did not upload (hidden-file issue, B3) or the host has `AllowOverride
None`. Ask the host to enable `AllowOverride All` for the document root.

**Admin loads an old build after deploying**
`index.html` must be served `no-cache` — that is in the provided `.htaccess`. If a
CDN like Cloudflare sits in front of cPanel, purge its cache too.

**Content edits don't appear on the live site**
`window.__CONTENT_API_BASE__` on the public site is wrong or missing (Part C).
Confirm in DevTools that the site is fetching from the Vercel origin.

---

## Redeploy checklist

**API changed** (`app.js`, `storage.js`, `api/`, `scripts/`):

```bash
vercel --prod
```
The admin needs no rebuild — it holds only the API's URL, not its code.

**Admin changed** (`admin/src/**`):

```bash
npm run build
rsync -avz --delete admin/dist/ <user>@<server>:/home/<user>/admin.norwegian…/
```

**API URL changed** (custom domain, new project): update `VITE_API_BASE` in
`admin/.env.production`, rebuild, re-upload — **and** update
`window.__CONTENT_API_BASE__` and both `<script src>` tags on the public site.

**Secrets rotated:** change on Vercel, then redeploy. Rotating `JWT_SECRET`
invalidates every issued token, so all admin sessions must log in again.
