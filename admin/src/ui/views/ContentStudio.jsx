import React, { useMemo, useState } from "react";
import { api, isImageUrl } from "../../lib/api";
import { useToast } from "../Toast";
import {
  SearchIcon, PlusIcon, TrashIcon, ChevronDownIcon, ImageIcon, XIcon, FileIcon,
} from "../icons";

function groupKeys(keys) {
  const groups = {};
  keys.forEach((key) => {
    const dot = key.indexOf(".");
    const group = dot > 0 ? key.slice(0, dot) : "general";
    (groups[group] = groups[group] || []).push(key);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function MediaPickerModal({ uploads, onPick, onClose }) {
  const images = uploads.filter((u) => isImageUrl(u.url));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Choose an image</h3>
          <button className="icon-btn" onClick={onClose}><XIcon size={16} /></button>
        </div>
        <div className="modal-body">
          {images.length === 0 ? (
            <div className="empty-note">No images uploaded yet — add some in the Media Library first.</div>
          ) : (
            <div className="media-pick-grid">
              {images.map((u) => (
                <button key={u.name} onClick={() => onPick(u.url)} title={u.name}>
                  <img src={u.url} alt={u.name} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Must match the live site's gallery tabs exactly — the injector shows a photo
// only under its own category's tab (and always under "All").
const GALLERY_CATEGORIES = ["Culture", "Academics", "Campus", "Sports", "NIS @ 40"];
const GALLERY_HEIGHTS = ["tall", "medium", "short"];

function parseGallery(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function GalleryEditor({ value, onChange, onOpenPicker }) {
  const items = parseGallery(value);
  const update = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const move = (i, d) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="gallery-editor">
      {items.length === 0 && (
        <div className="empty-note" style={{ margin: 0 }}>
          No extra photos yet. They appear after the site's existing gallery photos.
        </div>
      )}
      {items.map((it, i) => (
        <div className="gallery-item" key={`${it.src}-${i}`}>
          <img src={it.src} alt="" onError={(e) => { e.target.style.opacity = 0.25; }} />
          <select value={it.category || GALLERY_CATEGORIES[0]} onChange={(e) => update(i, { category: e.target.value })}>
            {GALLERY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={it.height || "medium"} onChange={(e) => update(i, { height: e.target.value })}>
            {GALLERY_HEIGHTS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <div className="gallery-item-actions">
            <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="icon-btn" title="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className="icon-btn danger" title="Remove from gallery" onClick={() => remove(i)}>
              <TrashIcon size={14} />
            </button>
          </div>
        </div>
      ))}
      <button className="btn btn-soft btn-sm" style={{ marginTop: 8 }} onClick={onOpenPicker}>
        <PlusIcon size={14} /> Add photo from Media
      </button>
    </div>
  );
}

function ValueEditor({ type, value, onChange, onOpenPicker }) {
  if (type === "gallery") {
    return <GalleryEditor value={value} onChange={onChange} onOpenPicker={onOpenPicker} />;
  }

  if (type === "toggle") {
    const on = value === true || value === "true";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
        <button
          type="button"
          className={`switch${on ? " on" : ""}`}
          onClick={() => onChange(!on)}
          aria-label="Toggle visibility"
        />
        <span style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
          {on ? "Section is visible" : "Section is hidden"}
        </span>
      </div>
    );
  }

  if (type === "image" || isImageUrl(value)) {
    return (
      <div className="img-value">
        {value ? (
          <img className="thumb" src={value} alt="" onError={(e) => { e.target.style.opacity = 0.25; }} />
        ) : (
          <div className="thumb" style={{ display: "grid", placeItems: "center", color: "var(--ink-soft)" }}>
            <ImageIcon size={22} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <input
            type="text"
            style={{
              width: "100%", padding: "10px 13px", border: "1.5px solid var(--line)",
              borderRadius: 10, fontSize: 13.5, fontFamily: "var(--mono)", background: "#fbfcfe", outline: "none",
            }}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/uploads/photo.jpg or https://…"
          />
          <button className="btn btn-soft btn-sm" style={{ marginTop: 8 }} onClick={onOpenPicker}>
            <ImageIcon size={14} /> Pick from Media
          </button>
        </div>
      </div>
    );
  }

  const str = value == null ? "" : String(value);
  const long = str.length > 60 || str.includes("\n");
  return (
    <textarea
      rows={long ? Math.min(6, Math.ceil(str.length / 70) + 1) : 1}
      value={str}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter content…"
    />
  );
}

export default function ContentStudio({ content, setContent, selectors, uploads, onSaved }) {
  const toast = useToast();
  const [draft, setDraft] = useState(content);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [saving, setSaving] = useState(false);
  const [pickerKey, setPickerKey] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const dirtyKeys = useMemo(() => {
    const all = new Set([...Object.keys(draft), ...Object.keys(content)]);
    return [...all].filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(content[k]));
  }, [draft, content]);

  const filteredKeys = useMemo(() => {
    const keys = Object.keys(draft);
    if (!query.trim()) return keys;
    const q = query.toLowerCase();
    return keys.filter(
      (k) => k.toLowerCase().includes(q) || (typeof draft[k] === "object" ? JSON.stringify(draft[k]) : String(draft[k] ?? "")).toLowerCase().includes(q)
    );
  }, [draft, query]);

  const groups = useMemo(() => groupKeys(filteredKeys), [filteredKeys]);

  function setValue(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function removeKey(key) {
    if (!confirm(`Delete the field "${key}"? The website will fall back to its original text.`)) return;
    setDraft((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  }

  async function saveAll() {
    setSaving(true);
    try {
      await api.saveContent(draft);
      setContent(draft);
      onSaved && onSaved();
      toast(`Published ${dirtyKeys.length} change${dirtyKeys.length === 1 ? "" : "s"} to the website`, "ok");
    } catch (e) {
      toast(e.message, "err");
    } finally {
      setSaving(false);
    }
  }

  function addField() {
    const key = newKey.trim();
    if (!key) return toast("Give the field a key, e.g. hero.heading", "err");
    if (key in draft) return toast("That key already exists", "err");
    setDraft((d) => ({ ...d, [key]: newValue }));
    setShowAdd(false);
    setNewKey("");
    setNewValue("");
    toast(`Field "${key}" added — remember to save`, "info");
  }

  return (
    <div>
      <div className="toolbar">
        <div className="search-box">
          <SearchIcon size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fields or content…"
          />
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <PlusIcon size={16} /> New field
        </button>
      </div>

      {groups.length === 0 && (
        <div className="empty-note anim-fade-up">No fields match “{query}”.</div>
      )}

      <div className="stagger">
        {groups.map(([group, keys]) => {
          const isOpen = !collapsed[group];
          return (
            <div className="content-group" key={group}>
              <div
                className="content-group-head"
                onClick={() => setCollapsed((c) => ({ ...c, [group]: !c[group] }))}
              >
                <span className="g-dot" />
                <h4>{group}</h4>
                <span className="count">{keys.length}</span>
                <span className={`chev${isOpen ? " open" : ""}`}><ChevronDownIcon size={18} /></span>
              </div>
              {isOpen && (
                <div className="content-rows">
                  {keys.map((key) => {
                    const mapping = selectors[key];
                    const type = mapping?.type || (isImageUrl(draft[key]) ? "image" : null);
                    const dirty = dirtyKeys.includes(key);
                    return (
                      <div className={`content-row${dirty ? " dirty" : ""}`} key={key}>
                        <div>
                          <span className="key-chip">{key}</span>
                          <div style={{ marginTop: 8 }}>
                            <span className={`type-badge t-${type || "unmapped"}`}>
                              {type || "no mapping"}
                            </span>
                          </div>
                        </div>
                        <div className="value-editor">
                          <ValueEditor
                            type={mapping?.type}
                            value={draft[key]}
                            onChange={(v) => setValue(key, v)}
                            onOpenPicker={() => setPickerKey(key)}
                          />
                        </div>
                        <div className="row-actions">
                          <button className="icon-btn danger" title="Delete field" onClick={() => removeKey(key)}>
                            <TrashIcon size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dirtyKeys.length > 0 && (
        <div className="savebar">
          <span className="msg">
            <b>{dirtyKeys.length}</b> unsaved change{dirtyKeys.length === 1 ? "" : "s"}
          </span>
          <button className="btn btn-ghost btn-sm" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
            onClick={() => setDraft(content)}>
            Discard
          </button>
          <button className="btn btn-red btn-sm" onClick={saveAll} disabled={saving}>
            {saving ? <span className="spinner" /> : "Publish changes"}
          </button>
        </div>
      )}

      {pickerKey && (
        <MediaPickerModal
          uploads={uploads}
          onClose={() => setPickerKey(null)}
          onPick={(url) => {
            const next = selectors[pickerKey]?.type === "gallery"
              ? [...parseGallery(draft[pickerKey]), { src: url, category: GALLERY_CATEGORIES[0], height: "medium" }]
              : url;
            setValue(pickerKey, next);
            setPickerKey(null);
          }}
        />
      )}

      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>New content field</h3>
              <button className="icon-btn" onClick={() => setShowAdd(false)}><XIcon size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Key</label>
                <input
                  autoFocus
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. about.heading"
                />
              </div>
              <div className="field">
                <label>Value</label>
                <textarea
                  rows={3}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="The content to show on the site"
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", display: "flex", gap: 8, alignItems: "center" }}>
                <FileIcon size={15} />
                Use a dot to group fields — “hero.heading” appears under <b>hero</b>.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addField}><PlusIcon size={15} /> Add field</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
