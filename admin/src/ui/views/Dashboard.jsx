import React from "react";
import { formatDate, isImageUrl, SITE_ORIGIN } from "../../lib/api";
import {
  PenIcon, ImageIcon, TargetIcon, EyeIcon, LayersIcon, FileIcon, SparkleIcon, LinkIcon,
} from "../icons";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard({ content, selectors, uploads, onNavigate }) {
  const contentCount = Object.keys(content).length;
  const mappingCount = Object.keys(selectors).length;
  const mediaCount = uploads.length;
  const imageValues = Object.values(content).filter(isImageUrl).length;
  const recentImages = uploads.filter((u) => isImageUrl(u.url)).slice(0, 10);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const quickActions = [
    {
      icon: <PenIcon />, title: "Edit content",
      desc: "Update headings, contact details and every text on the site.",
      view: "content",
    },
    {
      icon: <ImageIcon />, title: "Manage media",
      desc: "Upload new photos, replace old ones, keep the gallery fresh.",
      view: "media",
    },
    {
      icon: <TargetIcon />, title: "Map an element",
      desc: "Point and click any part of the site to make it editable.",
      view: "mappings",
    },
    {
      icon: <EyeIcon />, title: "Preview the site",
      desc: "See exactly what parents and students see, on any device.",
      view: "preview",
    },
  ];

  return (
    <div>
      <div className="hero-banner anim-fade-up">
        <p className="eyebrow">{today}</p>
        <h2>{greeting()}, Admin 👋</h2>
        <p>
          Everything on norwegianinternationalschools.com is at your fingertips.
          Change a headline, swap a photo, publish in seconds — no code needed.
        </p>
        <div className="hero-cta">
          <button className="btn btn-white" onClick={() => onNavigate("content")}>
            <PenIcon size={16} /> Start editing
          </button>
          <a className="btn btn-outline" href={SITE_ORIGIN + "/"} target="_blank" rel="noreferrer">
            <EyeIcon size={16} /> View live site
          </a>
        </div>
      </div>

      <div className="stat-grid stagger">
        <div className="stat-card">
          <div className="stat-icon i-indigo"><FileIcon /></div>
          <div>
            <div className="num">{contentCount}</div>
            <div className="lbl">Content fields</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon i-red"><LayersIcon /></div>
          <div>
            <div className="num">{mappingCount}</div>
            <div className="lbl">Mapped elements</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon i-sky"><ImageIcon /></div>
          <div>
            <div className="num">{mediaCount}</div>
            <div className="lbl">Media files</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon i-ok"><LinkIcon /></div>
          <div>
            <div className="num">{imageValues}</div>
            <div className="lbl">Images in use</div>
          </div>
        </div>
      </div>

      <div className="section-title">
        <h3>Quick actions</h3>
        <span>Jump straight into the work</span>
      </div>
      <div className="quick-grid stagger">
        {quickActions.map((qa) => (
          <button key={qa.view} className="quick-card" onClick={() => onNavigate(qa.view)}>
            <div className="qc-icon">{qa.icon}</div>
            <h4>{qa.title}</h4>
            <p>{qa.desc}</p>
          </button>
        ))}
      </div>

      <div className="section-title">
        <h3>Recent uploads</h3>
        {recentImages.length > 0 && <span>Latest first</span>}
      </div>
      {recentImages.length === 0 ? (
        <div className="empty-note anim-fade-up">
          <SparkleIcon style={{ verticalAlign: "-4px", marginRight: 8 }} size={17} />
          No photos yet — head to <b>Media Library</b> to upload your first one.
        </div>
      ) : (
        <div className="recent-strip">
          {recentImages.map((u) => (
            <img
              key={u.name}
              className="recent-thumb"
              src={u.url}
              alt={u.name}
              title={`${u.name} · ${formatDate(u.mtime)}`}
              loading="lazy"
            />
          ))}
        </div>
      )}
    </div>
  );
}
