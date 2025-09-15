"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginWithAuth0 } from "../../../lib/auth";

export default function Auth0Callback() {
  const router = useRouter();

  useEffect(() => {
    // The access_token will be in the URL hash (fragment) after Auth0 redirect
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    if (!accessToken) {
      // no token — go back to login
      router.replace('/login-singup');
      return;
    }

    (async () => {
      const res = await loginWithAuth0(accessToken);
      if (res.ok && res.user) {
        try { sessionStorage.setItem('demo_user', JSON.stringify(res.user)); } catch {}
        router.replace('/auth-status');
      } else {
        alert(res.message || 'Auth0 login failed');
        router.replace('/login-singup');
      }
    })();
  }, [router]);

  return <div className="min-h-screen flex items-center justify-center">Finishing Auth0 sign-in...</div>;
}
