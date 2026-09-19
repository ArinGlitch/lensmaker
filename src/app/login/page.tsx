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
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ink-4)]">
          Lensmaker
        </p>
        <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
          State what you care about.
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-3)]">
          The model composes the screen. You never touch a filter.
        </p>

        <form
          onSubmit={handleSubmit}
          className="relative mt-8 flex flex-col gap-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ink-4)]">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="rounded-lg border border-[var(--line-strong)] bg-[#0b0b0e] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ink-4)]">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="rounded-lg border border-[var(--line-strong)] bg-[#0b0b0e] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-[#d03b3b]/35 bg-[#d03b3b]/10 px-3 py-2 text-[12px] text-[#e06a6a]"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-[13px] font-semibold text-[#08080a] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-[11px] text-[var(--ink-4)]">
            Demo credentials are pre-filled — one click to sign in.
          </p>
        </form>
      </div>
    </main>
  );
}
