"use client";

import { ArrowUpRight, AudioLines, Mic, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { checkInSchema, moodDetails, moods, type CheckIn, type Mood, type Vibe } from "@/lib/workspace";
import { Dialog, MoodIcon } from "./ui";

function MoodOptions({ value, select }: { value: Mood; select: (mood: Mood) => void }) {
  return <div className="mood-options" role="group" aria-label="Mood">
    {moods.map((mood) => (
      <button type="button" className="mood-option" aria-pressed={value === mood} key={mood} onClick={() => select(mood)}>
        <MoodIcon mood={mood} /> {moodDetails[mood].label}
      </button>
    ))}
  </div>;
}

export function CheckInCard({ vibe, onOpen }: { vibe: Vibe | undefined; onOpen: (mood: Mood) => void }) {
  const [draft, setDraft] = useState<Mood | null>(null);
  const mood = draft ?? vibe?.mood ?? "steady";

  return (
    <section className="check-in-card" aria-labelledby="check-in-heading">
      <div className="check-in-content">
        <span className="eyebrow hero-eyebrow"><Sparkles size={15} /> Vibe check</span>
        <h2 id="check-in-heading">How are you feeling?</h2>
        <p>{vibe?.summary ?? "Choose a mood and let your workspace shift with you."}</p>
        <MoodOptions value={mood} select={setDraft} />
        <button type="button" className="button primary hero-action" onClick={() => { onOpen(mood); setDraft(null); }}>
          Check in <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="current-vibe">
        <span className="current-vibe-icon"><MoodIcon mood={vibe?.mood ?? "steady"} size={18} /></span>
        <span><small>Current vibe</small><strong>{vibe ? moodDetails[vibe.mood].label : "Steady"}</strong></span>
      </div>
    </section>
  );
}

type Recognition = {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

function defaultCheckIn(mood: Mood): CheckIn {
  return { mood, energy: moodDetails[mood].energy, intensity: moodDetails[mood].intensity, note: "" };
}

export function CheckInDialog({ mood, canTranscribe, aiEnabled, error, onSave, onClose }: {
  mood: Mood;
  canTranscribe: boolean;
  aiEnabled: boolean;
  error?: string;
  onSave: (checkIn: CheckIn) => Promise<boolean>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CheckIn>(() => defaultCheckIn(mood));
  const [saving, setSaving] = useState(false);
  const [voice, setVoice] = useState<"idle" | "listening" | "recording" | "transcribing">("idle");
  const [fallback, setFallback] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const active = useRef(false);
  const recordingTimer = useRef<number | null>(null);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (recognition.current) {
        recognition.current.onend = recognition.current.onresult = recognition.current.onerror = null;
        recognition.current.abort();
        recognition.current = null;
      }
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.stream.getTracks().forEach((track) => track.stop());
      }
      if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current);
    };
  }, []);

  function append(text: string) {
    setDraft((previous) => ({ ...previous, note: `${previous.note.trim()} ${text.trim()}`.trim().slice(0, 800) }));
  }

  async function record() {
    if (!canTranscribe || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError("Voice entry is unavailable in this browser. You can type your note.");
      return;
    }
    let stream: MediaStream | undefined;
    try {
      setVoice("listening");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const chunks: Blob[] = [];
      const capture = new MediaRecorder(stream);
      recorder.current = capture;
      capture.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
      capture.onstop = async () => {
        capture.stream.getTracks().forEach((track) => track.stop());
        recorder.current = null;
        if (recordingTimer.current !== null) window.clearTimeout(recordingTimer.current);
        if (!active.current) return;
        setVoice("transcribing");
        const type = capture.mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const body = new FormData();
        body.set("audio", new Blob(chunks, { type }), `note.${extension}`);
        try {
          const response = await fetch("/api/transcribe", { method: "POST", body });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          if (active.current && typeof data.text === "string") append(data.text);
        } catch {
          if (active.current) setVoiceError("Couldn’t transcribe this recording. You can type your note.");
        } finally {
          if (active.current) setVoice("idle");
        }
      };
      capture.start();
      setVoice("recording");
      recordingTimer.current = window.setTimeout(() => {
        if (capture.state === "recording") capture.stop();
      }, 30_000);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (active.current) {
        setVoice("idle");
        setVoiceError("Couldn’t access the microphone. Check your browser permissions.");
      }
    }
  }

  async function voiceInput() {
    setVoiceError("");
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
      return;
    }
    if (recognition.current) {
      recognition.current.stop();
      return;
    }
    const browser = window as SpeechWindow;
    const Speech = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Speech || fallback) {
      await record();
      return;
    }
    const listen = new Speech();
    listen.lang = document.documentElement.lang || "en";
    listen.onresult = ({ results }) => append(Array.from(results).map((result) => result[0].transcript).join(" "));
    listen.onerror = ({ error }) => {
      if (error === "aborted") return;
      if (canTranscribe && error !== "not-allowed") {
        setFallback(true);
        setVoiceError("Browser dictation is unavailable. Try recording a note instead.");
      } else {
        setVoiceError(error === "not-allowed" ? "Microphone access was declined." : "Couldn’t hear a note. Try again or type it.");
      }
    };
    listen.onend = () => {
      recognition.current = null;
      if (active.current) setVoice("idle");
    };
    try {
      listen.start();
      recognition.current = listen;
      setVoice("listening");
    } catch {
      if (canTranscribe) setFallback(true);
      setVoiceError("Couldn’t start dictation. Try again or type your note.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || voice !== "idle") return;
    setSaving(true);
    const result = await onSave(checkInSchema.parse(draft));
    if (result) onClose();
    else setSaving(false);
  }

  return (
    <Dialog title="Check in with yourself" onClose={() => { if (!saving) onClose(); }}>
      <form className="form-stack" onSubmit={submit}>
        <MoodOptions value={draft.mood} select={(value) => setDraft({ ...defaultCheckIn(value), note: draft.note })} />
        <div className="axes">
          <label className="axis">
            <span><strong>Energy</strong><output>{draft.energy} / 5</output></span>
            <input type="range" min="1" max="5" value={draft.energy} onChange={(event) => setDraft({ ...draft, energy: Number(event.target.value) })} />
            <span className="axis-ends"><span>Low</span><span>High</span></span>
          </label>
          <label className="axis">
            <span><strong>Intensity</strong><output>{draft.intensity} / 5</output></span>
            <input type="range" min="1" max="5" value={draft.intensity} onChange={(event) => setDraft({ ...draft, intensity: Number(event.target.value) })} />
            <span className="axis-ends"><span>Calm</span><span>Intense</span></span>
          </label>
        </div>
        <label className="field"><span>What’s on your mind? <small>Optional</small></span>
          <textarea rows={4} maxLength={800} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="A few words about where you’re at…" />
        </label>
        <div className="voice-tools">
          <button className="button subtle" type="button" disabled={voice === "transcribing" || saving}
            onClick={() => void voiceInput()}>
            {voice === "recording" || voice === "listening" ? <Square size={14} /> : <Mic size={15} />}
            {voice === "transcribing" ? "Transcribing…" : voice === "idle" ? (fallback ? "Record a note" : "Dictate note") : "Stop listening"}
          </button>
          {voiceError && <span role="status" className="hint">{voiceError}</span>}
        </div>
        <p className="hint">{aiEnabled ? "Your journal stays off your public profile. An AI provider processes this check-in." : "Your journal stays in your workspace."}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button subtle" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="button primary" disabled={saving || voice !== "idle"}>
            <AudioLines size={16} />{saving ? "Tuning your workspace…" : "Save check-in"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
