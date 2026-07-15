"use client";

import { useState } from "react";
import type { AuthUser } from "@/lib/useAuth";

/**
 * Replaces the old wallet rail: email/password/username accounts. Passwords
 * are only ever sent to our own API, which stores a scrypt hash in Redis.
 */
export function AuthPanel({
  user,
  isLoading,
  onSignup,
  onLogin,
  onLogout,
}: {
  user: AuthUser | null;
  isLoading: boolean;
  onSignup: (username: string, email: string, password: string) => Promise<void>;
  onLogin: (identifier: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await onSignup(username.trim(), email.trim(), password);
      } else {
        await onLogin(identifier.trim(), password);
      }
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    borderColor: "var(--glass-border)",
    color: "var(--ink)",
  } as const;
  const inputClass = "bg-transparent border rounded-md px-3 py-2 text-sm outline-none w-full";

  if (isLoading) {
    return (
      <div className="glass-panel neon-border-cyan p-5">
        <span className="terminal-label">Player</span>
        <p className="text-xs mt-2" style={{ color: "var(--ink-dim)" }}>
          loading…
        </p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="glass-panel neon-border-cyan p-5 flex flex-col gap-3">
        <span className="terminal-label">Player</span>
        <p className="text-sm">
          signed in as <span className="neon-text-green font-bold">{user.username}</span>
        </p>
        <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
          your best run each day lands on the leaderboard · top 3 gets a celebration
        </p>
        <button type="button" className="btn-ghost text-xs self-start" onClick={onLogout}>
          sign out
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel neon-border-cyan p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="terminal-label">{mode === "login" ? "Sign In" : "Create Account"}</span>
        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "need an account?" : "have an account?"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {mode === "signup" ? (
          <>
            <input
              type="text"
              value={username}
              placeholder="username"
              maxLength={20}
              autoComplete="username"
              required
              className={inputClass}
              style={inputStyle}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="email"
              value={email}
              placeholder="email"
              autoComplete="email"
              required
              className={inputClass}
              style={inputStyle}
              onChange={(e) => setEmail(e.target.value)}
            />
          </>
        ) : (
          <input
            type="text"
            value={identifier}
            placeholder="username or email"
            autoComplete="username"
            required
            className={inputClass}
            style={inputStyle}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        )}
        <input
          type="password"
          value={password}
          placeholder={mode === "signup" ? "password (8+ characters)" : "password"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
          className={inputClass}
          style={inputStyle}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="btn-neon mt-1" disabled={busy}>
          {busy ? "…" : mode === "login" ? "Sign In" : "Sign Up & Play"}
        </button>
      </form>

      {error && (
        <p className="text-xs" style={{ color: "#ff5ea8" }}>
          {error}
        </p>
      )}
      <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
        free forever · your username shows on the daily leaderboard
      </p>
    </div>
  );
}
