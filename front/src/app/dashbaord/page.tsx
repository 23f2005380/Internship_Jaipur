"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, sessionCountFor, logoutCurrent, forceLogoutOthers, USERS } from "../../lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [count, setCount] = useState(0);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const cur = await getCurrentUser();
      if (!mounted) return;
      if (!cur) {
        router.replace("/login-singup");
        return;
      }
      setUser(cur);
      const c = await sessionCountFor(cur.id);
      setCount(c);
      setBlocked(c >= 3);
    })();
    return () => { mounted = false };
  }, [router]);

  async function handleLogout() {
    await logoutCurrent();
    router.replace("/");
  }

  async function onForceLogout() {
    if (!user) return;
    await forceLogoutOthers(user.id);
    setCount(1);
    setBlocked(false);
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-b from-white to-slate-50 dark:from-[#021018] dark:to-[#021018]">
      <div className="max-w-4xl mx-auto bg-white/90 dark:bg-black/50 rounded-2xl p-8 shadow-2xl">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-3">
            <button onClick={handleLogout} className="px-3 py-1 rounded-full border">Logout</button>
          </div>
        </header>

        <main className="mt-6">
          {!user ? (
            <p>Loading...</p>
          ) : blocked ? (
            <div className="p-6 rounded-lg bg-red-50 border border-red-200">
              <h2 className="font-semibold text-lg text-red-700">Session limit reached</h2>
              <p className="mt-2 text-sm text-red-600">Your account appears to be logged in on {count} devices. To continue, force logout other sessions.</p>
              <div className="mt-4 flex gap-3">
                <button onClick={onForceLogout} className="px-4 py-2 bg-red-600 text-white rounded-full">Force logout others</button>
                <button onClick={handleLogout} className="px-4 py-2 border rounded-full">Sign out</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-600">Welcome back, <strong>{user.name}</strong> ({user.email})</p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-white border shadow-sm">
                  <h3 className="font-semibold">Quick stats</h3>
                  <p className="text-sm mt-2">Active sessions for you: <strong>{count}</strong></p>
                </div>
                <div className="p-4 rounded-lg bg-white border shadow-sm">
                  <h3 className="font-semibold">Demo users</h3>
                  <ul className="mt-2 text-sm list-disc list-inside">
                    {USERS.map((u) => (
                      <li key={u.id}>{u.name} — {u.email}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
