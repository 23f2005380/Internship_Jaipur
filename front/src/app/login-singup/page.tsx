"use client";

import { useCallback } from "react";

export default function AuthPage() {
  const goAuth0 = useCallback(() => {
    const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN || 'dev-vvpprnrqxtn7bxnb.jp.auth0.com';
    const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || '';
    const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE || 'https://dev-vvpprnrqxtn7bxnb.jp.auth0.com/api/v2/';
    const redirect = `${window.location.origin}/auth0/callback`;
    const url = `https://${domain}/authorize?response_type=token&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&scope=openid%20profile%20email&audience=${encodeURIComponent(audience)}`;
    window.location.href = url;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 auth-bg">
      <div className="max-w-md w-full animate-rise">
        <div className="panel bright text-center">
          <div className="logo-badge mx-auto mb-4">A</div>
          <h2 className="text-2xl font-bold mb-2">Sign in</h2>
          <p className="text-sm opacity-80 mb-4">Continue with your Auth0 provider</p>
          <div>
            <button type="button" className="btn-auth0" onClick={goAuth0}>Sign in with Auth0</button>
          </div>
        </div>
      </div>
    </div>
  );
}

