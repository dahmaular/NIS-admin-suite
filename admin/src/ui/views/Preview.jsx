import React, { useState } from "react";
import { SITE_ORIGIN } from "../../lib/api";
import { MonitorIcon, TabletIcon, PhoneIcon, RefreshIcon, ExternalIcon } from "../icons";

const DEVICES = [
  { id: "desktop", label: "Desktop", icon: <MonitorIcon size={15} />, width: "100%" },
  { id: "tablet", label: "Tablet", icon: <TabletIcon size={15} />, width: "820px" },
  { id: "mobile", label: "Mobile", icon: <PhoneIcon size={15} />, width: "400px" },
];

export default function Preview() {
  const [device, setDevice] = useState("desktop");
  const [frameKey, setFrameKey] = useState(0);
  const active = DEVICES.find((d) => d.id === device);

  return (
    <div>
      <div className="toolbar anim-fade-up" style={{ justifyContent: "space-between" }}>
        <div className="device-toggle">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              className={device === d.id ? "active" : ""}
              onClick={() => setDevice(d.id)}
            >
              {d.icon} {d.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setFrameKey((k) => k + 1)}>
            <RefreshIcon size={14} /> Refresh
          </button>
          <a className="btn btn-primary btn-sm" href={SITE_ORIGIN + "/"} target="_blank" rel="noreferrer">
            <ExternalIcon size={14} /> Open in new tab
          </a>
        </div>
      </div>

      <div className="preview-stage anim-fade-up">
        <div className="preview-device" style={{ maxWidth: active.width }}>
          <iframe
            key={frameKey}
            title="Site preview"
            src={SITE_ORIGIN + "/"}
            style={{ height: "calc(100vh - 240px)", minHeight: 520 }}
          />
        </div>
      </div>
    </div>
  );
}
