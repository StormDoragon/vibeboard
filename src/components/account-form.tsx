"use client";

import { ArrowLeft, ArrowRight, Github, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { VibeMark } from "./ui";

type AuthMode = "signin" | "signup" | "magic";

export function AccountForm({ providers, failed }: {
  providers: { magicLink: boolean; google: boolean; github: boolean };
  failed: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(failed ? "That sign-in link expired or couldn’t be verified. Try signing in again." : "");
  const [sent, setSent] = useState(false);

  useEffect(() => setReady(true), []);

  async function request(endpoint: string, body: Record<string, string>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Couldn’t sign you in. Try again.");
      if (result.url && result.redirect) {
        window.location.assign(result.url);
        return;
      }
      if (mode === "magic" || (mode === "signup" && providers.magicLink && !result.token)) setSent(true);
      else window.location.assign("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t sign you in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const callbackURL = "/";
    if (mode === "magic") void request("sign-in/magic-link", { email, callbackURL, errorCallbackURL: "/account?error=magic" });
    else if (mode === "signup") void request("sign-up/email", { email, name: name.trim(), password, callbackURL });
    else void request("sign-in/email", { email, password, callbackURL });
  }

  function choose(next: AuthMode) {
    setMode(next);
    setError("");
    setSent(false);
  }

  return (
    <main className="account-page">
      <div className="account-background" aria-hidden="true" />
      <header><Link href="/" className="button focus-ghost"><ArrowLeft size={16} /> Back to workspace</Link></header>
      <section className="account-form-panel">
        <Link href="/" className="wordmark account-wordmark"><VibeMark /><span>vibeboard<span>.</span></span></Link>
        <h1>{sent ? "Check your inbox." : mode === "signup" ? "Make it yours." : "Welcome back."}</h1>
        {sent ? <><p>We sent a link to <strong>{email}</strong>. Open it to continue to your workspace.</p>
          <button type="button" className="button subtle" onClick={() => choose("signin")}>Back to sign in</button></> :
          <>
            <p>{mode === "signup" ? "Create a personal workspace that travels with you." : mode === "magic" ? "We’ll email you a link to sign in." : "Sign in to your personal workspace."}</p>
            <form method="post" onSubmit={submit}>
              <fieldset className="form-stack" disabled={!ready || busy}>
                {mode === "signup" && <label className="field"><span>Name</span><input autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>}
                <label className="field"><span>Email</span><input type="email" autoComplete="email" required value={email}
                  onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
                {mode !== "magic" && <label className="field"><span>Password</span><input type="password" required minLength={8}
                  maxLength={128} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password}
                  onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : undefined} /></label>}
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="button primary" type="submit" disabled={busy || (mode === "signup" && !name.trim())}>
                  {busy ? "One moment…" : mode === "signup" ? "Create account" : mode === "magic" ? "Send sign-in link" : "Sign in"} <ArrowRight size={16} />
                </button>
              </fieldset>
            </form>
            {(providers.magicLink || providers.github || providers.google) && <div className="account-providers">
              {providers.magicLink && mode !== "magic" && <button type="button" className="button secondary" disabled={!ready || busy} onClick={() => choose("magic")}><Mail size={17} /> Use a sign-in link</button>}
              {providers.google && <button type="button" className="button secondary" disabled={!ready || busy}
                onClick={() => void request("sign-in/social", { provider: "google", callbackURL: "/", errorCallbackURL: "/account?error=google" })}>Continue with Google</button>}
              {providers.github && <button type="button" className="button secondary" disabled={!ready || busy}
                onClick={() => void request("sign-in/social", { provider: "github", callbackURL: "/", errorCallbackURL: "/account?error=github" })}><Github size={17} /> Continue with GitHub</button>}
            </div>}
            <div className="account-switch">
              {mode === "signin" && <span>New to VibeBoard?</span>}
              <button type="button" className="text-button" disabled={!ready || busy} onClick={() => choose(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Create an account" : "Back to sign in"}
              </button>
            </div>
          </>}
      </section>
    </main>
  );
}
