
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

  // --- gallery: admin photos (and admin-created tabs) on the site's gallery --- //
  // Selector points at the masonry grid. Value is { tabs: ["Graduation"],
  // images: [{ src, height, category }] } (a bare images array also works).
  // Admin photos go before the site's own (hardcoded) ones. A photo whose
  // category is one of `tabs` only shows under that admin-created tab (and
  // "All"); clicking such a tab hides the site's photos, since the site's
  // React state knows nothing about it. Cards and tab buttons reuse the site's
  // CSS-module classes (e.g. Gallery_galleryCard__Sr2fg), found at runtime so
  // they survive the class hashes changing per build.
  const ADDED = "data-nis-gallery";
  const ADDED_TAB = "data-nis-tab";
  const HIDDEN = "data-nis-hidden";
  const DEMOTED = "data-nis-demoted";
  let galleryValue = null;
  let galleryTabsBar = null;
  let customTab = null; // name of the admin-created tab being shown, if any

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
    let v = value;
    if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { v = null; } }
    if (Array.isArray(v)) v = { images: v };
    v = v && typeof v === "object" ? v : {};
    const tabs = Array.isArray(v.tabs) ? v.tabs.map((t) => String(t).trim()).filter(Boolean) : [];
    const images = Array.isArray(v.images) ? v.images.filter((i) => i && i.src) : [];
    return { tabs, images };
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

  function galleryModule(grid) {
    return (Array.from(grid.classList).find((c) => /_masonryGallery__/.test(c)) || "").split("_")[0] || "Gallery";
  }

  // Add/refresh the admin-created tab buttons and keep the active styling in
  // step with customTab. Site tabs are React's; we only swap their classes
  // while a custom tab is showing and put them back when it isn't.
  function syncTabs(module, tabs) {
    const bar = document.querySelector(`[class*="${module}_categoryTabs__"]`);
    if (!bar) return;
    if (bar !== galleryTabsBar) {
      galleryTabsBar = bar;
      customTab = null; // new page render: React is back on its own tab
      // A click on a site tab leaves any custom tab. React then shows its
      // loading state by reusing the grid element, so clear our cards now
      // (or the old tab's photos linger under the spinner) and re-add the
      // right ones as soon as the grid is back on the clicked tab. If React
      // ignores the click (already on that tab) that happens straight away.
      bar.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b || b.hasAttribute(ADDED_TAB) || b.disabled) return;
        const name = b.textContent.trim();
        customTab = null;
        // Undo our custom-tab styling before React reconciles the buttons.
        const tabCls = findClass(`${module}_tab__`);
        const activeCls = findClass(`${module}_activeTab__`);
        bar.querySelectorAll(`[${DEMOTED}]`).forEach((d) => { d.classList.replace(tabCls, activeCls); d.removeAttribute(DEMOTED); });
        bar.querySelectorAll(`[${ADDED_TAB}]`).forEach((d) => { d.className = tabCls; });
        document.querySelectorAll(`[${HIDDEN}]`).forEach((h) => { h.removeAttribute(HIDDEN); h.style.display = ""; });
        document.querySelectorAll(`[${ADDED}]`).forEach((n) => {
          if (n.parentElement && !n.matches(`[class*="_masonryGallery__"]`)) n.remove();
          else n.removeAttribute(ADDED);
        });
        let tries = 0;
        const timer = setInterval(() => {
          const active = bar.querySelector(`button[class*="${module}_activeTab__"]:not([${ADDED_TAB}])`);
          const ready = document.querySelector(`[class*="_masonryGallery__"]`) && active && active.textContent.trim() === name;
          if (ready || ++tries > 80) { clearInterval(timer); refreshGallery(); }
        }, 100);
      }, true);
    }
    if (customTab && !tabs.includes(customTab)) customTab = null;

    const cls = (name) => findClass(`${module}_${name}__`);
    const tabCls = cls("tab");
    const activeCls = cls("activeTab");
    const current = Array.from(bar.querySelectorAll(`[${ADDED_TAB}]`));
    if (current.map((b) => b.textContent).join("|") !== tabs.join("|")) {
      current.forEach((b) => b.remove());
      tabs.forEach((name) => {
        const b = document.createElement("button");
        b.setAttribute(ADDED_TAB, "");
        b.type = "button";
        b.textContent = name;
        b.addEventListener("click", () => {
          if (customTab === name) return;
          customTab = name;
          refreshGallery();
        });
        bar.appendChild(b);
      });
    }
    bar.querySelectorAll(`[${ADDED_TAB}]`).forEach((b) => {
      b.className = b.textContent === customTab ? activeCls : tabCls;
    });
    // Site tabs: demote React's active one while a custom tab shows.
    bar.querySelectorAll(`button:not([${ADDED_TAB}])`).forEach((b) => {
      if (customTab && b.classList.contains(activeCls)) {
        b.classList.replace(activeCls, tabCls);
        b.setAttribute(DEMOTED, "");
      } else if (!customTab && b.hasAttribute(DEMOTED)) {
        b.classList.replace(tabCls, activeCls);
        b.removeAttribute(DEMOTED);
      }
    });
    return bar;
  }

  function refreshGallery() {
    applying = true;
    document.querySelectorAll(`[class*="_masonryGallery__"]`).forEach((g) => setGallery(g, galleryValue));
    setTimeout(() => { applying = false; }, 50);
  }

  function setGallery(grid, value) {
    if (!grid) return;
    galleryValue = value;
    const { tabs, images } = parseGallery(value);
    const module = galleryModule(grid);
    const bar = syncTabs(module, tabs);

    let tab = "All";
    if (customTab) {
      tab = customTab;
    } else if (bar) {
      const active = bar.querySelector(`button[class*="${module}_activeTab__"]:not([${ADDED_TAB}])`);
      if (active) tab = active.textContent.trim();
    }
    const items = images.filter((i) => tab === "All" || i.category === tab);

    // Hide the site's own photos while a custom tab shows; restore otherwise.
    Array.from(grid.children).forEach((c) => {
      if (c.hasAttribute(ADDED)) return;
      if (customTab && !c.hasAttribute(HIDDEN)) { c.setAttribute(HIDDEN, ""); c.style.display = "none"; }
      if (!customTab && c.hasAttribute(HIDDEN)) { c.removeAttribute(HIDDEN); c.style.display = ""; }
    });

    const signature = tab + "|" + JSON.stringify(items);
    const existing = grid.querySelectorAll(`[${ADDED}]`);
    const inPlace = !items.length || grid.firstElementChild === existing[0];
    if (grid.getAttribute(ADDED) === signature && existing.length === items.length && inPlace) return;
    existing.forEach((n) => n.remove());
    grid.setAttribute(ADDED, signature);

    const cls = (name) => findClass(`${module}_${name}__`);
    const first = grid.firstChild;
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
      // stepping through every photo currently visible in the grid.
      card.addEventListener("click", () => {
        const imgs = Array.from(grid.querySelectorAll("img")).filter((n) => n.offsetParent !== null);
        openLightbox(imgs.map((n) => n.src), Math.max(0, imgs.indexOf(img)));
      });
      grid.insertBefore(card, first); // admin photos lead, site photos follow
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
