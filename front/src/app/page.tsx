"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  // Immediately redirect to auth flow (we removed the 'Get started' landing)
  useEffect(() => {
    router.replace("/login-singup");
  }, [router]);

  return <div className="min-h-screen" />;
}
