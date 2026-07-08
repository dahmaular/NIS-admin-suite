
/**
 * injector.js
 * Fetches selector mappings and content, and applies them to the DOM at runtime.
 * Supports types: text, html, image, link, toggle
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
