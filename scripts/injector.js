
/**
 * injector.js
 * Fetches selector mappings and content, and applies them to the DOM at runtime.
 * Supports types: text, html, image, link, toggle, gallery
 */
(function(){
  const API = (window.__CONTENT_API_BASE__ || "/api").replace(/\/$/, "");
  const sleep = (ms) => new Promise(r=>setTimeout(r, ms));

  function uniqSelector(el) {
    if (!el) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    while (el && el.nodeType === 1 && el.tagName.toLowerCase() !== "html") {
      let selector = el.tagName.toLowerCase();
      if (el.classList && el.classList.length) {
        selector += "." + Array.from(el.classList).map(c=>CSS.escape(c)).join(".");
      }
      const sibs = el.parentNode ? Array.from(el.parentNode.children).filter(n=>n.tagName===el.tagName) : [];
      if (sibs.length > 1) {
        const index = sibs.indexOf(el) + 1;
        selector += `:nth-of-type(${index})`;
      }
      parts.unshift(selector);
      el = el.parentNode;
    }
    return parts.join(" > ");
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${url}`);
    return res.json();
  }

  function setText(el, value) {
    if (!el || el.textContent === String(value)) return;
    el.textContent = value;
  }
  function setHTML(el, value) {
    if (!el || el.innerHTML === String(value)) return;
    el.innerHTML = value;
  }
  function setImage(el, value) {
    if (!el) return;
    if (el.tagName.toLowerCase()==="img") {
      if (el.getAttribute("src") !== value) el.src = value;
    } else {
      el.style.backgroundImage = `url('${value}')`;
    }
  }
  function setLink(el, value) {
    if (!el) return;
    if (el.tagName.toLowerCase()==="a") {
      el.href = value;
    } else {
      el.setAttribute("data-link", value);
    }
  }
  function setToggle(el, value) {
    if (!el) return;
    el.style.display = value ? "" : "none";
  }

  // --- gallery: append extra photos after the site's own (hardcoded) ones --- //
  // Selector points at the masonry grid; value is [{ src, height, category }].
  // Cards reuse the site's CSS-module classes (e.g. Gallery_galleryCard__Sr2fg),
  // found at runtime so they survive the site's class hashes changing per build.
  const ADDED = "data-nis-gallery";

  function findClass(prefix) {
    const el = document.querySelector(`[class*="${prefix}"]`);
    const fromDom = el && Array.from(el.classList).find((c) => c.startsWith(prefix));
    if (fromDom) return fromDom;
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; } // cross-origin sheet
      for (const rule of Array.from(rules || [])) {
        const m = rule.selectorText && rule.selectorText.match(new RegExp(`\\.(${prefix}[\\w-]+)`));
        if (m) return m[1];
      }
    }
    return "";
  }

  function parseGallery(value) {
    let items = value;
    if (typeof items === "string") { try { items = JSON.parse(items); } catch (e) { return []; } }
    return Array.isArray(items) ? items.filter((i) => i && i.src) : [];
  }

  function openLightbox(srcs, index) {
    let i = index;
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(10,12,30,.92);display:flex;align-items:center;justify-content:center";
    const img = document.createElement("img");
    img.style.cssText = "max-width:90vw;max-height:85vh;object-fit:contain;border-radius:8px";
    const counter = document.createElement("div");
    counter.style.cssText = "position:absolute;bottom:24px;left:50%;transform:translateX(-50%);color:#fff;font:14px sans-serif";
    const btn = (label, css, fn) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = "position:absolute;background:none;border:0;color:#fff;font-size:44px;cursor:pointer;line-height:1;padding:12px;" + css;
      b.onclick = (e) => { e.stopPropagation(); fn(); };
      return b;
    };
    const show = () => { img.src = srcs[i]; counter.textContent = `${i + 1} / ${srcs.length}`; };
    const prev = () => { if (i > 0) { i--; show(); } };
    const next = () => { if (i < srcs.length - 1) { i++; show(); } };
    const close = () => { overlay.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") prev(); else if (e.key === "ArrowRight") next(); };
    img.onclick = (e) => e.stopPropagation();
    overlay.onclick = close;
    overlay.append(img, counter, btn("×", "top:8px;right:16px", close), btn("‹", "left:16px", prev), btn("›", "right:16px", next));
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    document.body.appendChild(overlay);
    show();
  }

  function setGallery(grid, value) {
    if (!grid) return;
    const module = (Array.from(grid.classList).find((c) => /_masonryGallery__/.test(c)) || "").split("_")[0] || "Gallery";
    const active = document.querySelector(`[class*="${module}_activeTab__"]`);
    const tab = active ? active.textContent.trim() : "All";
    const items = parseGallery(value).filter((i) => tab === "All" || i.category === tab);

    const signature = tab + "|" + JSON.stringify(items);
    const existing = grid.querySelectorAll(`[${ADDED}]`);
    if (grid.getAttribute(ADDED) === signature && existing.length === items.length) return;
    existing.forEach((n) => n.remove());
    grid.setAttribute(ADDED, signature);

    const cls = (name) => findClass(`${module}_${name}__`);
    items.forEach((item) => {
      const card = document.createElement("div");
      card.setAttribute(ADDED, "");
      card.className = [cls("galleryCard"), cls(item.height || "medium")].filter(Boolean).join(" ");
      card.style.cursor = "pointer";
      const box = document.createElement("div");
      box.className = cls("imageContainer");
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt || "Gallery";
      img.loading = "lazy";
      img.className = cls("galleryImage");
      const overlay = document.createElement("div");
      overlay.className = cls("imageOverlay");
      box.append(img, overlay);
      card.appendChild(box);
      // The site's own lightbox only knows its hardcoded list, so open ours,
      // stepping through every photo currently in the grid.
      card.addEventListener("click", () => {
        const imgs = Array.from(grid.querySelectorAll("img"));
        openLightbox(imgs.map((n) => n.src), Math.max(0, imgs.indexOf(img)));
      });
      grid.appendChild(card);
    });
  }

  function applyOne(root, selector, type, value) {
    if (!selector) return;
    const nodes = root.querySelectorAll(selector);
    if (!nodes.length) return;
    nodes.forEach(node => {
      switch(type){
        case "text": setText(node, value); break;
        case "html": setHTML(node, value); break;
        case "image": setImage(node, value); break;
        case "link": setLink(node, value); break;
        case "toggle": setToggle(node, !!value); break;
        case "gallery": setGallery(node, value); break;
        default: break;
      }
    });
  }

  let applying = false;
  function applyAll(selectors, content) {
    applying = true;
    const root = document;
    Object.entries(selectors || {}).forEach(([key, conf])=>{
      const type = conf.type || "text";
      const selector = conf.selector || "";
      const value = content[key];
      if (typeof value === "undefined") return;
      applyOne(root, selector, type, value);
    });
    setTimeout(()=>{ applying = false; }, 50);
  }

  async function run() {
    try {
      // Wait for app to render
      for (let i=0;i<30;i++){ if (document.body && document.body.children.length) break; await sleep(200); }

      const [selectors, content] = await Promise.all([
        fetchJSON(`${API}/selectors`),
        fetchJSON(`${API}/content`)
      ]);

      applyAll(selectors, content);

      // SPAs render/replace nodes after load: re-apply when the DOM changes
      // (debounced, and ignoring mutations caused by our own writes).
      let timer = null;
      const observer = new MutationObserver(()=>{
        if (applying) return;
        clearTimeout(timer);
        timer = setTimeout(()=>applyAll(selectors, content), 250);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      console.warn("Injector failed:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
