import React, { useCallback, useEffect, useState } from "react";
import { api, getToken, setToken, SITE_ORIGIN } from "../lib/api";
import { ToastProvider } from "./Toast";
import Login from "./Login";
import Dashboard from "./views/Dashboard";
import ContentStudio from "./views/ContentStudio";
import MediaLibrary from "./views/MediaLibrary";
import Mappings from "./views/Mappings";
import Preview from "./views/Preview";
import {
  HomeIcon, PenIcon, ImageIcon, TargetIcon, EyeIcon, LogoutIcon, ExternalIcon,
} from "./icons";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: <HomeIcon size={19} />, group: "Overview" },
  { id: "content", label: "Content Studio", icon: <PenIcon size={19} />, group: "Manage" },
  { id: "media", label: "Media Library", icon: <ImageIcon size={19} />, group: "Manage" },
  { id: "mappings", label: "Element Mappings", icon: <TargetIcon size={19} />, group: "Manage" },
  { id: "preview", label: "Live Preview", icon: <EyeIcon size={19} />, group: "Site" },
];

const TITLES = {
  dashboard: ["Overview", "Dashboard"],
  content: ["Manage", "Content Studio"],
  media: ["Manage", "Media Library"],
  mappings: ["Manage", "Element Mappings"],
  preview: ["Site", "Live Preview"],
};

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}

function Root() {
  const [token, setTok] = useState(getToken());
  const [checking, setChecking] = useState(!!getToken());
  const [view, setView] = useState("dashboard");

  const [content, setContent] = useState({});
  const [selectors, setSelectors] = useState({});
  const [uploads, setUploads] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refreshUploads = useCallback(() => {
    api.listUploads().then(setUploads).catch(() => {});
  }, []);

  // restore session
  useEffect(() => {
    if (!getToken()) return;
    api.verify()
      .then(() => setChecking(false))
      .catch(() => { setToken(""); setTok(""); setChecking(false); });
  }, []);

  // react to 401s anywhere
  useEffect(() => {
    const onLogout = () => setTok("");
    window.addEventListener("nis:logout", onLogout);
    return () => window.removeEventListener("nis:logout", onLogout);
  }, []);

  // load data after login
  useEffect(() => {
    if (!token || checking) return;
    Promise.all([api.getContent(), api.getSelectors(), api.listUploads().catch(() => [])])
      .then(([c, s, u]) => {
        setContent(c);
        setSelectors(s);
        setUploads(u);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [token, checking]);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--mist)" }}>
        <span className="spinner dark" style={{ width: 30, height: 30 }} />
      </div>
    );
  }

  if (!token) {
    return <Login onLogin={(t) => { setTok(t); setChecking(false); }} />;
  }

  function logout() {
    setToken("");
    setTok("");
    setLoaded(false);
  }

  const [crumb, title] = TITLES[view];
  let groupShown = null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="NIS" style={{ borderRadius: 12 }} />
          <div>
            <div className="t1">NIS Admin</div>
            <div className="t2">Port Harcourt</div>
          </div>
        </div>

        <nav>
          {NAV.map((item) => {
            const label = item.group !== groupShown ? (
              <div className="nav-group-label" key={`g-${item.group}`}>{item.group}</div>
            ) : null;
            groupShown = item.group;
            return (
              <React.Fragment key={item.id}>
                {label}
                <button
                  className={`nav-item${view === item.id ? " active" : ""}`}
                  onClick={() => setView(item.id)}
                >
                  {item.icon}
                  {item.label}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <a
            className="nav-item"
            href={SITE_ORIGIN + "/"}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none", marginBottom: 10 }}
          >
            <ExternalIcon size={18} />
            Visit website
          </a>
          <div className="sidebar-user">
            <div className="avatar">A</div>
            <div>
              <div className="name">Administrator</div>
              <div className="role">Content manager</div>
            </div>
            <button className="logout" title="Sign out" onClick={logout}>
              <LogoutIcon size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumbs">
            {crumb} <b>{title}</b>
          </div>
          <div className="topbar-actions">
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}>
              <span className="live-dot" /> Site live
            </span>
          </div>
        </header>

        <main className="view" key={view}>
          {!loaded ? (
            <div className="stagger">
              <div className="skeleton" style={{ height: 160, borderRadius: 22 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 20 }}>
                {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 86 }} />)}
              </div>
            </div>
          ) : (
            <>
              {view === "dashboard" && (
                <Dashboard content={content} selectors={selectors} uploads={uploads} onNavigate={setView} />
              )}
              {view === "content" && (
                <ContentStudio
                  content={content}
                  setContent={setContent}
                  selectors={selectors}
                  uploads={uploads}
                />
              )}
              {view === "media" && (
                <MediaLibrary uploads={uploads} refreshUploads={refreshUploads} />
              )}
              {view === "mappings" && (
                <Mappings
                  selectors={selectors}
                  setSelectors={setSelectors}
                  content={content}
                  setContent={setContent}
                />
              )}
              {view === "preview" && <Preview />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
