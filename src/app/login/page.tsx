"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Pre-filled on purpose. Nobody types a password on stage — the demo is one
 * click from the login screen to a composed view.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@lensmaker.app");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const message =
          body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : "Login failed";
        setError(message);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Lensmaker
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          State what you care about. The model composes the screen.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 flex flex-col gap-4 rounded-xl border border-white/10 bg-[#1a1a19] p-6"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-white/35"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-white/35"
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-[#d03b3b]/40 bg-[#d03b3b]/15 px-3 py-2 text-xs text-[#e06a6a]"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-[11px] text-neutral-600">
            Demo credentials are pre-filled.
          </p>
        </form>
      </div>
    </main>
  );
}
