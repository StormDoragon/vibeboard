"use client";

import { CloudMoon, Flame, Leaf, Sun, Waves, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import type { Energy, Mood, Scene } from "@/lib/workspace";

export function VibeMark({ size = "normal" }: { size?: "normal" | "large" }) {
  return <span className={`vibe-mark ${size === "large" ? "vibe-mark-large" : ""}`} aria-hidden="true">
    <i /><i /><i /><i /><i />
  </span>;
}

const moodIcons = { drained: CloudMoon, calm: Leaf, steady: Sun, energized: Flame, restless: Waves };

export function MoodIcon({ mood, size = 16 }: { mood: Mood; size?: number }) {
  const Icon = moodIcons[mood];
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}

const heights = [6, 12, 10, 18, 13, 25, 18, 30, 22, 34, 25, 40, 28, 19, 33, 22, 27, 16, 24, 15, 12, 19, 10, 14, 7];

export function Waveform({ playing = false }: { playing?: boolean }) {
  return <span className={`waveform${playing ? " playing" : ""}`} aria-hidden="true">
    {heights.map((height, index) => (
      <i key={index} style={{ height: `${height}px`, animationDelay: `${index * -0.115}s` }} />
    ))}
  </span>;
}

export function SceneImage({ scene, className = "" }: { scene: Scene; className?: string }) {
  return <span className={`scene-image scene-${scene} ${className}`} aria-hidden="true" />;
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog ref={ref} aria-labelledby={titleId} className="dialog" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button>
      </div>
      {children}
    </dialog>
  );
}

export function EnergyTag({ energy }: { energy: Energy }) {
  const labels = { low: "Low", medium: "Medium", high: "High" };
  return <span className={`energy-tag energy-${energy}`}><i />{labels[energy]}</span>;
}
