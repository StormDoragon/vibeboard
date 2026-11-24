"use client";

import { ArrowUpRight, CreditCard, LogOut, Moon, Palette, Sparkles, Sun, Timer, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Theme, Workspace } from "@/lib/workspace";

export type Account = { name: string; email: string; pro: boolean; billing: boolean };

const appearance = [
  { value: "mood", label: "Mood adaptive", icon: Sparkles },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
] as const;

export function Settings({ preferences, account, setPreferences, saving, tell, paymentReturn }: {
  preferences: Workspace["preferences"];
  account: Account | null;
  setPreferences: (change: Partial<Workspace["preferences"]>) => void;
  saving: boolean;
  tell: (message: string) => void;
  paymentReturn: boolean;
}) {
  const [billing, setBilling] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");

  async function openBilling(action: "portal" | "monthly" | "yearly") {
    setBilling(true);
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign(data.url);
    } catch (error) {
      tell(error instanceof Error ? error.message : "Couldn’t open Stripe.");
      setBilling(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.assign("/");
    } catch {
      tell("Couldn’t sign you out. Try again.");
      setSigningOut(false);
    }
  }

  return <div className="settings-grid">
    <section className="panel settings-card">
      <div className="panel-title"><span className="feature-icon"><Palette size={19} /></span><h2>Appearance</h2></div>
      <fieldset className="field"><legend>Workspace theme</legend>
        <div className="theme-options">
          {appearance.map(({ value, label, icon: Icon }) => <label className="theme-option" key={value}>
            <input name="theme" type="radio" value={value} checked={preferences.theme === value}
              onChange={(event) => setPreferences({ theme: event.target.value as Theme })} />
            <span className={`theme-swatch swatch-${value}`}><Icon size={20} /></span>
            <span>{label}</span>
          </label>)}
        </div>
      </fieldset>
    </section>
    <section className="panel settings-card">
      <div className="panel-title"><span className="feature-icon"><Timer size={19} /></span><h2>Focus preferences</h2></div>
      <label className="field"><span>Focus session length</span>
        <select value={preferences.focusMinutes} onChange={(event) => setPreferences({ focusMinutes: Number(event.target.value) })}>
          {[5, 15, 25, 45, 60, 90, 120].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}
        </select>
      </label>
      <label className="toggle-row"><span><strong>Match tasks after each check-in</strong><small>Bring tasks that fit your energy to the top.</small></span>
        <input type="checkbox" role="switch" checked={preferences.autoMatch} onChange={(event) => setPreferences({ autoMatch: event.target.checked })} />
      </label>
    </section>
    <section className="panel settings-card">
      <div className="panel-title"><span className="feature-icon"><UserRound size={19} /></span><h2>Account</h2></div>
      {account ? <><div className="account-detail"><strong>{account.name}</strong><span>{account.email}</span></div>
        <div className="settings-actions"><button type="button" className="button secondary" onClick={() => void signOut()}
          disabled={signingOut || saving}><LogOut size={16} /> {signingOut ? "Signing out…" : "Sign out"}</button></div></> :
        <><p className="hint">This guest workspace is saved in your browser. Create an account to sync across devices and share your status.</p>
          <div className="settings-actions"><Link href="/account" className="button primary">Sign in or create an account <ArrowUpRight size={16} /></Link></div></>}
    </section>
    <section className="panel settings-card">
      <div className="panel-title"><span className="feature-icon"><CreditCard size={19} /></span><h2>Plan</h2></div>
      <div className="plan-detail"><strong>VibeBoard {account?.pro ? "Pro" : "Free"}</strong>
        <span>{account?.pro ? "Your public profile is free of VibeBoard branding." : "Check-ins, soft tasks, focus sessions, and status sharing."}</span></div>
      {paymentReturn && !account?.pro && <p role="status" className="hint">Your plan will update after Stripe confirms your subscription. Refresh in a moment.</p>}
      {account?.billing && <div className="settings-actions">
        {account.pro ? <button type="button" className="button secondary" disabled={billing} onClick={() => void openBilling("portal")}>Manage subscription <ArrowUpRight size={16} /></button> :
          <>
            <p className="hint">Pro removes the VibeBoard link from your public profile.</p>
            <label className="field"><span>Billing interval</span><select value={plan} onChange={(event) => setPlan(event.target.value as "monthly" | "yearly")}>
              <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
            </select></label>
            <button type="button" className="button primary" disabled={billing} onClick={() => void openBilling(plan)}>
              {billing ? "Opening Stripe…" : "Upgrade to Pro"} <ArrowUpRight size={16} />
            </button>
          </>}
      </div>}
    </section>
  </div>;
}
