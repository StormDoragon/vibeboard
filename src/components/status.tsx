"use client";

import { ArrowUpRight, Check, Globe2, Link2, LockKeyhole, Radio, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { adaptiveSummary, moodDetails, usernameSchema, type Mood, type Profile, type Scene, type Vibe } from "@/lib/workspace";
import { MoodIcon, SceneImage, VibeMark } from "./ui";

type Status = {
  username: string;
  message: string;
  mood: Mood | null;
  summary: string | null;
  focusEndsAt: number | null;
};

export function StatusCard({ status, now, scene, pro = false, preview = false }: {
  status: Status;
  now: number;
  scene: Scene;
  pro?: boolean;
  preview?: boolean;
}) {
  const [clock, setClock] = useState(now);
  const { focusEndsAt } = status;
  useEffect(() => {
    setClock(Date.now());
    if (!focusEndsAt) return;
    const remaining = focusEndsAt - Date.now();
    if (remaining <= 0) return;
    const timeout = window.setTimeout(() => setClock(Date.now()), Math.min(remaining + 30, 2_147_483_647));
    return () => window.clearTimeout(timeout);
  }, [focusEndsAt]);

  return <article className="status-card">
    <div className="status-cover"><SceneImage scene={scene} /><span className="scene-shade" aria-hidden="true" /></div>
    <div className="status-card-content">
      <div className="status-avatar" aria-hidden="true">{status.username ? status.username.slice(0, 2).toUpperCase() : <Radio size={22} />}</div>
      <h2>{status.username ? `@${status.username}` : "Your status"}</h2>
      <div className="status-pills">
        {status.mood && <span className="status-pill"><MoodIcon mood={status.mood} /> {moodDetails[status.mood].label}</span>}
        {status.focusEndsAt && status.focusEndsAt > clock ? <span className="status-pill"><Timer size={15} /> In focus</span> : null}
      </div>
      {status.message && <div className="status-message">{status.message}</div>}
      {status.summary && <p>{status.summary}</p>}
      {!status.summary && !status.message && <p>{preview ? "Your next check-in will appear here." : "No vibe shared yet."}</p>}
      {!pro && <Link href="/" className="status-powered"><VibeMark /> vibeboard <ArrowUpRight size={13} /></Link>}
    </div>
  </article>;
}

const privacy = [
  { value: "private", label: "Private", description: "Only you", icon: LockKeyhole },
  { value: "unlisted", label: "Unlisted", description: "Anyone with the link", icon: Link2 },
  { value: "public", label: "Public", description: "Anyone, including search engines", icon: Globe2 },
] as const;

export function StatusSettings({ profile, vibe, scene, focusEndsAt, now, account, pro, save, tell }: {
  profile: Profile;
  vibe?: Vibe;
  scene: Scene;
  focusEndsAt: number | null;
  now: number;
  account: boolean;
  pro: boolean;
  save: (profile: Profile) => Promise<boolean>;
  tell: (message: string) => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const canShare = account && !working && profile.visibility !== "private" && profile.username;
  const url = canShare ? `/@${profile.username}` : "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const input = draft.username.trim();
    const handle = usernameSchema.safeParse(input);
    if ((!handle.success && input) || (!input && draft.visibility !== "private")) {
      setError(input ? "Use 3–24 letters, numbers, dashes, or underscores." : "Add a username to share your status.");
      return;
    }
    setWorking(true);
    const next = { ...draft, username: handle.success ? handle.data : "", message: draft.message.trim() };
    if (await save(next)) {
      setDraft(next);
      tell("Status settings saved.");
    }
    setWorking(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      tell("Couldn’t copy the link. You can open your status page and copy its address.");
    }
  }

  return <div className="status-layout">
    <section className="panel settings-card">
      <div className="panel-title"><span className="feature-icon"><Radio size={19} /></span><h2>Your profile</h2></div>
      <form className="form-stack" onSubmit={submit}>
        <label className="field"><span>Username</span><div className="handle-field"><span aria-hidden="true">@</span>
          <input value={draft.username} maxLength={24} onChange={(event) => setDraft({ ...draft, username: event.target.value })} placeholder="your-name" autoCapitalize="none" />
        </div></label>
        <label className="field"><span>Status message <small>Optional</small></span>
          <textarea rows={3} maxLength={160} value={draft.message} placeholder="What are you up to?"
            onChange={(event) => setDraft({ ...draft, message: event.target.value })} />
        </label>
        <fieldset className="field"><legend>Visibility</legend>
          <div className="privacy-options">{privacy.map(({ value, label, description, icon: Icon }) =>
            <label className="select-option" key={value}>
              <Icon size={18} /><span><strong>{label}</strong><small>{description}</small></span>
              <input type="radio" name="visibility" checked={draft.visibility === value} onChange={() => setDraft({ ...draft, visibility: value })} />
            </label>
          )}</div>
        </fieldset>
        <label className="toggle-row"><span><strong>Show focus status</strong><small>People can see when your timer is running.</small></span>
          <input type="checkbox" role="switch" checked={draft.showFocus} onChange={(event) => setDraft({ ...draft, showFocus: event.target.checked })} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="settings-actions">
          <button type="submit" className="button primary" disabled={working}>{working ? "Saving…" : "Save status"}</button>
          {!account && <Link className="text-button" href="/account">Sign in to publish <ArrowUpRight size={14} /></Link>}
          {url && <button type="button" className="button secondary" onClick={() => void copy()}>{copied ? <Check size={15} /> : <Link2 size={15} />}{copied ? "Copied" : "Copy link"}</button>}
        </div>
      </form>
    </section>
    <section className="status-preview" aria-label="Status preview">
      <div className="status-preview-heading"><h2>Preview</h2>
        {url && <Link className="text-button" href={url} target="_blank" rel="noopener noreferrer">Open page <ArrowUpRight size={14} /></Link>}
      </div>
      <StatusCard preview scene={scene} pro={pro} now={now} status={{
        username: draft.username, message: draft.message, mood: vibe?.mood ?? null,
        summary: vibe ? adaptiveSummary(vibe) : null, focusEndsAt: draft.showFocus ? focusEndsAt : null,
      }} />
      <p className="hint">Your journal and tasks stay private.</p>
    </section>
  </div>;
}
