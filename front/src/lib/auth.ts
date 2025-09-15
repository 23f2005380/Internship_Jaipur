"use client";

type User = {
  id: string;
  email: string;
  name: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "demo_token";

function getToken(): string | null {
  return typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null;
}

function setToken(t: string) {
  sessionStorage.setItem(TOKEN_KEY, t);
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}
export async function loginWithAuth0(accessToken: string): Promise<{ ok: boolean; message?: string; user?: User }> {
  try {
    const res = await fetch(`${API}/login_with_auth0`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: accessToken }) });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, message: txt || "Auth0 login failed" };
    }
    const d = await res.json();
    setToken(d.token);
    return { ok: true, user: d.user };
  } catch {
    return { ok: false, message: "Network error" };
  }
}

export function setCurrentUserLocally(u: User) {
  try { sessionStorage.setItem('demo_user', JSON.stringify(u)); } catch {}
}

export function getCurrentUserLocal(): User | null {
  try { const raw = sessionStorage.getItem('demo_user'); return raw ? JSON.parse(raw) : null; } catch { return null }
}

export async function logoutCurrent() {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API}/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    } catch {
      // ignore network errors
    }
  }
  // Clear local session storage
  clearToken();
  try { sessionStorage.removeItem('demo_user'); } catch {}

  // Also redirect to Auth0 logout endpoint to clear the Auth0 session so subsequent sign-ins require re-authentication
  try {
    const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN || '';
    const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || '';
    const returnTo = window.location.origin;
    if (domain && clientId) {
      const logoutUrl = `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${encodeURIComponent(returnTo)}`;
      // small delay so the local cleanup completes
      setTimeout(() => { window.location.href = logoutUrl }, 200);
    }
  } catch {}
}

export async function forceLogoutOthers(userId: string) {
  try {
    const res = await fetch(`${API}/force_logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId }) });
    if (!res.ok) return false;
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  // Prefer the locally-stored user if present
  try {
    const raw = sessionStorage.getItem('demo_user');
    if (raw) return JSON.parse(raw) as User;
  } catch {}
  try {
    const token = getToken();
    if (!token) return null;
    // Find user by checking sessions
    const usersRes = await fetch(`${API}/users`);
    if (!usersRes.ok) return null;
    const users = await usersRes.json();
    for (const u of users) {
      const s = await fetch(`${API}/sessions/${u.id}`);
      if (!s.ok) continue;
      const sd = await s.json();
      if (sd.tokens && sd.tokens.includes(token)) {
        try { sessionStorage.setItem('demo_user', JSON.stringify(u)); } catch {}
        return u as User;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function sessionCountFor(userId: string) {
  try {
    const res = await fetch(`${API}/sessions/${userId}`);
    if (!res.ok) return 0;
    const d = await res.json();
    return d.count || 0;
  } catch {
    return 0;
  }
}

export const USERS: User[] = [];
