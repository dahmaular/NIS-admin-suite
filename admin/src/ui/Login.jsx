import React, { useState } from "react";
import { api, setToken } from "../lib/api";

export default function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!password) return;
    setError("");
    setBusy(true);
    try {
      const { token } = await api.login(password);
      setToken(token);
      onLogin(token);
    } catch (err) {
      setError(err.message === "Wrong password" ? "That password isn't right — try again." : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-orb o1" />
        <div className="login-orb o2" />
        <div className="login-orb o3" />

        <div className="stagger">
          <img className="login-crest" src="/logo.png" alt="NIS crest" />
        </div>

        <div className="stagger">
          <h1>
            Norwegian<br />International School
          </h1>
          <p className="tagline">
            Your website, in your hands. Update stories, photos and school news —
            beautifully, and in minutes.
          </p>
        </div>

        <div className="login-motto stagger">
          <span>Knowledge</span>
          <span>Diligence</span>
          <span>Character</span>
        </div>
      </div>

      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mini-crest">
            <img src="/logo.png" alt="" />
          </div>
          <h2>Welcome back</h2>
          <p className="sub">Sign in to manage the school website.</p>

          <div className="field">
            <label htmlFor="pw">Admin password</label>
            <div className="control">
              <input
                id="pw"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
              />
            </div>
            {error && <div className="error">{error}</div>}
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !password}>
            {busy ? <span className="spinner" /> : "Sign in to Dashboard"}
          </button>

          <p className="sub" style={{ marginTop: 18, marginBottom: 0, fontSize: 12.5, textAlign: "center" }}>
            Port Harcourt · Rivers State · Nigeria
          </p>
        </form>
      </div>
    </div>
  );
}
