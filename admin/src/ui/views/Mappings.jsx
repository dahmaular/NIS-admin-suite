import React, { useEffect, useRef, useState } from "react";
import { api, SITE_ORIGIN } from "../../lib/api";
import { useToast } from "../Toast";
import { PlusIcon, TrashIcon, PenIcon, CrosshairIcon, RefreshIcon, XIcon } from "../icons";

const TYPES = ["text", "html", "image", "link", "toggle"];

export default function Mappings({ selectors, setSelectors, content, setContent }) {
  const toast = useToast();
  const iframeRef = useRef(null);
  const [key, setKey] = useState("");
  const [selector, setSelector] = useState("");
  const [type, setType] = useState("text");
  const [initialValue, setInitialValue] = useState("");
  const [editingKey, setEditingKey] = useState(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    function onMessage(evt) {
      const data = evt.data || {};
      if (data.__nis_pick__) {
        setSelector(data.selector || "");
        if (!key && data.text) {
          // suggest a key from the picked element
          const slug = data.text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 24);
          if (slug) setKey(`section.${slug}`);
        }
        if (data.text && !initialValue) setInitialValue(data.text);
        setPicking(false);
        toast("Element captured — selector filled in", "ok");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [key, initialValue, toast]);

  function startPick() {
    const frame = iframeRef.current;
    if (!frame) return;
    frame.contentWindow.postMessage({ __nis_toggle_pick__: true }, "*");
    setPicking(true);
  }

  function cancelPick() {
    setPicking(false);
    setFrameKey((k) => k + 1); // reload the frame to clear pick mode
  }

  function resetForm() {
    setKey("");
    setSelector("");
    setType("text");
    setInitialValue("");
    setEditingKey(null);
  }

  async function persist(nextSelectors, nextContent) {
    setSaving(true);
    try {
      await api.saveSelectors(nextSelectors);
      setSelectors(nextSelectors);
      if (nextContent) {
        await api.saveContent(nextContent);
        setContent(nextContent);
      }
      setFrameKey((k) => k + 1); // refresh preview so injection reruns
      return true;
    } catch (e) {
      toast(e.message, "err");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveMapping() {
    const k = key.trim();
    if (!k) return toast("Give the mapping a key, e.g. hero.heading", "err");
    if (!selector.trim()) return toast("Pick an element or paste a CSS selector", "err");

    const nextSelectors = { ...selectors };
    if (editingKey && editingKey !== k) delete nextSelectors[editingKey];
    nextSelectors[k] = { type, selector: selector.trim() };

    let nextContent = null;
    if (!(k in content)) {
      nextContent = { ...content, [k]: type === "toggle" ? true : initialValue };
    }

    if (await persist(nextSelectors, nextContent)) {
      toast(editingKey ? "Mapping updated" : `"${k}" is now editable in Content Studio`, "ok");
      resetForm();
    }
  }

  function editMapping(k) {
    setEditingKey(k);
    setKey(k);
    setSelector(selectors[k].selector);
    setType(selectors[k].type || "text");
    setInitialValue("");
  }

  async function removeMapping(k) {
    if (!confirm(`Remove the mapping for "${k}"? Its content value stays in Content Studio.`)) return;
    const nextSelectors = { ...selectors };
    delete nextSelectors[k];
    if (await persist(nextSelectors)) toast("Mapping removed", "ok");
  }

  return (
    <div className="map-layout">
      <div className="stagger">
        <div className="panel">
          <div className="panel-head">
            <h4>{editingKey ? `Editing “${editingKey}”` : "Create a mapping"}</h4>
            {editingKey && (
              <button className="btn btn-ghost btn-sm" onClick={resetForm}>
                <XIcon size={13} /> Cancel
              </button>
            )}
          </div>
          <div className="panel-body">
            <div className="field">
              <label>Content key</label>
              <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. hero.heading" />
            </div>
            <div className="field">
              <label>CSS selector</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ fontFamily: "var(--mono)", fontSize: 13 }}
                  value={selector}
                  onChange={(e) => setSelector(e.target.value)}
                  placeholder=".hero h1"
                />
                <button
                  className={`btn ${picking ? "btn-red" : "btn-soft"}`}
                  style={{ flexShrink: 0 }}
                  onClick={picking ? cancelPick : startPick}
                  title="Click an element in the preview"
                >
                  <CrosshairIcon size={16} />
                  {picking ? "Cancel" : "Pick"}
                </button>
              </div>
            </div>
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {!editingKey && type !== "toggle" && (
              <div className="field">
                <label>Initial value <span style={{ opacity: 0.6, textTransform: "none" }}>(optional)</span></label>
                <input
                  value={initialValue}
                  onChange={(e) => setInitialValue(e.target.value)}
                  placeholder="Filled automatically when you pick"
                />
              </div>
            )}
            <button className="btn btn-primary btn-block" onClick={saveMapping} disabled={saving}>
              {saving ? <span className="spinner" /> : (<><PlusIcon size={16} /> {editingKey ? "Update mapping" : "Add mapping"}</>)}
            </button>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 18 }}>
          <div className="panel-head">
            <h4>Existing mappings</h4>
            <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
              {Object.keys(selectors).length} total
            </span>
          </div>
          <div>
            {Object.keys(selectors).length === 0 && (
              <div className="panel-body" style={{ color: "var(--ink-soft)", fontSize: 14 }}>
                Nothing mapped yet. Use <b>Pick</b> to click any element on the site.
              </div>
            )}
            {Object.entries(selectors).map(([k, conf]) => (
              <div className="mapping-item" key={k}>
                <div className="m-top">
                  <span className="key-chip">{k}</span>
                  <span className={`type-badge t-${conf.type || "text"}`}>{conf.type || "text"}</span>
                  <span className="m-actions">
                    <button className="icon-btn" title="Edit" onClick={() => editMapping(k)}>
                      <PenIcon size={14} />
                    </button>
                    <button className="icon-btn danger" title="Remove" onClick={() => removeMapping(k)}>
                      <TrashIcon size={14} />
                    </button>
                  </span>
                </div>
                <code className="m-sel" title={conf.selector}>{conf.selector}</code>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="preview-frame-wrap anim-fade-up">
        {picking && (
          <div className="pick-banner">
            <span className="live-dot" />
            Click any element on the page below…
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-soft)" }}>Live site</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setFrameKey((k) => k + 1)}>
            <RefreshIcon size={14} /> Refresh
          </button>
        </div>
        <iframe
          key={frameKey}
          ref={iframeRef}
          title="Site preview"
          src={SITE_ORIGIN + "/"}
          style={{ height: "calc(100vh - 220px)", minHeight: 480 }}
        />
      </div>
    </div>
  );
}
