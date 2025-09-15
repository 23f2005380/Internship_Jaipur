"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, sessionCountFor, forceLogoutOthers, logoutCurrent } from "../../lib/auth";

export default function AuthStatus() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
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
      if (!mounted) return;
      setCount(c);
      setLoading(false);
      // redirect to dashboard if under session limit
      if (c < 3) {
        router.replace('/dashbaord');
      }
    })();
    return () => { mounted = false };
  }, [router]);

  async function onForceLogout() {
    if (!user) return;
    setActionLoading(true);
    const ok = await forceLogoutOthers(user.id);
    setActionLoading(false);
    if (ok) {
      setCount(1);
    } else {
      // optionally show an error toast
      alert('Could not force logout other sessions');
    }
  }

  async function onSignOut() {
    setActionLoading(true);
    await logoutCurrent();
    setActionLoading(false);
    router.replace("/login-singup");
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Checking sessions...</div>;

  // If more than or equal to 3 sessions, show a Netflix-like chooser
  if (count >= 3) {
    return (
      <div className="min-h-screen flex items-center justify-center auth-bg">
        <div className="max-w-3xl w-full">
          <div className="panel bright text-center">
            <h2 className="text-2xl font-bold">Multiple devices detected</h2>
            <p className="mt-2 opacity-80">Your account is currently active on {count} devices.</p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="device-card">
                <div className="device-icon">1</div>
                <div className="device-info">
                  <div className="font-semibold">This device</div>
                  <div className="text-sm opacity-80">You&apos;re using this browser</div>
                </div>
              </div>
              <div className="device-card">
                <div className="device-icon">2</div>
                <div className="device-info">
                  <div className="font-semibold">Other device</div>
                  <div className="text-sm opacity-80">Chrome on Phone</div>
                </div>
              </div>
              <div className="device-card">
                <div className="device-icon">3</div>
                <div className="device-info">
                  <div className="font-semibold">Other device</div>
                  <div className="text-sm opacity-80">Smart TV</div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <button className="btn-primary" onClick={onForceLogout} disabled={actionLoading}>{actionLoading ? 'Working...' : 'Continue here (force logout others)'}</button>
              <button className="btn-ghost" onClick={onSignOut} disabled={actionLoading}>{actionLoading ? '...' : 'Sign out'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No UI to show when under session limit; effect above handles redirect.
  return null;
}
