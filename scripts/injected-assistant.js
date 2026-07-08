
/**
 * injected-assistant.js
 * Helps the Admin UI pick elements from the live site when loaded in an iframe.
 * The admin app toggles "PICK_MODE" via localStorage and communicates via postMessage.
 */
(function(){
  const HIGHLIGHT_CLASS = "__nis_pick_highlight";
  const style = document.createElement("style");
  style.textContent = `
    .${HIGHLIGHT_CLASS} { outline: 2px solid #dc2c2c !important; cursor: crosshair !important; }
  `;
  document.head.appendChild(style);

  function computeSelector(el){
    if (!el) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    while (el && el.nodeType === 1 && el.tagName.toLowerCase() !== "html") {
      let segment = el.tagName.toLowerCase();
      const id = el.id ? `#${CSS.escape(el.id)}` : "";
      const classList = el.classList ? Array.from(el.classList).filter(c => c !== HIGHLIGHT_CLASS) : [];
      const classes = classList.length ? "." + classList.map(c=>CSS.escape(c)).join(".") : "";
      segment += id + classes;
      const siblings = el.parentElement ? Array.from(el.parentElement.children).filter(c=>c.tagName===el.tagName) : [];
      if (siblings.length > 1) {
        segment += `:nth-of-type(${siblings.indexOf(el)+1})`;
      }
      parts.unshift(segment);
      el = el.parentElement;
    }
    return parts.join(" > ");
  }

  let pickMode = false;
  function setPickMode(on){
    pickMode = on;
    if (on) {
      document.body.addEventListener("mouseover", hoverListener, true);
      document.body.addEventListener("click", clickListener, true);
      document.body.classList.add(HIGHLIGHT_CLASS);
    } else {
      document.body.removeEventListener("mouseover", hoverListener, true);
      document.body.removeEventListener("click", clickListener, true);
      document.body.classList.remove(HIGHLIGHT_CLASS);
      clearHighlight();
    }
  }

  let lastEl = null;
  function clearHighlight(){
    if (lastEl) lastEl.style.outline = "";
    lastEl = null;
  }
  function hoverListener(e){
    if (!pickMode) return;
    e.stopPropagation();
    clearHighlight();
    lastEl = e.target;
    lastEl.style.outline = "2px dashed #dc2c2c";
  }
  function clickListener(e){
    if (!pickMode) return;
    e.preventDefault();
    e.stopPropagation();
    clearHighlight();

    const el = e.target;
    const selector = computeSelector(el);
    const tag = el.tagName.toLowerCase();
    const classes = el.className || "";
    const text = (el.textContent || "").trim().slice(0,120);

    window.parent.postMessage({ __nis_pick__: true, selector, tag, classes, text }, "*");
    setPickMode(false);
  }

  window.addEventListener("message", (evt)=>{
    const data = evt.data || {};
    if (data.__nis_toggle_pick__ === true) {
      setPickMode(true);
    }
  }, false);
})();
