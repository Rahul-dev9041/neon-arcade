"use client";

import { useCallback, useEffect, useState } from "react";

export type AuthUser = { username: string; email: string };

async function postJson(url: string, body: unknown): Promise<{ user: AuthUser }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
  return json;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json: { user: AuthUser | null }) => {
        if (!cancelled) setUser(json.user);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signup = useCallback(async (username: string, email: string, password: string) => {
    const json = await postJson("/api/auth/signup", { username, email, password });
    setUser(json.user);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const json = await postJson("/api/auth/login", { identifier, password });
    setUser(json.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    const res = await fetch("/api/auth/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
    setUser(null);
  }, []);

  return { user, isLoading, signup, login, logout, deleteAccount };
}
