import React, { useRef, useState } from "react";
import { api, formatBytes, formatDate, isImageUrl } from "../../lib/api";
import { useToast } from "../Toast";
import { UploadIcon, CopyIcon, TrashIcon, FileIcon, EyeIcon, XIcon } from "../icons";

// "1712_photo.jpg" or Cloudinary "nis-admin/photo_ab12" -> "photo.jpg" / "photo_ab12"
const displayName = (name) => name.split("/").pop().replace(/^\d+_/, "");

export default function MediaLibrary({ uploads, refreshUploads }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(null); // { done, total }
  const [lightbox, setLightbox] = useState(null);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading({ done: 0, total: files.length });
    let ok = 0;
    for (const file of files) {
      try {
        await api.upload(file);
        ok++;
      } catch (e) {
        toast(`${file.name}: ${e.message}`, "err");
      }
      setUploading((u) => u && { ...u, done: u.done + 1 });
    }
    setUploading(null);
    if (ok) toast(`Uploaded ${ok} file${ok === 1 ? "" : "s"}`, "ok");
    refreshUploads();
  }

  async function copyUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      toast("URL copied to clipboard", "info");
    } catch {
      toast(url, "info");
    }
  }

  async function remove(file) {
    if (!confirm(`Delete "${file.name}"? Pages using it will show a broken image.`)) return;
    try {
      await api.deleteUpload(file.name);
      toast("File deleted", "ok");
      refreshUploads();
    } catch (e) {
      toast(e.message, "err");
    }
  }

  return (
    <div>
      <div
        className={`dropzone anim-fade-up${dragOver ? " over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <div className="dz-icon"><UploadIcon size={26} /></div>
        <h4>{dragOver ? "Drop to upload!" : "Drag & drop photos here"}</h4>
        <p>or click to browse — JPG, PNG, WebP, SVG…</p>
        {uploading && (
          <div className="upload-progress">
            <div className="bar" style={{ width: `${(uploading.done / uploading.total) * 100}%` }} />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          hidden
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {uploads.length === 0 ? (
        <div className="empty-note anim-fade-up">
          The library is empty. Upload the school's photos above and use them anywhere on the site.
        </div>
      ) : (
        <div className="media-grid stagger">
          {uploads.map((file) => (
            <div className="media-card" key={file.name}>
              <div className="media-frame">
                {isImageUrl(file.url) ? (
                  <img src={file.url} alt={file.name} loading="lazy" />
                ) : (
                  <div className="file-generic"><FileIcon size={38} /></div>
                )}
                <div className="media-overlay">
                  {isImageUrl(file.url) && (
                    <button className="icon-btn" title="Preview" onClick={() => setLightbox(file)}>
                      <EyeIcon size={16} />
                    </button>
                  )}
                  <button className="icon-btn" title="Copy URL" onClick={() => copyUrl(file.url)}>
                    <CopyIcon size={16} />
                  </button>
                  <button className="icon-btn danger" title="Delete" onClick={() => remove(file)}>
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
              <div className="media-meta">
                <div className="fname" title={file.name}>{displayName(file.name)}</div>
                <div className="finfo">{formatBytes(file.size)} · {formatDate(file.mtime)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="modal-backdrop" onClick={() => setLightbox(null)}>
          <div className="modal" style={{ width: "min(860px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{ fontSize: 15, fontFamily: "var(--mono)" }}>{displayName(lightbox.name)}</h3>
              <button className="icon-btn" onClick={() => setLightbox(null)}><XIcon size={16} /></button>
            </div>
            <div className="modal-body">
              <img
                src={lightbox.url}
                alt={lightbox.name}
                style={{ width: "100%", borderRadius: 12, border: "1px solid var(--line)" }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button className="btn btn-primary btn-sm" onClick={() => copyUrl(lightbox.url)}>
                  <CopyIcon size={14} /> Copy URL
                </button>
                <span style={{ fontSize: 13, color: "var(--ink-soft)", alignSelf: "center" }}>
                  {formatBytes(lightbox.size)} · {formatDate(lightbox.mtime)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
