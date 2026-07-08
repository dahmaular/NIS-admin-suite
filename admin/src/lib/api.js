const API = "/api";
const TOKEN_KEY = "nis_token";

// The real public site (norwegianinternationalschools.com) is a separate
// deployment from this admin app, so links, the live-preview iframe and the
// element picker need its actual origin. Set VITE_SITE_ORIGIN at build time
// (Vercel project env vars, or admin/.env.local for local dev) to the site's
// URL, e.g. https://norwegianinternationalschools.com — no trailing slash.
// Falls back to the local Express dev server when unset.
export const SITE_ORIGIN = import.meta.env.VITE_SITE_ORIGIN
  || (import.meta.env.DEV ? "http://localhost:5175" : "");

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  if (res.status === 401 && path !== "/login") {
    setToken("");
    window.dispatchEvent(new Event("nis:logout"));
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  login: (password) => request("/login", { method: "POST", body: { password } }),
  verify: () => request("/verify"),
  getContent: () => request("/content"),
  saveContent: (data) => request("/content", { method: "POST", body: data }),
  getSelectors: () => request("/selectors"),
  saveSelectors: (data) => request("/selectors", { method: "POST", body: data }),
  listUploads: () => request("/uploads"),
  deleteUpload: (name) => request(`/uploads/${encodeURIComponent(name)}`, { method: "DELETE" }),
  upload: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/upload", { method: "POST", body: form, isForm: true });
  },
};

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function formatDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function isImageUrl(url) {
  return typeof url === "string" && /\.(png|jpe?g|gif|webp|svg|avif|ico)(\?.*)?$/i.test(url);
}
